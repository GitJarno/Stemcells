/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (collection.css), outside upstream's Tailwind entry. */
// The wardrobe: a dressing room where the person puts what the feats unlocked on a Cell and
// watches an act. One Cell here is alive, the one on the stage; every other stands still.

import { useState, useSyncExternalStore } from "react";

import {
  type Collection,
  FEAT_ACTS,
  unlockedPieces,
  wornIdOf,
} from "../../../../../stemcells/ledger/feats.ts";
import { actWords, COLLECTION, rewardShort } from "../../../../../stemcells/words/feats.ts";
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
import { usePrimaryEnvironmentId } from "../upstream/disk";
import { useCellDriver } from "../upstream/providers";
import { useMachineCells } from "../upstream/rail";
import { SettingsSection } from "../upstream/settings";
import { Button, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { actsToShow, MOST_TO_DRESS, toggled } from "./dress";
import { standings } from "./fresh";
import { wear } from "./read";
import { STAND_IN } from "./RewardCell";
import "./collection.css";

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
export function Wardrobe(props: { readonly collection: Collection; readonly ground: Ground }) {
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
