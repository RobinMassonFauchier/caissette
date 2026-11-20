import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace, uploadReceipt } from "@/lib/sheet";
import { extractPdfText, preprocessImage, recognizeImage } from "@/lib/ocr";
import { parseReceipt } from "@/lib/parse-receipt";
import { describeGoogleError } from "@/lib/google-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024; // 15 Mo

function extensionFor(mimeType: string, fileName: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && /^(pdf|jpe?g|png|webp|gif|tiff?|avif|heic|heif)$/.test(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/tiff":
      return "tiff";
    case "image/avif":
      return "avif";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "jpg";
  }
}

function sanitizeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session.refreshToken) {
    return NextResponse.json(
      { error: "Vous devez être connecté." },
      { status: 401 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Fichier illisible. Réessayez avec un autre ticket." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (typeof file !== "object" || file === null || !("arrayBuffer" in file)) {
    return NextResponse.json(
      { error: "Aucun fichier reçu." },
      { status: 400 },
    );
  }

  const upload = file as File;
  const fileName = upload.name || "ticket";
  const mimeType = upload.type || "";

  if (upload.size === 0) {
    return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 });
  }

  if (upload.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (15 Mo maximum)." },
      { status: 413 },
    );
  }

  const isPdf =
    mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|tiff?|avif|heic|heif)$/i.test(fileName);

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: "Format non pris en charge. Utilisez un PDF ou une photo (JPG, PNG, WebP)." },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await upload.arrayBuffer());

  let text = "";
  let source: "pdf" | "ocr" = "pdf";

  try {
    if (isPdf) {
      text = await extractPdfText(buffer);
      if (text.replace(/\s/g, "").length < 40) {
        return NextResponse.json(
          {
            error:
              "Ce PDF ne contient pas de texte exploitable (document scanné). Envoyez plutôt une photo ou une capture du ticket.",
            code: "scanned_pdf",
          },
          { status: 422 },
        );
      }
    } else {
      source = "ocr";
      const preprocessed = await preprocessImage(buffer);
      text = await recognizeImage(preprocessed);
      if (text.replace(/\s/g, "").length < 10) {
        return NextResponse.json(
          {
            error:
              "Impossible de lire ce ticket. Reprenez la photo bien à plat, avec assez de lumière et sans reflet.",
            code: "ocr_empty",
          },
          { status: 422 },
        );
      }
    }
  } catch (error) {
    console.error("Extraction du ticket impossible :", error);
    const message = error instanceof Error ? error.message : "";
    if (/ENOTFOUND|fetch failed|getaddrinfo|download/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "La lecture des photos nécessite une connexion internet lors du premier ticket (téléchargement du modèle OCR). Vérifiez votre connexion puis réessayez.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error:
          "Impossible de lire ce ticket. Essayez avec une photo plus nette, ou saisissez la dépense manuellement.",
      },
      { status: 422 },
    );
  }

  const parsed = parseReceipt(text);

  // Archive du ticket original dans le Drive de l'utilisateur (best effort).
  let fileUrl = "";
  let archivedName = "";
  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    const extension = extensionFor(mimeType, fileName);
    const base = sanitizeFileName(
      `${parsed.date}_${parsed.merchant || "ticket"}_${Math.random().toString(36).slice(2, 7)}`,
    );
    archivedName = `${base}.${extension}`;
    fileUrl = await uploadReceipt(auth, workspace.folderId, {
      buffer,
      mimeType: mimeType || (isPdf ? "application/pdf" : "image/jpeg"),
      name: archivedName,
    });
  } catch (error) {
    console.error("Archivage du ticket dans Drive impossible :", error);
    parsed.warnings.push(
      `Le ticket n'a pas pu être archivé dans Google Drive (${describeGoogleError(error)}).`,
    );
  }

  return NextResponse.json({
    ...parsed,
    fileUrl,
    fileName: archivedName,
    source,
  });
}
