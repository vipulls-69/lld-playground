"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/store/canvas-store";

const AUTOSAVE_DELAY = 600;

/**
 * Hydrates the canvas store from localStorage on mount, then autosaves the
 * active diagram back to it. This is the single owner of workspace persistence.
 */
export function usePersistence() {
  useEffect(() => {
    useCanvasStore.getState().hydrate();
    // Hydration is not a user edit — keep it out of the undo history.
    useCanvasStore.temporal.getState().clear();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (!state.hydrated) return;
      if (state.nodes === prev.nodes && state.edges === prev.edges) return;
      clearTimeout(timer);
      timer = setTimeout(() => useCanvasStore.getState().saveDiagram(), AUTOSAVE_DELAY);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
}
