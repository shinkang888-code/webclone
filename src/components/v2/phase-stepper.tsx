"use client";

import type { ProjectPhase } from "@/types/project";
import { PHASE_LABELS, PHASE_ORDER } from "@/types/project";

export function PhaseStepper({ current }: { current: ProjectPhase }) {
  const currentIdx = PHASE_ORDER.indexOf(current);

  return (
    <nav className="mb-8 flex flex-wrap gap-2" aria-label="프로젝트 단계">
      {PHASE_ORDER.map((phase, i) => {
        const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
        return (
          <span
            key={phase}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background:
                state === "done"
                  ? "var(--scan-blue)"
                  : state === "active"
                    ? "var(--scan-blue-soft)"
                    : "#f5f5f5",
              color: state === "done" ? "#fff" : "var(--scan-blue)",
            }}
          >
            {i + 1}. {PHASE_LABELS[phase]}
          </span>
        );
      })}
    </nav>
  );
}
