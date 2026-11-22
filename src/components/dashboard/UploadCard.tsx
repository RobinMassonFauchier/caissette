"use client";

import { useRef, useState } from "react";
import { Camera, FolderOpen, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import type { ExtractedReceipt } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SIZE = 15 * 1024 * 1024;
const MAX_DIMENSION = 2200;

/**
 * Réduit les photos trop lourdes avant l'envoi : l'OCR est plus rapide et
 * l'utilisateur n'attend pas plusieurs minutes sur une connexion mobile.
 */
async function prepareFile(file: File): Promise<File> {
  const compressible =
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp";

  if (!compressible) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIMENSION / longestSide);

    if (scale === 1 && file.size <= 2.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );

    if (!blob || blob.size >= file.size) return file;

    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "") || "ticket"}.jpg`,
      { type: "image/jpeg", lastModified: Date.now() },
    );
  } catch {
    // Format non décodable par le navigateur (HEIC…) : on envoie l'original.
    return file;
  }
}

export function UploadCard({
  onExtracted,
  children,
}: {
  onExtracted: (receipt: ExtractedReceipt) => void;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<null | "upload" | "analyze">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (busy) return;
    setError(null);

    if (file.size === 0) {
      setError("Ce fichier est vide. Choisissez-en un autre.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Fichier trop volumineux (15 Mo maximum).");
      return;
    }

    const supported =
      file.type === "application/pdf" ||
      file.type.startsWith("image/") ||
      /\.(pdf|jpe?g|png|webp|gif|tiff?|avif|heic|heif)$/i.test(file.name);

    if (!supported) {
      setError("Format non pris en charge. Utilisez un PDF ou une photo.");
      return;
    }

    setBusy("upload");
    const analyzeTimer = setTimeout(() => setBusy("analyze"), 1400);

    try {
      const prepared = await prepareFile(file);
      const body = new FormData();
      body.append("file", prepared);

      const response = await fetch("/api/extract", { method: "POST", body });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Impossible de lire ce ticket.");
      }

      onExtracted(data as ExtractedReceipt);
      toast.success("Ticket lu", {
        description: "Vérifiez les informations avant d'enregistrer.",
      });
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Impossible de lire ce ticket.";
      setError(message);
      toast.error(message);
    } finally {
      clearTimeout(analyzeTimer);
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function openPicker() {
    if (busy) return;
    inputRef.current?.click();
  }

  return (
    <section
      id="ajouter"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
            <Camera className="size-4.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-stone-900">
              Ajouter un ticket
            </h2>
            <p className="text-[12px] text-stone-600">
              Photo ou PDF · lecture automatique
            </p>
          </div>
        </div>
        <span className="hidden rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 sm:inline">
          Gratuit · sans installation
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          aria-label="Choisir un fichier PDF ou une photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Prendre une photo du ticket"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 py-7 text-center transition",
            dragging
              ? "border-emerald-500 bg-emerald-50/70"
              : "border-stone-300 bg-stone-50/50",
          )}
        >
          {busy !== null ? (
            <div role="status" aria-live="polite">
              <span className="relative mx-auto grid size-12 place-items-center rounded-full bg-white text-emerald-600 shadow-sm">
                <Loader2 className="size-5 animate-spin" />
              </span>
              <span className="mt-3 block text-[15px] font-medium text-stone-800">
                {busy === "upload"
                  ? "Envoi du ticket…"
                  : "Lecture du ticket…"}
              </span>
              <span className="mt-1 block text-[13px] text-stone-600">
                Reconnaissance du texte et des montants. Cela peut prendre
                quelques secondes.
              </span>
              <span className="mx-auto mt-4 block h-1.5 w-52 overflow-hidden rounded-full bg-stone-200/80">
                <span className="block h-full w-1/2 animate-pulse rounded-full bg-emerald-500" />
              </span>
            </div>
          ) : (
            <>
              <span className="grid size-12 place-items-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-stone-200">
                <UploadCloud className="size-5" />
              </span>
              <span className="mt-3 text-[15px] font-medium text-stone-800">
                Déposez un ticket ici
              </span>
              <span className="mt-1 text-[12.5px] text-stone-600">
                PDF du magasin ou photo bien nette · 15 Mo max
              </span>

              <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  <Camera className="size-4" />
                  Prendre une photo
                </button>
                <button
                  type="button"
                  onClick={openPicker}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-[13.5px] font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
                >
                  <FolderOpen className="size-4 text-stone-500" />
                  Choisir un fichier
                </button>
              </div>

              <span className="mt-3 text-[11.5px] text-stone-500">
                Sur téléphone, « Prendre une photo » ouvre directement
                l&apos;appareil.
              </span>
            </>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700"
          >
            {error}
          </p>
        )}

        {children && (
          <div className="mt-4 border-t border-stone-100 pt-4">{children}</div>
        )}
      </div>
    </section>
  );
}
