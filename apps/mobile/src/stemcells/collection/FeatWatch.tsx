// Keeps each machine's collection current while the app is in front and plays a feat's moment,
// as the Mac's watch (`apps/web/src/stemcells/collection/CollectionWatch.tsx`), one card at a
// time. Mounted once for the app (`push/PushCoordinator.tsx`), outside the navigator, so the
// card is drawn in upstream's overlay.

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AppState } from "react-native";

import { useMinute } from "../home/state";
import { needsConnectionOf } from "../line/readings";
import { useThreadShellsSelected } from "../upstream/cells";
import { OverlayPortal } from "../upstream/collection";
import { type SavedRemoteConnection, useSavedRemoteConnections } from "../upstream/push";
import { waitsOnPerson } from "./crew";
import { FeatMoment } from "./FeatMoment";
import { earnedIds, standings } from "./kit";
import { type Moment, momentKey, nextMoment } from "./moments";
import { readCollectionOf, useCollections } from "./read";

/** The ledger keeps a landing well inside a second; this long after a run changes, it is read. */
const LEDGER_WRITES_WITHIN = 2_500;

/** What each machine had earned when the phone first read it: none of it gets a card. */
const baselines = new Map<string, ReadonlySet<string>>();

function readEach(saved: ReadonlyArray<SavedRemoteConnection>): void {
  for (const each of saved)
    void readCollectionOf(each.environmentId, needsConnectionOf(each), Date.now(), fetch, true);
}

export function FeatWatch() {
  const collections = useCollections();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const minute = useMinute();
  const runs = useThreadShellsSelected((threads) =>
    threads
      .flatMap((thread) =>
        thread.latestRun === null ||
        thread.archivedAt !== null ||
        thread.lineage.relationshipToParent === "subagent"
          ? []
          : [`${thread.id}:${thread.latestRun.runId}:${thread.latestRun.completedAt !== null}`],
      )
      .join(),
  );
  const waiting = useThreadShellsSelected((threads) =>
    [...collections.keys()].filter((id) => waitsOnPerson(threads, id, minute)).join(),
  );
  const [showing, setShowing] = useState<Moment | null>(null);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());

  const readAll = useEffectEvent(() => readEach(Object.values(savedConnectionsById)));
  const read = useRef(runs);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read each machine's collection a beat after any run starts or ends (the ledger writes after the event), clearing the timer on change.
  useEffect(() => {
    if (read.current === runs) return;
    read.current = runs;
    const soon = setTimeout(() => readAll(), LEDGER_WRITES_WITHIN);
    return () => clearTimeout(soon);
  }, [runs]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read each machine's collection as the app starts, once a route hands the phone its token, and on each return to the front; remove the AppState listener on change.
  useEffect(() => {
    const saved = Object.values(savedConnectionsById);
    readEach(saved);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") readEach(saved);
    });
    return () => subscription.remove();
  }, [savedConnectionsById]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep what each machine had earned at the phone's first read of it, outside React: the app's lifetime, not a view's.
  useEffect(() => {
    for (const [environmentId, collection] of collections)
      if (!baselines.has(environmentId)) baselines.set(environmentId, earnedIds(collection));
  }, [collections]);

  const held = showing === null ? undefined : collections.get(showing.environmentId);
  const standing =
    held === undefined || showing === null
      ? undefined
      : standings(held).find(
          ({ feat, state }) => feat.id === showing.featId && state.earned !== null,
        );
  if (showing !== null && standing === undefined) {
    // Its machine was forgotten while it showed.
    setShowing(null);
  } else if (showing === null) {
    const next = nextMoment(
      collections,
      baselines,
      new Set(waiting === "" ? [] : waiting.split(",")),
      shown,
    );
    if (next !== null) setShowing(next);
  }
  if (showing === null || standing === undefined) return null;

  const saved = Object.values(savedConnectionsById).find(
    (each) => each.environmentId === showing.environmentId,
  );
  const threadId = standing.state.earned?.threadId ?? null;
  return (
    <OverlayPortal>
      <FeatMoment
        key={momentKey(showing)}
        environmentId={showing.environmentId}
        connection={saved === undefined ? null : needsConnectionOf(saved)}
        standing={standing}
        worn={threadId === null ? [] : (held?.worn[threadId] ?? [])}
        onDone={() => {
          setShown((before) => new Set(before).add(momentKey(showing)));
          setShowing(null);
        }}
      />
    </OverlayPortal>
  );
}
