/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (collection.css), outside upstream's Tailwind entry. */
// Settings › Collection: the day so far, a dressing room where the person puts what the feats
// unlocked on a Cell and watches an act, and every feat with how far along it is. One Cell on
// the page is alive, the one on the stage; every other stands still and costs no frame.

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";

import {
  type Collection,
  FEAT_ACTS,
  type Today,
  unlockedPieces,
  wornIdOf,
} from "../../../../../stemcells/ledger/feats.ts";
import {
  actWords,
  COLLECTION,
  featName,
  featProgress,
  featTakes,
  RARITY_NAMES,
  rewardLine,
  rewardShort,
  SECRET,
  todayCounts,
} from "../../../../../stemcells/words/feats.ts";
import { moment, play } from "../cell/acting";
import { clockSeconds } from "../cell/blink";
import { CellFigure } from "../cell/CellFigure";
import { CellStill } from "../cell/CellStill";
import { chosenVersion, onChosen } from "../cell/chosen";
import type { Ground } from "../cell/keyline";
import { dayOf, lookOf } from "../cell/looks";
import { cellNameOf } from "../cell/name";
import { CellMini } from "../rail/CellMini";
import { askiCellOf } from "../tabs/askiTab";
import { type CellRef, focusedPane } from "../tabs/layout";
import { useWorkspaceStore } from "../tabs/store";
import { reducedMotion } from "../tokens/motion";
import { useCellGround } from "../upstream/appearance";
import { usePrimaryEnvironmentId } from "../upstream/disk";
import { useCellDriver } from "../upstream/providers";
import { useMachineCells } from "../upstream/rail";
import { SettingsPageContainer, SettingsSection } from "../upstream/settings";
import { Button, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { actsToShow, MOST_TO_DRESS, toggled } from "./dress";
import { type Standing, standings } from "./fresh";
import { markSeen, readCollection, useCollection, wear } from "./read";
import "./collection.css";

/** A Cell that stands in on a tile: no chat's, so its look is only what the tile gives it. */
const STAND_IN = "collection";

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function CollectionSettingsPanel() {
  const collection = useCollection();
  const ground = useCellGround();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the machine's collection as the page opens.
  useEffect(() => {
    void readCollection();
  }, []);
  if (collection === null) {
    return (
      <SettingsPageContainer>
        <p className="text-sm text-muted-foreground">{COLLECTION.reading}</p>
      </SettingsPageContainer>
    );
  }
  return (
    <SettingsPageContainer>
      <TodayStrip today={collection.today} />
      <DressingRoom collection={collection} ground={ground} />
      <Feats collection={collection} ground={ground} />
    </SettingsPageContainer>
  );
}

function Count(props: { readonly n: string; readonly of: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold text-foreground tabular-nums">{props.n}</span>
      <span className="text-xs text-muted-foreground">{props.of}</span>
    </div>
  );
}

/** The day so far: what landed, merged and was born, and the Cells that landed, lined up. */
function TodayStrip(props: { readonly today: Today }) {
  const { today } = props;
  const primaryId = usePrimaryEnvironmentId();
  return (
    <SettingsSection title={COLLECTION.today} variant="plain">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {todayCounts(today).map((count) => (
          <Count key={count.of} n={count.n} of={count.of} />
        ))}
        {primaryId !== null && today.landed.length > 0 ? (
          <ul
            className="ms-auto flex flex-wrap items-end gap-2"
            aria-label={COLLECTION.landedToday}
          >
            {today.landed.map((threadId) => (
              <li key={threadId} aria-label={cellNameOf(threadId)}>
                <CellMini environmentId={primaryId} threadId={threadId} points={2} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SettingsSection>
  );
}

/** The Cell on the stage: alive, in what it wears now, under a name of its own so an act shown here plays here alone. */
function Stage(props: {
  readonly cell: CellRef | null;
  readonly look: readonly string[];
  readonly ground: Ground;
}) {
  const driver = useCellDriver(props.cell);
  return (
    <div className="collection-stage">
      <CellFigure
        name={stageName(props.cell)}
        mood="awake"
        provider={driver}
        look={props.look}
        ground={props.ground}
        points={6}
      />
    </div>
  );
}

const stageName = (cell: CellRef | null): string =>
  cell === null ? `stage:${STAND_IN}` : `stage:${cell.threadId}`;

function CellChip(props: {
  readonly cell: CellRef;
  readonly on: boolean;
  readonly onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      onClick={props.onPick}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
        props.on
          ? "border-foreground/40 bg-accent text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <CellMini environmentId={props.cell.environmentId} threadId={props.cell.threadId} />
      {cellNameOf(props.cell.threadId)}
    </button>
  );
}

/** Where the person dresses a Cell in what the feats unlocked, and has it show an act. */
function DressingRoom(props: { readonly collection: Collection; readonly ground: Ground }) {
  const { collection, ground } = props;
  const primaryId = usePrimaryEnvironmentId();
  const aski = useWorkspaceStore((store) => askiCellOf(store.workspace)?.threadId);
  const focused = useWorkspaceStore((store) => focusedPane(store.workspace)?.cell?.threadId);
  const cells = useMachineCells(primaryId)
    .filter((each) => each.threadId !== aski)
    .slice(0, MOST_TO_DRESS);
  const [picked, setPicked] = useState<string | null>(null);
  const cell =
    cells.find((each) => each.threadId === picked) ??
    cells.find((each) => each.threadId === focused) ??
    cells[0] ??
    null;
  const [day] = useState(() => dayOf(new Date()));
  useSyncExternalStore(onChosen, chosenVersion);
  // With no Cell open the stage holds a stand-in, dressed here alone and never kept.
  const [tried, setTried] = useState<readonly string[]>([]);
  const worn = cell === null ? tried : (collection.worn[cell.threadId] ?? []);
  const look = cell === null ? tried : lookOf(cell.threadId, day);
  const driver = useCellDriver(cell);

  const unlocked = unlockedPieces(collection.feats);
  const earned = standings(collection).filter(({ state }) => state.earned !== null);
  const pieces = earned.flatMap(({ feat }) => {
    const id = wornIdOf(feat.reward);
    return id !== undefined && unlocked.has(id) ? [{ feat, id }] : [];
  });
  const acts = actsToShow(collection.feats);

  const put = (id: string) => {
    const next = toggled(worn, id);
    if (cell === null) setTried(next);
    else {
      void wear(cell.threadId, next);
      if (!reducedMotion() && next.includes(id)) moment(cell.threadId, "dressed", clockSeconds());
    }
    if (!reducedMotion() && next.includes(id)) play(stageName(cell), "act/nod", clockSeconds());
  };
  const reset = () => (cell === null ? setTried([]) : void wear(cell.threadId, []));

  return (
    <SettingsSection title={COLLECTION.dressingRoom} variant="plain">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        {cells.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" aria-label={COLLECTION.cellsToDress}>
            {cells.map((each) => (
              <CellChip
                key={each.threadId}
                cell={each}
                on={each.threadId === cell?.threadId}
                onPick={() => setPicked(each.threadId)}
              />
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-52">
            <Stage cell={cell} look={look} ground={ground} />
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {cell === null ? COLLECTION.noCell : cellNameOf(cell.threadId)}
              </span>
              {worn.length > 0 ? (
                <Button size="xs" variant="ghost-muted" onClick={reset}>
                  {COLLECTION.ownLook}
                </Button>
              ) : null}
            </div>
            {cell === null ? (
              <p className="text-xs text-muted-foreground">{COLLECTION.tryOn}</p>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">{COLLECTION.toWear}</h3>
              {pieces.length === 0 ? (
                <p className="text-sm text-muted-foreground">{COLLECTION.nothingYet}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pieces.map(({ feat, id }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={worn.includes(id)}
                      onClick={() => put(id)}
                      data-feat-rarity={feat.rarity}
                      className="wardrobe-tile flex w-24 flex-col items-center gap-1 rounded-md border border-border bg-background p-2"
                    >
                      <CellStill
                        name={STAND_IN}
                        look={[id]}
                        provider={driver}
                        points={3}
                        ground={ground}
                      />
                      <span className="w-full truncate text-center text-2xs text-foreground">
                        {rewardShort(feat)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                {COLLECTION.acts(acts.length)}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {acts.map((each) => (
                  <Tooltip key={each.name}>
                    <TooltipTrigger
                      render={
                        <Button
                          size="xs"
                          variant={FEAT_ACTS.has(each.name) ? "outline" : "ghost-muted"}
                          onClick={() => play(stageName(cell), `act/${each.name}`, clockSeconds())}
                        />
                      }
                    >
                      {actWords(each.name)}
                    </TooltipTrigger>
                    <TooltipPopup side="bottom">{each.about}</TooltipPopup>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

/** One feat: what it unlocks on a Cell, its name, what it takes, and how far along or when and who. */
function FeatTile(props: {
  readonly standing: Standing;
  readonly fresh: boolean;
  readonly ground: Ground;
}) {
  const { feat, state } = props.standing;
  const earned = state.earned;
  const hidden = feat.rarity === "secret" && earned === null;
  const wornId = wornIdOf(feat.reward);
  const progress = featProgress(feat, state);
  return (
    <li
      data-feat-rarity={feat.rarity}
      className={`flex flex-col rounded-lg border border-border bg-card ${earned === null ? "feat-locked" : ""}`}
    >
      <div className="feat-plinth">
        {hidden ? (
          <span className="grid h-10 place-items-center text-xl font-semibold text-muted-foreground">
            ?
          </span>
        ) : (
          <CellStill
            name={STAND_IN}
            look={wornId === undefined ? [] : [wornId]}
            provider={null}
            points={3}
            ground={props.ground}
            scene={feat.reward.kind === "act" ? `act/${feat.reward.id}` : undefined}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="feat-rarity">{RARITY_NAMES[feat.rarity]}</span>
          {props.fresh ? (
            <span className="feat-new" role="img" aria-label={COLLECTION.isNew} />
          ) : null}
        </div>
        <span className="text-sm font-medium text-foreground">
          {hidden ? SECRET.name : featName(feat)}
        </span>
        <span className="text-xs text-muted-foreground">
          {hidden ? SECRET.takes : featTakes(feat)}
        </span>
        <div className="mt-auto flex flex-col gap-1 pt-1.5">
          {earned !== null ? (
            <span className="text-xs text-muted-foreground">
              {dateOf(earned.at)}
              {earned.threadId === null ? "" : ` · ${cellNameOf(earned.threadId)}`}
            </span>
          ) : progress !== null ? (
            <>
              <div className="feat-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((state.have / state.of) * 100)}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{progress}</span>
            </>
          ) : null}
          {hidden ? null : <span className="text-xs text-foreground/80">{rewardLine(feat)}</span>}
        </div>
      </div>
    </li>
  );
}

function Feats(props: { readonly collection: Collection; readonly ground: Ground }) {
  const all = standings(props.collection);
  const earned = all.filter(({ state }) => state.earned !== null);
  // What was new as the page opened stays marked while it is open, and is noted seen as it shuts.
  const [fresh] = useState(
    () =>
      new Set(
        earned.map(({ feat }) => feat.id).filter((id) => !props.collection.seen.includes(id)),
      ),
  );
  const leave = useEffectEvent(() => markSeen([...fresh]));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Note the feats shown here as seen on the machine when the page shuts.
  useEffect(() => () => leave(), []);
  return (
    <SettingsSection
      title={COLLECTION.feats(earned.length, all.length)}
      variant="plain"
      headerAction={
        props.collection.backfilled ? null : (
          <span className="text-xs text-muted-foreground">{COLLECTION.backfilling}</span>
        )
      }
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2.5">
        {all.map((standing) => (
          <FeatTile
            key={standing.feat.id}
            standing={standing}
            fresh={fresh.has(standing.feat.id)}
            ground={props.ground}
          />
        ))}
      </ul>
    </SettingsSection>
  );
}
