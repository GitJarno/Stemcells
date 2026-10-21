import { useEffect, useState } from "react";

import { currentActivity } from "../cell/activity";
import { CellBuds } from "../cell/CellBuds";
import { CellFigure } from "../cell/CellFigure";
import { useShownActivity } from "../cell/useShownActivity";
import { useCellGround } from "../upstream/appearance";
import {
  useCellBuds,
  useCellCalls,
  useCellDeep,
  useCellRest,
  useCellSubagentsAway,
} from "../upstream/cellWork";
import { useCellDriver } from "../upstream/providers";
import { useCellStatus } from "../upstream/status";
import { activityOfStatus, moodAt, moodTurnsAt, thinkingQuietly } from "./cellMood";
import type { CellRef } from "./layout";
import { useRosterLook } from "./roster";

/** Points a sprite pixel is drawn in a tab or a pane header: small beside a label. */
const POINTS = 1;

/**
 * A chat's Cell, small: its look dealt by the chat's thread id with the crew
 * in view (`roster.ts`; a draft keeps it once sent), its face from the chat's
 * status, the "?" over it while it waits on you, in its provider's colours.
 * While the chat works it acts out the call in flight, and meditates once its
 * thought goes deep; when a turn lands it cheers, then rests, and sleeps once
 * the chat's prompt cache has gone cold.
 * Its box holds all of it, hats too, so centring the box centres the whole
 * Cell. Drawn `points` a sprite pixel; small beside a label unless told.
 * Given a `stage` (room at its right, as on the composer), the buds of its
 * subagents at work stand there, those in the background too; the box stays
 * its own.
 */
export function CellMark(props: { cell: CellRef | null; points?: number; stage?: boolean }) {
  const status = useCellStatus(props.cell);
  const provider = useCellDriver(props.cell);
  const ground = useCellGround();
  const working = status === "Working";
  const calls = useCellCalls(props.cell, working);
  const raw = currentActivity(working, calls);
  const shown = useShownActivity(raw);
  const away = useCellSubagentsAway(props.cell);
  const activity = shown ?? activityOfStatus(status, away);
  const deep = useCellDeep(props.cell, working, thinkingQuietly(raw, shown));
  const buds = useCellBuds(props.cell, working);
  const { landedAt, coldAt } = useCellRest(props.cell, provider);
  const look = useRosterLook(props.cell?.threadId);
  const [now, setNow] = useState(Date.now);
  const turnsAt = moodTurnsAt(status, landedAt, coldAt, now);
  const mood = moodAt(status, landedAt, coldAt, now);
  useEffect(() => {
    if (turnsAt === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, turnsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [turnsAt]);
  return (
    <span className="relative flex shrink-0" data-stemcells-cell-status={status ?? "idle"}>
      {/* First, so the Cell is drawn over its buds: one steps out from behind it. */}
      {props.stage ? (
        <CellBuds
          count={buds}
          provider={provider}
          ground={ground}
          points={props.points ?? POINTS}
        />
      ) : null}
      <CellFigure
        name={props.cell?.threadId ?? ""}
        ground={ground}
        mood={mood === "awake" && deep ? "meditating" : mood}
        activity={activity}
        provider={provider}
        look={look}
        points={props.points ?? POINTS}
      />
    </span>
  );
}
