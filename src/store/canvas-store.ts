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

export type UMLNode = Node<UMLNodeData>;
export type UMLEdge = Edge<UMLEdgeData>;

interface CanvasState {
  nodes: UMLNode[];
  edges: UMLEdge[];
  selectedIds: string[];
  gridSnap: boolean;
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
  toggleGridSnap: () => void;
  duplicateSelection: () => void;
  clear: () => void;
}

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

export const useCanvasStore = create<CanvasState>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedIds: [],
      gridSnap: true,

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
        const edge: UMLEdge = {
          id: uid("e"),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          type: "uml",
          data: { relation: "association" },
        };
        set({ edges: [...get().edges, edge] });
      },

      addNode: (kind, position, name, stereotype) => {
        const id = uid("n");
        const data = defaultData(kind, name);
        if (stereotype) {
          data.stereotype = stereotype;
          if (!name) data.name = stereotype.charAt(0).toUpperCase() + stereotype.slice(1);
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
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
          ),
        }),

      updateEdgeData: (id, patch) =>
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, ...patch } as UMLEdgeData } : e
          ),
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
    }),
    {
      limit: 100,
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }
  )
);
