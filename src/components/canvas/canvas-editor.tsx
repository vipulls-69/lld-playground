"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { UMLNodeRenderer } from "./uml-node";
import { UMLEdgeMarkers, UMLEdgeRenderer } from "./uml-edge";
import type { UMLNodeData } from "@/lib/types";

const nodeTypes = { uml: UMLNodeRenderer };
const edgeTypes = { uml: UMLEdgeRenderer };

// Hook version for reactive temporal state
import { useStore } from "zustand";
export function useTemporal() {
  return useStore(useCanvasStore.temporal, (s) => s);
}

function CanvasInner() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteSelection,
    duplicateSelection,
    gridSnap,
  } = useCanvasStore();
  const { activeTool, setCursorPosition, setCommandPaletteOpen, minimapVisible } = useUIStore();
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
      const stereotype = e.dataTransfer.getData("application/uml-stereotype") || undefined;
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

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // schedule the latest mouse position to be applied on the next animation frame
      pendingPosRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          const pos = pendingPosRef.current ?? { x: 0, y: 0 };
          cursorFlow.current = pos;
          setCursorPosition(pos);
          rafRef.current = null;
          pendingPosRef.current = null;
        });
      }
    },
    [screenToFlowPosition, setCursorPosition]
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
        addNode("note", { x: pos.x - 70, y: pos.y - 14 }, "note");
        useUIStore.getState().setActiveTool("pointer");
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
        addNode("note", { x: pos.x - 70, y: pos.y - 14 }, "note");
        useUIStore.getState().setActiveTool("pointer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, duplicateSelection, setCommandPaletteOpen]);

  return (
    <div ref={wrapper} className="h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
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
        panOnDrag={activeTool === "pan" ? true : [1, 2]}
        selectionOnDrag={activeTool === "lasso" || activeTool === "pointer"}
        selectionMode={activeTool === "lasso" ? SelectionMode.Full : SelectionMode.Partial}
        panOnScroll={activeTool === "pan"}
        zoomOnScroll={activeTool !== "pan"}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
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
    </ReactFlowProvider>
  );
}
