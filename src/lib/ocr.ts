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

type StyledText = {
  text: string;
  /** Lignes dont la police est grasse (PDF) ou mises en avant (taille). */
  boldLines: string[];
};

type StyledLine = {
  text: string;
  height: number;
  bold: boolean;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

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

const BOLD_FONT = /bold|black|heavy|semibold|demi|extrabold|gras/i;

/**
 * Un seul worker Tesseract est réutilisé : les requêtes sont mises en file
 * d'attente pour éviter les accès concurrents au même worker.
 *
 * Tesseract 5 expose le nom de police de chaque mot. Quand il est renseigné,
 * on en déduit les lignes en gras. Sur beaucoup de photos le nom de police
 * reste vide : l'utilisateur peut alors cocher « en avant » dans le détail.
 */
export async function recognizeImageWithStyle(
  buffer: Buffer,
): Promise<StyledText> {
  const job = queue.then(async () => {
    const worker = await getWorker();
    const result = await worker.recognize(
      buffer,
      {},
      { text: true, blocks: true },
    );

    const lines: StyledLine[] = [];
    for (const block of result.data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          const words = line.words ?? [];
          if (words.length === 0) continue;
          const boldWords = words.filter((word) =>
            BOLD_FONT.test(word.font_name || ""),
          );
          const height =
            line.rowAttributes?.rowHeight ||
            Math.abs((line.bbox?.y1 ?? 0) - (line.bbox?.y0 ?? 0)) ||
            Math.max(...words.map((word) => word.bbox.y1 - word.bbox.y0), 0);
          lines.push({
            text: line.text,
            height,
            bold: boldWords.length >= Math.ceil(words.length / 2),
          });
        }
      }
    }

    // Les tickets mettent souvent les promos en plus gros caractères, sans que
    // Tesseract identifie la police. On considère donc aussi les lignes
    // nettement plus hautes que la médiane comme « mises en avant ».
    const medianHeight = median(lines.map((line) => line.height));
    const boldLines = lines
      .filter(
        (line) =>
          line.bold ||
          (medianHeight > 0 && line.height >= medianHeight * 1.16),
      )
      .map((line) => line.text)
      .filter(Boolean);

    return { text: result.data.text, boldLines };
  });

  queue = job.catch(() => undefined);
  return job;
}

export async function recognizeImage(buffer: Buffer): Promise<string> {
  const result = await recognizeImageWithStyle(buffer);
  return result.text;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // unpdf est un module ESM : import dynamique pour rester compatible avec le
  // runtime Node de Next.js.
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text;
}

type TextLine = {
  page: number;
  y: number;
  text: string;
  fontSize: number;
  boldChars: number;
  totalChars: number;
};

/**
 * Extrait le texte d'un PDF en conservant l'information de graisse.
 * Les items PDF sont regroupés par ligne (coordonnée Y), puis la ligne est
 * considérée en gras si la majorité de ses caractères utilise une police
 * « bold ». Le texte reste identique à celui d'extractText.
 */
export async function extractPdfContent(buffer: Buffer): Promise<StyledText> {
  const { extractText, extractTextItems } = await import("unpdf");

  try {
    const { items } = await extractTextItems(new Uint8Array(buffer));
    const lines: TextLine[] = [];

    items.forEach((pageItems, pageIndex) => {
      const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);

      for (const item of sorted) {
        if (!item.str?.trim()) continue;
        const tolerance = Math.max(2, (item.fontSize || 10) * 0.45);
        let line = lines.find(
          (candidate) =>
            candidate.page === pageIndex &&
            Math.abs(candidate.y - item.y) <= tolerance,
        );

        if (!line) {
          line = {
            page: pageIndex,
            y: item.y,
            text: "",
            fontSize: item.fontSize || 0,
            boldChars: 0,
            totalChars: 0,
          };
          lines.push(line);
        }

        const isBold = BOLD_FONT.test(item.fontFamily || "");
        line.fontSize = Math.max(line.fontSize, item.fontSize || 0);
        line.text = line.text ? `${line.text} ${item.str}` : item.str;
        line.totalChars += item.str.length;
        if (isBold) line.boldChars += item.str.length;
      }
    });

    if (lines.some((line) => line.text.trim().length > 0)) {
      const ordered = [...lines].sort((a, b) => a.page - b.page || b.y - a.y);
      const medianFontSize = median(
        ordered.map((line) => line.fontSize).filter((size) => size > 0),
      );
      return {
        text: ordered.map((line) => line.text.trim()).filter(Boolean).join("\n"),
        boldLines: ordered
          .filter(
            (line) =>
              line.totalChars > 0 &&
              (line.boldChars / line.totalChars >= 0.5 ||
                (medianFontSize > 0 &&
                  line.fontSize >= medianFontSize * 1.16)),
          )
          .map((line) => line.text.trim())
          .filter(Boolean),
      };
    }
  } catch (error) {
    console.error("Lecture stylée du PDF impossible :", error);
  }

  // Repli : le texte seul fonctionne toujours, sans détection du gras.
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return { text, boldLines: [] };
}
