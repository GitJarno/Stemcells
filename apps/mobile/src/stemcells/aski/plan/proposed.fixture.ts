import type { Plan, StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";

/** A plan as `stemcells_propose` makes it on the server (`proposedPlan`): every Cell a check. */
export function proposed(
  id: string,
  cells: ReadonlyArray<{
    readonly projectId: string;
    readonly projectName: string;
    readonly title: string;
    readonly words: string;
    readonly risks?: StartAct["risks"];
  }>,
): Plan {
  return {
    id,
    dictated: false,
    pieces: [],
    acts: cells.map((cell, i) => ({
      kind: "start",
      i,
      pieces: [],
      threadId: `thread-${i}`,
      title: cell.title,
      words: cell.words,
      note: null,
      place: {
        id: null,
        projectId: cell.projectId,
        name: cell.projectName,
        heard: null,
        how: "picked",
      },
      model: null,
      effort: null,
      risks: cell.risks ?? [],
      tier: "check",
      why: cell.risks === undefined ? ["proposed"] : ["proposed", "risky"],
    })),
    talk: [],
    leftOver: [],
    from: "proposed",
  };
}
