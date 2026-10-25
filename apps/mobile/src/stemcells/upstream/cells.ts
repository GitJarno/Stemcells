// What a Cell on the phone reads from upstream: its chat's shell and the
// status T3's own list gives it, the chats in view, each environment's
// providers (whose colours a Cell wears), and the theme it stands on.
// `cells.contract.test.ts` pins the statuses a Cell's face is read from.

import { useAtomValue } from "@effect/atom-react";

import { useAppearancePreferences } from "../../features/settings/appearance/AppearancePreferencesProvider";
import { threadListEnvironmentsAtom } from "../../state/server";
import { environmentThreadShells } from "../../state/threads";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

export type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
export { AppText } from "../../components/ui/AppText";
export { useProject } from "../../state/entities";
export { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
export {
  resolveThreadListV2Status,
  type ThreadListV2Status,
} from "../../features/threads/threadListV2";

/** What `select` reads from every chat the phone knows; the caller draws again only when that changes. */
export function useThreadShellsSelected<A>(
  select: (threads: ReadonlyArray<EnvironmentThreadShell>) => A,
): A {
  return useAtomValue(environmentThreadShells.threadShellsAtom, select);
}

/** Each environment's providers, by environment: a Cell's driver is its provider's. */
export function useEnvironmentProviders() {
  return useAtomValue(threadListEnvironmentsAtom).providersByEnvironmentId;
}

/** Whether the phone is drawn light or dark. */
export function useThemeAppearance(): "light" | "dark" {
  return useAppearancePreferences().themeAppearance;
}
