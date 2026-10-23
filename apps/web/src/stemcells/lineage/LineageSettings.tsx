import { useState } from "react";

import { CellStill } from "../cell/CellStill";
import type { Ground } from "../cell/keyline";
import { dayOf, looksOf } from "../cell/looks";
import { useCellGround } from "../upstream/appearance";
import { useLives } from "../upstream/lineage";
import {
  SettingsPageContainer,
  SettingsSection,
  Toggle,
  ToggleGroup,
  useRelativeTimeTick,
} from "../upstream/settings";
import {
  type Avatar,
  avatarsOf,
  isAwake,
  type Life,
  livedMs,
  type Order,
  ORDERS,
  spotlightOf,
  tallyOf,
} from "./lineage";
import { ProviderCell } from "./ProviderCell";

// Settings › Lineage: every name a Cell has been dealt, and the lives lived
// under it. A name comes back, so each chat that drew it is a new life of
// the same avatar, in the look it was dealt the day it was born. The page
// shows a face, a name and how many lives; a face opens its card with every
// life. The Cells here stand still: a page of many costs no frames.

/** What a life wore: the look its Cell is dealt alone, on the day it was born. */
const lookOfLife = (life: Life): readonly string[] =>
  looksOf([life.threadId], dayOf(new Date(life.born))).get(life.threadId)?.worn ?? [];

const ORDER_NAMES: Readonly<Record<Order, string>> = {
  lives: "Most lives",
  newest: "Newest",
  oldest: "Oldest",
};

/** "3 min", "2 h 14 min", "5 days". */
function spanOf(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  return `${Math.round(hours / 24)} days`;
}

const dateOf = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const livesWord = (n: number) => `${n} ${n === 1 ? "life" : "lives"}`;

export function LineageSettingsPanel() {
  const { lives, loading } = useLives();
  const now = useRelativeTimeTick(60_000);
  const ground = useCellGround();
  const [order, setOrder] = useState<Order>("lives");
  const [open, setOpen] = useState<string | null>(null);
  const avatars = avatarsOf(lives).sort(ORDERS[order]);
  const spotlight = spotlightOf(avatars);
  const toggle = (name: string) => setOpen((current) => (current === name ? null : name));

  return (
    <SettingsPageContainer>
      <SettingsSection
        id="lineage"
        title="Lineage"
        headerAction={
          avatars.length > 0 ? (
            <ToggleGroup
              aria-label="Order"
              value={[order]}
              onValueChange={(next) => {
                const value = next[0];
                if (value === "lives" || value === "newest" || value === "oldest") setOrder(value);
              }}
            >
              {(Object.keys(ORDER_NAMES) as Order[]).map((key) => (
                <Toggle key={key} value={key}>
                  {ORDER_NAMES[key]}
                </Toggle>
              ))}
            </ToggleGroup>
          ) : null
        }
        variant="plain"
      >
        {avatars.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Reading your Cells' lives…"
              : "No Cell has lived yet. Each chat is a Cell, and its name is kept here once it has one."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">{tallyOf(avatars, now)}</p>
            {spotlight !== undefined ? (
              <button
                type="button"
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left"
                aria-expanded={open === spotlight.name}
                onClick={() => toggle(spotlight.name)}
              >
                <CellStill
                  name={spotlight.lives.at(-1)!.threadId}
                  look={lookOfLife(spotlight.lives.at(-1)!)}
                  provider={spotlight.lives.at(-1)!.driver}
                  points={4}
                  ground={ground}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Most lives</span>
                  <span className="text-lg font-medium text-foreground">{spotlight.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {livesWord(spotlight.lives.length)} · first born {dateOf(spotlight.firstBorn)}
                  </span>
                </span>
              </button>
            ) : null}
            <div className="grid grid-flow-dense grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
              {avatars.flatMap((avatar) => [
                <AvatarTile
                  key={avatar.name}
                  avatar={avatar}
                  open={open === avatar.name}
                  awake={avatar.lives.some((life) => isAwake(life, now))}
                  ground={ground}
                  onToggle={() => toggle(avatar.name)}
                />,
                ...(open === avatar.name
                  ? [
                      <AvatarCard
                        key={`${avatar.name}:card`}
                        avatar={avatar}
                        now={now}
                        ground={ground}
                      />,
                    ]
                  : []),
              ])}
            </div>
          </div>
        )}
      </SettingsSection>
    </SettingsPageContainer>
  );
}

function AvatarTile(props: {
  readonly avatar: Avatar;
  readonly open: boolean;
  readonly awake: boolean;
  readonly ground: Ground;
  readonly onToggle: () => void;
}) {
  const latest = props.avatar.lives.at(-1)!;
  return (
    <button
      type="button"
      className={`flex flex-col items-center gap-1.5 rounded-lg border bg-card px-2 pt-3 pb-2 ${
        props.open ? "border-foreground/40" : "border-border"
      }`}
      aria-expanded={props.open}
      aria-label={`${props.avatar.name}, ${livesWord(props.avatar.lives.length)}${props.awake ? ", awake" : ""}`}
      onClick={props.onToggle}
    >
      <CellStill
        name={latest.threadId}
        look={lookOfLife(latest)}
        provider={latest.driver}
        points={2}
        ground={props.ground}
      />
      <span className="max-w-full truncate text-sm text-foreground">{props.avatar.name}</span>
      <span className="text-xs text-muted-foreground">
        {livesWord(props.avatar.lives.length)}
        {props.awake ? " · awake" : ""}
      </span>
    </button>
  );
}

/** An avatar's every life, oldest first, under its row. */
function AvatarCard(props: {
  readonly avatar: Avatar;
  readonly now: number;
  readonly ground: Ground;
}) {
  return (
    <div className="col-span-full flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        {props.avatar.name} · {livesWord(props.avatar.lives.length)}
      </p>
      <ol className="flex flex-col gap-2">
        {props.avatar.lives.map((life) => (
          <li key={life.key} className="flex items-center gap-3">
            <CellStill
              name={life.threadId}
              look={lookOfLife(life)}
              provider={life.driver}
              points={1}
              ground={props.ground}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-foreground">{life.title}</span>
              <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <ProviderCell driver={life.driver} className="size-3 shrink-0" />
                {life.provider} · {life.project} · born {dateOf(life.born)} · lived{" "}
                {spanOf(livedMs(life))}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {isAwake(life, props.now) ? "Awake" : life.archived ? "Archived" : "Resting"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
