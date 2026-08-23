"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/canvas-store";

const STORAGE_KEY = "lld-playground:workspace";

export function usePersistence() {
  const hydrated = useRef(false);

  // Load once on mount
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          useCanvasStore.getState().setDiagram(parsed.nodes, parsed.edges);
        }
      }
    } catch {
      // corrupted storage — start fresh
    }
  }, []);

  // Auto-save (debounced)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const unsub = useCanvasStore.subscribe((state) => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ nodes: state.nodes, edges: state.edges })
          );
        } catch {
          // storage full — ignore
        }
      }, 600);
    });
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);
}
