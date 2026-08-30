"use client";

import { useUIStore } from "@/store/ui-store";
import { useCanvasStore } from "@/store/canvas-store";
import { Grid3x3 } from "lucide-react";
import type { CodeLanguage } from "@/lib/types";

const LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
];

export function StatusBar() {
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const gridSnap = useCanvasStore((s) => s.gridSnap);
  const toggleGridSnap = useCanvasStore((s) => s.toggleGridSnap);

  return (
    <div className="flex h-6 items-center gap-3 border-t border-border bg-card px-2 text-2xs text-muted-foreground">
      <button
        onClick={toggleGridSnap}
        className={`flex items-center gap-1 rounded px-1 transition-colors hover:bg-accent/50 ${gridSnap ? "text-foreground" : ""}`}
      >
        <Grid3x3 className="h-3 w-3" />
        Snap {gridSnap ? "On" : "Off"}
      </button>
      <div className="flex-1" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
        className="h-5 rounded border-none bg-transparent px-1 text-2xs text-muted-foreground outline-none hover:bg-accent/50"
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value} className="bg-popover">
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
