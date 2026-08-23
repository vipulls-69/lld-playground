"use client";

import { useEffect } from "react";
import { AlertTriangle, Info, XCircle, RefreshCw } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { useChallengeStore } from "@/store/challenge-store";
import { auditDiagram } from "@/lib/audit/auditor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const SEVERITY_ICON = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_COLOR = {
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-sky-500",
} as const;

export function AuditorPanel() {
  const { nodes, edges } = useCanvasStore();
  const { auditFindings, setAuditFindings } = useChallengeStore();

  const run = () => setAuditFindings(auditDiagram(nodes, edges));

  useEffect(() => {
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const errors = auditFindings.filter((f) => f.severity === "error").length;
  const warnings = auditFindings.filter((f) => f.severity === "warning").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-2">
        <span className="text-2xs text-muted-foreground">
          {errors} errors · {warnings} warnings · {auditFindings.length - errors - warnings} hints
        </span>
        <Button variant="ghost" size="xs" onClick={run} className="gap-1">
          <RefreshCw className="h-3 w-3" /> Re-run
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {auditFindings.length === 0 && (
          <p className="p-1 text-2xs text-muted-foreground">No findings. Design looks clean.</p>
        )}
        {auditFindings.map((f) => {
          const Icon = SEVERITY_ICON[f.severity];
          return (
            <div
              key={f.id}
              className="mb-1 rounded-md border border-border bg-card p-2 text-2xs"
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3 w-3 shrink-0", SEVERITY_COLOR[f.severity])} />
                <span className="font-mono font-medium">{f.principle}</span>
              </div>
              <p className="mt-1 leading-4 text-muted-foreground">{f.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
