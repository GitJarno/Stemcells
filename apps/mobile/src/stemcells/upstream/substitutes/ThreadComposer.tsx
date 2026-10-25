// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the
// Cell's ledge stands over upstream's composer (`ledge/CellLedge.tsx`). The
// chat sizes its feed from the composer's height, so the height it hears is
// the ledge's and the composer's together.
import { useRef, useState } from "react";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { ASKI_INSTANCE } from "../../aski/instance";
import { CellLedge, LEDGE_OVERLAP } from "../../ledge/CellLedge";

export * from "../../../features/threads/ThreadComposer";

export const ThreadComposer: typeof Upstream.ThreadComposer = (props) => {
  const thread = props.selectedThread;
  const shows = props.isDraft !== true && thread.providerInstanceId !== ASKI_INSTANCE;
  const [ledge, setLedge] = useState(0);
  const composer = useRef<number | null>(null);
  const report = props.onHeightChange;
  const reach = (height: number) => (shows ? Math.max(0, height - LEDGE_OVERLAP) : 0);
  return (
    <>
      {shows ? (
        <CellLedge
          thread={thread}
          contentMaxWidth={props.contentMaxWidth}
          onHeightChange={(height) => {
            setLedge(height);
            if (composer.current !== null) report?.(composer.current + reach(height));
          }}
        />
      ) : null}
      <Upstream.ThreadComposer
        {...props}
        onHeightChange={(height) => {
          composer.current = height;
          report?.(height + reach(ledge));
        }}
      />
    </>
  );
};
