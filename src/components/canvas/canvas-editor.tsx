"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { UMLNodeRenderer } from "./uml-node";
import { UMLEdgeMarkers, UMLEdgeRenderer } from "./uml-edge";
import { CanvasSearch } from "@/components/modals/canvas-search";
import { exportPng, exportSvg } from "@/lib/canvas/export-image";
import { AlignToolbar } from "./align-toolbar";
import type { UMLNodeData } from "@/lib/types";

const nodeTypes = { uml: UMLNodeRenderer };
const edgeTypes = { uml: UMLEdgeRenderer };

// Hook version for reactive temporal state
import { useStore } from "zustand";
export function useTemporal() {
  return useStore(useCanvasStore.temporal, (s) => s);
}

function CanvasInner() {
  // Fine-grained selectors: subscribing to the whole store re-rendered the
  // canvas on unrelated changes (selection bookkeeping, diagram list, etc).
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);
  const deleteSelection = useCanvasStore((s) => s.deleteSelection);
  const duplicateSelection = useCanvasStore((s) => s.duplicateSelection);
  const gridSnap = useCanvasStore((s) => s.gridSnap);

  const activeTool = useUIStore((s) => s.activeTool);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const minimapVisible = useUIStore((s) => s.minimapVisible);

  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  // Always-fresh cursor position in flow coordinates (for hotkey placement)
  const cursorFlow = useRef({ x: 0, y: 0 });

  // Throttle mouse-move updates to the browser refresh rate (≈60fps) using requestAnimationFrame
  const rafRef = useRef<number | null>(null);
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/uml-kind") as UMLNodeData["kind"];
      if (!kind) return;
      // An empty string is a valid value (generic box with a blank stereotype
      // slot), so distinguish "absent" by checking the data types.
      const stereotype = e.dataTransfer.types.includes("application/uml-stereotype")
        ? e.dataTransfer.getData("application/uml-stereotype")
        : undefined;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(kind, position, undefined, stereotype);
    },
    [addNode, screenToFlowPosition]
  );

  // Click-to-place: shape library clicks dispatch a custom event with the kind (+ optional stereotype)
  useEffect(() => {
    const onPlace = (e: Event) => {
      const detail = (e as CustomEvent<{ kind: UMLNodeData["kind"]; stereotype?: string } | UMLNodeData["kind"]>).detail;
      const kind = typeof detail === "string" ? detail : detail?.kind;
      if (!kind) return;
      const stereotype = typeof detail === "object" ? detail.stereotype : undefined;
      const el = wrapper.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      // Cascade: offset each new node so consecutive clicks don't stack
      const count = useCanvasStore.getState().nodes.length;
      const offset = (count % 8) * 28;
      addNode(kind, { x: center.x - 110 + offset, y: center.y - 60 + offset }, undefined, stereotype);
    };
    window.addEventListener("uml:place-node", onPlace);
    return () => window.removeEventListener("uml:place-node", onPlace);
  }, [addNode, screenToFlowPosition]);

  // Image export has to run from here: `onlyRenderVisibleElements` keeps
  // off-screen nodes out of the DOM, so we temporarily render everything.
  // Toggling that flag (rather than calling fitView) keeps the user's viewport
  // untouched, so the canvas doesn't visibly zoom during the export.
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const onExport = async (e: Event) => {
      const format = (e as CustomEvent<{ format: "png" | "svg" }>).detail?.format ?? "png";
      const { nodes, edges } = useCanvasStore.getState();
      if (!nodes.length) {
        window.alert("Nothing to export — the canvas is empty.");
        return;
      }
      setExporting(true);
      // Two frames: one for React to commit the extra nodes, one for layout.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const bgVar = getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
      const background = bgVar ? `hsl(${bgVar})` : "#ffffff";

      try {
        const ok =
          format === "svg"
            ? await exportSvg(nodes, edges, background)
            : await exportPng(nodes, edges, background);
        if (!ok) window.alert("Could not export the image.");
      } finally {
        setExporting(false);
      }
    };
    window.addEventListener("uml:export-image", onExport);
    return () => window.removeEventListener("uml:export-image", onExport);
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Cursor position is only read by keyboard handlers, so keep it in a ref.
      // Pushing it into the store re-rendered every store subscriber ~60x/sec.
      const { clientX, clientY } = e;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          const p = pendingPosRef.current;
          if (p) cursorFlow.current = screenToFlowPosition(p);
          rafRef.current = null;
          pendingPosRef.current = null;
        });
      }
      pendingPosRef.current = { x: clientX, y: clientY };
    },
    [screenToFlowPosition]
  );

  // Select a freshly created node and drop it straight into edit mode.
  // The dispatch waits a frame so the node has mounted and can hear the event.
  const focusNewNode = useCallback((id: string) => {
    useCanvasStore.getState().selectOnly(id);
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("uml:enter-edit", { detail: { id } }));
    });
  }, []);

  // Remembers where the in-flight connection started (for drop-on-empty-canvas).
  const connectionOrigin = useRef<{ fromNode: string | null; fromHandle: string | null }>({
    fromNode: null,
    fromHandle: null,
  });

  // Reject self-connections and duplicates so dragging can't create junk edges.
  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target) return false;
    return !useCanvasStore
      .getState()
      .edges.some((e) => e.source === c.source && e.target === c.target);
  }, []);

  // `connecting` reveals every node's handles while a connection is in flight,
  // so the user can see all the available drop targets.
  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null }) => {
      connectionOrigin.current = { fromNode: params.nodeId, fromHandle: params.handleId };
      wrapper.current?.querySelector(".react-flow")?.classList.add("connecting");
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      wrapper.current?.querySelector(".react-flow")?.classList.remove("connecting");

      // Dropped on empty canvas: spawn a connected class so the user can keep
      // sketching without breaking flow.
      const target = event.target as HTMLElement | null;
      if (!target?.classList.contains("react-flow__pane")) return;
      const { fromNode, fromHandle } = connectionOrigin.current;
      if (!fromNode) return;

      const point =
        "changedTouches" in event
          ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
          : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
      const position = screenToFlowPosition(point);

      const store = useCanvasStore.getState();
      const newId = store.addNode("class", { x: position.x - 110, y: position.y - 40 });
      store.onConnect({
        source: fromNode,
        target: newId,
        sourceHandle: fromHandle,
        targetHandle: null,
      });
      focusNewNode(newId);
    },
    [screenToFlowPosition, focusNewNode]
  );

  // Cleanup any pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Text tool: click on empty canvas places a note node
  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (useUIStore.getState().activeTool !== "text") return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode("note", position, "note");
      useUIStore.getState().setActiveTool("pointer");
    },
    [addNode, screenToFlowPosition]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (inInput) return;

      // If a node is selected and Enter is pressed, open edit mode for that node
      if (e.key === "Enter" && !mod) {
        const selected = useCanvasStore.getState().nodes.filter((n) => n.selected);
        if (selected.length === 1) {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("uml:enter-edit", { detail: { id: selected[0].id } })
          );
          return;
        }
      }

      // Shortcuts: Shift+<key> to insert UML blocks at cursor (or center if not over canvas)
      const addAtCursor = (kind: UMLNodeData["kind"], name?: string) => {
        e.preventDefault();
        const el = wrapper.current;
        let pos = cursorFlow.current;
        const overCanvas = el && el.matches(":hover");
        if (!overCanvas && el) {
          const rect = el.getBoundingClientRect();
          pos = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
        // center-offset similar to click-to-place
        const id = addNode(kind, { x: pos.x - 110, y: pos.y - 60 }, name);
        useUIStore.getState().setActiveTool("pointer");
        focusNewNode(id);
      };

      if (e.shiftKey && !mod) {
        const k = e.key.toLowerCase();
        if (k === "c") {
          addAtCursor("class");
          return;
        }
        if (k === "i") {
          addAtCursor("interface");
          return;
        }
        if (k === "e") {
          addAtCursor("enum");
          return;
        }
        if (k === "a") {
          addAtCursor("abstract");
          return;
        }
        if (k === "r") {
          addAtCursor("record");
          return;
        }
        if (k === "n") {
          addAtCursor("note", "note");
          return;
        }
        if (k === "o") {
          addAtCursor("package");
          return;
        }
        if (k === "t") {
          // Shift+T reserved for lifeline (T used by text tool without shift)
          addAtCursor("lifeline");
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelection();
      } else if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        useCanvasStore.temporal.getState().undo();
      } else if ((mod && e.key.toLowerCase() === "y") || (mod && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        useCanvasStore.temporal.getState().redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        useCanvasStore.getState().setNodes(useCanvasStore.getState().nodes.map((n) => ({ ...n, selected: true })));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        useUIStore.getState().setSearchOpen(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        useCanvasStore.getState().tidyLayout();
      } else if (mod && e.key.toLowerCase() === "c") {
        const payload = useCanvasStore.getState().copySelection();
        if (!payload) return;
        e.preventDefault();
        navigator.clipboard?.writeText(payload).catch(() => {
          /* clipboard blocked — selection stays intact */
        });
      } else if (mod && e.key.toLowerCase() === "x") {
        const payload = useCanvasStore.getState().copySelection();
        if (!payload) return;
        e.preventDefault();
        navigator.clipboard
          ?.writeText(payload)
          .then(() => useCanvasStore.getState().deleteSelection())
          .catch(() => {
            /* clipboard blocked — don't delete what we couldn't copy */
          });
      } else if (mod && e.key.toLowerCase() === "v") {
        // Pasted nodes land slightly offset from the originals so they're visible.
        e.preventDefault();
        navigator.clipboard
          ?.readText()
          .then((text) => {
            if (text) useCanvasStore.getState().pasteClipboard(text);
          })
          .catch(() => {
            /* clipboard read denied */
          });
      } else if (e.key.toLowerCase() === "v") {
        // Place a note at the cursor if it's over the canvas, else at viewport center
        e.preventDefault();
        const el = wrapper.current;
        let pos = cursorFlow.current;
        const overCanvas = el && el.matches(":hover");
        if (!overCanvas && el) {
          const rect = el.getBoundingClientRect();
          pos = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
        const id = addNode("note", { x: pos.x - 70, y: pos.y - 14 }, "note");
        useUIStore.getState().setActiveTool("pointer");
        focusNewNode(id);
      }
      else if (e.key.toLowerCase() === "h") useUIStore.getState().setActiveTool("pan");
      else if (e.key.toLowerCase() === "l") useUIStore.getState().setActiveTool("lasso");
      else if (e.key.toLowerCase() === "t") {
        // Place a note at the cursor if it's over the canvas, else at viewport center
        e.preventDefault();
        const el = wrapper.current;
        let pos = cursorFlow.current;
        const overCanvas = el && el.matches(":hover");
        if (!overCanvas && el) {
          const rect = el.getBoundingClientRect();
          pos = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
        const id = addNode("note", { x: pos.x - 70, y: pos.y - 14 }, "note");
        useUIStore.getState().setActiveTool("pointer");
        focusNewNode(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, duplicateSelection, setCommandPaletteOpen, addNode, screenToFlowPosition, focusNewNode]);

  return (
    <div ref={wrapper} className="relative h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
      <AlignToolbar />
      <UMLEdgeMarkers />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMouseMove={onMouseMove}
        onPaneClick={onPaneClick}
        snapToGrid={gridSnap}
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={5}
        // Loose mode lets any handle act as both source and target, so users can
        // drag a connection from (and to) any side of any node.
        connectionMode={ConnectionMode.Loose}
        // Magnetically attach to the nearest handle within this many pixels,
        // so users don't have to hit the small dots exactly.
        connectionRadius={44}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ strokeWidth: 1.5, strokeDasharray: "4 4" }}
        isValidConnection={isValidConnection}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        panOnDrag={activeTool === "pan" ? true : [1, 2]}
        selectionOnDrag={activeTool === "lasso" || activeTool === "pointer"}
        selectionMode={activeTool === "lasso" ? SelectionMode.Full : SelectionMode.Partial}
        panOnScroll={activeTool === "pan"}
        zoomOnScroll={activeTool !== "pan"}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        // Skip rendering nodes outside the viewport — keeps large diagrams smooth.
        onlyRenderVisibleElements={!exporting}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="text-border" color="currentColor" />
        <Controls position="bottom-left" showInteractive={false} />
        {minimapVisible && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            className="!bg-card"
            nodeColor="hsl(var(--muted))"
            maskColor="hsl(var(--background) / 0.7)"
          />
        )}
      </ReactFlow>
    </div>
  );
}

export function CanvasEditor() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
      {/* Inside the provider so it can pan/zoom to a result. */}
      <CanvasSearch />
    </ReactFlowProvider>
  );
}
