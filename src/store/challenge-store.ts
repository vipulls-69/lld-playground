"use client";

import { create } from "zustand";
import type { AuditFinding, LLDProblem } from "@/lib/types";

interface ChallengeState {
  activeProblem: LLDProblem | null;
  checkedClasses: Record<string, boolean>;
  auditFindings: AuditFinding[];
  setActiveProblem: (p: LLDProblem | null) => void;
  setCheckedClasses: (c: Record<string, boolean>) => void;
  toggleCheckedClass: (name: string) => void;
  setAuditFindings: (f: AuditFinding[]) => void;
}

export const useChallengeStore = create<ChallengeState>()((set) => ({
  activeProblem: null,
  checkedClasses: {},
  auditFindings: [],
  setActiveProblem: (activeProblem) => set({ activeProblem, checkedClasses: {} }),
  setCheckedClasses: (checkedClasses) => set({ checkedClasses }),
  toggleCheckedClass: (name) =>
    set((s) => ({
      checkedClasses: { ...s.checkedClasses, [name]: !s.checkedClasses[name] },
    })),
  setAuditFindings: (auditFindings) => set({ auditFindings }),
}));
