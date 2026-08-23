"use client";

import { ChevronRight } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useChallengeStore } from "@/store/challenge-store";

export function Breadcrumbs() {
  const breadcrumbs = useUIStore((s) => s.breadcrumbs);
  const activeProblem = useChallengeStore((s) => s.activeProblem);

  const parts = activeProblem
    ? ["Workspace", activeProblem.title, "Class Diagram"]
    : breadcrumbs;

  return (
    <div className="flex h-7 items-center gap-1 border-b border-border bg-background px-3 text-2xs text-muted-foreground">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          <span className={i === parts.length - 1 ? "text-foreground" : ""}>{part}</span>
        </span>
      ))}
    </div>
  );
}
