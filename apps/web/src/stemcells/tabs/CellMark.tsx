import { useEffect, useState } from "react";

import { currentActivity } from "../cell/activity";
import { CellFigure } from "../cell/CellFigure";
import { useShownActivity } from "../cell/useShownActivity";
import { useCellCalls, useCellRest } from "../upstream/cellWork";
import { useCellDriver } from "../upstream/providers";
import { useCellStatus } from "../upstream/status";
import { activityOfStatus, moodAt, moodTurnsAt } from "./cellMood";
import type { CellRef } from "./layout";
import { useRosterLook } from "./roster";

/** Points a sprite pixel is drawn in a tab or a pane header: small beside a label. */
const POINTS = 1;

/**
 * A chat's Cell, small: its look dealt by the chat's thread id with the crew
 * in view (`roster.ts`; a draft keeps it once sent), its face from the chat's
 * status, the "?" over it while it waits on you, in its provider's colours.
 * While the chat works it acts out the call in flight; when a turn lands it
 * cheers, then rests, and sleeps once the chat's prompt cache has gone cold.
 * Its box holds all of it, hats too, so centring the box centres the whole
 * Cell. Drawn `points` a sprite pixel; small beside a label unless told.
 */
export function CellMark(props: { cell: CellRef | null; points?: number }) {
  const status = useCellStatus(props.cell);
  const provider = useCellDriver(props.cell);
  const working = status === "Working";
  const calls = useCellCalls(props.cell, working);
  const activity = useShownActivity(currentActivity(working, calls)) ?? activityOfStatus(status);
  const { landedAt, coldAt } = useCellRest(props.cell, provider);
  const look = useRosterLook(props.cell?.threadId);
  const [now, setNow] = useState(Date.now);
  const turnsAt = moodTurnsAt(status, landedAt, coldAt, now);
  useEffect(() => {
    if (turnsAt === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, turnsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [turnsAt]);
  return (
    <span className="flex shrink-0" data-stemcells-cell-status={status ?? "idle"}>
      <CellFigure
        name={props.cell?.threadId ?? ""}
        mood={moodAt(status, landedAt, coldAt, now)}
        activity={activity}
        provider={provider}
        look={look}
        points={props.points ?? POINTS}
      />
    </span>
  );
}
