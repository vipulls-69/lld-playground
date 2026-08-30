"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Wand2,
} from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AlignAxis, DistributeAxis } from "@/lib/canvas/layout";

const ALIGN: { axis: AlignAxis; icon: React.ElementType; label: string }[] = [
  { axis: "left", icon: AlignStartVertical, label: "Align left" },
  { axis: "center-x", icon: AlignCenterVertical, label: "Align horizontal centers" },
  { axis: "right", icon: AlignEndVertical, label: "Align right" },
  { axis: "top", icon: AlignStartHorizontal, label: "Align top" },
  { axis: "center-y", icon: AlignCenterHorizontal, label: "Align vertical centers" },
  { axis: "bottom", icon: AlignEndHorizontal, label: "Align bottom" },
];

const DISTRIBUTE: { axis: DistributeAxis; icon: React.ElementType; label: string }[] = [
  { axis: "horizontal", icon: AlignHorizontalSpaceAround, label: "Distribute horizontally" },
  { axis: "vertical", icon: AlignVerticalSpaceAround, label: "Distribute vertically" },
];

/**
 * Floating alignment bar. Only rendered once a multi-selection exists, so it
 * stays out of the way during normal editing.
 */
export function AlignToolbar() {
  const selectedCount = useCanvasStore((s) => s.nodes.filter((n) => n.selected).length);
  const alignSelection = useCanvasStore((s) => s.alignSelection);
  const distributeSelection = useCanvasStore((s) => s.distributeSelection);
  const tidyLayout = useCanvasStore((s) => s.tidyLayout);

  if (selectedCount < 2) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-card/95 px-1 py-1 shadow-md backdrop-blur">
        {ALIGN.map(({ axis, icon: Icon, label }) => (
          <Tooltip key={axis}>
            <TooltipTrigger asChild>
              <button
                onClick={() => alignSelection(axis)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="mx-1 h-4" />

        {DISTRIBUTE.map(({ axis, icon: Icon, label }) => (
          <Tooltip key={axis}>
            <TooltipTrigger asChild>
              <button
                onClick={() => distributeSelection(axis)}
                disabled={selectedCount < 3}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {selectedCount < 3 ? `${label} (needs 3+)` : label}
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={tidyLayout}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-2xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Tidy
            </button>
          </TooltipTrigger>
          <TooltipContent>Auto-layout selection (Ctrl+Shift+L)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
