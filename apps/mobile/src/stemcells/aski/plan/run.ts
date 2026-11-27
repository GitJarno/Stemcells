// The phone's plans, wired to the app (stemcells/tasks/aski-orchestrator.md, decisions 1, 5 and
// 7): one store and one carrier for the whole app, the requests a plan makes of its machine's
// server, and the hands that carry it out, each the person's own command.

import type { DestroyAct, Plan } from "../../../../../../stemcells/orchestrator/plan.ts";
import { DEFAULT_CAP } from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  COMPILE_PATH,
  type CompileRequest,
  EXPECT_PATH,
  type ExpectRequest,
  OUTCOME_PATH,
  PLAN_PATH,
  thinkWith,
} from "../../../../../../stemcells/orchestrator/wire.ts";
import { cellNameOf } from "../../../../../../stemcells/words/cellNames.ts";
import { feedPlannedRows, plannedRowsOf } from "../../home/plannedRows";
import { isAway } from "../../home/tabs";
import { cellSelection } from "../../upstream/cellInstance";
import { askMachine } from "../../upstream/machines";
import {
  archiveCell,
  catalogProvider,
  cellCanArchive,
  cellExists,
  createProject,
  deleteProject,
  EFFORT_OPTIONS,
  newCellDefaults,
  providerReady,
  readChatDraft,
  readMachine,
  startCell,
  stopCell,
  uuidv4,
} from "../../upstream/plans";
import { DEFAULT_PROVIDER_INTERACTION_MODE } from "../../upstream/planLaunch";
import { askiChatsOf } from "../chat";
import { type Carrier, carry, type Hands, type Went } from "./carry";
import { wasDictated } from "./dictated";
import { launchOf } from "./launch";
import type { PlanDoor } from "./send";
import { makeTrays, type ToldOutcome } from "./trays";
import { placeOfKey, type World, worldOf } from "./world";

export const trays = makeTrays();

/** The world of a machine as it stands now. */
export function machineWorld(environmentId: string): World {
  const { projects, shells, config } = readMachine(environmentId);
  const now = new Date().toISOString();
  return worldOf({
    environmentId,
    projects,
    shells,
    providers: (config?.providers ?? []).map(catalogProvider),
    effortOptions: EFFORT_OPTIONS,
    aski: askiChatsOf(shells),
    away: (shell) => {
      const whole = shells.find((one) => one.id === shell.id);
      return whole !== undefined && isAway(whole, now);
    },
  });
}

const JSON_BODY = { "content-type": "application/json" };

const post = (environmentId: string, path: string, body: unknown, signal?: AbortSignal) =>
  askMachine(environmentId, path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: JSON_BODY,
    ...(signal === undefined ? {} : { signal }),
  });

/** A plan and what came of it, as its machine's server has it; `gone` once it has forgotten it. */
export async function readPlan(
  environmentId: string,
  id: string,
): Promise<
  | { readonly kind: "plan"; readonly plan: Plan; readonly outcome: ToldOutcome[] | null }
  | { readonly kind: "gone" }
  | { readonly kind: "unreachable" }
> {
  try {
    const answer = await askMachine(environmentId, `${PLAN_PATH}?id=${encodeURIComponent(id)}`);
    if (answer === null) return { kind: "unreachable" };
    if (answer.status === 404) return { kind: "gone" };
    if (!answer.ok) return { kind: "unreachable" };
    const body = (await answer.json()) as { plan: Plan; outcome: ToldOutcome[] | null };
    return { kind: "plan", plan: body.plan, outcome: body.outcome };
  } catch {
    return { kind: "unreachable" };
  }
}

/** The Cells a deletion archives: those it names, or every Cell of its project. */
function cellsOf(environmentId: string, act: DestroyAct): string[] {
  if (act.cells.length > 0) return act.cells.map((cell) => cell.threadId);
  const place = act.place;
  const projectId =
    place === null ? null : (place.projectId ?? (place.id && placeOfKey(place.id)?.projectId));
  if (projectId == null) return [];
  const { shells } = readMachine(environmentId);
  const aski = askiChatsOf(shells);
  return shells
    .filter(
      (shell) =>
        shell.projectId === projectId &&
        shell.archivedAt === null &&
        shell.deletedAt === null &&
        shell.lineage.parentThreadId === null &&
        !aski.has(shell.id),
    )
    .map((shell) => shell.id);
}

async function destroy(environmentId: string, act: DestroyAct): Promise<Went> {
  if (act.target === "project") {
    const place = act.place;
    const projectId =
      place === null ? null : (place.projectId ?? (place.id && placeOfKey(place.id)?.projectId));
    if (projectId == null || projectId === "")
      return { ok: false, reason: "No project to delete." };
    return deleteProject(environmentId, projectId);
  }
  const ids = cellsOf(environmentId, act).filter((id) => cellExists(environmentId, id));
  // A Cell at work can't be archived, and stopping it is more than was confirmed.
  const flying = ids.filter((id) => !cellCanArchive(environmentId, id));
  if (flying.length > 0) {
    const names = flying.map(cellNameOf).join(", ");
    return {
      ok: false,
      reason: `${names} ${flying.length === 1 ? "is" : "are"} flying. Stop ${flying.length === 1 ? "it" : "them"} first.`,
    };
  }
  for (const id of ids) {
    const went = await archiveCell(environmentId, id);
    if (!went.ok) return went;
  }
  return { ok: true };
}

const hands: Hands = {
  start: async (environmentId, act, projectId) => {
    // Started already, here or on another device: the plan's thread is that Cell.
    if (cellExists(environmentId, act.threadId)) return { ok: true };
    const defaults = newCellDefaults(environmentId, projectId);
    if (defaults.project === null)
      return { ok: false, reason: "That project isn’t here any more." };
    const launch = launchOf(act, {
      projectId,
      projectName: defaults.project.title,
      projectCwd: defaults.project.workspaceRoot,
      defaultModel: defaults.model,
      runtimeMode: defaults.runtimeMode,
      interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
      models: machineWorld(environmentId).models,
      ready: (instanceId) => providerReady(environmentId, instanceId),
      commandId: uuidv4(),
      messageId: uuidv4(),
      createdAt: new Date().toISOString(),
    });
    return launch.ok ? startCell(environmentId, launch.input) : launch;
  },
  create: createProject,
  destroy,
  callBack: async (environmentId, threadId) => {
    await stopCell(environmentId, threadId);
    await archiveCell(environmentId, threadId);
  },
  tell: async (environmentId, outcome) => {
    await post(environmentId, OUTCOME_PATH, outcome);
  },
  rows: (entries) => feedPlannedRows(plannedRowsOf(entries)),
  now: () => Date.now(),
  later: (ms, run) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
};

/** Fences being read, by machine and plan: one request however many views show the fence. */
const opening = new Map<string, Promise<"plan" | "gone" | "unreachable">>();

/** Reads a fence's plan into the store, once; what it found. */
export function openPlan(environmentId: string, id: string) {
  const key = `${environmentId}\u0000${id}`;
  const held = trays.read().get(id);
  if (held !== undefined) return Promise.resolve(held.state === "gone" ? "gone" : "plan");
  const running = opening.get(key);
  if (running !== undefined) return running;
  const reading = readPlan(environmentId, id).then((read) => {
    opening.delete(key);
    if (read.kind === "plan") {
      planCarrier();
      trays.opened(id, environmentId, read.plan, read.outcome);
    } else if (read.kind === "gone") trays.gone(id, environmentId);
    return read.kind;
  });
  opening.set(key, reading);
  return reading;
}

let carrier: Carrier | null = null;

/** The app's one carrier, running from the first plan on. */
export function planCarrier(): Carrier {
  carrier ??= carry(trays, hands);
  return carrier;
}

/**
 * The compiler's side of a send from Aski's chat: everything `sendThroughPlan` needs but the
 * send itself, read as the message goes.
 */
export function planDoor(chat: {
  readonly environmentId: string;
  readonly threadId: string;
  readonly draftKey?: string | undefined;
}): Omit<PlanDoor<never>, "send"> & { readonly key: string } {
  const { environmentId, threadId } = chat;
  const draft = readChatDraft(environmentId, threadId, chat.draftKey);
  const world = machineWorld(environmentId);
  const { shells, config } = readMachine(environmentId);
  const own = shells.find((shell) => shell.id === threadId);
  // Aski thinks on its driver's own instance: its own is its chat's alone.
  const instance = own === undefined ? null : cellSelection(config, own.modelSelection).instanceId;
  const think = instance === null ? null : thinkWith(world.models, instance);
  const dictated = wasDictated(draft.key);
  return {
    key: draft.key,
    text: draft.text,
    plain: draft.plain,
    names: world.names,
    able: think !== null,
    mint: uuidv4,
    expect: async (id, signal) => {
      const body: ExpectRequest = { id, threadId, text: draft.text };
      return (await post(environmentId, EXPECT_PATH, body, signal))?.ok === true;
    },
    compile: async (id, signal) => {
      if (think === null) return null;
      const body: CompileRequest = {
        id,
        threadId,
        text: draft.text,
        context: {
          places: world.places,
          models: world.models,
          cells: world.cells,
          cap: DEFAULT_CAP,
          dictated,
        },
        think,
      };
      const answer = await post(environmentId, COMPILE_PATH, body, signal);
      if (answer === null || !answer.ok) return null;
      return ((await answer.json()) as { plan: Plan }).plan;
    },
    reading: (id) => {
      planCarrier();
      trays.reading(id, environmentId, threadId);
    },
    settled: (id, plan) => {
      if (plan === null) trays.leave(id);
      else trays.arrived(id, plan);
    },
    // A compile the server can't read tells whatever waits for the plan that none is coming.
    forget: (id) => void post(environmentId, COMPILE_PATH, { id }).catch(() => undefined),
  };
}
