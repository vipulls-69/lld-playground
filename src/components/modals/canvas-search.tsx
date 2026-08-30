"use client";

import { useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils/cn";

/** Matches a node if the query appears in its name, fields, or method names. */
function matches(haystack: string[], query: string): boolean {
  const q = query.toLowerCase();
  return haystack.some((h) => h.toLowerCase().includes(q));
}

export function CanvasSearch() {
  const open = useUIStore((s) => s.searchOpen);
  const setOpen = useUIStore((s) => s.setSearchOpen);
  const nodes = useCanvasStore((s) => s.nodes);
  const { setCenter } = useReactFlow();

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return nodes
      .filter((n) =>
        matches(
          [
            n.data.name,
            ...n.data.fields.map((f) => `${f.name} ${f.type}`),
            ...n.data.methods.map((m) => m.name),
            ...(n.data.enumValues ?? []),
          ],
          query
        )
      )
      .slice(0, 30);
  }, [nodes, query]);

  const reveal = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const w = node.measured?.width ?? node.width ?? 220;
    const h = node.measured?.height ?? node.height ?? 120;
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.2, duration: 400 });
    useCanvasStore.getState().selectOnly(id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[index]) {
      e.preventDefault();
      reveal(results[index].id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find a class, field, or method…"
          className="h-10 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
          )}
          {results.map((n, i) => (
            <button
              key={n.id}
              onClick={() => reveal(n.id)}
              onMouseEnter={() => setIndex(i)}
              className={cn(
                "flex w-full items-center justify-between rounded-sm px-3 py-1.5 text-left text-xs",
                i === index ? "bg-accent text-accent-foreground" : "text-foreground"
              )}
            >
              <span className="truncate font-mono">{n.data.name}</span>
              <span className="ml-2 shrink-0 text-2xs text-muted-foreground">{n.data.kind}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
