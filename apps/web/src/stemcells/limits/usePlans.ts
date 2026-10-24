import { limitAccountsOf, type LimitPresentations, useChatWork } from "../upstream/limits";
import { providerLook } from "../upstream/rail";
import { readPlans, ringPlan } from "./plans";

/** Every plan on these environments, and the one the ring shows. */
export function usePlans(presentations: LimitPresentations, now: number) {
  const work = useChatWork();
  const { accounts, accountOf } = limitAccountsOf(presentations);
  const plans = readPlans(accounts, accountOf, work, (driver) => providerLook(driver).name, now);
  const lastWritten = work.lastWritten === null ? null : accountOf(work.lastWritten);
  return { plans, ring: ringPlan(plans, lastWritten) };
}
