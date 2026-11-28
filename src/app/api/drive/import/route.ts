import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import {
  extractPdfContent,
  preprocessImage,
  recognizeImageWithStyle,
} from "@/lib/ocr";
import { parseReceipt } from "@/lib/parse-receipt";
import { ensureWorkspace } from "@/lib/sheet";
import { readSettings } from "@/lib/settings";
import type { Category } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();

  if (!session.refreshToken) {
    return NextResponse.json(
      { error: "Vous devez être connecté." },
      { status: 401 },
    );
  }

  let payload: { fileId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const fileId = typeof payload.fileId === "string" ? payload.fileId : "";
  if (!fileId || fileId.length > 200) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const drive = google.drive({ version: "v3", auth });

    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,webViewLink",
    });

    const mimeType = meta.data.mimeType || "";
    const fileName = meta.data.name || "ticket";
    const size = Number(meta.data.size || 0);

    const isPdf = mimeType === "application/pdf";
    const isImage = mimeType.startsWith("image/");

    if (!isPdf && !isImage) {
      return NextResponse.json(
        {
          error:
            "Ce fichier n'est pas un ticket lisible. Choisissez un PDF ou une photo (JPG, PNG, WebP).",
        },
        { status: 415 },
      );
    }

    if (size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (15 Mo maximum)." },
        { status: 413 },
      );
    }

    const media = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );

    const buffer = Buffer.from(media.data as ArrayBuffer);
    let text = "";
    let boldLines: string[] = [];
    let source: "pdf" | "ocr" = "pdf";

    if (isPdf) {
      const content = await extractPdfContent(buffer);
      text = content.text;
      boldLines = content.boldLines;
      if (text.replace(/\s/g, "").length < 40) {
        return NextResponse.json(
          {
            error:
              "Ce PDF ne contient pas de texte exploitable (document scanné). Choisissez une photo ou un autre fichier.",
          },
          { status: 422 },
        );
      }
    } else {
      source = "ocr";
      const preprocessed = await preprocessImage(buffer);
      const content = await recognizeImageWithStyle(preprocessed);
      text = content.text;
      boldLines = content.boldLines;
      if (text.replace(/\s/g, "").length < 10) {
        return NextResponse.json(
          {
            error:
              "Impossible de lire ce ticket. Essayez une photo plus nette ou saisissez la dépense manuellement.",
          },
          { status: 422 },
        );
      }
    }

    let defaultCategory: Category = "Divers";
    try {
      const workspace = await ensureWorkspace(auth);
      const settings = await readSettings(auth, workspace.folderId);
      defaultCategory = settings.defaultCategory;
    } catch (settingsError) {
      console.error("Lecture des préférences impossible :", settingsError);
    }

    const parsed = parseReceipt(text, { defaultCategory, boldLines });
    const fileUrl =
      meta.data.webViewLink ||
      `https://drive.google.com/file/d/${fileId}/view`;

    return NextResponse.json({
      ...parsed,
      fileUrl,
      fileName,
      source,
    });
  } catch (error) {
    console.error("Import Drive impossible :", error);
    return NextResponse.json(
      {
        error:
          "Impossible de lire ce fichier depuis Google Drive. Vérifiez qu'il est bien accessible et réessayez.",
      },
      { status: 502 },
    );
  }
}
