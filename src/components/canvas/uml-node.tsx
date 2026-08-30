"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { Plus, X } from "lucide-react";
import type { UMLNode } from "@/store/canvas-store";
import { uid, visibilitySymbol, cn } from "@/lib/utils/cn";
import { useCanvasStore } from "@/store/canvas-store";
import { NodeHandles } from "./node-handles";
import { STEREOTYPES } from "@/lib/data/stereotypes";
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

/**
 * All suggestable stereotypes: the built-in list plus any stereotype already
 * used elsewhere on the canvas.
 */
function useAllStereotypes(): string[] {
  const used = useCanvasStore((s) =>
    s.nodes
      .map((n) => n.data.stereotype)
      .filter(Boolean)
      .join("\u0000")
  );
  return useMemo(
    () => Array.from(new Set([...STEREOTYPES, ...(used ? used.split("\u0000") : [])])),
    [used]
  );
}

/**
 * Stereotype editor with a VS Code-style inline suggestion list: filters as you
 * type, Arrow keys move through matches, Tab/Enter accepts, Escape dismisses.
 */
function StereotypeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const all = useAllStereotypes();
  const [open, setOpen] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q ? all.filter((s) => s.toLowerCase().includes(q)) : all;
    // Prefix matches first so typing "fa" surfaces "factory" before "interface".
    return pool
      .slice()
      .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [all, value]);

  const suggestions = open ? matches : [];

  const apply = (s: string) => {
    onChange(s);
    setOpen(false);
    requestAnimationFrame(() => ref.current?.blur());
  };

  return (
    <span className="relative inline-block">
      <input
        ref={ref}
        value={value}
        placeholder="stereotype"
        spellCheck={false}
        {...{ [EDITOR_ATTR]: "" }}
        onFocus={() => {
          setOpen(true);
          setSelIdx(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setSelIdx(0);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (suggestions.length) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelIdx((i) => Math.min(i + 1, suggestions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelIdx((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Tab" || e.key === "Enter") {
              e.preventDefault();
              apply(suggestions[selIdx]);
              return;
            }
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
          }
          if (onVerticalNav(e)) return;
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="nodrag w-24 max-w-full rounded-sm bg-transparent text-center outline-none ring-[0.5px] ring-ring/60"
      />
      <SuggestionList suggestions={suggestions} selIdx={selIdx} onPick={apply} placement="below" />
    </span>
  );
}

/** Renders the shared <datalist> of primitive + workspace-defined types. */
function TypeSuggestions() {
  const options = useAllTypes();
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

/** Marks an element as part of a node's vertical edit-field sequence. */
const EDITOR_ATTR = "data-uml-editor";

type TextControl = HTMLInputElement | HTMLTextAreaElement;

/**
 * Moves focus to the previous/next editable field within the same node.
 * Returns false when there is no such field (caller lets the key through).
 */
function focusAdjacentEditor(el: TextControl, dir: 1 | -1): boolean {
  const container = el.closest("[data-uml-node]");
  if (!container) return false;
  const editors = Array.from(container.querySelectorAll<TextControl>(`[${EDITOR_ATTR}]`));
  const target = editors[editors.indexOf(el) + dir];
  if (!target) return false;
  target.focus();
  // Park the caret at the end so typing appends rather than replacing.
  const len = target.value.length;
  requestAnimationFrame(() => target.setSelectionRange(len, len));
  return true;
}

/**
 * ArrowUp/ArrowDown handler shared by every in-node editor.
 * Call after the autocomplete handler so an open suggestion list wins.
 */
function onVerticalNav(e: React.KeyboardEvent<TextControl>): boolean {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (!focusAdjacentEditor(e.currentTarget, e.key === "ArrowDown" ? 1 : -1)) return false;
  e.preventDefault();
  return true;
}

/**
 * Shift+Cmd/Ctrl+Backspace deletes the row whose editor currently has focus.
 *
 * Other candidates are taken: Cmd+D is "bookmark page" and Ctrl+Shift+K is
 * Firefox's web console — both are handled by the browser before the page sees
 * them, so they can't be overridden.
 *
 * Focus moves to the next editor (or the previous one for the last row) so the
 * user can keep deleting without reaching for the mouse.
 */
function onDeleteRow(e: React.KeyboardEvent<TextControl>, remove: () => void): boolean {
  const isBackspace = e.key === "Backspace" || e.key === "Delete";
  if (!isBackspace || !e.shiftKey || !(e.metaKey || e.ctrlKey)) return false;
  e.preventDefault();
  const el = e.currentTarget;
  if (!focusAdjacentEditor(el, 1)) focusAdjacentEditor(el, -1);
  remove();
  return true;
}

/**
 * All suggestable types: primitives + workspace-defined class/interface/enum names.
 *
 * Subscribes to a joined string rather than the node array so it only re-runs
 * when a type name actually changes — not on every drag frame.
 */
function useAllTypes(): string[] {
  const names = useCanvasStore((s) =>
    s.nodes
      .filter((n) => ["class", "abstract", "interface", "enum", "record"].includes(n.data.kind))
      .map((n) => n.data.name)
      .join("\u0000")
  );
  return useMemo(
    () => Array.from(new Set([...PRIMITIVE_TYPES, ...(names ? names.split("\u0000") : [])])),
    [names]
  );
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

/** Shared suggestion dropdown rendered next to the input. */
function SuggestionList({
  suggestions,
  selIdx,
  onPick,
  placement = "above",
}: {
  suggestions: string[];
  selIdx: number;
  onPick: (s: string) => void;
  placement?: "above" | "below";
}) {
  if (!suggestions.length) return null;
  return (
    <div
      className={cn(
        "absolute left-0 z-[100] min-w-[120px] rounded-md border border-border bg-popover py-0.5 text-left shadow-md",
        placement === "below" ? "top-full mt-0.5" : "bottom-full mb-0.5"
      )}
    >
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
  onDelete,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  editing: boolean;
  autoFocus?: boolean;
  isType?: boolean;
  onDelete?: () => void;
}) {
  const [text, setText] = useState(value);
  const wasEditing = useRef(false);
  // Set by Cmd+D. Enum values are addressed by index, so a blur-commit after
  // the row is gone would overwrite whichever value shifted into its slot.
  const deleted = useRef(false);

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
      {...{ [EDITOR_ATTR]: "" }}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => {
        if (!deleted.current) onCommit(text.trim() || value);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (
          onDelete &&
          onDeleteRow(e, () => {
            deleted.current = true;
            onDelete();
          })
        )
          return;
        if (onVerticalNav(e)) return;
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        "nodrag nowheel block min-w-0 flex-1 resize-none overflow-hidden whitespace-pre-wrap break-all rounded-sm bg-transparent px-0.5 leading-4 text-foreground/90 outline-none ring-[0.5px] ring-ring/60",
        className
      )}
    />
  );
}

/**
 * Free-form multiline body of a note node.
 *
 * Unlike the single-line editors, Enter inserts a newline; Escape (handled by
 * the node) leaves edit mode. Text fills the node box so it grows with the
 * resize handles rather than with its content.
 */
function NoteBody({
  value,
  onCommit,
  editing,
}: {
  value: string;
  onCommit: (v: string) => void;
  editing: boolean;
}) {
  const [text, setText] = useState(value);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing && !wasEditing.current) setText(value);
    wasEditing.current = editing;
  }, [editing, value]);

  if (!editing) {
    return (
      <div className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words">
        {value || <span className="opacity-50">Double-click to edit…</span>}
      </div>
    );
  }
  return (
    <textarea
      autoFocus
      value={text}
      placeholder="Note…"
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        // Let the textarea own every key (including Enter and Backspace) so it
        // behaves like a normal text box instead of triggering canvas shortcuts.
        e.stopPropagation();
      }}
      className="nodrag nowheel min-h-0 w-full flex-1 resize-none whitespace-pre-wrap break-words bg-transparent leading-4 outline-none ring-[0.5px] ring-ring/60 scrollbar-thin"
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
  // No store subscription: the row already receives `field` as a prop, and
  // mutations read the latest state on demand.
  const patch = (p: Partial<UMLField>) => {
    const { nodes, updateNodeData } = useCanvasStore.getState();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, {
      fields: node.data.fields.map((f) => (f.id === field.id ? { ...f, ...p } : f)),
    });
  };
  const remove = () => {
    const { nodes, updateNodeData } = useCanvasStore.getState();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, { fields: node.data.fields.filter((f) => f.id !== field.id) });
  };
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
            {...{ [EDITOR_ATTR]: "" }}
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
              if (onDeleteRow(e, remove)) return;
              if (onVerticalNav(e)) return;
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
          title="Delete field (⇧⌘⌫)"
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
  onDelete,
}: {
  method: UMLMethod;
  onCommit: (name: string, params: UMLMethod["params"], returnType: string) => void;
  onDelete: () => void;
}) {
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
        {...{ [EDITOR_ATTR]: "" }}
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
          if (onDeleteRow(e, onDelete)) return;
          if (onVerticalNav(e)) return;
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
  const patch = (p: Partial<UMLMethod>) => {
    const { nodes, updateNodeData } = useCanvasStore.getState();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, {
      methods: node.data.methods.map((m) => (m.id === method.id ? { ...m, ...p } : m)),
    });
  };
  const remove = () => {
    const { nodes, updateNodeData } = useCanvasStore.getState();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, { methods: node.data.methods.filter((m) => m.id !== method.id) });
  };

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
          onDelete={remove}
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
          title="Delete method (⇧⌘⌫)"
          className="nodrag ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center self-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function AddRowButton({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="nodrag flex w-full items-center gap-1 px-1.5 py-0.5 text-left text-[10px] text-muted-foreground/60 transition-colors hover:bg-accent/50 hover:text-muted-foreground"
    >
      <Plus className="h-2.5 w-2.5" /> {label}
      {hint && <span className="ml-auto tabular-nums opacity-60">{hint}</span>}
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

  // Which section just gained a row, so we can focus it once it renders.
  const pendingFocus = useRef<"fields" | "methods" | null>(null);

  const addField = useCallback(() => {
    const n = useCanvasStore.getState().nodes.find((x) => x.id === id);
    if (!n) return;
    updateNodeData(id, {
      fields: [
        ...n.data.fields,
        { id: uid("f"), visibility: "private", name: "field", type: "String" },
      ],
    });
    pendingFocus.current = "fields";
  }, [id, updateNodeData]);

  const addMethod = useCallback(() => {
    const n = useCanvasStore.getState().nodes.find((x) => x.id === id);
    if (!n) return;
    updateNodeData(id, {
      methods: [
        ...n.data.methods,
        { id: uid("m"), visibility: "public", name: "method", params: [], returnType: "void" },
      ],
    });
    pendingFocus.current = "methods";
  }, [id, updateNodeData]);

  // Focus the newly added row's editor once it has mounted.
  useEffect(() => {
    const section = pendingFocus.current;
    if (!section || !editing) return;
    pendingFocus.current = null;
    requestAnimationFrame(() => {
      const container = document.querySelector(`[data-uml-node="${id}"]`);
      const rows = container?.querySelectorAll<HTMLTextAreaElement>(
        `[data-uml-section="${section}"] [${EDITOR_ATTR}]`
      );
      const last = rows?.[rows.length - 1];
      last?.focus();
      last?.select();
    });
  }, [id, editing, d.fields.length, d.methods.length]);

  // Cmd/Ctrl+F adds a field, Cmd/Ctrl+M adds a method, while this node is active.
  useEffect(() => {
    if (!selected && !editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "f" && k !== "m") return;
      // Interfaces have no field compartment.
      if (k === "f" && (d.kind === "interface" || d.kind === "enum")) return;
      e.preventDefault();
      e.stopPropagation();
      setEditing(true);
      if (k === "f") addField();
      else addMethod();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selected, editing, d.kind, addField, addMethod]);

  // Exit edit mode when deselected
  useEffect(() => {
    if (!selected) setEditing(false);
  }, [selected]);

  // Enter edit mode on request (Enter key, or right after this node is created)
  useEffect(() => {
    const onEnterEdit = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === id) setEditing(true);
    };
    window.addEventListener("uml:enter-edit", onEnterEdit);
    return () => window.removeEventListener("uml:enter-edit", onEnterEdit);
  }, [id]);

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
        className={cn("group/node flex flex-col items-center text-foreground", selected && "opacity-90")}
      >
        <NodeHandles compact />
        <svg width="36" height="52" viewBox="0 0 36 52" className="stroke-foreground" fill="none" strokeWidth="1.5">
          <circle cx="18" cy="8" r="6" />
          <line x1="18" y1="14" x2="18" y2="34" />
          <line x1="4" y1="20" x2="32" y2="20" />
          <line x1="18" y1="34" x2="6" y2="50" />
          <line x1="18" y1="34" x2="30" y2="50" />
        </svg>
        <div className="mt-1 font-mono text-2xs">
          <Seg editing={editing} autoFocus value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        </div>
      </div>
    );
  }

  if (d.kind === "lifeline") {
    return (
      <div className="group/node flex flex-col items-center" onDoubleClick={enterEdit}>
        <NodeHandles compact />
        <div
          className={cn(
            "border border-border bg-card px-3 py-1 font-mono text-2xs underline decoration-dotted",
            selected && "border-foreground"
          )}
        >
          <Seg editing={editing} autoFocus value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        </div>
        <div className="h-40 w-px border-l border-dashed border-muted-foreground" />
      </div>
    );
  }

  if (d.kind === "state") {
    return (
      <div
        onDoubleClick={enterEdit}
        className={cn(
          "group/node rounded-full border border-border bg-card px-4 py-2 font-mono text-2xs text-foreground",
          selected && "border-foreground"
        )}
      >
        <NodeHandles compact />
        <Seg editing={editing} autoFocus value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
      </div>
    );
  }

  if (d.kind === "package") {
    return (
      <div onDoubleClick={enterEdit} className={cn("group/node min-w-[180px]", selected && "ring-1 ring-foreground")}>
        <NodeHandles />
        <div className="inline-block border border-b-0 border-border bg-card px-2 py-0.5 font-mono text-2xs">
          <Seg editing={editing} autoFocus value={d.name} onCommit={(v) => updateNodeData(id, { name: v })} />
        </div>
        <div className="h-24 border border-border bg-card/50" />
      </div>
    );
  }

  if (d.kind === "note") {
    return (
      <div
        onDoubleClick={enterEdit}
        className={cn(
          "group/node flex h-full min-h-[48px] w-full min-w-[140px] flex-col border border-border bg-amber-50 p-2 font-mono text-2xs text-zinc-800 dark:bg-amber-950/30 dark:text-amber-200",
          selected && "border-foreground"
        )}
      >
        <NodeResizer
          isVisible={Boolean(selected)}
          minWidth={140}
          minHeight={48}
          lineClassName="!border-transparent"
          handleClassName="!h-2 !w-2 !rounded-sm !border !border-foreground !bg-card"
        />
        <NodeHandles compact />
        <NoteBody
          editing={editing}
          value={d.name}
          onCommit={(v) => updateNodeData(id, { name: v })}
        />
      </div>
    );
  }

  // Class-like nodes: header / fields / methods — whole block toggles editable
  return (
    <div
      data-uml-node={id}
      onDoubleClick={enterEdit}
      className={cn(
        "group/node flex h-full max-h-[560px] w-full min-w-[220px] max-w-[480px] flex-col break-words border bg-card font-mono text-2xs text-card-foreground",
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
      <NodeHandles />

      {/* Header */}
      <div
        className={cn(
          "shrink-0 border-b border-border px-1 py-1.5 text-center",
          // While editing, the stereotype suggestion popup must escape the header.
          editing ? "overflow-visible" : "overflow-hidden"
        )}
      >
        {(stereotype || d.stereotype !== undefined || editing) && (
          <div
            className={cn(
              "text-[10px] font-normal text-muted-foreground",
              !editing && "truncate"
            )}
            title={`«${stereotype}»`}
          >
            «
            {editing ? (
              <StereotypeInput
                value={d.stereotype ?? ""}
                onChange={(v) => updateNodeData(id, { stereotype: v })}
              />
            ) : (
              stereotype || <span className="text-muted-foreground/50">stereotype</span>
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
          data-uml-section="fields"
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
                    onDelete={() =>
                      updateNodeData(id, {
                        enumValues: (d.enumValues ?? []).filter((_, xi) => xi !== i),
                      })
                    }
                  />
                  {editing && (
                    <button
                      onClick={() =>
                        updateNodeData(id, { enumValues: (d.enumValues ?? []).filter((_, xi) => xi !== i) })
                      }
                      title="Delete value (⇧⌘⌫)"
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
                  hint="⌘F"
                  onClick={addField}
                />
              )}
            </>
          )}
        </div>
      )}
  
      {/* Methods */}
      <div
        data-uml-section="methods"
        className={cn("min-h-0 flex-1 py-1 scrollbar-thin", editing ? "overflow-visible" : "overflow-y-auto")}
      >
        {d.methods.length ? (
          d.methods.map((m) => <MethodLine key={m.id} nodeId={id} method={m} editing={editing} />)
        ) : (
          !editing && <div className="px-2 leading-4 text-muted-foreground/50">—</div>
        )}
        {editing && <AddRowButton label="method" hint="⌘M" onClick={addMethod} />}
      </div>

    </div>
  );
});
