/**
 * One Cell of a plan on one line (aski-orchestrator.md, decisions 15, 16 and 18), drawn from the
 * Awake row's own pieces (`rail/RowParts.tsx`). Before Send it is a task with no Cell name and no
 * creature; Send gives it both, and from then on it reads its Cell as the Awake list does.
 */
import { ChevronDownIcon } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  messageOf,
  type RiskMark,
  type StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import type { RowSays } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  CALL_BACK_MS,
  setModel,
  setNewName,
  setPlace,
  type TrayAct,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import {
  CALL_BACK,
  DEFAULT_MODEL,
  DROP,
  OWN_WORKTREE,
  placeLabel,
  START_NOW,
  SWITCH_OFF,
  SWITCH_ON,
  TOLD,
  whyLine,
  whyLines,
} from "../../../../../../stemcells/words/plans.ts";
import { toneTokenOf } from "../../glow/light";
import type { CellStanding } from "../../needs/wire";
import { rowStateOf, rowStatusOf } from "../../rail/awake";
import { RowCell, RowEnd, RowField, rowPlateProps, RowTitle } from "../../rail/RowParts";
import { CellMark } from "../../tabs/CellMark";
import type { usePlanRows } from "../../upstream/askiPlans";
import { usePlanPlaces } from "../../upstream/askiPlans";
import {
  CellProjectMarkOf,
  compactAge,
  useCellLightFacts,
  useCellShell,
} from "../../upstream/cellRow";
import { useOpenFromNeeds } from "../../upstream/needs";
import { PlanModelPick } from "../../upstream/planPick";
import {
  Button,
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "../../upstream/ui";
import { runner } from "./PlanRunner";
import { cardFormKey, takeSent } from "./sent";
import { playSent } from "./sentPlay";
import { changePlan } from "./store";

type Rows = ReturnType<typeof usePlanRows>;

/** A press on a control inside the row is the control's own: the row hears none of it. */
function Own(props: { children: ReactNode }) {
  return (
    <span
      data-plan-own=""
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {props.children}
    </span>
  );
}

export function PlanRow(props: {
  planId: string;
  /** Aski's server, where the plan's Cells start. */
  environmentId: string;
  one: TrayAct;
  act: StartAct;
  index: number;
  /** A deletion of the plan still waits for the person's hand. */
  holding: boolean;
  says: RowSays;
  /** Not yet a Cell, and it will be given a worktree of its own. */
  apart: boolean;
  /** Its Cell as the needs list has it; null before it is one, and for one asleep. */
  standing: CellStanding | null;
  now: number;
  rows: Rows;
}) {
  const { planId, one, act, says, standing } = props;
  const open = useOpenFromNeeds();
  const waiting = one.status === "waiting";
  const off = one.off === true;
  // What is sent has a creature: a Cell on its way, or one that started.
  const sent = one.status === "starting" || one.status === "started";
  const cell = { environmentId: props.environmentId, threadId: act.threadId, draftId: null };
  const shell = useCellShell(cell);
  const { driver, unseen } = useCellLightFacts(cell);
  // What can't be taken back is read before it is sent: its words stand open.
  const [whole, setWhole] = useState(() => waiting && act.why.includes("risky"));
  // Read of upstream for a task and for a Cell this window just sent, whose line then stands as
  // it was sent. A plan read back under an old message says what the plan itself names.
  const facts =
    one.status === "started" && one.startedAt === undefined ? null : props.rows.factsOf(act);
  const project = props.rows.projectOf(act);
  // A plan Aski's chat proposed names its project and its model itself: they stand as they are.
  // So does a plan drawn outside Aski's chat, where no server is known to pick from.
  const fixed =
    act.selection !== undefined || act.place?.projectId !== undefined || props.environmentId === "";
  const model = facts?.modelName ?? act.model?.name ?? "";
  const effort = facts?.effort ?? act.model?.effort?.level ?? act.effort;
  const why = waiting ? whyLines(act, props.holding) : [];

  const line = useRef<HTMLDivElement>(null);
  const { threadId, i } = act;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Play the row's one-shot Send on its DOM as its Cell is sent, before paint.
  useLayoutEffect(() => {
    if (!sent) return;
    const box = line.current?.querySelector<HTMLElement>("[data-cells-row-cell]");
    const at = takeSent(planId, i);
    if (line.current && box && at !== undefined) playSent(line.current, box, threadId, at);
  }, [sent, planId, i, threadId]);

  const lit = one.status === "started" && standing !== null;
  const state = lit
    ? rowStateOf(standing.holds == null ? standing.stage : undefined, unseen)
    : null;
  const short = standing?.landing?.verdict === "short";
  const when = waiting
    ? off
      ? SWITCH_OFF
      : says.word
    : lit && !short && standing.since
      ? compactAge(standing.since, props.now)
      : says.word;
  const toggle = () => setWhole(!whole);

  return (
    <li
      data-plan-row=""
      data-status={one.status}
      data-off={off ? "" : undefined}
      style={{ "--plan-row": props.index } as CSSProperties}
    >
      <div
        ref={line}
        data-plan-line=""
        {...rowPlateProps({
          light: state === null ? null : { state, tone: toneTokenOf(driver) },
          // A Cell opens as its row in Awake does; a task opens its words.
          onOpen: one.status === "started" ? () => open.chat(threadId) : toggle,
        })}
      >
        {state === null ? null : <RowField />}
        {sent ? (
          <RowCell>
            <CellMark cell={cell} forms={cardFormKey(threadId)} driver={facts?.driver} />
          </RowCell>
        ) : null}
        {waiting && !fixed ? (
          <Own>
            <ProjectPick planId={planId} act={act} project={project} />
          </Own>
        ) : (
          <span data-plan-place="">
            {project === null ? null : <CellProjectMarkOf {...project} settles={false} />}
            <span data-plan-place-name="">{placeLabel(act)}</span>
          </span>
        )}
        <RowTitle>{act.title}</RowTitle>
        {why.length === 0 ? null : (
          // Beside the title it may be cut short: pointed at, it says all of it.
          <Tooltip>
            <TooltipTrigger render={<span data-plan-why="" />}>{why.join(" · ")}</TooltipTrigger>
            <TooltipPopup side="top">{why.join(" · ")}</TooltipPopup>
          </Tooltip>
        )}
        {props.apart ? <span data-plan-meta="">{OWN_WORKTREE}</span> : null}
        {waiting && !fixed ? (
          <Own>
            <span data-plan-model="" data-unsure={act.model?.how === "near" ? "" : undefined}>
              <PlanModelPick
                environmentId={props.environmentId}
                model={props.rows.modelOf(act)}
                onPick={(model) => changePlan(planId, (tray) => setModel(tray, i, model))}
              />
            </span>
          </Own>
        ) : (
          <span data-plan-meta="">
            {[model || (waiting ? DEFAULT_MODEL : ""), effort].filter(Boolean).join(" · ")}
          </span>
        )}
        {one.status === "started" && one.startedAt !== undefined ? (
          <Own>
            <CallBack planId={planId} i={i} startedAt={one.startedAt} />
          </Own>
        ) : null}
        <RowEnd
          lit={lit}
          status={state === null ? null : rowStatusOf(state, shell?.hasPendingApprovals === true)}
          when={when}
          act={
            waiting
              ? {
                  label: off ? SWITCH_ON : SWITCH_OFF,
                  icon: <span data-plan-switch="">{off ? SWITCH_ON : SWITCH_OFF}</span>,
                  run: () => runner.toggle(planId, i),
                }
              : null
          }
        />
        <button
          type="button"
          data-plan-chevron=""
          aria-label={TOLD}
          aria-expanded={whole}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          <ChevronDownIcon aria-hidden />
        </button>
      </div>
      {one.status === "queued" ? (
        // Waiting its turn is the plan as said: starting now is the quieter choice.
        <div data-plan-queued="">
          <Button
            size="compact"
            variant="outline"
            disabled={props.holding}
            onClick={() => runner.startNow(planId, i)}
          >
            {START_NOW}
          </Button>
          <Button size="compact" variant="ghost-muted" onClick={() => runner.drop(planId, i)}>
            {DROP}
          </Button>
        </div>
      ) : null}
      {says.line === null ? null : <p data-plan-said="">{says.line}</p>}
      {says.stuck === null ? null : <p data-plan-stuck="">{says.stuck}</p>}
      {one.status === "failed" ? (
        <p data-plan-failed="">{one.reason ?? "It didn't start."}</p>
      ) : null}
      {whole ? (
        <div data-plan-told="">
          <p data-plan-told-head="">{TOLD}</p>
          <Words words={messageOf(act)} risks={act.risks} />
        </div>
      ) : null}
    </li>
  );
}

/** A Cell's words as it is sent them, with what can't be taken back marked. */
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

/**
 * A waiting Cell's project, as the person can still change it: the projects the column's own
 * filter lists, in the same menu. One Aski heard near or picked itself is marked, and one that
 * is missing holds Send until it is picked. A project the plan is to make takes its name instead.
 */
function ProjectPick(props: {
  planId: string;
  act: StartAct;
  project: ReturnType<Rows["projectOf"]>;
}) {
  const { planId, act, project } = props;
  const { places } = usePlanPlaces();
  const place = act.place;
  if (place?.how === "new")
    return (
      <input
        data-plan-pick=""
        aria-label="The new project's name"
        defaultValue={place.name}
        onChange={(event) =>
          changePlan(planId, (tray) => setNewName(tray, act.i, event.target.value))
        }
      />
    );
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            data-plan-pick=""
            data-unsure={place === null || place.how !== "exact" ? "" : undefined}
            aria-label={`Project: ${place === null ? whyLine(act, "place-open") : place.name}`}
          />
        }
      >
        {project === null ? null : <CellProjectMarkOf {...project} settles={false} />}
        <span data-plan-place-name="">
          {place === null ? whyLine(act, "place-open") : place.name}
        </span>
        <ChevronDownIcon aria-hidden />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuRadioGroup
          value={place?.id ?? ""}
          onValueChange={(id: string) => {
            const picked = places.find((each) => each.id === id);
            if (picked) changePlan(planId, (tray) => setPlace(tray, act.i, picked));
          }}
        >
          {places.map((each) => (
            <MenuRadioItem key={each.id} value={each.id} closeOnClick>
              {each.name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
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
