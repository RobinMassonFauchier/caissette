"use client";

import {
  createContext,
  useCallback,
  useContext,
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
