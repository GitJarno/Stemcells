/**
 * Sending on the Cells a condition holds (stemcells/tasks/conditions.md), for one nothing else
 * carries on: each gets what its own banner's Continue sends.
 */
import { sendThreadCommand } from "../upstream/needs";
import { PHRASES } from "./card";
import type { Condition } from "./wire";

/** The first refusal's reason, or null when every Cell took it. */
export async function continueHeld(condition: Condition): Promise<string | null> {
  let why: string | null = null;
  for (const cell of condition.cells) {
    const outcome = await sendThreadCommand(cell.threadId, {
      type: "message",
      text: PHRASES.continueNow,
      continuationOfRunId: cell.runId,
    });
    if (!outcome.ok) why ??= outcome.why;
  }
  return why;
}
