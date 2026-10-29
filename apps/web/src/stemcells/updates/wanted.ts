/**
 * The person's one click on Update. From there the update gets ready on its own and restarts
 * Stemcells once no Cell is at work, since a restart ends every Cell's turn (`UpdateBanner.tsx`).
 * A step that fails or is refused hands the click back.
 */
import { create } from "zustand";

import type { UpdateStep } from "../upstream/updates";

type UpdateAct = "download" | "restart";

export const useUpdateWanted = create<{
  readonly wanted: boolean;
  /** The bridge step under way. */
  readonly taking: UpdateAct | null;
  /** The last step that went through for this want, and the version it took. */
  readonly taken: { readonly act: UpdateAct; readonly version: string | null } | null;
}>(() => ({ wanted: false, taking: null, taken: null }));

export function wantUpdate(): void {
  useUpdateWanted.setState({ wanted: true, taken: null });
}

/**
 * One bridge step at a time: the desktop refuses a step while another runs. A step that fails,
 * or comes due again for the version it took, drops the want, so the column offers its button
 * rather than retrying; a newer main is a new version, and the one click carries on to it.
 */
export async function takeUpdateStep(
  act: UpdateAct,
  version: string | null,
  run: () => Promise<boolean>,
): Promise<void> {
  const { taking, taken } = useUpdateWanted.getState();
  if (taking !== null) return;
  if (taken?.act === act && taken.version === version) {
    useUpdateWanted.setState({ wanted: false });
    return;
  }
  useUpdateWanted.setState({ taking: act });
  let through = false;
  try {
    through = await run();
  } finally {
    useUpdateWanted.setState(
      through ? { taking: null, taken: { act, version } } : { taking: null, wanted: false },
    );
  }
}

/**
 * What a wanted update does next. `atWork`: the Cells whose turn a restart would end, null until
 * that's known.
 */
export function nextUpdateAct(step: UpdateStep | null, atWork: number | null): UpdateAct | null {
  if (step === "download") return "download";
  if (step === "restart" && atWork === 0) return "restart";
  return null;
}

/** What the column says about the update, and the one thing it offers. */
export interface UpdateView {
  /** Under "Stemcells gets better": how far it is, or what it waits for. */
  readonly line: string | null;
  /** Its progress, 0 to 100, while it gets ready. */
  readonly percent: number | null;
  /** A sentence over the action, when what happens next isn't plain. */
  readonly note: string | null;
  readonly act: "update" | "retry" | "restart-now" | null;
}

const cells = (count: number) => `${count} ${count === 1 ? "Cell is" : "Cells are"}`;

export function updateViewOf(input: {
  readonly status: string;
  readonly step: UpdateStep;
  readonly percent: number | null;
  readonly wanted: boolean;
  readonly atWork: number | null;
}): UpdateView {
  const { step, wanted, atWork } = input;
  const busy = atWork !== null && atWork > 0;
  if (input.status === "error" && !wanted) {
    return { line: "Couldn't update", percent: null, note: null, act: "retry" };
  }
  if (step === "download" && wanted) {
    return { line: "Updating…", percent: 0, note: null, act: null };
  }
  if (step === "downloading") {
    const percent = input.percent === null ? null : Math.floor(input.percent);
    return {
      line: percent === null ? "Updating…" : `Updating… ${percent}%`,
      percent: percent ?? 0,
      note: !wanted ? null : busy ? `${cells(atWork)} flying: it restarts once they finish.` : null,
      act: wanted ? null : "update",
    };
  }
  if (step === "restart" && wanted) {
    return busy
      ? {
          line: "Restarts once your Cells finish",
          percent: null,
          note: `${cells(atWork)} flying, and a restart would stop them.`,
          act: "restart-now",
        }
      : { line: "Restarting…", percent: null, note: null, act: null };
  }
  return { line: null, percent: null, note: null, act: "update" };
}
