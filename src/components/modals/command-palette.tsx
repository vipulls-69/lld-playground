"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUIStore } from "@/store/ui-store";
import { useCanvasStore } from "@/store/canvas-store";
import { diagramToMermaid } from "@/lib/mermaid/convert";
import { generateCode } from "@/lib/codegen/generate";
import { cn } from "@/lib/utils/cn";
import type { UMLNodeData } from "@/lib/types";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** The canvas performs the export so it can fit the diagram into view first. */
function exportImage(format: "png" | "svg") {
  window.dispatchEvent(new CustomEvent("uml:export-image", { detail: { format } }));
}

/**
 * Drops a node near the middle of the current viewport. The palette has no
 * cursor context, so the canvas listens for this event and picks the spot.
 */
function placeNode(kind: UMLNodeData["kind"]) {
  window.dispatchEvent(new CustomEvent("uml:place-node", { detail: { kind } }));
}

export function CommandPalette() {
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setCenterView = useUIStore((s) => s.setCenterView);
  const setActivityView = useUIStore((s) => s.setActivityView);
  const language = useUIStore((s) => s.language);
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
      { id: "open-diagrams", label: "Open: Saved Designs", run: () => setActivityView("diagrams") },
      { id: "open-explorer", label: "Open: Explorer", run: () => setActivityView("explorer") },
      { id: "open-settings", label: "Open: Settings", run: () => setActivityView("settings") },

      // Shape creation
      { id: "add-class", label: "Add: Class", hint: "Shift+C", run: () => placeNode("class") },
      { id: "add-interface", label: "Add: Interface", hint: "Shift+I", run: () => placeNode("interface") },
      { id: "add-abstract", label: "Add: Abstract class", hint: "Shift+A", run: () => placeNode("abstract") },
      { id: "add-enum", label: "Add: Enum", hint: "Shift+E", run: () => placeNode("enum") },
      { id: "add-record", label: "Add: Record", hint: "Shift+R", run: () => placeNode("record") },
      { id: "add-note", label: "Add: Note", hint: "Shift+N", run: () => placeNode("note") },

      { id: "undo", label: "Edit: Undo", hint: "Ctrl+Z", run: () => useCanvasStore.temporal.getState().undo() },
      { id: "redo", label: "Edit: Redo", hint: "Ctrl+Y", run: () => useCanvasStore.temporal.getState().redo() },
      { id: "duplicate", label: "Edit: Duplicate selection", hint: "Ctrl+D", run: () => canvas.duplicateSelection() },
      { id: "delete", label: "Edit: Delete selection", hint: "Del", run: () => canvas.deleteSelection() },
      {
        id: "search",
        label: "Go to: Find class, field, or method",
        hint: "Ctrl+Shift+F",
        run: () => useUIStore.getState().setSearchOpen(true),
      },

      // Layout
      { id: "tidy", label: "Layout: Tidy up (auto-layout)", hint: "Ctrl+Shift+L", run: () => canvas.tidyLayout() },
      { id: "align-left", label: "Layout: Align left", run: () => canvas.alignSelection("left") },
      { id: "align-right", label: "Layout: Align right", run: () => canvas.alignSelection("right") },
      { id: "align-top", label: "Layout: Align top", run: () => canvas.alignSelection("top") },
      { id: "align-bottom", label: "Layout: Align bottom", run: () => canvas.alignSelection("bottom") },
      {
        id: "align-cx",
        label: "Layout: Align horizontal centers",
        run: () => canvas.alignSelection("center-x"),
      },
      {
        id: "align-cy",
        label: "Layout: Align vertical centers",
        run: () => canvas.alignSelection("center-y"),
      },
      {
        id: "dist-h",
        label: "Layout: Distribute horizontally",
        run: () => canvas.distributeSelection("horizontal"),
      },
      {
        id: "dist-v",
        label: "Layout: Distribute vertically",
        run: () => canvas.distributeSelection("vertical"),
      },

      { id: "clear", label: "Canvas: Clear all", run: () => canvas.clear() },
      { id: "snap", label: "Canvas: Toggle grid snap", run: () => canvas.toggleGridSnap() },
      { id: "minimap", label: "Canvas: Toggle minimap", run: () => useUIStore.getState().toggleMinimap() },
      {
        id: "theme",
        label: "Preferences: Toggle light/dark theme",
        run: () => {
          const s = useUIStore.getState();
          s.setTheme(s.theme === "dark" ? "light" : "dark");
        },
      },

      // Saved designs
      { id: "save", label: "Design: Save current", run: () => canvas.saveDiagram() },
      {
        id: "save-as",
        label: "Design: Save as new…",
        run: () => {
          const name = window.prompt("Name for the new design", "Untitled");
          if (name === null) return;
          const { nodes, edges, saveDiagram, createDiagram } = useCanvasStore.getState();
          saveDiagram();
          createDiagram(
            name.trim() || "Untitled",
            JSON.parse(JSON.stringify(nodes)),
            JSON.parse(JSON.stringify(edges))
          );
        },
      },

      {
        id: "export-png",
        label: "Export: Diagram as PNG",
        run: () => exportImage("png"),
      },
      {
        id: "export-svg",
        label: "Export: Diagram as SVG",
        run: () => exportImage("svg"),
      },
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
