import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import sharp from "sharp";

/**
 * OCR local (Tesseract) : gratuit, aucune donnée envoyée à un service tiers.
 * Le premier appel télécharge le modèle français (~1,5 Mo), les suivants sont
 * servis depuis .cache/tesseract.
 */

let workerPromise: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getCachePath(): string {
  // /tmp sur les hébergements cloud, dossier temporaire Windows en local.
  const cachePath =
    process.env.OCR_CACHE_DIR || path.join(os.tmpdir(), "caissette-tesseract");
  fs.mkdirSync(cachePath, { recursive: true });
  return cachePath;
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("fra", OEM.LSTM_ONLY, {
      cachePath: getCachePath(),
    })
      .then(async (worker) => {
        await worker.setParameters({
          // PSM 6 (bloc de texte uniforme) est le plus fiable sur les tickets :
          // PSM 4 renvoie parfois un résultat vide sur les longues images.
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
        });
        return worker;
      })
      .catch((error) => {
        // Permet une nouvelle tentative au prochain ticket.
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
}

/** Améliore une photo de ticket avant OCR (rotation EXIF, contraste, netteté). */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer, { failOn: "none", limitInputPixels: 60_000_000 }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;

  let pipeline = image.grayscale().normalize();
  if (width > 0 && width < 1600) {
    pipeline = pipeline.resize({ width: 1600, kernel: "lanczos3" });
  } else if (width > 3000) {
    pipeline = pipeline.resize({ width: 3000, kernel: "lanczos3" });
  }

  return pipeline.sharpen({ sigma: 0.8 }).png().toBuffer();
}

/**
 * Un seul worker Tesseract est réutilisé : les requêtes sont mises en file
 * d'attente pour éviter les accès concurrents au même worker.
 */
export async function recognizeImage(buffer: Buffer): Promise<string> {
  const job = queue.then(async () => {
    const worker = await getWorker();
    const result = await worker.recognize(buffer);
    return result.data.text;
  });

  queue = job.catch(() => undefined);
  return job;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // unpdf est un module ESM : import dynamique pour rester compatible avec le
  // runtime Node de Next.js.
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text;
}
