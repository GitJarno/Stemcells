/**
 * Moving the Cells a limit holds to another account and sending them on, at the person's click
 * (stemcells/tasks/account-switch.md: the person switches, nothing moves a Cell by itself). Each
 * gets what its own banner's Continue sends, going out on the account picked.
 */
import { PHRASES } from "../needs/card";
import type { HeldCell } from "../needs/wire";
import { sendThreadCommand } from "../upstream/needs";

/** How many Cells went, and the first refusal's reason if one didn't. */
export async function moveHeld(
  cells: ReadonlyArray<HeldCell>,
  instanceId: string,
): Promise<{ readonly moved: number; readonly why: string | null }> {
  let moved = 0;
  let why: string | null = null;
  for (const cell of cells) {
    const outcome = await sendThreadCommand(cell.threadId, {
      type: "message",
      text: PHRASES.continueNow,
      continuationOfRunId: cell.runId,
      onInstanceId: instanceId,
    });
    if (outcome.ok) moved += 1;
    else why ??= outcome.why;
  }
  return { moved, why };
}
