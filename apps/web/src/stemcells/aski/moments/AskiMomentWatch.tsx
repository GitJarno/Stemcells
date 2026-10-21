// What earns Aski's moments, watched for while the workspace is up,
// whether Aski's page is mounted or not: asks answered three tabs away
// count all the same. What it earns waits in `earned.ts` for the theater.

import { useEffect, useEffectEvent } from "react";

import { useMinute } from "../../rail/clock";
import type { CellRef } from "../../tabs/layout";
import { useAskiHome } from "../../upstream/askiEyes";
import { useAskiRun, useMomentChats, useRunsDropped } from "../../upstream/askiMoments";
import { usePresence } from "../presence";
import words from "../strings/en.json" with { type: "json" };
import { earn } from "./earned";
import { haulLine } from "./haul";
import { newsLine } from "./news";
import { playedFor } from "./seen";
import {
  backAfter,
  hauled,
  landedWhileOut,
  MANY,
  NONE_WAITING,
  startedBy,
  type Waiting,
  waited,
  type Watching,
} from "./triggers";

/**
 * What the watch has seen, kept for the page's life: the workspace mounts
 * the watch afresh as its routes change, and a count begun before that
 * still counts. The page is open from when this loads.
 */
const seen: {
  readonly openedAt: number;
  silentSince: number | null;
  waiting: Waiting;
  watching: Watching;
} = { openedAt: Date.now(), silentSince: null, waiting: NONE_WAITING, watching: new Map() };

/** Watches for what earns Aski's moments. `aski` is Aski's chat. */
export function AskiMomentWatch(props: { aski: CellRef | null }): null {
  const minute = useMinute();
  const now = new Date(minute).toISOString();
  const home = useAskiHome(props.aski, now);
  const chats = useMomentChats(props.aski, now);
  const askiRun = useAskiRun(props.aski);
  const presence = usePresence();
  const dropped = useRunsDropped();
  const needsYou = chats.filter((chat) => chat.standing === "needsYou").length;
  const chatsNow = useEffectEvent(() => chats);

  // Back: the server answers again after a silence in which no run was lost.
  const droppedNow = useEffectEvent(() => dropped);
  useEffect(() => {
    const at = Date.now();
    if (!home.answers) {
      seen.silentSince ??= at;
      return;
    }
    const since = seen.silentSince;
    seen.silentSince = null;
    if (since !== null && backAfter(since, at, droppedNow()))
      earn({ id: "back", line: words["moment.back"], at });
  }, [home.answers]);

  // The news: back from an hour or more away, and Cells landed meanwhile.
  const backFrom = presence.back?.from;
  const backTo = presence.back?.to;
  const landedOut = landedWhileOut(presence.back, chats);
  useEffect(() => {
    if (backFrom === undefined || backTo === undefined || landedOut === 0) return;
    const once = String(backFrom);
    if (playedFor("news", once)) return;
    earn({ id: "news", line: newsLine(landedOut), at: backTo, args: { n: landedOut }, once });
  }, [backFrom, backTo, landedOut]);

  // Many: one message to Aski started five Cells or more.
  const askiRunNow = useEffectEvent(() => askiRun);
  const askiRunId = askiRun?.id;
  const askiLanded = askiRun?.ended === "landed";
  const started = startedBy(askiLanded ? askiRun : null, chats, minute);
  const startedTitles = started.length >= MANY ? started.map((chat) => chat.title).join("\n") : "";
  useEffect(() => {
    const run = askiRunNow();
    if (startedTitles === "" || run === null || run.id !== askiRunId || run.endedAt === null)
      return;
    if (playedFor("many", run.id)) return;
    earn({
      id: "many",
      line: words["moment.many"],
      at: run.endedAt,
      args: { titles: startedTitles.split("\n") },
      once: run.id,
    });
  }, [askiRunId, startedTitles]);

  // All clear: three or more asks answered down to none, soon.
  useEffect(() => {
    const at = Date.now();
    const next = waited(seen.waiting, needsYou, at);
    seen.waiting = next.waiting;
    if (next.cleared !== null) earn({ id: "clear", line: "", at, args: { n: next.cleared } });
  }, [needsYou]);

  // A haul: an hour or more of work, watched whole, that never asked.
  const runs = chats
    .map((chat) => `${chat.key}:${chat.standing}:${chat.run?.id}:${chat.run?.ended}`)
    .join("|");
  useEffect(() => {
    if (runs === "") {
      seen.watching = new Map();
      return;
    }
    const next = hauled(seen.watching, chatsNow(), seen.openedAt);
    seen.watching = next.watching;
    const haul = next.hauls.at(-1);
    if (haul !== undefined)
      earn({ id: "haul", line: haulLine(haul.hours), at: Date.now(), args: { hours: haul.hours } });
  }, [runs]);

  return null;
}
