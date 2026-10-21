import { use, useState } from "react";

import { PaneCellContext } from "../tabs/paneCell";
import { continueCell, toastManager } from "../upstream/limitResume";
import { Button } from "../upstream/ui";

/**
 * Continue, on the banner over a Cell a usage limit stopped: the Cell
 * carries on now, as the composer's "Resume thread" does. Nothing outside a
 * Cell's pane, where the composer's own resume is the way.
 */
export function ContinueNow(props: { readonly runId: string }) {
  const cell = use(PaneCellContext);
  const [pending, setPending] = useState(false);
  if (cell === null) return null;
  const onClick = async () => {
    setPending(true);
    const outcome = await continueCell(cell, props.runId);
    if (!outcome.ok) {
      toastManager.add({ type: "error", title: "Couldn't continue", description: outcome.why });
    }
    setPending(false);
  };
  return (
    <Button size="xs" variant="ghost" disabled={pending} onClick={() => void onClick()}>
      {pending ? "Continuing…" : "Continue"}
    </Button>
  );
}
