/**
 * Carries the window's plans out (aski-orchestrator.md, decisions 5, 16 and 17): each Cell on its
 * way is started once with the person's own commands, or handed to the server when it comes after
 * others or gets a worktree, and the server and the Awake list hear of it. A deletion is carried
 * out only from `destroy`, which only a held hand calls (`PlanCard.tsx`).
 */
import {
  clearPlannedRows,
  type PlannedRow,
  setPlannedRows,
} from "../../../../../../stemcells/aski/planned.ts";
import { said } from "../../../../../../stemcells/orchestrator/names.ts";
import type { StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  begun,
  CALL_BACK_MS,
  calledBack,
  comesAfter,
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
  startNow,
  type Tray,
  unqueued,
  unsureField,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import { placeLabel } from "../../../../../../stemcells/words/plans.ts";
import { changePlan, leavePlan, type LivePlan, planOf, readPlans } from "./store";

/** A Cell, as the workspace names one. */
interface Ref {
  readonly environmentId: string;
  readonly threadId: string;
  readonly draftId: string | null;
}

type Carried = { readonly ok: true } | { readonly ok: false; readonly error: string };

/** What the runner needs from the app: the hands, and what it tells besides. */
export interface RunnerHands {
  readonly start: (act: StartAct, projectKey: string) => Promise<Carried>;
  /** Hands the server a Cell to start itself: at once, or once the Cells it comes after land. */
  readonly queue: (planId: string, act: StartAct, projectKey: string) => Promise<Carried>;
  /** Whether a Cell starting in `projectKey` gets a worktree of its own, which the server gives. */
  readonly wantsWorktree: (act: StartAct, projectKey: string) => boolean;
  /** Whether the app lists a Cell's thread: one the server was handed has started. */
  readonly exists: (threadId: string) => boolean;
  readonly newProject: (
    name: string,
  ) => Promise<
    | { readonly ok: true; readonly projectKey: string }
    | { readonly ok: false; readonly error: string }
  >;
  readonly removeProject: (
    placeId: string,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  readonly archive: (
    cells: ReadonlyArray<Ref>,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
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
const LINGER_MS = CALL_BACK_MS + 1_500;
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
  /** Deletions being carried out, as `plan/i`: a second hold while one runs does nothing. */
  const destroying = new Set<string>();
  /** Queued acts handed to the server, as `plan/i`: each is handed over once. */
  const handed = new Set<string>();
  /** Acts on their way that the server starts, as `plan/i`: it hears `queued` of them until it has. */
  const serverStarts = new Set<string>();
  /** Rows of a plan under its message that Awake's own rows took over, as `plan/thread`. */
  const retired = new Set<string>();
  const retiring = new Map<string, ReturnType<typeof setTimeout>>();

  /** The project an act starts in; one the plan names as new is made first, once. */
  const projectOf = async (
    use: RunnerHands,
    planId: string,
    act: StartAct,
  ): Promise<{ ok: true; projectKey: string } | { ok: false; error: string }> => {
    if (act.place?.how === "new") {
      // Several Cells of one plan may start in the project it makes: it is made once.
      const key = `${planId}/${said(act.place.name)}`;
      const made = making.get(key) ?? use.newProject(act.place.name);
      making.set(key, made);
      return made;
    }
    const projectKey = use.projectKeyOf(act.place);
    return projectKey === null
      ? { ok: false, error: "That project isn't here any more." }
      : { ok: true, projectKey };
  };

  /**
   * A worktree is the server's to give, so it starts that Cell. One that came after others it
   * would hold until they land: the person's "Start now" starts that one here, in the folder.
   */
  const serverStartsIn = (use: RunnerHands, act: StartAct, projectKey: string) =>
    !comesAfter(act) && use.wantsWorktree(act, projectKey);

  const startOne = async (use: RunnerHands, planId: string, act: StartAct) => {
    use.arrive([act.threadId]);
    const project = await projectOf(use, planId, act);
    if (!project.ok) return changePlan(planId, (tray) => failed(tray, act.i, project.error));
    const key = `${planId}/${act.i}`;
    startedIn.set(key, project.projectKey);
    const apart = serverStartsIn(use, act, project.projectKey);
    if (apart) serverStarts.add(key);
    const result = await (apart
      ? use.queue(planId, act, project.projectKey)
      : use.start(act, project.projectKey));
    changePlan(planId, (tray) =>
      result.ok ? started(tray, act.i, Date.now()) : failed(tray, act.i, result.error),
    );
  };

  const queueOne = async (use: RunnerHands, planId: string, act: StartAct) => {
    const project = await projectOf(use, planId, act);
    const result = project.ok ? await use.queue(planId, act, project.projectKey) : project;
    if (!result.ok) changePlan(planId, (tray) => unqueued(tray, act.i, result.error));
  };

  const rowsOf = (live: LivePlan, tray: Tray, use: RunnerHands): PlannedRow[] =>
    tray.acts.flatMap((one): PlannedRow[] => {
      const { act, status } = one;
      if (act.kind !== "start") return [];
      if (status !== "starting" && status !== "started" && status !== "waiting") return [];
      // What waits in Aski's reply or under a message waits on its card: Awake holds no outline for it.
      if (status === "waiting" && live.source !== "message") return [];
      // Under its message a plan forms rows only for what this window starts, until Awake's own take over.
      if (
        live.source === "kept" &&
        (!launched.has(`${live.id}/${act.i}`) || retired.has(`${live.id}/${act.threadId}`))
      )
        return [];
      const facts = use.factsOf(act);
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
          unsure: status === "waiting" ? unsureField(act) : undefined,
          born: live.at,
          driver: facts.driver,
        },
      ];
    });

  /** Call on every change of the store: starts what is on its way, and tells what there is to tell. */
  const sync = () => {
    const use = hands();
    if (use === null) return;
    // A queued Cell the app now lists was started by the server. Each change comes back here.
    const listed = readPlans().flatMap((plan) =>
      (plan.tray?.acts ?? []).flatMap((one) =>
        one.status === "queued" && one.act.kind === "start" && use.exists(one.act.threadId)
          ? [{ id: plan.id, i: one.act.i }]
          : [],
      ),
    );
    if (listed.length > 0) {
      for (const one of listed) changePlan(one.id, (tray) => begun(tray, one.i));
      return;
    }
    const live = readPlans();
    for (const plan of live) {
      const tray = plan.tray;
      if (tray === null) continue;
      for (const one of tray.acts) {
        const { act } = one;
        if (act.kind !== "start") continue;
        const key = `${plan.id}/${act.i}`;
        if (one.status === "starting" && !launched.has(key)) {
          launched.add(key);
          const projectKey = use.projectKeyOf(act.place);
          if (projectKey !== null && serverStartsIn(use, act, projectKey)) serverStarts.add(key);
          void startOne(use, plan.id, act);
        }
        // What the server held when this window read the plan is its own already.
        if (one.status === "queued" && !handed.has(key) && !plan.handed.includes(act.i)) {
          handed.add(key);
          void queueOne(use, plan.id, act);
        }
      }
      const outcome = {
        id: plan.id,
        // Told as started, a Cell the server is still to start would be nobody's to start.
        acts: outcomeOf(tray).map((act, at) =>
          tray.acts[at]?.status === "starting" && serverStarts.has(`${plan.id}/${act.i}`)
            ? { ...act, status: "queued" as const }
            : act,
        ),
        learned: learnedOf(tray),
      };
      const telling = JSON.stringify(outcome);
      if (tray.plan.from !== "floor" && told.get(plan.id) !== telling) {
        // A plan read from the server is told back only once something of it changes here.
        if (plan.source !== "kept" || told.has(plan.id)) use.tell(outcome);
        told.set(plan.id, telling);
      }
      const planned = rowsOf(plan, tray, use);
      const drawn = JSON.stringify(planned);
      if (rows.get(plan.id) !== drawn) {
        if (rows.has(plan.id) || planned.length > 0) setPlannedRows(plan.id, planned);
        rows.set(plan.id, drawn);
      }
      // Under its message a plan stays for good: its rows in Awake give way as a plan's that left do.
      if (plan.source === "kept" && planned.length > 0 && !retiring.has(plan.id))
        retiring.set(
          plan.id,
          setTimeout(() => {
            retiring.delete(plan.id);
            for (const row of planned) retired.add(`${plan.id}/${row.threadId}`);
            sync();
          }, ROWS_KEPT_MS),
        );
      // A plan with nothing left to ask, and nothing that failed, leaves the composer once its Cells can't be called back.
      const clean =
        settled(tray) &&
        tray.acts.every((one) => one.status !== "failed") &&
        plan.source === "message";
      if (clean && !leaving.has(plan.id))
        leaving.set(
          plan.id,
          setTimeout(() => leavePlan(plan.id), tray.plan.from === "floor" ? 6_000 : LINGER_MS),
        );
    }
    const here = new Set(live.map((plan) => plan.id));
    for (const id of rows.keys()) {
      if (here.has(id)) continue;
      rows.delete(id);
      told.delete(id);
      clearTimeout(leaving.get(id));
      leaving.delete(id);
      clearTimeout(retiring.get(id));
      retiring.delete(id);
      setTimeout(() => clearPlannedRows(id), ROWS_KEPT_MS);
    }
  };

  return {
    sync,
    /** The person's yes to one waiting Cell. */
    confirm: (planId: string, i: number) => changePlan(planId, (tray) => confirm(tray, i)),
    confirmAll: (planId: string) => changePlan(planId, confirmAll),
    /** A waiting Cell, or a queued one, goes. */
    drop: (planId: string, i: number) => changePlan(planId, (tray) => drop(tray, i)),
    /** The person won't wait for the Cells a queued one comes after. */
    startNow: (planId: string, i: number) => changePlan(planId, (tray) => startNow(tray, i)),
    dropAll: (planId: string) => changePlan(planId, dropAll),
    /**
     * The plan of `chat` with a Cell waiting that Enter could start. Only a message's own plan:
     * a proposed one holds words Aski wrote, and starts by a tap on its card.
     */
    waitingIn: (chat: string): string | null =>
      readPlans().find(
        (plan) =>
          plan.chat === chat &&
          plan.source === "message" &&
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
      if (cell === null)
        return use.report("The Cell wasn't called back", "It isn't listed here yet. Try again.");
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
      const key = `${planId}/${i}`;
      if (destroying.has(key)) return;
      destroying.add(key);
      const { act } = one;
      const placeId = act.place?.id ?? null;
      const carried = async () =>
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
      // The hold is free again however the deletion ended.
      const result = await carried()
        .catch(() => ({ ok: false as const, error: "It couldn't be carried out." }))
        .finally(() => destroying.delete(key));
      if (!result.ok) return use.report("Nothing was deleted", result.error);
      changePlan(planId, (tray) => done(tray, i));
    },
  };
}

export type Runner = ReturnType<typeof createRunner>;
