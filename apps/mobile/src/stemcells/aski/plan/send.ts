// A message to Aski's chat on its way out (stemcells/tasks/aski-orchestrator.md, decision 1):
// when code says the compiler reads it, the server is told a plan is coming, the message goes
// exactly as it would have, and the compiler reads beside it. Nothing here can stop a message:
// when the server doesn't answer, the message goes alone.

import { wantsCompiler } from "../../../../../../stemcells/orchestrator/gate.ts";
import type { Plan } from "../../../../../../stemcells/orchestrator/plan.ts";

/** How long the message waits for the server to say it expects a plan. */
export const EXPECT_WITHIN_MS = 2_000;

export interface PlanDoor<Sent> {
  /** The message as it will be sent. */
  readonly text: string;
  /** Words alone: no attachment and no chip rides along. */
  readonly plain: boolean;
  /** The words that set a Cell up on their own (`gateNames`). */
  readonly names: ReadonlySet<string>;
  /** Whether a compile can run now: a direct line to the machine, and a model to think with. */
  readonly able: boolean;
  readonly mint: () => string;
  /** Tells the server a plan is coming; true once it has said so. */
  readonly expect: (id: string, signal: AbortSignal) => Promise<boolean>;
  /** The message's own send, as upstream runs it; null when it didn't go. */
  readonly send: () => Promise<Sent | null>;
  /** Asks for the plan. Its answer is null when none came. */
  readonly compile: (id: string, signal: AbortSignal) => Promise<Plan | null>;
  /** The message is being read. */
  readonly reading: (id: string) => void;
  /** Its plan, or null: the message didn't go, or no plan came. */
  readonly settled: (id: string, plan: Plan | null) => void;
  /** Tells the server a plan it expects won't come. */
  readonly forget: (id: string) => void;
  readonly wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Sends the message; what the send returns is returned, whatever the compiler does. */
export async function sendThroughPlan<Sent>(door: PlanDoor<Sent>): Promise<Sent | null> {
  if (!door.able || !door.plain || !wantsCompiler(door.text, door.names)) return door.send();
  const id = door.mint();
  const asking = new AbortController();
  const acked = await Promise.race([
    door.expect(id, asking.signal).catch(() => false),
    (door.wait ?? sleep)(EXPECT_WITHIN_MS).then(() => false),
  ]);
  if (!acked) {
    // A late ack would leave the chat's turn waiting for a plan that never comes.
    asking.abort();
    return door.send();
  }
  door.reading(id);
  const compiling = new AbortController();
  // Beside the send, never before it: the plan is only taken once the message has gone.
  const plan = door.compile(id, compiling.signal).catch(() => null);
  const unsent = () => {
    compiling.abort();
    door.forget(id);
    door.settled(id, null);
  };
  let sent: Sent | null;
  try {
    sent = await door.send();
  } catch (error) {
    unsent();
    throw error;
  }
  if (sent === null) unsent();
  else
    void plan.then((made) => {
      // No plan came: whatever waits for it on the server waits no longer.
      if (made === null) door.forget(id);
      door.settled(id, made);
    });
  return sent;
}
