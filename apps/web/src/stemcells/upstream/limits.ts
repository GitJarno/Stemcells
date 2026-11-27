/**
 * What the plan board reads from upstream: every signed-in plan's limits,
 * merged across instances and environments as upstream's Usage page merges
 * them, the plan each provider instance signs in with, and what the chats
 * are doing on each. `limits.contract.test.ts` pins what this relies on.
 */
import { useAtomValue } from "@effect/atom-react";
import type { LimitPresentations } from "@t3tools/shared/usageLimits";

import { useThreadShells } from "../../state/entities";
import { environmentPresentations } from "../../state/presentation";
import {
  readUsagePagePreferences,
  saveUsagePagePreferences,
} from "../../components/usage/usagePagePreferences";
import { usePrimarySettings } from "../../hooks/useSettings";
import { formatShortTimestamp } from "../../timestampFormat";
import { chatWorkOf, type ChatWork } from "./limitAccounts";
import { statusOfShell } from "./status";

export { formatDuration } from "@t3tools/shared/usageLimitsCopy";
export { ResetCredits } from "../../components/usage/UsageLimits";

export * from "./limitAccounts";

/**
 * The Usage page opens on its limits next: the plans, and under them the accounts. Upstream reads
 * the tab it kept when the page mounts, so a page already open stays on its tab.
 */
export function showLimitsOnUsage(): void {
  saveUsagePagePreferences({ ...readUsagePagePreferences(), metric: "limits" });
}

/** Every environment's providers, as upstream's Usage page reads them. */
export function useLimitPresentations(): LimitPresentations {
  return useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
}

export function useChatWork(): ChatWork {
  return chatWorkOf(useThreadShells(), (shell) => statusOfShell(shell, undefined) === "Working");
}

// The app's words are English, so its weekdays are too.
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });

/**
 * A moment as the app writes times (the person's 12- or 24-hour choice),
 * with its weekday once it isn't today: "15.40", "Tue 10.00".
 */
export function useClockFormat(now: number): (at: number) => string {
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const today = new Date(now).toDateString();
  return (at) => {
    const time = formatShortTimestamp(new Date(at).toISOString(), timestampFormat);
    return new Date(at).toDateString() === today ? time : `${weekday.format(at)} ${time}`;
  };
}
