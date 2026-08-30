"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { UMLEdgeData, UMLNodeData } from "@/lib/types";
import { uid } from "@/lib/utils/cn";
import { parseWorkspaceJson, serializeWorkspace, parseGraph } from "@/lib/utils/schema";
import {
  alignNodes,
  autoLayout,
  distributeNodes,
  type AlignAxis,
  type DistributeAxis,
} from "@/lib/canvas/layout";

export type UMLNode = Node<UMLNodeData>;
export type UMLEdge = Edge<UMLEdgeData>;

export type Diagram = {
  id: string;
  name: string;
  nodes: UMLNode[];
  edges: UMLEdge[];
  createdAt: string;
  updatedAt: string;
};

interface CanvasState {
  nodes: UMLNode[];
  edges: UMLEdge[];
  selectedIds: string[];
  gridSnap: boolean;

  /** False until `hydrate()` has run; guards autosave from clobbering storage. */
  hydrated: boolean;

  // diagram management
  diagrams: Diagram[];
  currentDiagramId?: string;

  /** Loads persisted state from localStorage. Safe to call more than once. */
  hydrate: () => void;

  onNodesChange: (changes: NodeChange<UMLNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<UMLEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (
    kind: UMLNodeData["kind"],
    position: { x: number; y: number },
    name?: string,
    stereotype?: string
  ) => string;
  updateNodeData: (id: string, patch: Partial<UMLNodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<UMLEdgeData>) => void;
  deleteSelection: () => void;
  setNodes: (nodes: UMLNode[]) => void;
  setEdges: (edges: UMLEdge[]) => void;
  setDiagram: (nodes: UMLNode[], edges: UMLEdge[]) => void;
  /** Makes `id` the sole selected node. */
  selectOnly: (id: string) => void;

  // multi-diagram API
  createDiagram: (name?: string, nodes?: UMLNode[], edges?: UMLEdge[]) => string;
  loadDiagram: (id: string) => void;
  saveDiagram: (id?: string) => void;
  deleteDiagram: (id: string) => void;
  renameDiagram: (id: string, name: string) => void;

  toggleGridSnap: () => void;
  duplicateSelection: () => void;
  clear: () => void;

  /** Aligns selected nodes along one edge of their bounding box. */
  alignSelection: (axis: AlignAxis) => void;
  /** Evens out the gaps between selected nodes. */
  distributeSelection: (axis: DistributeAxis) => void;
  /** Re-flows the whole diagram into inheritance-aware layers. */
  tidyLayout: () => void;
  /** Serializes the current selection for the clipboard. */
  copySelection: () => string | null;
  /** Inserts nodes/edges from a clipboard payload; returns the new node ids. */
  pasteClipboard: (payload: string, offset?: { x: number; y: number }) => string[];
}

const STORAGE_KEY = "lld-playground:workspace";

/** Storage keys written by earlier versions, read once then removed. */
const LEGACY_KEYS = ["lld:diagrams", "lld-playground:workspace:v0"];

/** Marker on clipboard payloads so we ignore unrelated JSON. */
const CLIPBOARD_TYPE = "lld-playground/clipboard";

const defaultData = (kind: UMLNodeData["kind"], name?: string): UMLNodeData => {
  const base: UMLNodeData = { kind, name: name ?? defaultName(kind), fields: [], methods: [] };
  if (kind === "class") {
    base.fields = [{ id: uid("f"), visibility: "private", name: "id", type: "String" }];
    base.methods = [
      { id: uid("m"), visibility: "public", name: "getId", params: [], returnType: "String" },
    ];
  }
  if (kind === "interface") {
    base.stereotype = "interface";
    base.methods = [{ id: uid("m"), visibility: "public", name: "execute", params: [], returnType: "void" }];
  }
  if (kind === "abstract") base.stereotype = "abstract";
  if (kind === "enum") base.enumValues = ["VALUE_A", "VALUE_B"];
  return base;
};

function defaultName(kind: UMLNodeData["kind"]): string {
  switch (kind) {
    case "class":
      return "NewClass";
    case "abstract":
      return "AbstractBase";
    case "interface":
      return "IInterface";
    case "enum":
      return "Enumeration";
    case "record":
      return "ValueObject";
    case "actor":
      return "Actor";
    case "lifeline":
      return "lifeline:Object";
    case "state":
      return "State";
    case "package":
      return "package";
    case "note":
      return "note";
    default:
      return "Node";
  }
}

function loadPersisted(): { diagrams: Diagram[]; currentDiagramId?: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return parseWorkspaceJson(raw);

  for (const key of LEGACY_KEYS) {
    const legacy = localStorage.getItem(key);
    if (!legacy) continue;
    const parsed = parseWorkspaceJson(legacy);
    localStorage.removeItem(key);
    if (parsed) return parsed;
  }
  return null;
}

function persist(diagrams: Diagram[], currentDiagramId?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeWorkspace(diagrams, currentDiagramId));
  } catch (e) {
    console.warn("failed to persist diagrams", e);
  }
}

function blankDiagram(name = "Default"): Diagram {
  const now = new Date().toISOString();
  return { id: uid("D"), name, nodes: [], edges: [], createdAt: now, updatedAt: now };
}

/**
 * Fields that change as a by-product of interacting with a node (selecting it,
 * dragging it, React Flow measuring it) rather than as a real edit. History
 * entries are compared with these stripped out so they never create an undo step.
 */
const TRANSIENT_NODE_KEYS = [
  "position",
  "positionAbsolute",
  "selected",
  "dragging",
  "resizing",
  "measured",
  "width",
  "height",
] as const;

function stripTransient(node: UMLNode) {
  const rest: Record<string, unknown> = { ...node };
  for (const key of TRANSIENT_NODE_KEYS) delete rest[key];
  return rest;
}

/** True when two snapshots differ only by selection/position/measurement noise. */
function snapshotsEqual(
  a: { nodes: UMLNode[]; edges: UMLEdge[] } | undefined,
  b: { nodes: UMLNode[]; edges: UMLEdge[] } | undefined
) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  const normalize = (s: { nodes: UMLNode[]; edges: UMLEdge[] }) => ({
    nodes: s.nodes.map(stripTransient),
    edges: s.edges.map(({ selected, ...rest }) => rest),
  });
  try {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  } catch {
    return false;
  }
}

/**
 * Leading-edge throttle. Used so a burst of edits (typing a class name one
 * character at a time) collapses into a single undo step: the first call in the
 * burst records the pre-edit state and the rest are dropped.
 */
function throttleLeading<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    } else if (!timer) {
      // Re-open the window once the burst goes quiet.
      timer = setTimeout(() => {
        timer = null;
        last = 0;
      }, ms);
    }
  }) as T;
}

export const useCanvasStore = create<CanvasState>()(
  temporal(
    (set, get) => {
      // NOTE: no localStorage access here — the store is created during SSR/prerender.
      // Real state arrives via `hydrate()`, called from a client effect.
      const initialDiagram = blankDiagram();

      return {
        nodes: [],
        edges: [],
        selectedIds: [],
        gridSnap: true,
        hydrated: false,

        diagrams: [initialDiagram],
        currentDiagramId: initialDiagram.id,

        hydrate: () => {
          if (get().hydrated) return;
          const persisted = loadPersisted();
          if (!persisted) {
            set({ hydrated: true });
            return;
          }
          const current =
            persisted.diagrams.find((d) => d.id === persisted.currentDiagramId) ??
            persisted.diagrams[0];
          set({
            diagrams: persisted.diagrams,
            currentDiagramId: current.id,
            nodes: current.nodes,
            edges: current.edges,
            selectedIds: [],
            hydrated: true,
          });
        },

        onNodesChange: (changes) => {
          set({ nodes: applyNodeChanges(changes, get().nodes) });
          const selected = changes
            .filter((c) => c.type === "select" && c.selected)
            .map((c) => (c as { id: string }).id);
          if (selected.length) set({ selectedIds: selected });
          const deselectedAll = changes.some((c) => c.type === "select" && !c.selected);
          if (deselectedAll && !selected.length) {
            const still = get().nodes.filter((n) => n.selected).map((n) => n.id);
            set({ selectedIds: still });
          }
        },

        onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

        onConnect: (connection) => {
          const { source, target } = connection;
          // Guard here too: onConnect is also called programmatically.
          if (!source || !target || source === target) return;
          const existing = get().edges;
          if (existing.some((e) => e.source === source && e.target === target)) return;
          const edge: UMLEdge = {
            id: uid("e"),
            source,
            target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            type: "uml",
            data: { relation: "association" },
          };
          set({ edges: [...existing, edge] });
        },

        addNode: (kind, position, name, stereotype) => {
          const id = uid("n");
          const data = defaultData(kind, name);
          // An empty string is meaningful: it marks a generic box whose
          // stereotype slot is shown so the user can fill it in.
          if (stereotype !== undefined) {
            data.stereotype = stereotype;
            if (stereotype && !name)
              data.name = stereotype.charAt(0).toUpperCase() + stereotype.slice(1);
          }
          const node: UMLNode = {
            id,
            type: "uml",
            position,
            data,
          };
          set({ nodes: [...get().nodes, node] });
          return id;
        },

        updateNodeData: (id, patch) =>
          set({
            nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
          }),

        updateEdgeData: (id, patch) =>
          set({
            edges: get().edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } as UMLEdgeData } : e)),
          }),

        deleteSelection: () => {
          const { nodes, edges } = get();
          const removedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
          const removedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));
          set({
            nodes: nodes.filter((n) => !removedNodeIds.has(n.id)),
            edges: edges.filter(
              (e) =>
                !removedEdgeIds.has(e.id) &&
                !removedNodeIds.has(e.source) &&
                !removedNodeIds.has(e.target)
            ),
            selectedIds: [],
          });
        },

        setNodes: (nodes) => set({ nodes }),
        setEdges: (edges) => set({ edges }),
        setDiagram: (nodes, edges) => set({ nodes, edges, selectedIds: [] }),

        selectOnly: (id) =>
          set({
            nodes: get().nodes.map((n) => ({ ...n, selected: n.id === id })),
            edges: get().edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
            selectedIds: [id],
          }),

        // multi-diagram API
        createDiagram: (name = "Untitled", nodes = [], edges = []) => {
          const id = uid("D");
          const now = new Date().toISOString();
          const d: Diagram = { id, name, nodes, edges, createdAt: now, updatedAt: now };
          set((state) => {
            const diagrams = [...state.diagrams, d];
            persist(diagrams, id);
            return { diagrams, currentDiagramId: id, nodes: d.nodes, edges: d.edges, selectedIds: [] };
          });
          return id;
        },

        loadDiagram: (id) => {
          const d = get().diagrams.find((x) => x.id === id);
          if (!d) return;
          set({ nodes: d.nodes, edges: d.edges, selectedIds: [], currentDiagramId: id });
          persist(get().diagrams, id);
        },

        saveDiagram: (id) => {
          const targetId = id ?? get().currentDiagramId;
          if (!targetId) return;
          set((state) => {
            const now = new Date().toISOString();
            const diagrams = state.diagrams.map((d) =>
              d.id === targetId ? { ...d, nodes: state.nodes, edges: state.edges, updatedAt: now } : d
            );
            persist(diagrams, targetId);
            return { diagrams };
          });
        },

        deleteDiagram: (id) => {
          set((state) => {
            const diagrams = state.diagrams.filter((d) => d.id !== id);
            let current = state.currentDiagramId;
            if (current === id) {
              current = diagrams.length ? diagrams[0].id : undefined;
            }
            const nextNodes = diagrams.length && current ? diagrams.find((d) => d.id === current)!.nodes : [];
            const nextEdges = diagrams.length && current ? diagrams.find((d) => d.id === current)!.edges : [];
            persist(diagrams, current);
            return { diagrams, currentDiagramId: current, nodes: nextNodes ?? [], edges: nextEdges ?? [], selectedIds: [] };
          });
        },

        renameDiagram: (id, name) => {
          set((state) => {
            const diagrams = state.diagrams.map((d) => (d.id === id ? { ...d, name, updatedAt: new Date().toISOString() } : d));
            persist(diagrams, state.currentDiagramId);
            return { diagrams };
          });
        },

        toggleGridSnap: () => set({ gridSnap: !get().gridSnap }),

        duplicateSelection: () => {
          const { nodes, edges } = get();
          const selected = nodes.filter((n) => n.selected);
          if (!selected.length) return;
          const idMap = new Map<string, string>();
          const newNodes = selected.map((n) => {
            const nid = uid("n");
            idMap.set(n.id, nid);
            return {
              ...n,
              id: nid,
              position: { x: n.position.x + 32, y: n.position.y + 32 },
              selected: true,
              data: JSON.parse(JSON.stringify(n.data)) as UMLNodeData,
            };
          });
          const newEdges = edges
            .filter((e) => idMap.has(e.source) && idMap.has(e.target))
            .map((e) => ({
              ...e,
              id: uid("e"),
              source: idMap.get(e.source)!,
              target: idMap.get(e.target)!,
              selected: false,
            }));
          set({
            nodes: nodes.map((n) => ({ ...n, selected: false })).concat(newNodes),
            edges: edges.concat(newEdges),
            selectedIds: newNodes.map((n) => n.id),
          });
        },

        clear: () => set({ nodes: [], edges: [], selectedIds: [] }),

        alignSelection: (axis) => {
          const { nodes } = get();
          const moves = alignNodes(nodes.filter((n) => n.selected), axis);
          if (!moves.size) return;
          set({
            nodes: nodes.map((n) => (moves.has(n.id) ? { ...n, position: moves.get(n.id)! } : n)),
          });
        },

        distributeSelection: (axis) => {
          const { nodes } = get();
          const moves = distributeNodes(nodes.filter((n) => n.selected), axis);
          if (!moves.size) return;
          set({
            nodes: nodes.map((n) => (moves.has(n.id) ? { ...n, position: moves.get(n.id)! } : n)),
          });
        },

        tidyLayout: () => {
          const { nodes, edges } = get();
          // Tidy the selection if there is one, otherwise the whole diagram.
          const target = nodes.some((n) => n.selected) ? nodes.filter((n) => n.selected) : nodes;
          const ids = new Set(target.map((n) => n.id));
          const scoped = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
          const moves = autoLayout(target, scoped);
          if (!moves.size) return;
          set({
            nodes: nodes.map((n) => (moves.has(n.id) ? { ...n, position: moves.get(n.id)! } : n)),
          });
        },

        copySelection: () => {
          const { nodes, edges } = get();
          const picked = nodes.filter((n) => n.selected);
          if (!picked.length) return null;
          const ids = new Set(picked.map((n) => n.id));
          return JSON.stringify({
            type: CLIPBOARD_TYPE,
            nodes: picked,
            // Only edges fully inside the selection survive the round trip.
            edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
          });
        },

        pasteClipboard: (payload, offset = { x: 32, y: 32 }) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            return [];
          }
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            (parsed as { type?: string }).type !== CLIPBOARD_TYPE
          ) {
            return [];
          }
          // Reuse the import validator so pasted data is sanitized too.
          const { nodes: srcNodes, edges: srcEdges } = parseGraph(parsed);
          if (!srcNodes.length) return [];

          const idMap = new Map<string, string>();
          const newNodes = srcNodes.map((n) => {
            const nid = uid("n");
            idMap.set(n.id, nid);
            return {
              ...n,
              id: nid,
              position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
              selected: true,
            };
          });
          const newEdges = srcEdges.map((e) => ({
            ...e,
            id: uid("e"),
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!,
            selected: false,
          }));

          set((state) => ({
            nodes: state.nodes.map((n) => ({ ...n, selected: false })).concat(newNodes),
            edges: state.edges.map((e) => ({ ...e, selected: false })).concat(newEdges),
            selectedIds: newNodes.map((n) => n.id),
          }));
          return newNodes.map((n) => n.id);
        },
      };
    },
    {
      limit: 100,
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      equality: snapshotsEqual,
      // Collapse rapid successive edits into one undo step.
      handleSet: (handleSet) => throttleLeading(handleSet, 500),
    }
  )
);
