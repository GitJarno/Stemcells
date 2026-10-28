// What earns Aski's moments, watched for while the workspace is up,
// whether Aski's page is mounted or not: asks answered three tabs away
// count all the same. What it earns waits in `earned.ts` for the theater.

import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";

import { useMinute } from "../../rail/clock";
import type { CellRef } from "../../tabs/layout";
import { useAskiHome } from "../../upstream/askiEyes";
import {
  useAskiRun,
  useMerges,
  useMomentChats,
  useRunLook,
  useRunsDropped,
} from "../../upstream/askiMoments";
import { usePresence } from "../presence";
import words from "../strings/en.json" with { type: "json" };
import { earn } from "./earned";
import { haulLine } from "./haul";
import { newsLine } from "./news";
import { lastPlayed, playedFor } from "./seen";
import { thingsLine } from "./things";
import { windowLine } from "./window";
import { zippedLine } from "./zipped";
import {
  type Armed,
  backAfter,
  carriedOn,
  filesAdded,
  hauled,
  landings,
  landedWhileOut,
  MANY,
  NONE_WAITING,
  type Running,
  startedBy,
  zippedNow,
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
  running: Running;
  armed: Armed;
} = {
  openedAt: Date.now(),
  silentSince: null,
  waiting: NONE_WAITING,
  watching: new Map(),
  running: new Map(),
  armed: new Map(),
};

/** How long after the first Cell carries on the window waits for the rest of the same reset, in milliseconds. */
const CARRY_SETTLES = 5_000;

/** A run that just landed, to look into: its chat, its run, and whether Aski started the chat. */
interface Look {
  readonly key: string;
  readonly environmentId: string;
  readonly threadId: string;
  readonly runId: string;
  readonly launched: boolean;
}
/** The most runs looked into at once; how long a look waits for the detail before giving up. */
const LOOKS = { most: 4, waitFor: 60_000 } as const;

/** The runs being looked into, kept beside the watch so a landing seen in an effect mounts its look. */
let looking: readonly Look[] = [];
const hearLooks = new Set<() => void>();
function setLooking(next: readonly Look[]): void {
  looking = next;
  for (const hear of hearLooks) hear();
}
function onLooks(hear: () => void): () => void {
  hearLooks.add(hear);
  return () => hearLooks.delete(hear);
}
const lookingNow = (): readonly Look[] => looking;
const lookKey = (look: Look): string => `${look.key}:${look.runId}`;

/** The local day `at` falls on, as the seen-state names it. */
const dayOf = (at: number): string => new Date(at).toLocaleDateString("sv");

/** Looks into one run that landed, while mounted: did it compact on its own, did it add files. */
function RunLooker(props: { look: Look; onDone: (lookKey: string) => void }): null {
  const { look } = props;
  const { compacted, diff } = useRunLook(look.environmentId, look.threadId, look.runId);
  const done = useEffectEvent(() => props.onDone(lookKey(look)));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Give up on the run's look after its wait, and clear the timer on unmount.
  useEffect(() => {
    const giveUp = setTimeout(() => done(), LOOKS.waitFor);
    return () => clearTimeout(giveUp);
  }, []);
  /** What the run did, once known: a compaction of its own, files added by a Cell Aski started. */
  const tell = useEffectEvent((compacted: boolean, diff: string | null) => {
    const now = Date.now();
    if (compacted && !playedFor("pages", look.key))
      earn({ id: "pages", line: words["moment.pages"], at: now, once: look.key });
    const added = look.launched && diff !== null ? filesAdded(diff) : 0;
    if (added > 0 && !lastPlayed("things")?.startsWith(dayOf(now)))
      earn({
        id: "things",
        line: thingsLine(added),
        at: now,
        args: { n: added },
        once: `${dayOf(now)} ${look.key}`,
      });
    done();
  });
  const launched = look.launched;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell what the landed run did once its compaction and diff have loaded.
  useEffect(() => {
    if (compacted === null || (launched && diff === null)) return;
    tell(compacted, diff);
  }, [compacted, diff, launched]);
  return null;
}

/** Watches for what earns Aski's moments. `aski` is Aski's chat. */
export function AskiMomentWatch(props: { aski: CellRef | null }) {
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Track the server's silences across renders to earn `back` when one ends.
  useEffect(() => {
    const at = Date.now();
    if (!home.answers) {
      if (seen.silentSince === null) seen.silentSince = at;
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Earn `news` once per return when Cells landed while the person was away.
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Earn `many` once when Aski's newest run lands having started many Cells.
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Track waiting asks across renders to earn `clear` once they are all answered.
  useEffect(() => {
    const at = Date.now();
    const next = waited(seen.waiting, needsYou, at);
    seen.waiting = next.waiting;
    if (next.cleared !== null) earn({ id: "clear", line: "", at, args: { n: next.cleared } });
  }, [needsYou]);

  const looks = useSyncExternalStore(onLooks, lookingNow, lookingNow);
  const looked = (done: string): void =>
    setLooking(looking.filter((look) => lookKey(look) !== done));

  // A haul: an hour or more of work, watched whole, that never asked.
  const runs = chats
    .map((chat) => `${chat.key}:${chat.standing}:${chat.run?.id}:${chat.run?.ended}`)
    .join("|");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Track runs across renders to earn hauls and queue looks into runs that just landed.
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
    // Runs that just landed are looked into: compacted on their own, files added.
    const landed = landings(seen.running, chatsNow());
    seen.running = landed.running;
    if (landed.landed.length > 0)
      setLooking(
        [
          ...looking,
          ...landed.landed.flatMap((chat) =>
            chat.run === null
              ? []
              : [
                  {
                    key: chat.key,
                    environmentId: chat.environmentId,
                    threadId: chat.threadId,
                    runId: chat.run.id,
                    launched: chat.launched,
                  },
                ],
          ),
        ].slice(-LOOKS.most),
      );
  }, [runs]);

  // Zipped: a Cell's pull request merged; the day's first, or a big one.
  const merges = useMerges(props.aski);
  const mergeKeys = merges.map(({ key, mergedAt }) => `${key}@${mergedAt}`).join("|");
  const mergesNow = useEffectEvent(() => merges);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Earn `zipped` when a new merge arrives: the day's first, or a big one.
  useEffect(() => {
    if (mergeKeys === "") return;
    const at = Date.now(),
      last = lastPlayed("zipped");
    const merge = zippedNow(
      mergesNow(),
      at,
      last?.split(" ")[1],
      last?.startsWith(dayOf(at)) ?? false,
    );
    if (merge === null) return;
    earn({
      id: "zipped",
      line: zippedLine(merge.base),
      at: merge.mergedAt,
      args: { base: merge.base, lines: merge.lines },
      once: `${dayOf(at)} ${merge.key}`,
    });
  }, [mergeKeys]);

  // The window: a limit reset, and Cells carried on by themselves.
  const carried = useRef<{ readonly keys: Set<string>; timer?: ReturnType<typeof setTimeout> }>({
    keys: new Set(),
  });
  const recoveries = chats
    .map(
      (chat) => `${chat.key}:${chat.recovery?.runId}:${chat.recovery?.autoResume}:${chat.run?.id}`,
    )
    .join("|");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Track limit recoveries across renders and earn `window` once a reset's Cells carry on.
  useEffect(() => {
    if (recoveries === "") return;
    const next = carriedOn(seen.armed, chatsNow(), Date.now());
    seen.armed = next.armed;
    if (next.carried.length === 0) return;
    const pending = carried.current;
    for (const key of next.carried) pending.keys.add(key);
    // The worker resumes every Cell of one reset at once: they are told together.
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      const n = pending.keys.size;
      pending.keys.clear();
      earn({ id: "window", line: windowLine(n), at: Date.now(), args: { n } });
    }, CARRY_SETTLES);
  }, [recoveries]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Clear the pending carried-on timer on unmount.
  useEffect(() => () => clearTimeout(carried.current.timer), []);

  return (
    <>
      {looks.map((look) => (
        <RunLooker key={lookKey(look)} look={look} onDone={looked} />
      ))}
    </>
  );
}
