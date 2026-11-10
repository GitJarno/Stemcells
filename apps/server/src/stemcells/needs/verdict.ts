/**
 * How a finished Cell landed (stemcells/tasks/aski-brief.md, decision 2): shown by a fact,
 * on its word alone, or short. A failing fact outranks a passing one, and both outrank what
 * the Cell says. Pure.
 */
import type { Shell } from "../upstream/needs.ts";
import type { Brief } from "./evidence.ts";

export type Verdict = "shown" | "claimed" | "short";

/** The fact a verdict stands on; `word` when it stands on nothing but the Cell's own. */
export type Proof =
  | "stopped"
  | "rolled-back"
  | "failed"
  | "pr-checks-failing"
  | "check-failed"
  | "pr-merged"
  | "pr-checks-passing"
  | "checks-clean"
  | "word";

export interface Landing {
  readonly verdict: Verdict;
  readonly proof: Proof;
}

const landing = (verdict: Verdict, proof: Proof): Landing => ({ verdict, proof });

/** A run that ended without the Cell finishing it. */
const ENDED_SHORT: Partial<Record<Shell["status"], Proof>> = {
  interrupted: "stopped",
  cancelled: "stopped",
  rolled_back: "rolled-back",
  failed: "failed",
};

/** How the Cell's latest run landed, from how it ended and what it shows. */
export function landingOf(status: Shell["status"], brief: Brief | null): Landing {
  const ended = ENDED_SHORT[status];
  if (ended !== undefined) return landing("short", ended);
  const pullRequest = brief?.pullRequest ?? null;
  const checks = brief?.checks ?? [];
  if (pullRequest?.state === "open" && pullRequest.checks === "failing") {
    return landing("short", "pr-checks-failing");
  }
  if (checks.some((check) => !check.ok)) return landing("short", "check-failed");
  if (pullRequest?.state === "merged") return landing("shown", "pr-merged");
  if (pullRequest?.state === "open" && pullRequest.checks === "passing") {
    return landing("shown", "pr-checks-passing");
  }
  if (checks.length > 0) return landing("shown", "checks-clean");
  return landing("claimed", "word");
}
