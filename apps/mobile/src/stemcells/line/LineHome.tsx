// The phone's home on the Cells' line (stemcells/tasks/phone-line.md), under Aski, narrowed by
// the header's picks. Needs you is the asks themselves, one open at a time; Flying, Landed and
// Settled hand T3's list their Cells, so its rows and swipes stay T3's. Asks never hide: Needs
// you counts every one, and says where those the picks leave out are.

import { useEffect, useSyncExternalStore, useState, type ReactNode } from "react";
import { AppState, Pressable, View } from "react-native";

import { CopyLayer } from "../home/CopyLayer";
import { EmptyTab, HomePage } from "../home/EmptyTab";
import { HomeTabsContext, tabChoice } from "../home/state";
import { inTab } from "../home/tabs";
import { AppText, type EnvironmentThreadShell } from "../upstream/cells";
import { useHomeThreadSelection } from "../upstream/home";
import { sendThreadCommand, settleFromAnyStage } from "../upstream/needs";
import { type Act, createHeld } from "./held";
import { AskCard, type AskActs, AskHead, whoOf } from "./Ask";
import { Hops } from "./Hops";
import {
  commandsFor,
  elsewhereWords,
  type FilterProject,
  type LineStage,
  movedByHand,
} from "./kit";
import { type Ask, countsOf, elsewhereOf, lineOf, opensOn, SEGMENTS } from "./line";
import { readMachine } from "./readings";
import type { Reading } from "./read";
import { UndoLine } from "./UndoLine";

const segments = tabChoice<LineStage>();

export const held = createHeld({
  send: sendThreadCommand,
  stillAsks: async (act) => {
    const reading = await readMachine(act.environmentId);
    if (reading?.state !== "read") return null;
    return reading.list.needs.some((need) => `${act.environmentId}:${need.key}` === act.key);
  },
  after: (ms, then) => {
    const timer = setTimeout(then, ms);
    return () => clearTimeout(timer);
  },
  now: Date.now,
});

const EMPTY: Readonly<Record<Exclude<LineStage, "needs">, string>> = {
  working: "No Cells flying.",
  landed: "Nothing waits to be settled.",
  settled: "No Cells settled.",
};

type Place = { readonly environmentId: string; readonly projectId: string };

/** Where a Cell's own record stands it, as T3's tabs read it, while its machine hasn't said. */
const byRecord =
  (now: string) =>
  (cell: EnvironmentThreadShell): "needs" | "working" | "landed" =>
    inTab(cell, "input", now) ? "needs" : inTab(cell, "working", now) ? "working" : "landed";

const UNSTOPPED = "Couldn't stop it to settle it. Settle it once it has stopped.";

export function LineHome(props: {
  /** The Cells the home lists: T3's chats but Aski's, archived ones and Subcells. */
  readonly cells: ReadonlyArray<EnvironmentThreadShell>;
  readonly readings: ReadonlyMap<string, Reading>;
  /** Every machine in view has answered once: where the home opens can be chosen. */
  readonly known: boolean;
  readonly now: string;
  readonly inView: (place: Place) => boolean;
  /** T3's project groups across every machine, for where the asks left out are. */
  readonly projects: ReadonlyArray<FilterProject>;
  /** What the picks show, when they narrow the home: "in Harbor", "on Studio". */
  readonly narrowedTo: string | null;
  readonly environmentId: string | null;
  /** Its machines haven't sent their Cells yet. */
  readonly connecting: boolean;
  readonly onShowAll: () => void;
  readonly settle: (cell: EnvironmentThreadShell) => Promise<boolean>;
  /** New chats on their way, which Working lists first. */
  readonly pending: number;
  /** T3's list, handed these Cells, and the new chats on their way with `pending`. */
  readonly renderList: (
    cells: ReadonlyArray<EnvironmentThreadShell>,
    pending: boolean,
  ) => ReactNode;
}) {
  const { answered } = useSyncExternalStore(held.subscribe, held.read);
  const line = lineOf(props.cells, props.readings, props.now, answered, byRecord(props.now));
  const counts = countsOf(line, props.inView);
  const tab = segments.useTab(opensOn(counts), props.known);
  const openChat = useHomeThreadSelection();
  const cellOf = (threadId: string) => props.cells.find((cell) => cell.id === threadId);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Forget answered asks the machines stopped asking, as each reading comes in.
  useEffect(() => {
    const asked = new Set<string>();
    for (const [environmentId, reading] of props.readings)
      if (reading.state !== "none")
        for (const need of reading.list?.needs ?? []) asked.add(`${environmentId}:${need.key}`);
    held.keepOnly(asked, Date.now());
  }, [props.readings]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Send a held answer as the app leaves the front: the person chose it.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") void held.letGo();
    });
    return () => subscription.remove();
  }, []);

  const actsFor = (ask: Ask, done: () => void): AskActs => {
    const { need, environmentId } = ask;
    const who = whoOf(need);
    const hold = (commands: Act["commands"], words: string) => {
      if (commands.length === 0) return;
      movedByHand(need.parentThreadId ?? need.threadId);
      void held.hold({
        key: ask.key,
        environmentId,
        threadId: need.threadId,
        who,
        words,
        commands,
      });
      done();
    };
    const cell = cellOf(need.parentThreadId ?? need.threadId);
    return {
      choose: (option, given = {}) =>
        hold(
          commandsFor(need, option.choice, given, Date.now()),
          option.choice.kind === "wait" ? `Snoozed ${who}` : `Answered ${who}`,
        ),
      later: () => hold(commandsFor(need, { kind: "later" }, {}, Date.now()), `Snoozed ${who}`),
      settle:
        cell === undefined
          ? null
          : () => {
              void held.letGo();
              held.aside(ask.key);
              movedByHand(cell.id);
              done();
              void settleFromAnyStage(environmentId, cell.id, () => props.settle(cell)).then(
                (end) => {
                  if (end !== "settled") held.back(ask.key, end === "unstopped" ? UNSTOPPED : null);
                },
              );
            },
      openChat: () => openChat({ environmentId, id: need.threadId }),
    };
  };

  // T3's list narrows to the pickers too; handed only those, an empty segment says so in ours.
  const shown = (
    tab === "settled" ? [...line.settled, ...line.snoozed] : tab === "needs" ? [] : line[tab]
  ).filter(props.inView);
  const greet = {
    input: counts.needs,
    working: counts.working,
    active: counts.needs + counts.working + counts.landed,
    asleep: counts.settled,
  };
  const home = {
    tab,
    options: SEGMENTS.map((segment) => ({ ...segment, count: counts[segment.id] })),
    counts: greet,
    night: tab === "settled",
    choose: (id: string) => segments.choose(id as LineStage),
    environmentId: props.environmentId,
  };
  return (
    <HomeTabsContext value={home}>
      <View style={{ flex: 1 }}>
        {props.connecting ? (
          <EmptyTab words="Connecting…" />
        ) : tab === "needs" ? (
          <NeedsYou
            asks={line.asks.filter((ask) =>
              props.inView({ ...ask, projectId: ask.need.projectId }),
            )}
            unread={line.unread.filter(props.inView)}
            onOpenChat={openChat}
            waiting={counts.needs}
            elsewhere={elsewhereWords(elsewhereOf(line.asks, props.inView, props.projects))}
            narrowedTo={props.narrowedTo}
            onShowAll={props.onShowAll}
            now={Date.parse(props.now)}
            cellOf={cellOf}
            actsFor={actsFor}
          />
        ) : shown.length === 0 && (tab !== "working" || props.pending === 0) ? (
          <EmptyTab words={EMPTY[tab]} />
        ) : (
          <View style={{ flex: 1 }}>
            {props.renderList(shown, tab === "working")}
            <CopyLayer />
          </View>
        )}
        <Hops standings={line.standings} cellOf={cellOf} />
        <UndoLine held={held} />
      </View>
    </HomeTabsContext>
  );
}

/** What needs you: the asks in view, one open at a time; answering one opens the next. */
function NeedsYou(props: {
  readonly asks: ReadonlyArray<Ask>;
  /** Cells in view that ask, on a machine that hasn't said what yet: each opens its chat. */
  readonly unread: ReadonlyArray<EnvironmentThreadShell>;
  readonly onOpenChat: (cell: EnvironmentThreadShell) => void;
  /** Every ask in reach, the ones the pickers leave out too. */
  readonly waiting: number;
  readonly elsewhere: string | null;
  readonly narrowedTo: string | null;
  readonly onShowAll: () => void;
  readonly now: number;
  readonly cellOf: (threadId: string) => EnvironmentThreadShell | undefined;
  readonly actsFor: (ask: Ask, done: () => void) => AskActs;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = props.asks.find((ask) => ask.key === openKey) ?? props.asks[0];
  // The open ask stays under a finger: a reading that brings an older ask doesn't open in its place.
  if (open !== undefined && open.key !== openKey) setOpenKey(open.key);
  return (
    <HomePage>
      <View className="pt-3">
        {props.asks.length === 0 && props.unread.length === 0 ? (
          <View className="mt-5 items-center gap-1 px-8">
            <AppText className="text-center text-base text-foreground">
              {props.waiting > 0 && props.narrowedTo !== null
                ? `Nothing ${props.narrowedTo} needs you.`
                : "Nothing needs you."}
            </AppText>
            {props.waiting === 0 ? (
              <AppText className="text-center text-sm text-foreground-muted">
                You’ll hear the moment a Cell does.
              </AppText>
            ) : null}
          </View>
        ) : null}
        {props.asks.map((ask, index) => (
          <AskCard
            key={ask.key}
            ask={ask}
            cell={props.cellOf(ask.need.parentThreadId ?? ask.need.threadId)}
            now={props.now}
            open={ask.key === open?.key}
            onOpen={() => setOpenKey(ask.key)}
            acts={props.actsFor(ask, () =>
              setOpenKey((props.asks[index + 1] ?? props.asks[index - 1])?.key ?? null),
            )}
          />
        ))}
        {props.unread.map((cell) => (
          <Pressable
            key={`${cell.environmentId}:${cell.id}`}
            accessibilityRole="button"
            accessibilityHint="Opens its chat"
            onPress={() => props.onOpenChat(cell)}
            className="mx-3 mb-2 rounded-[20px] bg-grouped-card py-3 pl-3 pr-4 active:opacity-70"
          >
            <AskHead
              cell={cell}
              over={null}
              title={cell.title}
              open={false}
              corner="Asks you"
              urgent
            />
            <AppText className="ml-16 text-xs text-foreground-muted">
              Its machine hasn’t answered yet.
            </AppText>
          </Pressable>
        ))}
        {props.elsewhere === null ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Shows every machine and project"
            onPress={props.onShowAll}
            className="mt-2 self-center px-6 py-2 active:opacity-70"
          >
            <AppText className="text-center text-sm text-foreground-muted">
              {props.elsewhere}
            </AppText>
          </Pressable>
        )}
      </View>
    </HomePage>
  );
}
