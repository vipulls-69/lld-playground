"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

interface ResizeHandleProps {
  orientation: "vertical" | "horizontal";
  /**
   * Called with the pointer position (clientX for vertical handles, clientY for
   * horizontal ones) on every frame during a drag.
   */
  onResize: (position: number) => void;
  onResizeEnd?: () => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * A VS Code-style drag handle. Renders as a thin 1px seam with a wider
 * invisible hit area, and highlights on hover/drag.
 *
 * Pointer events are captured so the drag keeps tracking even when the cursor
 * outruns the handle, and updates are coalesced into animation frames.
 */
export function ResizeHandle({
  orientation,
  onResize,
  onResizeEnd,
  className,
  "aria-label": ariaLabel,
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const frame = useRef<number | null>(null);
  const pending = useRef(0);

  const flush = useCallback(() => {
    frame.current = null;
    onResize(pending.current);
  }, [onResize]);

  const schedule = useCallback(
    (pos: number) => {
      pending.current = pos;
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    },
    [flush]
  );

  const stop = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onResizeEnd?.();
  }, [onResizeEnd]);

  useEffect(() => stop, [stop]);

  const vertical = orientation === "vertical";

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        // Keep the resize cursor while dragging over other elements.
        document.body.style.cursor = vertical ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        schedule(vertical ? e.clientX : e.clientY);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        // Keyboard resizing: arrows nudge, held Shift moves faster.
        const step = e.shiftKey ? 40 : 8;
        const back = vertical ? "ArrowLeft" : "ArrowUp";
        const fwd = vertical ? "ArrowRight" : "ArrowDown";
        if (e.key !== back && e.key !== fwd) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const origin = vertical ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        onResize(origin + (e.key === fwd ? step : -step));
        onResizeEnd?.();
      }}
      className={cn(
        "group relative z-10 shrink-0 touch-none",
        vertical ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
        "bg-border transition-colors",
        className
      )}
    >
      {/* Widened hit area so the 1px seam is still easy to grab. */}
      <span
        className={cn(
          "absolute",
          vertical ? "-left-1 -right-1 top-0 bottom-0" : "-top-1 -bottom-1 left-0 right-0"
        )}
      />
      <span
        className={cn(
          "absolute bg-primary opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100",
          vertical ? "-left-px -right-px top-0 bottom-0" : "-top-px -bottom-px left-0 right-0"
        )}
      />
    </div>
  );
}
