"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Plus, X } from "lucide-react";
import type { UMLNode } from "@/store/canvas-store";
import { uid, visibilitySymbol, cn } from "@/lib/utils/cn";
import { useCanvasStore } from "@/store/canvas-store";
import type { UMLField, UMLMethod, Visibility } from "@/lib/types";

const KIND_STEREOTYPE: Record<string, string> = {
  interface: "interface",
  abstract: "abstract",
  enum: "enumeration",
  record: "record",
};

const VIS_CYCLE: Visibility[] = ["public", "private", "protected", "package"];

const PRIMITIVE_TYPES = [
  // TS primitives
  "string",
  "number",
  "boolean",
  "void",
  "undefined",
  "null",
  "any",
  "unknown",
  "never",
  "object",
  "symbol",
  "bigint",
  // TS utility / generic
  "Array",
  "ReadonlyArray",
  "Promise",
  "Record",
  "Partial",
  "Required",
  "Readonly",
  "Pick",
  "Omit",
  "Exclude",
  "Extract",
  "NonNullable",
  "ReturnType",
  "InstanceType",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Date",
  "RegExp",
  "Error",
  "Function",
  // Common OOP / other-lang conveniences
  "String",
  "int",
  "long",
  "double",
  "float",
  "bool",
  "List",
  "Optional",
];

/** Datalist id shared by all type inputs on the canvas. */
const TYPE_LIST_ID = "uml-type-suggestions";

/** Renders the shared <datalist> of primitive + workspace-defined types. */
function TypeSuggestions() {
  const nodes = useCanvasStore((s) => s.nodes);
  const custom = nodes
    .filter((n) => ["class", "abstract", "interface", "enum", "record"].includes(n.data.kind))
    .map((n) => n.data.name);
  const options = Array.from(new Set([...PRIMITIVE_TYPES, ...custom]));
  return (
    <datalist id={TYPE_LIST_ID}>
      {options.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}

function nextVisibility(v: Visibility): Visibility {
  return VIS_CYCLE[(VIS_CYCLE.indexOf(v) + 1) % VIS_CYCLE.length];
}

/** All suggestable types: primitives + workspace-defined class/interface/enum names. */
function useAllTypes(): string[] {
  const nodes = useCanvasStore((s) => s.nodes);
  const custom = nodes
    .filter((n) => ["class", "abstract", "interface", "enum", "record"].includes(n.data.kind))
    .map((n) => n.data.name);
  return Array.from(new Set([...PRIMITIVE_TYPES, ...custom]));
}

/** Per-token type autocomplete: suggests when the caret is right after a ":". */
function useTypeAutocomplete(text: string, setText: (v: string) => void, allTypes: string[]) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tokenStart, setTokenStart] = useState(0);
  const [selIdx, setSelIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const updateSuggestions = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const colonIdx = before.lastIndexOf(":");
    if (colonIdx === -1) {
      setSuggestions([]);
      return;
    }
    const token = before.slice(colonIdx + 1);
    if (/[(),]/.test(token)) {
      setSuggestions([]);
      return;
    }
    const prefix = token.trimStart().toLowerCase();
    const matches = allTypes.filter((t) => t.toLowerCase().startsWith(prefix)).slice(0, 8);
    setSuggestions(matches);
    setTokenStart(colonIdx + 1 + (token.length - token.trimStart().length));
    setSelIdx(0);
  };

  const applySuggestion = (type: string) => {
    const caret = ref.current?.selectionStart ?? text.length;
    const next = text.slice(0, tokenStart) + type + text.slice(caret);
    setText(next);
    setSuggestions([]);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(tokenStart + type.length, tokenStart + type.length);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    // returns true if the key was consumed by the suggestion list
    if (!suggestions.length) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelIdx((i) => Math.min(i + 1, suggestions.length - 1));
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelIdx((i) => Math.max(i - 1, 0));
      return true;
    }
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      applySuggestion(suggestions[selIdx]);
      return true;
    }
    if (e.key === "Escape") {
      setSuggestions([]);
      return true;
    }
    return false;
  };

  return { ref, suggestions, selIdx, updateSuggestions, applySuggestion, onKeyDown, setSuggestions };
}

/** Shared suggestion dropdown rendered above the input. */
function SuggestionList({
  suggestions,
  selIdx,
  onPick,
}: {
  suggestions: string[];
  selIdx: number;
  onPick: (s: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="absolute bottom-full left-0 z-[100] mb-0.5 min-w-[120px] rounded-md border border-border bg-popover py-0.5 shadow-md">
      {suggestions.map((s, i) => (
        <button
          key={s}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(s);
          }}
          className={cn(
            "block w-full px-2 py-0.5 text-left font-mono text-2xs",
            i === selIdx ? "bg-accent text-accent-foreground" : "text-foreground"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/**
 * A text segment that renders as plain text normally, and as an input when
 * the parent node is in edit mode. Commits on blur / Enter.
 */
function Seg({
  value,
  onCommit,
  className,
  placeholder,
  editing,
  autoFocus,
  isType,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  editing: boolean;
  autoFocus?: boolean;
  isType?: boolean;
}) {
  const [text, setText] = useState(value);
  const wasEditing = useRef(false);

  // Sync external value when entering edit mode
  useEffect(() => {
    if (editing && !wasEditing.current) setText(value);
    wasEditing.current = editing;
  }, [editing, value]);

  if (!editing) {
    return (
      <span title={value} className={className}>
        {value || <span className="text-muted-foreground/50">{placeholder ?? "—"}</span>}
      </span>
    );
  }
  return (
    <input
      autoFocus={autoFocus}
      value={text}
      placeholder={placeholder}
      list={isType ? TYPE_LIST_ID : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text.trim() || value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        "nodrag nowheel block min-w-0 flex-1 resize-none overflow-hidden whitespace-pre-wrap break-all rounded-sm bg-transparent px-0.5 leading-4 text-foreground/90 outline-none ring-[0.5px] ring-ring/60",
        className
      )}
    />
  );
}

function FieldLine({
  nodeId,
  field,
  editing,
}: {
  nodeId: string;
  field: UMLField;
  editing: boolean;
}) {
  const { nodes, updateNodeData } = useCanvasStore();
  const node = nodes.find((n) => n.id === nodeId)!;
  const patch = (p: Partial<UMLField>) =>
    updateNodeData(nodeId, { fields: node.data.fields.map((f) => (f.id === field.id ? { ...f, ...p } : f)) });
  const remove = () =>
    updateNodeData(nodeId, { fields: node.data.fields.filter((f) => f.id !== field.id) });

  // Single text box: "name: Type"
  const [text, setText] = useState(`${field.name}: ${field.type}`);
  const wasEditing = useRef(false);
  const allTypes = useAllTypes();
  const ac = useTypeAutocomplete(text, setText, allTypes);
  useEffect(() => {
    if (editing && !wasEditing.current) setText(`${field.name}: ${field.type}`);
    wasEditing.current = editing;
  }, [editing, field.name, field.type]);

  const commit = (v: string) => {
    const idx = v.indexOf(":");
    if (idx >= 0) {
      patch({ name: v.slice(0, idx).trim() || field.name, type: v.slice(idx + 1).trim() || field.type });
    } else {
      patch({ name: v.trim() || field.name });
    }
  };

  return (
    <div className="group/row flex items-baseline gap-0.5 px-1.5 leading-4">
      <button
        title={`${field.visibility} (click to cycle)`}
        onClick={() => patch({ visibility: nextVisibility(field.visibility) })}
        className="nodrag w-3 shrink-0 self-center text-muted-foreground hover:text-foreground"
      >
        {visibilitySymbol(field.visibility)}
      </button>
      {editing ? (
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={ac.ref}
            value={text}
            placeholder="name: Type"
            rows={1}
            spellCheck={false}
            onChange={(e) => {
              setText(e.target.value);
              ac.updateSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
              const el = e.target;
              el.style.height = "0px";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onBlur={() => {
              setTimeout(() => {
                commit(text);
                ac.setSuggestions([]);
              }, 120);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (ac.onKeyDown(e)) return;
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            className="nodrag nowheel block min-w-0 flex-1 w-full resize-none overflow-hidden whitespace-pre-wrap break-all rounded-sm bg-transparent px-0.5 leading-4 text-foreground/90 outline-none ring-[0.5px] ring-ring/60"
          />
          <SuggestionList suggestions={ac.suggestions} selIdx={ac.selIdx} onPick={ac.applySuggestion} />
        </div>
      ) : (
        <span title={`${field.name}: ${field.type}`} className="whitespace-pre-wrap break-all">
          <span className="text-foreground/90">{field.name}</span>
          <span className="text-muted-foreground">: {field.type}</span>
        </span>
      )}
      {editing && (
        <button
          onClick={remove}
          className="nodrag ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center self-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Single-box method signature editor with per-token type autocomplete.
 * Typing after ":" (in params or return position) suggests types.
 */
function MethodSigInput({
  method,
  onCommit,
}: {
  method: UMLMethod;
  onCommit: (name: string, params: UMLMethod["params"], returnType: string) => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  void nodes;
  const full = `${method.name}(${method.params.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${method.returnType}`;
  const [text, setText] = useState(full);
  const allTypes = useAllTypes();
  const ac = useTypeAutocomplete(text, setText, allTypes);
  const ref = ac.ref;

  // Auto-grow the textarea to fit wrapped content
  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(autoGrow, [text]);

  useEffect(() => {
    setText(full);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method.id]);

  const commit = (v: string) => {
    const m = v.match(/^([\w$]+)\s*\(([^)]*)\)\s*:?\s*(.*)$/);
    if (!m) {
      onCommit(v.trim() || method.name, method.params, method.returnType);
      return;
    }
    const [, name, paramsRaw, ret] = m;
    const params = paramsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [pn, pt] = s.split(":").map((x) => x.trim());
        return { name: pn || "arg", type: pt || "any" };
      });
    onCommit(name || method.name, params, ret.trim() || method.returnType);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <textarea
        ref={ref}
        value={text}
        placeholder="name(arg: Type): Ret"
        rows={1}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          ac.updateSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onBlur={() => {
          // Delay so a click on a suggestion registers first
          setTimeout(() => {
            commit(text);
            ac.setSuggestions([]);
          }, 120);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (ac.onKeyDown(e)) return;
          // Enter commits (no newlines in a signature)
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        className="nodrag nowheel block w-full min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-all rounded-sm bg-transparent px-0.5 leading-4 text-foreground/90 outline-none ring-[0.5px] ring-ring/60"
      />
      <SuggestionList suggestions={ac.suggestions} selIdx={ac.selIdx} onPick={ac.applySuggestion} />
    </div>
  );
}

function MethodLine({
  nodeId,
  method,
  editing,
}: {
  nodeId: string;
  method: UMLMethod;
  editing: boolean;
}) {
  const { nodes, updateNodeData } = useCanvasStore();
  const node = nodes.find((n) => n.id === nodeId)!;
  const patch = (p: Partial<UMLMethod>) =>
    updateNodeData(nodeId, { methods: node.data.methods.map((m) => (m.id === method.id ? { ...m, ...p } : m)) });
  const remove = () =>
    updateNodeData(nodeId, { methods: node.data.methods.filter((m) => m.id !== method.id) });

  const paramsStr = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const signatureLen = method.name.length + paramsStr.length + method.returnType.length;
  const isLong = signatureLen > 42 || method.params.length > 2;

  // Prettier-style: long signatures break after "(" and "," with hanging indent
  if (!editing && isLong && method.params.length > 0) {
    return (
      <div className="group/row px-1.5 leading-4">
        <div className="flex items-baseline gap-0.5">
          <button
            title={`${method.visibility} (click to cycle)`}
            onClick={() => patch({ visibility: nextVisibility(method.visibility) })}
            className="nodrag w-3 shrink-0 self-center text-muted-foreground hover:text-foreground"
          >
            {visibilitySymbol(method.visibility)}
          </button>
          <span className={cn("whitespace-pre-wrap break-all text-foreground/90", method.isAbstract && "italic")}>
            {method.name}
          </span>
          <span className="text-muted-foreground">(</span>
        </div>
        <div className="pl-6">
          {method.params.map((p, i) => (
            <div key={i} className="whitespace-pre-wrap break-all text-muted-foreground">
              {p.name}: {p.type}
              {i < method.params.length - 1 ? "," : ""}
            </div>
          ))}
        </div>
        <div className="pl-4 text-muted-foreground">
          ): <span className="whitespace-pre-wrap break-all">{method.returnType}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group/row flex items-baseline gap-0.5 px-1.5 leading-4">
      <button
        title={`${method.visibility} (click to cycle)`}
        onClick={() => patch({ visibility: nextVisibility(method.visibility) })}
        className="nodrag w-3 shrink-0 self-center text-muted-foreground hover:text-foreground"
      >
        {visibilitySymbol(method.visibility)}
      </button>
      {editing ? (
        <MethodSigInput
          method={method}
          onCommit={(name, params, returnType) => patch({ name, params, returnType })}
        />
      ) : (
        <span
          title={`${method.name}(${paramsStr}): ${method.returnType}`}
          className="whitespace-pre-wrap break-all"
        >
          <span className={cn("text-foreground/90", method.isAbstract && "italic")}>{method.name}</span>
          <span className="text-muted-foreground">({paramsStr}): {method.returnType}</span>
        </span>
      )}
      {editing && (
        <button
          onClick={remove}
          className="nodrag ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center self-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="nodrag flex w-full items-center gap-1 px-1.5 py-0.5 text-left text-[10px] text-muted-foreground/60 transition-colors hover:bg-accent/50 hover:text-muted-foreground"
    >
      <Plus className="h-2.5 w-2.5" /> {label}
    </button>
  );
}

export const UMLNodeRenderer = memo(function UMLNodeRenderer({ data, selected, id }: NodeProps<UMLNode>) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id));
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = node?.data ?? data;
  const stereotype = d.stereotype ?? KIND_STEREOTYPE[d.kind];

  // Node-level edit mode: double-click anywhere on the block toggles it
  const [editing, setEditing] = useState(false);

  // When leaving edit mode, drop rows the user never touched (still default placeholders)
  useEffect(() => {
    if (editing) return;
    const n = useCanvasStore.getState().nodes.find((x) => x.id === id);
    if (!n) return;
    const fields = n.data.fields.filter((f) => !(f.name === "field" && f.type === "String"));
    const methods = n.data.methods.filter(
      (m) => !(m.name === "method" && m.returnType === "void" && m.params.length === 0)
    );
    const enumValues = n.data.enumValues?.filter((v) => v !== "NEW_VALUE");
    if (
      fields.length !== n.data.fields.length ||
      methods.length !== n.data.methods.length ||
      (enumValues && enumValues.length !== (n.data.enumValues ?? []).length)
    ) {
      updateNodeData(id, { fields, methods, ...(enumValues ? { enumValues } : {}) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, id]);

  // Exit edit mode when deselected
  useEffect(() => {
    if (!selected) setEditing(false);
  }, [selected]);

  // Escape exits edit mode
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing]);

  const enterEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  // Non-class kinds get minimal renderings
  if (d.kind === "actor") {
    return (
      <div
        onDoubleClick={enterEdit}
        className={cn("flex flex-col items-center text-foreground", selected && "opacity-90")}
      >
        <Handle type="target" position={Position.Top} />
        <svg width="36" height="52" viewBox="0 0 36 52" className="stroke-foreground" fill="none" strokeWidth="1.5">
          <circle cx="18" cy="8" r="6" />
          <line x1="18" y1="14" x2="18" y2="34" />
          <line x1="4" y1="20" x2="32" y2="20" />
          <line x1="18" y1="34" x2="6" y2="50" />
          <line x1="18" y1="34" x2="30" y2="50" />
        </svg>
        <div className="mt-1 font-mono text-2xs">
          <Seg editing={editing} value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        </div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (d.kind === "lifeline") {
    return (
      <div className="flex flex-col items-center" onDoubleClick={enterEdit}>
        <Handle type="target" position={Position.Top} />
        <div
          className={cn(
            "border border-border bg-card px-3 py-1 font-mono text-2xs underline decoration-dotted",
            selected && "border-foreground"
          )}
        >
          <Seg editing={editing} value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        </div>
        <div className="h-40 w-px border-l border-dashed border-muted-foreground" />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (d.kind === "state") {
    return (
      <div
        onDoubleClick={enterEdit}
        className={cn(
          "rounded-full border border-border bg-card px-4 py-2 font-mono text-2xs text-foreground",
          selected && "border-foreground"
        )}
      >
        <Handle type="target" position={Position.Top} />
        <Seg editing={editing} value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (d.kind === "package") {
    return (
      <div onDoubleClick={enterEdit} className={cn("min-w-[180px]", selected && "ring-1 ring-foreground")}>
        <Handle type="target" position={Position.Top} />
        <div className="inline-block border border-b-0 border-border bg-card px-2 py-0.5 font-mono text-2xs">
          <Seg editing={editing} value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        </div>
        <div className="h-24 border border-border bg-card/50" />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (d.kind === "note") {
    return (
      <div
        onDoubleClick={enterEdit}
        className={cn(
          "min-w-[140px] border border-border bg-amber-50 p-2 font-mono text-2xs text-zinc-800 dark:bg-amber-950/30 dark:text-amber-200",
          selected && "border-foreground"
        )}
      >
        <Handle type="target" position={Position.Top} />
        <Seg editing={editing} value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  // Class-like nodes: header / fields / methods — whole block toggles editable
  return (
    <div
      onDoubleClick={enterEdit}
      className={cn(
        "flex h-full max-h-[560px] w-full min-w-[220px] max-w-[480px] flex-col break-words border bg-card font-mono text-2xs text-card-foreground",
        editing ? "border-primary/60 ring-1 ring-primary/30" : "border-border overflow-hidden",
        selected && !editing && "border-foreground ring-1 ring-foreground/20"
      )}
    >
      <NodeResizer
        isVisible={Boolean(selected)}
        minWidth={220}
        minHeight={80}
        maxWidth={480}
        maxHeight={560}
        lineClassName="!border-transparent"
        handleClassName="!h-2 !w-2 !rounded-sm !border !border-foreground !bg-card"
      />
      <TypeSuggestions />
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} id="left" />

      {/* Header */}
      <div className="shrink-0 overflow-hidden border-b border-border px-1 py-1.5 text-center">
        {(stereotype || editing) && (
          <div className="truncate text-[10px] font-normal text-muted-foreground" title={`«${stereotype}»`}>
            «
            {editing ? (
              <input
                value={d.stereotype ?? ""}
                placeholder="stereotype"
                onChange={(e) => updateNodeData(id, { stereotype: e.target.value || undefined })}
                onKeyDown={(e) => e.stopPropagation()}
                className="nodrag w-24 max-w-full rounded-sm bg-transparent text-center outline-none ring-[0.5px] ring-ring/60"
              />
            ) : (
              stereotype
            )}
            »
          </div>
        )}
        <div className="flex items-center justify-center px-1 font-semibold">
          <Seg editing={editing} autoFocus value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        </div>
      </div>

      {/* Fields / enum values */}
      {d.kind !== "interface" && (
        <div
          className={cn(
            // Make fields a flexible region so it shares vertical space with methods.
            "min-h-0 flex-1 border-b border-border py-1 scrollbar-thin",
            editing ? "overflow-visible" : "overflow-y-auto"
          )}
        >
          {d.kind === "enum" ? (
            <>
              {(d.enumValues ?? []).map((v, i) => (
                <div key={i} className="group/row flex items-center gap-0.5 px-1.5 leading-4">
                  <Seg
                    editing={editing}
                    value={v}
                    onCommit={(nv) =>
                      updateNodeData(id, {
                        enumValues: (d.enumValues ?? []).map((x, xi) => (xi === i ? nv : x)),
                      })
                    }
                    className="text-foreground/90"
                  />
                  {editing && (
                    <button
                      onClick={() =>
                        updateNodeData(id, { enumValues: (d.enumValues ?? []).filter((_, xi) => xi !== i) })
                      }
                      className="nodrag ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
              {editing && (
                <AddRowButton
                  label="value"
                  onClick={() => updateNodeData(id, { enumValues: [...(d.enumValues ?? []), "NEW_VALUE"] })}
                />
              )}
            </>
          ) : (
            <>
              {d.fields.length ? (
                d.fields.map((f) => <FieldLine key={f.id} nodeId={id} field={f} editing={editing} />)
              ) : (
                !editing && <div className="px-2 leading-4 text-muted-foreground/50">—</div>
              )}
              {editing && (
                <AddRowButton
                  label="field"
                  onClick={() =>
                    updateNodeData(id, {
                      fields: [...d.fields, { id: uid("f"), visibility: "private", name: "field", type: "String" }],
                    })
                  }
                />
              )}
            </>
          )}
        </div>
      )}
  
      {/* Methods */}
      <div className={cn("min-h-0 flex-1 py-1 scrollbar-thin", editing ? "overflow-visible" : "overflow-y-auto")}>
        {d.methods.length ? (
          d.methods.map((m) => <MethodLine key={m.id} nodeId={id} method={m} editing={editing} />)
        ) : (
          !editing && <div className="px-2 leading-4 text-muted-foreground/50">—</div>
        )}
        {editing && (
          <AddRowButton
            label="method"
            onClick={() =>
              updateNodeData(id, {
                methods: [
                  ...d.methods,
                  { id: uid("m"), visibility: "public", name: "method", params: [], returnType: "void" },
                ],
              })
            }
          />
        )}
      </div>

    </div>
  );
});
