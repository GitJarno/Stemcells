import { resolveThreadListV2Status, useThreadShellsSelected } from "../upstream/cells";
import { providerNameOf, useLimitPresentations } from "../upstream/limits";
import { type ChatWork, chatWorkOf, limitAccountsOf, readPlans, ringPlan } from "./kit";
import { workKey, workOfKey } from "./work";

/** A chat works as upstream's list says it does, as the Mac's ring counts it. */
function useChatWork(): ChatWork {
  return workOfKey(
    useThreadShellsSelected((shells) =>
      workKey(chatWorkOf(shells, (shell) => resolveThreadListV2Status(shell) === "working")),
    ),
  );
}

/** Every plan on the phone's environments and the one the ring shows, as the Mac's `usePlans`. */
export function usePlans(now: number) {
  const work = useChatWork();
  const { accounts, accountOf } = limitAccountsOf(useLimitPresentations());
  const plans = readPlans(accounts, accountOf, work, providerNameOf, now);
  const lastWritten = work.lastWritten === null ? null : accountOf(work.lastWritten);
  return { plans, ring: ringPlan(plans, lastWritten) };
}
