"use client";

import { useEffect } from "react";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { LLD_PROBLEMS } from "@/lib/data/problems";
import { useChallengeStore } from "@/store/challenge-store";
import { useCanvasStore } from "@/store/canvas-store";
import { cn } from "@/lib/utils/cn";
import { Separator } from "@/components/ui/separator";

const DIFF_COLOR = {
  Easy: "text-emerald-500",
  Medium: "text-amber-500",
  Hard: "text-red-500",
} as const;

export function ProblemBank() {
  const { activeProblem, setActiveProblem, checkedClasses, toggleCheckedClass, setCheckedClasses } =
    useChallengeStore();
  const nodes = useCanvasStore((s) => s.nodes);

  // Auto-detect expected classes present on canvas
  useEffect(() => {
    if (!activeProblem) return;
    const names = new Set(nodes.map((n) => n.data.name.toLowerCase()));
    const next: Record<string, boolean> = {};
    for (const cls of activeProblem.expectedClasses) {
      next[cls] = names.has(cls.toLowerCase()) || checkedClasses[cls] === true && names.has(cls.toLowerCase());
      next[cls] = names.has(cls.toLowerCase());
    }
    setCheckedClasses(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, activeProblem?.id]);

  if (!activeProblem) {
    return (
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {LLD_PROBLEMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProblem(p)}
            className="mb-1 flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left transition-colors duration-150 hover:border-border hover:bg-accent/50"
          >
            <div>
              <div className="text-xs font-medium">{p.title}</div>
              <div className={cn("text-2xs", DIFF_COLOR[p.difficulty])}>{p.difficulty}</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  }

  const done = activeProblem.expectedClasses.filter((c) => checkedClasses[c]).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <button
          onClick={() => setActiveProblem(null)}
          className="mb-1 text-2xs text-muted-foreground hover:text-foreground"
        >
          ← All problems
        </button>
        <div className="text-xs font-semibold">{activeProblem.title}</div>
        <div className={cn("text-2xs", DIFF_COLOR[activeProblem.difficulty])}>{activeProblem.difficulty}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 text-xs scrollbar-thin">
        <p className="text-muted-foreground">{activeProblem.description}</p>

        <div className="mt-3 mb-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          Requirements
        </div>
        <ul className="list-disc space-y-0.5 pl-4 text-foreground/90">
          {activeProblem.requirements.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <div className="mt-3 mb-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          Use Cases
        </div>
        <ul className="list-disc space-y-0.5 pl-4 text-foreground/90">
          {activeProblem.useCases.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>

        <Separator className="my-3" />

        <div className="mb-1 flex items-center justify-between">
          <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            Expected Classes
          </span>
          <span className="font-mono text-2xs text-muted-foreground">
            {done}/{activeProblem.expectedClasses.length}
          </span>
        </div>
        <div className="space-y-0.5">
          {activeProblem.expectedClasses.map((cls) => {
            const found = Boolean(checkedClasses[cls]);
            return (
              <button
                key={cls}
                onClick={() => toggleCheckedClass(cls)}
                className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left font-mono text-2xs hover:bg-accent/50"
              >
                {found ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={cn(found ? "text-foreground" : "text-muted-foreground")}>{cls}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
