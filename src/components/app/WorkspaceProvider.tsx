"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Expense, SessionUser } from "@/lib/types";
import type { AppSettings } from "@/lib/settings";

export type WorkspaceData = {
  user: SessionUser;
  expenses: Expense[];
  settings: AppSettings;
  sheetUrl: string;
  folderId: string;
  error: string | null;
};

type WorkspaceContextValue = WorkspaceData & {
  refresh: () => Promise<void>;
  setSettings: (settings: AppSettings) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: WorkspaceData;
  children: ReactNode;
}) {
  const [data, setData] = useState<WorkspaceData>(initial);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Impossible de recharger vos données.");
    }

    setData((current) => ({
      ...current,
      expenses: payload.expenses ?? [],
      settings: payload.settings ?? current.settings,
      sheetUrl: payload.sheetUrl ?? current.sheetUrl,
      folderId: payload.folderId ?? current.folderId,
      error: null,
    }));
  }, []);

  const setSettings = useCallback((settings: AppSettings) => {
    setData((current) => ({ ...current, settings }));
  }, []);

  // Rafraîchit les données quand l'onglet redevient actif et toutes les 2 min,
  // pour refléter aussi les modifications faites directement dans le Sheet.
  useEffect(() => {
    let lastRefresh = 0;

    const refreshIfVisible = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      if (now - lastRefresh < 5_000) return;
      lastRefresh = now;
      void refresh().catch(() => undefined);
    };

    const onFocus = () => refreshIfVisible();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshIfVisible();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(refreshIfVisible, 120_000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return (
    <WorkspaceContext.Provider value={{ ...data, refresh, setSettings }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace doit être utilisé dans WorkspaceProvider.");
  }
  return context;
}
