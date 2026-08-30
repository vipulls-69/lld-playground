"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { UMLNodeKind } from "@/lib/types";

const SHAPES: { kind: UMLNodeKind; label: string; group: string; preview: string }[] = [
  { kind: "class", label: "Class", group: "Class Diagram", preview: "┌─ Class ─┐" },
  { kind: "abstract", label: "Abstract Class", group: "Class Diagram", preview: "«abstract»" },
  { kind: "interface", label: "Interface", group: "Class Diagram", preview: "«interface»" },
  { kind: "enum", label: "Enum", group: "Class Diagram", preview: "«enum»" },
  { kind: "record", label: "Record / Value Object", group: "Class Diagram", preview: "«record»" },
  { kind: "actor", label: "Actor", group: "Sequence / Use Case", preview: "○ stick" },
  { kind: "lifeline", label: "Lifeline", group: "Sequence / Use Case", preview: "┆ dashed" },
  { kind: "state", label: "State", group: "State Diagram", preview: "( state )" },
  { kind: "package", label: "Package", group: "Grouping", preview: "▤ folder" },
  { kind: "note", label: "Note", group: "Grouping", preview: "🗒 note" },
];

// Design-pattern and layering boxes are all plain class nodes that differ only
// by their stereotype, so they get no dedicated palette entries; the stereotype
// is typed directly on any node's header with autocomplete.


export function ShapeLibrary() {
  const [query, setQuery] = useState("");
  const filtered = SHAPES.filter(
    (s) =>
      s.label.toLowerCase().includes(query.toLowerCase()) ||
      s.group.toLowerCase().includes(query.toLowerCase())
  );
  const groups = Array.from(new Set(filtered.map((s) => s.group)));

  const place = (kind: UMLNodeKind, stereotype?: string) =>
    window.dispatchEvent(new CustomEvent("uml:place-node", { detail: { kind, stereotype } }));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shapes…"
            className="pl-7"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {groups.map((group) => (
          <div key={group} className="mb-3">
            <div className="mb-1 px-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {filtered
                .filter((s) => s.group === group)
                .map((s) => (
                  <div
                    key={s.kind}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/uml-kind", s.kind);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => place(s.kind)}
                    className="cursor-pointer overflow-hidden rounded-md border border-border bg-card p-2 transition-colors duration-150 hover:border-foreground/30 hover:bg-accent/50 active:cursor-grabbing"
                    title="Click to place at viewport center, or drag onto canvas"
                  >
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{s.preview}</div>
                    <div className="mt-1 truncate text-2xs font-medium leading-tight">{s.label}</div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
