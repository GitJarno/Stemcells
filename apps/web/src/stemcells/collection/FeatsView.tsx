/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (collection.css), outside upstream's Tailwind entry. */
// The feats, the summary first: how many are earned and the rank that makes, each segment's
// share, and the day so far; then the rungs nearest earned; then one row a ladder, which opens
// on its rungs; the secrets last and apart. Every Cell here stands still.

import { ChevronDownIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { type Collection, SEGMENTS, type Today } from "../../../../../stemcells/ledger/feats.ts";
import {
  type Ladder,
  laddersOf,
  nextUp,
  rankOf,
  reachOf,
  secretsOf,
  type Standing,
  type Tally,
  tallyOf,
} from "../../../../../stemcells/ledger/ladders.ts";
import {
  COLLECTION,
  featName,
  featTakes,
  ladderName,
  ladderProgress,
  RANK_NAMES,
  RARITY_NAMES,
  rankLine,
  rewardLine,
  SECRET,
  SEGMENT_ABOUT,
  SEGMENT_NAMES,
  todayCounts,
} from "../../../../../stemcells/words/feats.ts";
import type { Ground } from "../cell/keyline";
import { cellNameOf } from "../cell/name";
import { CellMini } from "../rail/CellMini";
import { usePrimaryEnvironmentId } from "../upstream/disk";
import { SettingsSection } from "../upstream/settings";
import { markSeen } from "./read";
import { RewardCell } from "./RewardCell";
import "./collection.css";

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const percent = (part: number) => `${Math.round(Math.min(1, Math.max(0, part)) * 100)}%`;

export function FeatsView(props: { readonly collection: Collection; readonly ground: Ground }) {
  const { collection, ground } = props;
  const ladders = laddersOf(collection.feats);
  const secrets = secretsOf(collection.feats);
  // What was new as the page opened stays marked while it is open, and is noted seen as it shuts.
  const [fresh] = useState(
    () =>
      new Set(
        collection.feats
          .filter((state) => state.earned !== null && !collection.seen.includes(state.id))
          .map((state) => state.id),
      ),
  );
  const leave = useEffectEvent(() => markSeen([...fresh]));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Note the feats shown here as seen on the machine when the page shuts.
  useEffect(() => () => leave(), []);
  const near = nextUp(ladders);
  return (
    <>
      <Summary
        tally={tallyOf(collection.feats)}
        today={collection.today}
        backfilled={collection.backfilled}
      />
      <SettingsSection title={COLLECTION.nextUp} variant="plain">
        {near.length === 0 ? (
          <p className="text-sm text-muted-foreground">{COLLECTION.nextUpNone}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {near.map((ladder) => (
              <NextCard key={ladder.measure} ladder={ladder} ground={ground} />
            ))}
          </ul>
        )}
      </SettingsSection>
      {SEGMENTS.map((segment) => {
        const own = ladders.filter((ladder) => ladder.segment === segment);
        return (
          <SettingsSection
            key={segment}
            title={SEGMENT_NAMES[segment]}
            variant="plain"
            headerAction={
              <span className="text-xs text-muted-foreground">{SEGMENT_ABOUT[segment]}</span>
            }
          >
            <ul className="overflow-hidden rounded-lg border border-border bg-card">
              {own.map((ladder) => (
                <LadderRow key={ladder.measure} ladder={ladder} fresh={fresh} ground={ground} />
              ))}
            </ul>
          </SettingsSection>
        );
      })}
      <SettingsSection title={COLLECTION.secrets} variant="plain">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {secrets.map((standing) => (
            <SecretTile
              key={standing.feat.id}
              standing={standing}
              fresh={fresh.has(standing.feat.id)}
              ground={ground}
            />
          ))}
        </ul>
      </SettingsSection>
    </>
  );
}

/** A ring filled as far as `part` of it is done, its number in the middle. */
function Ring(props: { readonly part: number; readonly n: number; readonly of: number }) {
  const round = 2 * Math.PI * 34;
  return (
    <div className="feat-ring" role="img" aria-label={COLLECTION.feats(props.n, props.of)}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="feat-ring-track" cx="40" cy="40" r="34" />
        <circle
          className="feat-ring-fill"
          cx="40"
          cy="40"
          r="34"
          strokeDasharray={`${round * Math.min(1, props.part)} ${round}`}
        />
      </svg>
      <span className="feat-ring-count">
        <span className="text-2xl font-semibold text-foreground tabular-nums">{props.n}</span>
        <span className="text-2xs text-muted-foreground tabular-nums">of {props.of}</span>
      </span>
    </div>
  );
}

/** The whole collection in one look: feats earned, the rank they make, each segment, and today. */
function Summary(props: {
  readonly tally: Tally;
  readonly today: Today;
  readonly backfilled: boolean;
}) {
  const { tally, today } = props;
  const primaryId = usePrimaryEnvironmentId();
  const { rank, toNext } = rankOf(tally.all.earned);
  const next = rankLine(rank, toNext);
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Ring part={tally.all.earned / tally.all.of} n={tally.all.earned} of={tally.all.of} />
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-semibold text-foreground">{RANK_NAMES[rank]}</span>
            {next === null ? null : <span className="text-xs text-muted-foreground">{next}</span>}
            {tally.secrets > 0 ? (
              <span className="feat-secret-ink text-xs">
                {COLLECTION.secretsFound(tally.secrets)}
              </span>
            ) : null}
            {props.backfilled ? null : (
              <span className="text-xs text-muted-foreground">{COLLECTION.backfilling}</span>
            )}
          </div>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col gap-2 sm:ms-auto sm:max-w-80">
          {tally.segments.map((each) => (
            <li key={each.segment} className="flex items-center gap-3">
              <span className="w-12 text-xs text-foreground">{SEGMENT_NAMES[each.segment]}</span>
              <div className="feat-bar flex-1" aria-hidden="true">
                <span style={{ width: percent(each.earned / each.of) }} />
              </div>
              <span className="w-14 text-end text-xs text-muted-foreground tabular-nums">
                {COLLECTION.count(each.earned, each.of)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3">
        <span className="text-xs font-medium text-muted-foreground">{COLLECTION.today}</span>
        {todayCounts(today).map((count) => (
          <span key={count.of} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{count.n}</span> {count.of}
          </span>
        ))}
        {primaryId !== null && today.landed.length > 0 ? (
          <ul
            className="ms-auto flex flex-wrap items-end gap-1.5"
            aria-label={COLLECTION.landedToday}
          >
            {today.landed.slice(0, 12).map((threadId) => (
              <li key={threadId} aria-label={cellNameOf(threadId)}>
                <CellMini environmentId={primaryId} threadId={threadId} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/** A rung nearly earned: what it is, how near, and what it unlocks. */
function NextCard(props: { readonly ladder: Ladder; readonly ground: Ground }) {
  const { ladder } = props;
  const next = ladder.next;
  if (next === null) return null;
  return (
    <li
      data-feat-rarity={next.feat.rarity}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <RewardCell feat={next.feat} earned={false} points={3} ground={props.ground} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-foreground">{featName(next.feat)}</span>
        <div className="feat-bar" aria-hidden="true">
          <span style={{ width: percent(reachOf(ladder)) }} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{ladderProgress(ladder)}</span>
        <span className="truncate text-xs text-foreground/80">{rewardLine(next.feat)}</span>
      </div>
    </li>
  );
}

/** A ladder's rungs as dots: each earned one filled in its rarity's hue. */
function Pips(props: { readonly ladder: Ladder }) {
  const { rungs, earned } = props.ladder;
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={COLLECTION.rung(earned, rungs.length)}
    >
      {rungs.map(({ feat, state }) => (
        <span
          key={feat.id}
          data-feat-rarity={feat.rarity}
          className={state.earned === null ? "ladder-pip" : "ladder-pip ladder-pip-on"}
        />
      ))}
    </span>
  );
}

/** One ladder in a line: the last thing it unlocked, how far up it is, and how near the next rung; it opens on every rung. */
function LadderRow(props: {
  readonly ladder: Ladder;
  readonly fresh: ReadonlySet<string>;
  readonly ground: Ground;
}) {
  const { ladder, ground } = props;
  const [open, setOpen] = useState(false);
  const held = ladder.rungs.findLast(({ state }) => state.earned !== null);
  const shown = held ?? ladder.rungs[0]!;
  const isNew = ladder.rungs.some(({ feat }) => props.fresh.has(feat.id));
  return (
    <li
      className="border-b border-border last:border-b-0"
      data-feat-rarity={(ladder.next ?? shown).feat.rarity}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="ladder-row flex w-full items-center gap-3 px-3 py-2.5 text-start"
      >
        <span className="grid w-10 shrink-0 place-items-center">
          <RewardCell feat={shown.feat} earned={held !== undefined} points={2} ground={ground} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {ladderName(ladder)}
            </span>
            {isNew ? <span className="feat-new" role="img" aria-label={COLLECTION.isNew} /> : null}
          </span>
          <span className="feat-bar" aria-hidden="true">
            <span style={{ width: percent(reachOf(ladder)) }} />
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Pips ladder={ladder} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {ladderProgress(ladder)}
          </span>
        </span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul className="flex flex-col gap-0.5 px-3 pb-3">
          {ladder.rungs.map((standing) => (
            <Rung
              key={standing.feat.id}
              standing={standing}
              fresh={props.fresh.has(standing.feat.id)}
              ground={ground}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** One rung: what it unlocks, what it takes, and when and who, or what it will give. */
function Rung(props: {
  readonly standing: Standing;
  readonly fresh: boolean;
  readonly ground: Ground;
}) {
  const { feat, state } = props.standing;
  const earned = state.earned;
  return (
    <li
      data-feat-rarity={feat.rarity}
      className="flex items-center gap-3 rounded-md bg-background px-2.5 py-2"
    >
      <span className="grid w-10 shrink-0 place-items-center">
        <RewardCell feat={feat} earned={earned !== null} points={2} ground={props.ground} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm text-foreground">{featName(feat)}</span>
          <span className="feat-rarity">{RARITY_NAMES[feat.rarity]}</span>
          {props.fresh ? (
            <span className="feat-new" role="img" aria-label={COLLECTION.isNew} />
          ) : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">{featTakes(feat)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-xs text-foreground/80">{rewardLine(feat)}</span>
        {earned === null ? null : (
          <span className="text-xs text-muted-foreground">
            {dateOf(earned.at)}
            {earned.threadId === null ? "" : ` · ${cellNameOf(earned.threadId)}`}
          </span>
        )}
      </span>
    </li>
  );
}

/** A secret: nothing but a question mark until it is found. */
function SecretTile(props: {
  readonly standing: Standing;
  readonly fresh: boolean;
  readonly ground: Ground;
}) {
  const { feat, state } = props.standing;
  const earned = state.earned;
  return (
    <li
      data-feat-rarity="secret"
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <span className="grid size-10 shrink-0 place-items-center">
        {earned === null ? (
          <span className="text-xl font-semibold text-muted-foreground">?</span>
        ) : (
          <RewardCell feat={feat} earned points={2} ground={props.ground} />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {earned === null ? SECRET.name : featName(feat)}
          </span>
          {props.fresh ? (
            <span className="feat-new" role="img" aria-label={COLLECTION.isNew} />
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {earned === null ? SECRET.takes : rewardLine(feat)}
        </span>
      </span>
    </li>
  );
}
