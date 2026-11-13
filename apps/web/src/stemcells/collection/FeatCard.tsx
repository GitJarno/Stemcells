/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (collection.css), outside upstream's Tailwind entry. */
// A feat's moment: a card in the corner that names the feat, the Cell whose fact did it and
// what it unlocked, with one button to wear it. It takes no focus and leaves on its own.

import { useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { wornIdOf } from "../../../../../stemcells/ledger/feats.ts";
import {
  COLLECTION,
  featName,
  featSaid,
  RARITY_NAMES,
} from "../../../../../stemcells/words/feats.ts";
import { moment } from "../cell/acting";
import { clockSeconds } from "../cell/blink";
import { CellStill } from "../cell/CellStill";
import { dayOf, lookOf } from "../cell/looks";
import { cellNameOf } from "../cell/name";
import { reducedMotion } from "../tokens/motion";
import { useCellGround } from "../upstream/appearance";
import { usePrimaryEnvironmentId } from "../upstream/disk";
import { useCellDriver } from "../upstream/providers";
import { Button, InlineButton } from "../upstream/ui";
import { toggled } from "./dress";
import type { Standing } from "./fresh";
import { markSeen, wear } from "./read";
import "./collection.css";

/** How long the card stays when the pointer leaves it alone, in ms. */
const STAYS = 14_000;

export function FeatCard(props: {
  readonly standing: Standing;
  readonly worn: readonly string[];
  readonly onDone: () => void;
}) {
  const { feat, state } = props.standing;
  const threadId = state.earned?.threadId ?? null;
  const primaryId = usePrimaryEnvironmentId();
  const driver = useCellDriver(
    threadId === null || primaryId === null
      ? null
      : { environmentId: primaryId, threadId, draftId: null },
  );
  const ground = useCellGround();
  const navigate = useNavigate();
  const [held, setHeld] = useState(false);
  const [day] = useState(() => dayOf(new Date()));
  const done = useEffectEvent(() => props.onDone());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The card is shown: note the feat as seen on the machine and let the Cell that earned it mark the moment, once.
  useEffect(() => {
    markSeen([feat.id]);
    if (threadId !== null && !reducedMotion()) moment(threadId, "feat", clockSeconds());
  }, [feat.id, threadId]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Leave after its stay unless the pointer holds it, clearing the timer on change.
  useEffect(() => {
    if (held) return;
    const leave = setTimeout(() => done(), STAYS);
    return () => clearTimeout(leave);
  }, [held]);

  const wornId = wornIdOf(feat.reward);
  const name = threadId === null ? null : cellNameOf(threadId);
  const figure = threadId ?? "collection";
  const own = threadId === null ? [] : lookOf(threadId, day);
  const wearing = wornId !== undefined && props.worn.includes(wornId);
  return (
    <aside
      className="feat-card flex gap-3 rounded-lg border border-border bg-card p-3"
      data-feat-rarity={feat.rarity}
      aria-label={COLLECTION.earned}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
    >
      <div className="grid w-14 shrink-0 place-items-center">
        <CellStill
          name={figure}
          look={wornId === undefined ? own : [wornId, ...own]}
          provider={driver}
          points={3}
          ground={ground}
          scene={feat.reward.kind === "act" ? `act/${feat.reward.id}` : undefined}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="feat-rarity">{COLLECTION.rarityFeat(RARITY_NAMES[feat.rarity])}</span>
        <span className="text-sm font-medium text-foreground">{featName(feat)}</span>
        <span className="text-xs text-muted-foreground">{featSaid(feat, name)}</span>
        <div className="mt-1.5 flex items-center gap-3">
          {wornId !== undefined && threadId !== null && !wearing ? (
            <Button
              size="xs"
              onClick={() => {
                void wear(threadId, toggled(props.worn, wornId));
                if (!reducedMotion()) moment(threadId, "dressed", clockSeconds());
              }}
            >
              {COLLECTION.putOn(name ?? "")}
            </Button>
          ) : null}
          <InlineButton
            onClick={() => {
              props.onDone();
              void navigate({ to: "/settings/collection" });
            }}
          >
            {COLLECTION.title}
          </InlineButton>
        </div>
      </div>
      <button
        type="button"
        className="self-start text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        onClick={props.onDone}
      >
        <XIcon className="size-3.5" />
      </button>
    </aside>
  );
}
