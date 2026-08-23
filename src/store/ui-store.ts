"use client";

import { create } from "zustand";
import type { CodeLanguage } from "@/lib/types";

export type ActivityView = "explorer" | "shapes" | "problems" | "auditor" | "settings";
export type CenterView = "canvas" | "split" | "code";
export type CanvasTool = "pointer" | "pan" | "lasso" | "text";

interface UIState {
  theme: "dark" | "light";
  activityView: ActivityView;
  sidebarOpen: boolean;
  centerView: CenterView;
  activeTool: CanvasTool;
  language: CodeLanguage;
  commandPaletteOpen: boolean;
  minimapVisible: boolean;
  cursorPosition: { x: number; y: number };
  activeProblemId: string | null;
  breadcrumbs: string[];
  setTheme: (t: "dark" | "light") => void;
  setActivityView: (v: ActivityView) => void;
  toggleSidebar: () => void;
  setCenterView: (v: CenterView) => void;
  setActiveTool: (t: CanvasTool) => void;
  setLanguage: (l: CodeLanguage) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleMinimap: () => void;
  setCursorPosition: (p: { x: number; y: number }) => void;
  setActiveProblemId: (id: string | null) => void;
  setBreadcrumbs: (b: string[]) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  theme: "light",
  activityView: "shapes",
  sidebarOpen: true,
  centerView: "canvas",
  activeTool: "pointer",
  language: "typescript",
  commandPaletteOpen: false,
  minimapVisible: false,
  cursorPosition: { x: 0, y: 0 },
  activeProblemId: null,
  breadcrumbs: ["Workspace", "Untitled Diagram", "Class Diagram"],
  setTheme: (theme) => set({ theme }),
  setActivityView: (activityView) => set({ activityView, sidebarOpen: true }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCenterView: (centerView) => set({ centerView }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setLanguage: (language) => set({ language }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  setCursorPosition: (cursorPosition) => set({ cursorPosition }),
  setActiveProblemId: (activeProblemId) => set({ activeProblemId }),
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
}));
