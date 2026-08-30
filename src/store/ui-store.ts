"use client";

import { create } from "zustand";
import type { CodeLanguage } from "@/lib/types";

export type ActivityView = "explorer" | "shapes" | "problems" | "auditor" | "settings" | "diagrams";
export type CenterView = "canvas" | "split" | "code";
export type CanvasTool = "pointer" | "pan" | "lasso" | "text";

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 520;
export const SIDEBAR_DEFAULT = 240;

/** Code-editor share of the center area in split view. */
export const SPLIT_MIN = 0.2;
export const SPLIT_MAX = 0.8;
export const SPLIT_DEFAULT = 0.4;

const LAYOUT_KEY = "lld-playground:layout";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function persistLayout(sidebarWidth: number, splitRatio: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ sidebarWidth, splitRatio }));
  } catch {
    // storage unavailable — layout just won't persist
  }
}

interface UIState {
  theme: "dark" | "light";
  activityView: ActivityView;
  sidebarOpen: boolean;
  centerView: CenterView;
  activeTool: CanvasTool;
  language: CodeLanguage;
  commandPaletteOpen: boolean;
  searchOpen: boolean;
  minimapVisible: boolean;
  activeProblemId: string | null;
  breadcrumbs: string[];

  /** Sidebar width in px. */
  sidebarWidth: number;
  /** Code-editor share of the split view, 0–1. */
  splitRatio: number;

  setTheme: (t: "dark" | "light") => void;
  setActivityView: (v: ActivityView) => void;
  toggleSidebar: () => void;
  setCenterView: (v: CenterView) => void;
  setActiveTool: (t: CanvasTool) => void;
  setLanguage: (l: CodeLanguage) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  toggleMinimap: () => void;
  setActiveProblemId: (id: string | null) => void;
  setBreadcrumbs: (b: string[]) => void;
  setSidebarWidth: (w: number) => void;
  setSplitRatio: (r: number) => void;
  /** Restores persisted layout sizes; call from a client effect. */
  hydrateLayout: () => void;
}

export const useUIStore = create<UIState>()((set, get) => ({
  theme: "light",
  activityView: "shapes",
  sidebarOpen: true,
  centerView: "canvas",
  activeTool: "pointer",
  language: "typescript",
  commandPaletteOpen: false,
  searchOpen: false,
  minimapVisible: false,
  activeProblemId: null,
  breadcrumbs: ["Workspace", "Untitled Diagram", "Class Diagram"],

  sidebarWidth: SIDEBAR_DEFAULT,
  splitRatio: SPLIT_DEFAULT,
  setTheme: (theme) => set({ theme }),
  setActivityView: (activityView) => set({ activityView, sidebarOpen: true }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCenterView: (centerView) => set({ centerView }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setLanguage: (language) => set({ language }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  setActiveProblemId: (activeProblemId) => set({ activeProblemId }),
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),

  setSidebarWidth: (w) => {
    const sidebarWidth = clamp(Math.round(w), SIDEBAR_MIN, SIDEBAR_MAX);
    if (sidebarWidth === get().sidebarWidth) return;
    set({ sidebarWidth });
    persistLayout(sidebarWidth, get().splitRatio);
  },

  setSplitRatio: (r) => {
    const splitRatio = clamp(r, SPLIT_MIN, SPLIT_MAX);
    if (splitRatio === get().splitRatio) return;
    set({ splitRatio });
    persistLayout(get().sidebarWidth, splitRatio);
  },

  hydrateLayout: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{ sidebarWidth: number; splitRatio: number }>;
      const next: Partial<UIState> = {};
      if (typeof parsed.sidebarWidth === "number" && Number.isFinite(parsed.sidebarWidth)) {
        next.sidebarWidth = clamp(parsed.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX);
      }
      if (typeof parsed.splitRatio === "number" && Number.isFinite(parsed.splitRatio)) {
        next.splitRatio = clamp(parsed.splitRatio, SPLIT_MIN, SPLIT_MAX);
      }
      if (Object.keys(next).length) set(next);
    } catch {
      // corrupted layout — keep defaults
    }
  },
}));
