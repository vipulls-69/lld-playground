"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FilePlus2, Pencil, Save, Trash2, X } from "lucide-react";
import { useCanvasStore, type Diagram } from "@/store/canvas-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function DiagramRow({ diagram, active }: { diagram: Diagram; active: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(diagram.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = () => {
    const name = draft.trim();
    if (name && name !== diagram.name) useCanvasStore.getState().renameDiagram(diagram.id, name);
    else setDraft(diagram.name);
    setRenaming(false);
  };

  const open = () => {
    if (renaming) return;
    // Persist the current diagram before switching away, so edits aren't lost.
    useCanvasStore.getState().saveDiagram();
    useCanvasStore.getState().loadDiagram(diagram.id);
  };

  const remove = () => {
    if (!window.confirm(`Delete "${diagram.name}"? This can't be undone.`)) return;
    useCanvasStore.getState().deleteDiagram(diagram.id);
  };

  return (
    <div
      onClick={open}
      className={cn(
        "group flex cursor-pointer items-center gap-1 rounded px-2 py-1 hover:bg-accent/50",
        active && "bg-accent/70"
      )}
    >
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(diagram.name);
                setRenaming(false);
              }
            }}
            className="w-full rounded-sm bg-transparent text-2xs outline-none ring-[0.5px] ring-ring"
          />
        ) : (
          <div className="truncate text-2xs text-foreground/90" title={diagram.name}>
            {diagram.name}
          </div>
        )}
        <div className="truncate text-[10px] text-muted-foreground">
          {diagram.nodes.length} block{diagram.nodes.length === 1 ? "" : "s"} ·{" "}
          {relativeTime(diagram.updatedAt)}
        </div>
      </div>

      {!renaming && (
        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              setDraft(diagram.name);
              setRenaming(true);
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              remove();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function DiagramsPanel() {
  const diagrams = useCanvasStore((s) => s.diagrams);
  const currentDiagramId = useCanvasStore((s) => s.currentDiagramId);
  const [justSaved, setJustSaved] = useState(false);

  const saveNow = () => {
    useCanvasStore.getState().saveDiagram();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const saveAsNew = () => {
    const { nodes, edges, createDiagram, saveDiagram } = useCanvasStore.getState();
    saveDiagram();
    const name = window.prompt("Name for the new design", "Untitled");
    if (name === null) return;
    // Deep-copy so the new design doesn't alias the current one's objects.
    createDiagram(
      name.trim() || "Untitled",
      JSON.parse(JSON.stringify(nodes)),
      JSON.parse(JSON.stringify(edges))
    );
  };

  const newBlank = () => {
    useCanvasStore.getState().saveDiagram();
    const name = window.prompt("Name for the new design", "Untitled");
    if (name === null) return;
    useCanvasStore.getState().createDiagram(name.trim() || "Untitled");
  };

  const sorted = [...diagrams].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        <Button variant="outline" size="xs" onClick={saveNow} className="gap-1">
          {justSaved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
          {justSaved ? "Saved" : "Save"}
        </Button>
        <Button variant="outline" size="xs" onClick={saveAsNew} className="gap-1">
          <FilePlus2 className="h-3 w-3" /> Save as…
        </Button>
        <Button variant="ghost" size="xs" onClick={newBlank} className="gap-1">
          <X className="h-3 w-3 rotate-45" /> New
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1 scrollbar-thin">
        {sorted.length === 0 && (
          <p className="p-2 text-2xs text-muted-foreground">No saved designs yet.</p>
        )}
        {sorted.map((d) => (
          <DiagramRow key={d.id} diagram={d} active={d.id === currentDiagramId} />
        ))}
      </div>
    </div>
  );
}
