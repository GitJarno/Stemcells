import { limitAccountsOf, type LimitPresentations, useChatWork } from "../upstream/limits";
import { providerLook } from "../upstream/rail";
import { readPlans, ringPlan } from "./plans";

/** Every plan on these environments, the one the ring shows, and each instance's. */
export function usePlans(presentations: LimitPresentations, now: number) {
  const work = useChatWork();
  const { accounts, accountOf } = limitAccountsOf(presentations);
  const plans = readPlans(accounts, accountOf, work, (driver) => providerLook(driver).name, now);
  const lastWritten = work.lastWritten === null ? null : accountOf(work.lastWritten);
  /** The plan an instance (`environmentId:instanceId`) is signed in to; null when none reports. */
  const planOf = (instance: string) => {
    const account = accountOf(instance);
    return account === null
      ? null
      : (plans.find((plan) => plan.account.key === account.key) ?? null);
  };
  return { plans, ring: ringPlan(plans, lastWritten), planOf };
}
