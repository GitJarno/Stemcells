/**
 * Carries the window's plans out (aski-orchestrator.md, decision 5): each Cell on its way is
 * started once with the person's own commands, and the server and the Awake list hear of it.
 * A deletion is carried out only from `destroy`, which only a held hand calls (`PlanCard.tsx`).
 */
import {
  clearPlannedRows,
  type PlannedRow,
  setPlannedRows,
} from "../../../../../../stemcells/aski/planned.ts";
import { said } from "../../../../../../stemcells/orchestrator/names.ts";
import type { StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  CALL_BACK_MS,
  calledBack,
  confirm,
  confirmAll,
  done,
  drop,
  dropAll,
  failed,
  held,
  learnedOf,
  outcomeOf,
  settled,
  started,
  type Tray,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import { placeLabel } from "../../../../../../stemcells/words/plans.ts";
import { changePlan, closePlan, type LivePlan, planOf, readPlans } from "./store";

/** A Cell, as the workspace names one. */
interface Ref {
  readonly environmentId: string;
  readonly threadId: string;
  readonly draftId: string | null;
}

/** What the runner needs from the app: the hands, and what it tells besides. */
export interface RunnerHands {
  readonly start: (
    act: StartAct,
    projectKey: string,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  readonly newProject: (
    name: string,
  ) => Promise<
    { readonly ok: true; readonly projectKey: string } | { readonly ok: false; readonly error: string }
  >;
  readonly removeProject: (
    placeId: string,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  readonly archive: (cells: ReadonlyArray<Ref>) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  readonly projectKeyOf: (place: StartAct["place"]) => string | null;
  readonly cellsIn: (placeId: string) => Ref[];
  readonly cellOf: (threadId: string) => Ref | null;
  readonly factsOf: (act: StartAct) => {
    readonly projectId: string;
    readonly modelName: string;
    readonly effort: string | undefined;
    readonly driver: string | undefined;
  };
  /** What came of a plan, for the server. */
  readonly tell: (request: {
    id: string;
    acts: ReturnType<typeof outcomeOf>;
    learned?: ReturnType<typeof learnedOf>;
  }) => void;
  /** These Cells form in Awake and open no tab; Aski throws a copy of itself to each. */
  readonly arrive: (threadIds: readonly string[]) => void;
  /** Says a deletion or a call-back failed. */
  readonly report: (title: string, why: string) => void;
}

/** How long a plan whose Cells all started stands before it leaves: its call-back time and a breath. */
export const LINGER_MS = CALL_BACK_MS + 1_500;
/** How long a plan's rows stay planned in Awake: the list's own rows have taken over long before. */
const ROWS_KEPT_MS = 90_000;

export function createRunner(hands: () => RunnerHands | null) {
  /** Acts handed to a command, as `plan/i`: each starts once, whatever the store does after. */
  const launched = new Set<string>();
  const making = new Map<string, ReturnType<RunnerHands["newProject"]>>();
  const told = new Map<string, string>();
  const rows = new Map<string, string>();
  const leaving = new Map<string, ReturnType<typeof setTimeout>>();
  /** The project each act started in, as `plan/i`: one a plan made has no key until then. */
  const startedIn = new Map<string, string>();

  const startOne = async (planId: string, act: StartAct) => {
    const use = hands();
    if (use === null) return;
    use.arrive([act.threadId]);
    let projectKey = use.projectKeyOf(act.place);
    if (act.place?.how === "new") {
      // Several Cells of one plan may start in the project it makes: it is made once.
      const key = `${planId}/${said(act.place.name)}`;
      const made = making.get(key) ?? use.newProject(act.place.name);
      making.set(key, made);
      const project = await made;
      if (!project.ok)
        return changePlan(planId, (tray) => failed(tray, act.i, project.error));
      projectKey = project.projectKey;
    }
    if (projectKey === null)
      return changePlan(planId, (tray) => failed(tray, act.i, "That project isn't here any more."));
    startedIn.set(`${planId}/${act.i}`, projectKey);
    const result = await use.start(act, projectKey);
    changePlan(planId, (tray) =>
      result.ok ? started(tray, act.i, Date.now()) : failed(tray, act.i, result.error),
    );
  };

  const rowsOf = (live: LivePlan, tray: Tray, use: RunnerHands): PlannedRow[] =>
    tray.acts.flatMap((one): PlannedRow[] => {
      const { act, status } = one;
      if (act.kind !== "start") return [];
      if (status !== "starting" && status !== "started" && status !== "waiting") return [];
      const facts = use.factsOf(act);
      const why = act.why;
      const key = startedIn.get(`${live.id}/${act.i}`);
      const projectId = facts.projectId || (key?.slice(key.indexOf(":") + 1) ?? "");
      // A Cell with no project yet has no place in a list of projects' Cells: it waits in the plan.
      if (projectId === "") return [];
      return [
        {
          threadId: act.threadId,
          projectId,
          projectName: act.place === null ? "" : placeLabel(act),
          title: act.title,
          modelName: facts.modelName,
          effort: facts.effort,
          tier: status === "waiting" ? "check" : "start",
          unsure:
            status !== "waiting"
              ? undefined
              : why.some((one) => one.startsWith("place-") || one === "new-project")
                ? "place"
                : act.model?.how === "near"
                  ? "model"
                  : "words",
          born: live.at,
          driver: facts.driver,
        },
      ];
    });

  /** Call on every change of the store: starts what is on its way, and tells what there is to tell. */
  const sync = () => {
    const use = hands();
    if (use === null) return;
    const live = readPlans();
    for (const plan of live) {
      const tray = plan.tray;
      if (tray === null) continue;
      for (const one of tray.acts) {
        if (one.act.kind !== "start" || one.status !== "starting") continue;
        const key = `${plan.id}/${one.act.i}`;
        if (launched.has(key)) continue;
        launched.add(key);
        void startOne(plan.id, one.act);
      }
      const outcome = { id: plan.id, acts: outcomeOf(tray), learned: learnedOf(tray) };
      const telling = JSON.stringify(outcome);
      if (tray.plan.from !== "floor" && told.get(plan.id) !== telling) {
        told.set(plan.id, telling);
        use.tell(outcome);
      }
      const planned = rowsOf(plan, tray, use);
      const drawn = JSON.stringify(planned);
      if (rows.get(plan.id) !== drawn) {
        rows.set(plan.id, drawn);
        setPlannedRows(plan.id, planned);
      }
      // A plan with nothing left to ask, and nothing that failed, leaves once its Cells can't be called back.
      const clean =
        settled(tray) && tray.acts.every((one) => one.status !== "failed") && plan.source === "message";
      if (clean && !leaving.has(plan.id))
        leaving.set(
          plan.id,
          setTimeout(() => closePlan(plan.id), tray.plan.from === "floor" ? 6_000 : LINGER_MS),
        );
    }
    const here = new Set(live.map((plan) => plan.id));
    for (const id of rows.keys()) {
      if (here.has(id)) continue;
      rows.delete(id);
      told.delete(id);
      clearTimeout(leaving.get(id));
      leaving.delete(id);
      setTimeout(() => clearPlannedRows(id), ROWS_KEPT_MS);
    }
  };

  return {
    sync,
    /** The person's yes to one waiting Cell. */
    confirm: (planId: string, i: number) => changePlan(planId, (tray) => confirm(tray, i)),
    confirmAll: (planId: string) => changePlan(planId, confirmAll),
    drop: (planId: string, i: number) => changePlan(planId, (tray) => drop(tray, i)),
    dropAll: (planId: string) => changePlan(planId, dropAll),
    /** Whether any plan of `chat` has a Cell waiting that Enter could start. */
    waitingIn: (chat: string): string | null =>
      readPlans().find(
        (plan) =>
          plan.chat === chat &&
          plan.tray !== null &&
          !held(plan.tray) &&
          plan.tray.acts.some(
            (one) => one.status === "waiting" && one.act.kind === "start" && one.act.place !== null,
          ),
      )?.id ?? null,
    /** A Cell just started is stopped and archived. */
    callBack: async (planId: string, i: number) => {
      const use = hands();
      const one = planOf(planId)?.tray?.acts.find((each) => each.act.i === i);
      if (use === null || one === undefined || one.act.kind !== "start") return;
      const cell = use.cellOf(one.act.threadId);
      if (cell === null) return;
      const result = await use.archive([cell]);
      if (!result.ok) return use.report("The Cell wasn't called back", result.error);
      changePlan(planId, (tray) => calledBack(tray, i));
    },
    /** The deletion the person's hand confirmed, on its own card. */
    destroy: async (planId: string, i: number) => {
      const use = hands();
      const one = planOf(planId)?.tray?.acts.find((each) => each.act.i === i);
      if (use === null || one === undefined || one.act.kind !== "destroy") return;
      if (one.status !== "waiting") return;
      const { act } = one;
      const placeId = act.place?.id ?? null;
      const result =
        act.target === "project"
          ? placeId === null
            ? { ok: false as const, error: "Aski couldn't tell which project." }
            : await use.removeProject(placeId)
          : await use.archive(
              act.cells.length > 0
                ? act.cells.flatMap((cell) => use.cellOf(cell.threadId) ?? [])
                : placeId === null
                  ? []
                  : use.cellsIn(placeId),
            );
      if (!result.ok) return use.report("Nothing was deleted", result.error);
      changePlan(planId, (tray) => done(tray, i));
    },
  };
}

export type Runner = ReturnType<typeof createRunner>;
