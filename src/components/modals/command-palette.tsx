"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUIStore } from "@/store/ui-store";
import { useCanvasStore } from "@/store/canvas-store";
import { diagramToMermaid } from "@/lib/mermaid/convert";
import { generateCode } from "@/lib/codegen/generate";
import { cn } from "@/lib/utils/cn";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setCenterView, setActivityView, language } = useUIStore();
  const canvas = useCanvasStore();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const commands: Command[] = useMemo(
    () => [
      { id: "view-canvas", label: "View: Canvas", run: () => setCenterView("canvas") },
      { id: "view-split", label: "View: Split (Code + Canvas)", run: () => setCenterView("split") },
      { id: "view-code", label: "View: Code", run: () => setCenterView("code") },
      { id: "open-shapes", label: "Open: UML Shape Library", run: () => setActivityView("shapes") },
      { id: "open-problems", label: "Open: LLD Problem Bank", run: () => setActivityView("problems") },
      { id: "open-auditor", label: "Open: Design Auditor", run: () => setActivityView("auditor") },
      { id: "undo", label: "Edit: Undo", hint: "Ctrl+Z", run: () => useCanvasStore.temporal.getState().undo() },
      { id: "redo", label: "Edit: Redo", hint: "Ctrl+Y", run: () => useCanvasStore.temporal.getState().redo() },
      { id: "duplicate", label: "Edit: Duplicate selection", hint: "Ctrl+D", run: () => canvas.duplicateSelection() },
      { id: "delete", label: "Edit: Delete selection", hint: "Del", run: () => canvas.deleteSelection() },
      { id: "clear", label: "Canvas: Clear all", run: () => canvas.clear() },
      { id: "snap", label: "Canvas: Toggle grid snap", run: () => canvas.toggleGridSnap() },
      {
        id: "copy-mermaid",
        label: "Export: Copy Mermaid to clipboard",
        run: () => navigator.clipboard.writeText(diagramToMermaid(canvas.nodes, canvas.edges)),
      },
      {
        id: "copy-code",
        label: `Export: Copy generated ${language} to clipboard`,
        run: () => navigator.clipboard.writeText(generateCode(canvas.nodes, canvas.edges, language)),
      },
    ],
    [canvas, language, setActivityView, setCenterView]
  );

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setIndex(0);
    }
  }, [commandPaletteOpen]);

  useEffect(() => setIndex(0), [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[index]) {
      filtered[index].run();
      setCommandPaletteOpen(false);
    }
  };

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="overflow-hidden p-0">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command…"
          className="h-10 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No matching commands.</div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onClick={() => {
                c.run();
                setCommandPaletteOpen(false);
              }}
              onMouseEnter={() => setIndex(i)}
              className={cn(
                "flex w-full items-center justify-between rounded-sm px-3 py-1.5 text-left text-xs",
                i === index ? "bg-accent text-accent-foreground" : "text-foreground"
              )}
            >
              <span>{c.label}</span>
              {c.hint && <span className="font-mono text-2xs text-muted-foreground">{c.hint}</span>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
