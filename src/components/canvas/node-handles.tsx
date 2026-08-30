"use client";

import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils/cn";

/** Handle ids are stable and directional so edges keep their routing on reload. */
export const HANDLE_IDS = ["top", "right", "bottom", "left"] as const;

const SIDES: { id: (typeof HANDLE_IDS)[number]; position: Position }[] = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

/**
 * Connection points on all four sides of a node.
 *
 * Every handle is declared `type="source"`. Combined with
 * `ConnectionMode.Loose` on the canvas, that lets any side act as both the
 * start and the end of a connection, so users can drag in either direction.
 *
 * Handles stay invisible until the node is hovered (or a connection is in
 * flight, via the `.connecting` class the canvas puts on the pane) to keep the
 * diagram clean, but their hit area is always live.
 */
export function NodeHandles({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {SIDES.map(({ id, position }) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={position}
          className={cn(
            // Reset React Flow's default dot styling.
            "!border-primary !bg-background !opacity-0 transition-opacity duration-150",
            "!rounded-full !border-2",
            compact ? "!h-2 !w-2" : "!h-2.5 !w-2.5",
            // Reveal on node hover, while dragging a connection, and when connected.
            "group-hover/node:!opacity-100",
            "[.react-flow__node.selected_&]:!opacity-100",
            "[.react-flow.connecting_&]:!opacity-100",
            "hover:!scale-125 hover:!bg-primary"
          )}
        />
      ))}
    </>
  );
}
