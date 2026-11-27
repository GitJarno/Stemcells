/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (plan.css), outside upstream's Tailwind entry. */
/**
 * One plan, as the person reads it (stemcells/tasks/aski-orchestrator.md, decisions 4 and 7): a
 * row per Cell with its name, project, model and the words it is told; a row that waits says why
 * and takes one tap; a deletion takes a hand held on its own button, and nothing else does it.
 */
import { type CSSProperties, type ReactNode, use, useEffect, useRef, useState } from "react";

import type {
  DestroyAct,
  RiskMark,
  StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  CALL_BACK_MS,
  canDestroy,
  canStart,
  counts,
  held,
  setModel,
  setNewName,
  setPlace,
  type TrayAct,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import { cellNameOf } from "../../../../../../stemcells/words/cellNames.ts";
import {
  CALL_BACK,
  DEFAULT_MODEL,
  DICTATED,
  DROP,
  FLOOR_LINE,
  headline,
  HOLD_HEARD,
  HOLD_PRESS,
  HOLD_UNKNOWN,
  holdLine,
  holdStays,
  LEFT_OVER,
  placeLabel,
  START,
  START_ALL,
  whyLine,
} from "../../../../../../stemcells/words/plans.ts";
import { useOpenFromNeeds } from "../../upstream/needs";
import { Button } from "../../upstream/ui";
import { useWordsCatalog, useWordsPlaces } from "../../upstream/words";
import { runner } from "./PlanRunner";
import { PlanRoom } from "./room";
import { changePlan, closePlan, type LivePlan } from "./store";

import "./plan.css";

/** How long a hand stays down to confirm a deletion, in ms. */
export const HOLD_MS = 1200;

const STATUS_WORDS: Partial<Record<TrayAct["status"], string>> = {
  starting: "Starting",
  started: "Flying",
  dropped: "Dropped",
  "called-back": "Called back",
};

export function PlanCard(props: { live: LivePlan }) {
  const { live } = props;
  const tray = live.tray;
  if (tray === null)
    return (
      <section data-aski-plan="" data-reading="" aria-live="polite">
        <header data-plan-head="">{headline(0, 0, 0, true)}</header>
      </section>
    );
  const { plan } = tray;
  const { flying, waiting } = counts(tray);
  const cells = tray.acts.filter((one) => one.act.kind === "start").length;
  const holding = held(tray);
  const startable = tray.acts.filter(
    (one) => one.status === "waiting" && one.act.kind === "start" && canStart(one.act),
  ).length;
  const leftOver = plan.leftOver
    .map((n) => plan.pieces.find((piece) => piece.n === n)?.text ?? "")
    .filter((text) => text.length > 0);
  return (
    <section data-aski-plan="" data-source={live.source} aria-label="Aski's plan">
      <header data-plan-head="">
        <span data-plan-headline="" aria-live="polite">
          {plan.from === "floor" ? FLOOR_LINE : headline(cells, flying, waiting, false)}
        </span>
        {plan.dictated ? <span data-plan-chip="">{DICTATED}</span> : null}
        <span data-plan-head-actions="">
          {startable > 1 && !holding ? (
            <Button size="compact" onClick={() => runner.confirmAll(live.id)}>
              {START_ALL}
            </Button>
          ) : null}
          {live.source === "message" ? (
            <Button
              size="compact"
              variant="ghost-muted"
              aria-label="Close the plan"
              onClick={() => {
                runner.dropAll(live.id);
                closePlan(live.id);
              }}
            >
              ×
            </Button>
          ) : null}
        </span>
      </header>
      <ol data-plan-rows="">
        {tray.acts.map((one, index) =>
          one.act.kind === "destroy" ? (
            <HoldRow key={one.act.i} planId={live.id} one={one} act={one.act} />
          ) : (
            <CellRow
              key={one.act.i}
              planId={live.id}
              one={one}
              act={one.act}
              index={index}
              holding={holding}
            />
          ),
        )}
      </ol>
      {leftOver.length > 0 ? <p data-plan-note="">{LEFT_OVER(leftOver.join(" … "))}</p> : null}
    </section>
  );
}

/** A Cell's words, with what can't be taken back marked. */
function Words(props: { words: string; risks: readonly RiskMark[] }) {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const risk of props.risks.toSorted((a, b) => a.start - b.start)) {
    if (risk.start < from) continue;
    parts.push(props.words.slice(from, risk.start));
    parts.push(
      <mark key={risk.start} data-plan-risk="">
        {props.words.slice(risk.start, risk.end)}
      </mark>,
    );
    from = risk.end;
  }
  parts.push(props.words.slice(from));
  return <p data-plan-words="">{parts}</p>;
}

function CellRow(props: {
  planId: string;
  one: TrayAct;
  act: StartAct;
  index: number;
  holding: boolean;
}) {
  const { planId, one, act } = props;
  const open = useOpenFromNeeds();
  const waiting = one.status === "waiting";
  const [whole, setWhole] = useState(false);
  const why = act.why.flatMap((each) => whyLine(act, each) ?? []);
  const model = act.model;
  const effort = model?.effort?.level ?? act.effort;
  const status = STATUS_WORDS[one.status];
  return (
    <li
      data-plan-row=""
      data-status={one.status}
      style={{ "--plan-row": props.index } as CSSProperties}
    >
      <div data-plan-line="">
        <button
          type="button"
          data-plan-cell=""
          disabled={one.status !== "started"}
          onClick={() => open.chat(act.threadId)}
        >
          {cellNameOf(act.threadId)}
        </button>
        {waiting ? (
          <Pickers planId={planId} act={act} />
        ) : (
          <span data-plan-meta="">
            {[placeLabel(act), model?.name ?? DEFAULT_MODEL, effort].filter(Boolean).join(" · ")}
          </span>
        )}
        <button
          type="button"
          data-plan-title=""
          aria-expanded={whole || waiting}
          onClick={() => setWhole(!whole)}
        >
          {act.title}
        </button>
        <span data-plan-actions="">
          {waiting ? (
            <>
              <Button
                size="compact"
                disabled={props.holding || !canStart(act)}
                onClick={() => runner.confirm(planId, act.i)}
              >
                {START}
              </Button>
              <Button size="compact" variant="ghost-muted" onClick={() => runner.drop(planId, act.i)}>
                {DROP}
              </Button>
            </>
          ) : one.status === "started" && one.startedAt !== undefined ? (
            <CallBack planId={planId} i={act.i} startedAt={one.startedAt} />
          ) : null}
          {status === undefined || waiting ? null : <span data-plan-status="">{status}</span>}
        </span>
      </div>
      {waiting && why.length > 0 ? <p data-plan-why="">{why.join(" · ")}</p> : null}
      {one.status === "failed" ? <p data-plan-failed="">{one.reason ?? "It didn't start."}</p> : null}
      {waiting || whole ? <Words words={act.words} risks={act.risks} /> : null}
    </li>
  );
}

/** A waiting Cell's project and model, as the person can still change them. */
function Pickers(props: { planId: string; act: StartAct }) {
  const { planId, act } = props;
  const aski = use(PlanRoom);
  const { places } = useWordsPlaces();
  const { catalog, ready } = useWordsCatalog(aski?.environmentId ?? null);
  const place = act.place;
  // A plan Aski's chat proposed names its project and model itself: they stand as they are.
  if (act.selection !== undefined || place?.projectId !== undefined)
    return (
      <span data-plan-meta="">
        {[placeLabel(act), act.selection?.model].filter(Boolean).join(" · ")}
      </span>
    );
  const models = catalog.providers
    .filter((provider) => ready.has(provider.id))
    .flatMap((provider) => provider.models.map((model) => ({ provider, model })));
  const modelKey = act.model === null ? "" : `${act.model.instanceId}\u0000${act.model.id}`;
  return (
    <span data-plan-pickers="">
      {place?.how === "new" ? (
        <input
          data-plan-pick=""
          aria-label="The new project's name"
          defaultValue={place.name}
          onChange={(event) =>
            changePlan(planId, (tray) => setNewName(tray, act.i, event.target.value))
          }
        />
      ) : (
        <select
          data-plan-pick=""
          data-unsure={place === null || place.how !== "exact" ? "" : undefined}
          aria-label="Project"
          value={place?.id ?? ""}
          onChange={(event) => {
            const picked = places.find((each) => each.id === event.target.value);
            if (picked) changePlan(planId, (tray) => setPlace(tray, act.i, picked));
          }}
        >
          {place === null ? <option value="">Which project?</option> : null}
          {places.map((each) => (
            <option key={each.id} value={each.id}>
              {each.name}
            </option>
          ))}
        </select>
      )}
      <select
        data-plan-pick=""
        data-unsure={act.model?.how === "near" ? "" : undefined}
        aria-label="Model"
        value={modelKey}
        onChange={(event) => {
          const picked = models.find(
            ({ provider, model }) => `${provider.id}\u0000${model.id}` === event.target.value,
          );
          changePlan(planId, (tray) =>
            setModel(
              tray,
              act.i,
              picked === undefined
                ? null
                : {
                    instanceId: picked.provider.id,
                    id: picked.model.id,
                    name: picked.model.name,
                    effort: null,
                  },
            ),
          );
        }}
      >
        <option value="">{DEFAULT_MODEL}</option>
        {models.map(({ provider, model }) => (
          <option key={`${provider.id}\u0000${model.id}`} value={`${provider.id}\u0000${model.id}`}>
            {model.name}
          </option>
        ))}
      </select>
      {act.model?.effort || act.effort ? (
        <span data-plan-meta="">{act.model?.effort?.level ?? act.effort}</span>
      ) : null}
    </span>
  );
}

/** For ten seconds after a Cell starts, one tap stops and archives it. */
function CallBack(props: { planId: string; i: number; startedAt: number }) {
  const left = () => props.startedAt + CALL_BACK_MS - Date.now();
  const [open, setOpen] = useState(() => left() > 0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Take the button away when the Cell's call-back time ends, and clear the timer on unmount.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), Math.max(0, left()));
    return () => clearTimeout(timer);
  });
  if (!open) return null;
  return (
    <Button
      size="compact"
      variant="ghost-muted"
      onClick={() => void runner.callBack(props.planId, props.i)}
    >
      {CALL_BACK}
    </Button>
  );
}

/**
 * A deletion. It names the thing as the app writes it, says what stays, and is carried out only
 * by a pointer or a key held on its button for `HOLD_MS`: no Enter, no "Start all", no message.
 */
function HoldRow(props: { planId: string; one: TrayAct; act: DestroyAct }) {
  const { planId, one, act } = props;
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const letGo = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const press = () => {
    if (timer.current !== null) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      letGo();
      void runner.destroy(planId, act.i);
    }, HOLD_MS);
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Clear the hold's timer if the row leaves while a hand is down.
  useEffect(() => () => void (timer.current !== null && clearTimeout(timer.current)), []);
  const known = canDestroy(act);
  const waiting = one.status === "waiting";
  return (
    <li data-plan-row="" data-plan-hold="" data-status={one.status}>
      <div data-plan-line="">
        <strong data-plan-hold-what="">{holdLine(act)}</strong>
        <span data-plan-actions="">
          {waiting && known ? (
            <button
              type="button"
              data-plan-hold-button=""
              data-holding={holding ? "" : undefined}
              style={{ "--plan-hold": `${HOLD_MS}ms` } as CSSProperties}
              onPointerDown={(event) => {
                if (event.button === 0) press();
              }}
              onPointerUp={letGo}
              onPointerLeave={letGo}
              onPointerCancel={letGo}
              onKeyDown={(event) => {
                if ((event.key === " " || event.key === "Enter") && !event.repeat) press();
              }}
              onKeyUp={letGo}
              onBlur={letGo}
              // A click alone does nothing: only the hold.
              onClick={(event) => event.preventDefault()}
            >
              {HOLD_PRESS}
            </button>
          ) : null}
          {waiting ? (
            <Button size="compact" variant="ghost-muted" onClick={() => runner.drop(planId, act.i)}>
              {DROP}
            </Button>
          ) : (
            <span data-plan-status="">{one.status === "done" ? "Done" : "Dropped"}</span>
          )}
        </span>
      </div>
      {waiting ? (
        <p data-plan-why="">
          {known ? `${HOLD_HEARD(act.words)} ${holdStays(act)}` : HOLD_UNKNOWN}
        </p>
      ) : null}
    </li>
  );
}
