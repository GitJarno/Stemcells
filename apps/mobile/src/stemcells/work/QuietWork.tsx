// A chat's work on the phone, as on the Mac (stemcells/docs/interaction.md, The work log):
// finished, successful tool calls step aside, and the live line, thoughts, failures and what the
// agent looked at stay. Upstream's own "Hide successful", saved once while the phone has no mode
// chosen; Settings › Appearance › Tool calls in chat turns it back.
import { useEffect, useEffectEvent } from "react";

import { useToolCallVisibilityUnset } from "../upstream/workLog";

export function QuietWorkOnce() {
  const { unset, set } = useToolCallVisibilityUnset();
  const quiet = useEffectEvent(() => set("hideSuccessful"));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- saves the quieter mode into the phone's stored preferences once they load holding no choice
  useEffect(() => {
    if (unset) quiet();
  }, [unset]);
  return null;
}
