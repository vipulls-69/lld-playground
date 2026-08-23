"use client";

import { memo, useEffect, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import type { UMLEdge } from "@/store/canvas-store";
import { useCanvasStore } from "@/store/canvas-store";
import type { EdgeRelationType } from "@/lib/types";

const MARKER = {
  generalization: { end: "url(#uml-triangle)", dashed: false },
  realization: { end: "url(#uml-triangle)", dashed: true },
  composition: { end: "url(#uml-diamond-filled)", dashed: false },
  aggregation: { end: "url(#uml-diamond)", dashed: false },
  association: { end: "url(#uml-arrow)", dashed: false },
  dependency: { end: "url(#uml-arrow)", dashed: true },
} as const;

export function UMLEdgeMarkers() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <marker id="uml-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5" fill="none" className="stroke-muted-foreground" strokeWidth="1.25" />
        </marker>
        <marker id="uml-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
          <path d="M 1 1 L 11 6 L 1 11 Z" className="fill-card stroke-muted-foreground" strokeWidth="1.25" />
        </marker>
        <marker id="uml-diamond" viewBox="0 0 14 8" refX="13" refY="4" markerWidth="13" markerHeight="8" orient="auto-start-reverse">
          <path d="M 1 4 L 7 0.5 L 13 4 L 7 7.5 Z" className="fill-card stroke-muted-foreground" strokeWidth="1.25" />
        </marker>
        <marker id="uml-diamond-filled" viewBox="0 0 14 8" refX="13" refY="4" markerWidth="13" markerHeight="8" orient="auto-start-reverse">
          <path d="M 1 4 L 7 0.5 L 13 4 L 7 7.5 Z" className="fill-muted-foreground stroke-muted-foreground" strokeWidth="1.25" />
        </marker>
      </defs>
    </svg>
  );
}

/** Controlled text input that commits on blur/Enter and stays in sync with external value. */
function EdgeInput({
  value,
  onCommit,
  placeholder,
  title,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  title?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      value={text}
      placeholder={placeholder}
      title={title}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
}

export const UMLEdgeRenderer = memo(function UMLEdgeRenderer(props: EdgeProps<UMLEdge>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, label } = props;
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const deleteSelection = useCanvasStore((s) => s.deleteSelection);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
    offset: 16,
  });

  const rel = (data?.relation ?? "association") as keyof typeof MARKER;
  const marker = MARKER[rel] ?? MARKER.association;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={marker.end}
        style={{
          strokeDasharray: marker.dashed ? "5 4" : undefined,
          strokeWidth: selected ? 1.5 : 1.25,
        }}
        className={selected ? "stroke-foreground" : "stroke-muted-foreground"}
      />
      {data?.sourceMultiplicity && (
        <text x={sourceX + 8} y={sourceY - 6} className="fill-muted-foreground font-mono text-[10px]">
          {data.sourceMultiplicity}
        </text>
      )}
      {data?.targetMultiplicity && (
        <text x={targetX - 16} y={targetY - 6} className="fill-muted-foreground font-mono text-[10px]">
          {data.targetMultiplicity}
        </text>
      )}
      <EdgeLabelRenderer>
        {typeof label === "string" && label && !selected && (
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="pointer-events-none absolute font-mono text-[10px] text-muted-foreground"
          >
            {label}
          </div>
        )}
        {selected && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              zIndex: 1000,
            }}
            className="nodrag nopan flex items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-md"
          >
            <select
              value={data?.relation ?? "association"}
              onChange={(e) => updateEdgeData(props.id, { relation: e.target.value as EdgeRelationType })}
              className="h-6 rounded border border-input bg-background px-1 font-mono text-[10px] outline-none"
            >
              <option value="association">Association →</option>
              <option value="aggregation">Aggregation ◇—</option>
              <option value="composition">Composition ◆—</option>
              <option value="generalization">Generalization ▷—</option>
              <option value="realization">Realization ▷┄</option>
              <option value="dependency">Dependency ┄&gt;</option>
            </select>
            <EdgeInput
              value={data?.sourceLabel ?? ""}
              onCommit={(v) => updateEdgeData(props.id, { sourceLabel: v || undefined })}
              placeholder="label"
              className="h-6 w-16 rounded border border-input bg-background px-1 font-mono text-[10px] outline-none"
            />
            <EdgeInput
              value={data?.sourceMultiplicity ?? ""}
              onCommit={(v) => updateEdgeData(props.id, { sourceMultiplicity: v || undefined })}
              placeholder="1"
              title="Source multiplicity"
              className="h-6 w-8 rounded border border-input bg-background px-1 font-mono text-[10px] outline-none"
            />
            <EdgeInput
              value={data?.targetMultiplicity ?? ""}
              onCommit={(v) => updateEdgeData(props.id, { targetMultiplicity: v || undefined })}
              placeholder="*"
              title="Target multiplicity"
              className="h-6 w-8 rounded border border-input bg-background px-1 font-mono text-[10px] outline-none"
            />
            <button
              onClick={deleteSelection}
              title="Delete edge"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
