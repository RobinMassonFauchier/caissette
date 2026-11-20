"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import type { ExtractedReceipt } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SIZE = 15 * 1024 * 1024;

export function UploadCard({
  onExtracted,
}: {
  onExtracted: (receipt: ExtractedReceipt) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<null | "upload" | "analyze">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (busy) return;
    setError(null);

    if (file.size === 0) {
      setError("Ce fichier est vide.");
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
      const body = new FormData();
      body.append("file", file);

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
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
            <Camera className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Ajouter un ticket</h2>
            <p className="text-[11px] text-stone-500">
              Photo ou PDF · lecture automatique
            </p>
          </div>
        </div>
        <span className="hidden rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500 sm:inline">
          Gratuit · sur votre machine
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          disabled={busy !== null}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition",
            dragging
              ? "border-emerald-500 bg-emerald-50/70"
              : "border-stone-300 bg-stone-50/50 hover:border-emerald-400 hover:bg-emerald-50/40",
            busy !== null && "cursor-wait",
          )}
        >
          {busy !== null ? (
            <>
              <span className="relative grid size-11 place-items-center rounded-full bg-white text-emerald-600 shadow-sm">
                <Loader2 className="size-5 animate-spin" />
              </span>
              <span className="mt-3 text-sm font-medium text-stone-800">
                {busy === "upload" ? "Envoi du ticket…" : "Lecture du ticket…"}
              </span>
              <span className="mt-1 text-xs text-stone-500">
                Reconnaissance du texte et des montants, quelques secondes.
              </span>
              <span className="mt-4 h-1.5 w-52 overflow-hidden rounded-full bg-stone-200/80">
                <span className="block h-full w-1/2 animate-pulse rounded-full bg-emerald-500" />
              </span>
            </>
          ) : (
            <>
              <span className="grid size-11 place-items-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-stone-200">
                <UploadCloud className="size-5" />
              </span>
              <span className="mt-3 text-sm font-medium text-stone-800">
                Déposez un ticket ici
              </span>
              <span className="mt-1 text-xs text-stone-500">
                PDF du magasin ou photo bien nette · 15 Mo max
              </span>
              <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-stone-800">
                Choisir un fichier
              </span>
              <span className="mt-3 text-[11px] text-stone-400">
                Sur mobile, vous pouvez prendre la photo directement.
              </span>
            </>
          )}
        </button>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
