// What the plan ring reads from upstream on the phone: every environment's providers as the
// Usage page reads them (`features/usage/UsageLimitsPooled.tsx`), a provider's name as that page
// writes it, its duration words, and the way to the page.

import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts, type LimitPresentations } from "@t3tools/shared/usageLimits";

import { PROVIDER_LABEL, usageProviderKind } from "../../features/usage/usageProviders";
import { environmentPresentations } from "../../state/presentation";

export { formatDuration } from "@t3tools/shared/usageLimitsCopy";
export { useNowMinuteMs } from "../../lib/clock";
export { openSettings } from "../../features/settings/settings-navigation";

export function useLimitPresentations(): LimitPresentations {
  return useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
}

/** Whether any plan reports a window, read so a view draws again only when that flips. */
export function useHasLimits(): boolean {
  return useAtomValue(environmentPresentations.presentationsWithProvidersAtom, (presentations) =>
    collectLimitAccounts(presentations).some((account) => account.limits.windows.length > 0),
  );
}

/** A provider's name as upstream's Usage page writes it: "Claude Code", "Codex". */
export function providerNameOf(driver: string): string {
  const kind = usageProviderKind(driver);
  return kind === null ? driver : PROVIDER_LABEL[kind];
}
