"use client";

import { useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DriveImportResult } from "@/lib/types";

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

const MAX_FILES = 5;

let pickerLoader: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Impossible de charger l'API Google Picker."));
    document.head.appendChild(script);
  });
}

function loadPicker(): Promise<void> {
  if (window.google?.picker) return Promise.resolve();
  if (pickerLoader) return pickerLoader;

  pickerLoader = loadScript("https://apis.google.com/js/api.js")
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (!window.gapi) {
            reject(new Error("API Google indisponible."));
            return;
          }
          window.gapi.load("picker", {
            callback: () => resolve(),
            onerror: () =>
              reject(new Error("Impossible d'initialiser Google Picker.")),
          });
        }),
    )
    .catch((error) => {
      pickerLoader = null;
      throw error;
    });

  return pickerLoader;
}

export function DriveImportButton({
  onBatch,
}: {
  onBatch: (results: DriveImportResult[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  async function importFiles(fileIds: string[]) {
    setBusy(true);
    const results: DriveImportResult[] = [];
    let failures = 0;

    for (let index = 0; index < fileIds.length; index += 1) {
      setProgress({ done: index, total: fileIds.length });
      try {
        const response = await fetch("/api/drive/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: fileIds[index] }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Impossible de lire ce fichier Drive.");
        }

        results.push({ ...(data as DriveImportResult), fileId: fileIds[index] });
      } catch (error) {
        failures += 1;
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossible de lire un fichier Drive.",
        );
      }
    }

    setProgress(null);
    setBusy(false);

    if (results.length > 0) {
      onBatch(results);
    }

    if (failures > 0 && results.length === 0) {
      toast.error("Aucun ticket n'a pu être lu.");
    }
  }

  async function openPicker() {
    if (busy) return;
    setBusy(true);

    try {
      const [tokenResponse, configResponse] = await Promise.all([
        fetch("/api/google-token"),
        fetch("/api/drive/config"),
      ]);

      if (!tokenResponse.ok) {
        throw new Error("Votre session Google a expiré. Reconnectez-vous.");
      }
      if (!configResponse.ok) {
        throw new Error("Configuration Drive indisponible.");
      }

      const { accessToken } = await tokenResponse.json();
      const { apiKey, appId } = await configResponse.json();

      if (!apiKey) {
        throw new Error(
          "L'import Drive n'est pas configuré (clé API Google Picker manquante).",
        );
      }

      await loadPicker();

      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .addView(
          new window.google.picker.DocsView(
            window.google.picker.ViewId.DOCS,
          )
            .setMimeTypes("application/pdf,image/jpeg,image/png,image/webp")
            .setIncludeFolders(false),
        )
        .setTitle(`Choisir jusqu'à ${MAX_FILES} tickets dans Google Drive`)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const ids: string[] = (data.docs ?? [])
              .map((doc: { id?: string }) => doc.id)
              .filter((id: string | undefined): id is string => Boolean(id));

            if (ids.length === 0) {
              setBusy(false);
              return;
            }

            if (ids.length > MAX_FILES) {
              toast.error(
                `Vous avez sélectionné ${ids.length} tickets. Seuls les ${MAX_FILES} premiers seront importés.`,
              );
            }

            void importFiles(ids.slice(0, MAX_FILES));
            return;
          }

          if (data.action === window.google.picker.Action.CANCEL) {
            setBusy(false);
          }
        })
        .build();

      picker.setVisible(true);
    } catch (error) {
      setBusy(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d'ouvrir Google Drive.",
      );
    }
  }

  const label = progress
    ? `Lecture ${Math.min(progress.done + 1, progress.total)}/${progress.total}…`
    : busy
      ? "Ouverture de Drive…"
      : "Importer depuis Google Drive";

  return (
    <div>
      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-[12.5px] font-medium text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin text-emerald-600" />
        ) : (
          <FolderOpen className="size-4 text-emerald-600" />
        )}
        {label}
      </button>
      <p className="mt-1.5 text-center text-[10px] text-stone-500">
        PDF ou photos déjà présents dans votre Drive, jusqu'à {MAX_FILES} tickets.
      </p>
    </div>
  );
}
