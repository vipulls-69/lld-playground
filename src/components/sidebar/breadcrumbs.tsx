"use client";

import { ChevronRight } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { useChallengeStore } from "@/store/challenge-store";

export function Breadcrumbs() {
  const activeProblem = useChallengeStore((s) => s.activeProblem);
  const diagramName = useCanvasStore(
    (s) => s.diagrams.find((d) => d.id === s.currentDiagramId)?.name ?? "Untitled"
  );
  // Only the trailing crumb tracks selection, so subscribe to a string.
  const selectionLabel = useCanvasStore((s) => {
    const selected = s.nodes.filter((n) => n.selected);
    if (selected.length === 1) return selected[0].data.name;
    if (selected.length > 1) return `${selected.length} selected`;
    return "";
  });

  const parts = [
    "Workspace",
    activeProblem ? activeProblem.title : diagramName,
    ...(selectionLabel ? [selectionLabel] : []),
  ];

  return (
    <div className="flex h-7 items-center gap-1 border-b border-border bg-background px-3 text-2xs text-muted-foreground">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          <span className={i === parts.length - 1 ? "text-foreground" : ""}>{part}</span>
        </span>
      ))}
    </div>
  );
}
