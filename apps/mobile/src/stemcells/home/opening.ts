// A Cell's row starts loading its chat as the finger lands: T3's row hands control here
// (`features/threads/thread-list-v2-items.tsx`).
import type { EnvironmentThreadShell } from "../upstream/cells";
import { startOpeningEnvironmentThread } from "../upstream/opening";

/**
 * Starts loading a row's chat at press-in, where T3 starts at the press, so a chat opened for the
 * first time shows with its messages rather than empty. A touch that turns into a scroll loaded a
 * chat nobody opened; T3's hold lets it go after a few seconds.
 */
export function openOnPressIn(thread: Pick<EnvironmentThreadShell, "environmentId" | "id">) {
  startOpeningEnvironmentThread(thread.environmentId, thread.id);
}
