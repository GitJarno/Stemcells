// The phone's own tool-call mode (Settings › Appearance › Tool calls in chat), for the chat's
// quieter work log (`../work/QuietWork.tsx`).
import { useAtomValue } from "@effect/atom-react";
import type { ToolCallVisibility } from "@t3tools/contracts/settings";
import { AsyncResult } from "effect/reactivity";

import { mobilePreferencesAtom, saveMobilePreferences } from "../../state/preferences";
import { useAtomCommand } from "../../state/use-atom-command";

/** Whether the phone's preferences have loaded with no tool-call mode chosen, and how to set one. */
export function useToolCallVisibilityUnset(): {
  readonly unset: boolean;
  readonly set: (visibility: ToolCallVisibility) => void;
} {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const save = useAtomCommand(saveMobilePreferences);
  return {
    unset: AsyncResult.isSuccess(preferences) && preferences.value.toolCallVisibility === undefined,
    set: (visibility) => void save({ toolCallVisibility: visibility }),
  };
}
