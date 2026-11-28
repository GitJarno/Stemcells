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
  planWords,
  QUEUE_PATH,
  type QueueReply,
  thinkWith,
} from "../../../../../../stemcells/orchestrator/wire.ts";
import { cellNameOf } from "../../../../../../stemcells/words/cellNames.ts";
import { throwTo } from "../../home/plannedArrivals";
import { plannedRowsFeed } from "../../home/planFeed";
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
  watchCells,
} from "../../upstream/plans";
import { DEFAULT_PROVIDER_INTERACTION_MODE } from "../../upstream/planLaunch";
import { askiChatsOf } from "../chat";
import { type Carrier, carry, type Hands, type Went } from "./carry";
import { wasDictated } from "./dictated";
import { fenceReader } from "./fence";
import { makeKept } from "./kept";
import { launchOf, queueOf, worksApart } from "./launch";
import type { PlanDoor } from "./send";
import { makeTrays } from "./trays";
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

/** A machine's world, built once for the rows fed in one turn of the event loop. */
const worlds = new Map<string, World>();
function worldNow(environmentId: string): World {
  if (worlds.size === 0) queueMicrotask(() => worlds.clear());
  const world = worlds.get(environmentId) ?? machineWorld(environmentId);
  worlds.set(environmentId, world);
  return world;
}

const JSON_BODY = { "content-type": "application/json" };

const post = (environmentId: string, path: string, body: unknown, signal?: AbortSignal) =>
  askMachine(environmentId, path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: JSON_BODY,
    ...(signal === undefined ? {} : { signal }),
  });

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
    // Deleting a project takes its chats along, and Aski's is where this plan is read.
    const { shells } = readMachine(environmentId);
    const aski = askiChatsOf(shells);
    if (shells.some((shell) => shell.projectId === projectId && aski.has(shell.id)))
      return { ok: false, reason: "Aski’s own chat is in that project. It stays." };
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

/** What a Cell in `projectId` starts with, by the person's defaults; null for a project that is gone. */
function setupOf(environmentId: string, projectId: string) {
  const defaults = newCellDefaults(environmentId, projectId);
  if (defaults.project === null) return null;
  return {
    projectId,
    projectName: defaults.project.title,
    projectCwd: defaults.project.workspaceRoot,
    defaultModel: defaults.model,
    runtimeMode: defaults.runtimeMode,
    interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
    models: machineWorld(environmentId).models,
    ready: (instanceId: string) => providerReady(environmentId, instanceId),
    apart: defaults.apart,
  };
}

const GONE: Went = { ok: false, reason: "That project isn’t here any more." };

const hands: Hands = {
  start: async (environmentId, act, projectId) => {
    // Started already, here or on another device: the plan's thread is that Cell.
    if (cellExists(environmentId, act.threadId)) return { ok: true };
    const setup = setupOf(environmentId, projectId);
    if (setup === null) return GONE;
    const launch = launchOf(act, {
      ...setup,
      commandId: uuidv4(),
      messageId: uuidv4(),
      createdAt: new Date().toISOString(),
    });
    return launch.ok ? startCell(environmentId, launch.input) : launch;
  },
  queue: async (environmentId, planId, act, projectId, now) => {
    if (cellExists(environmentId, act.threadId)) return { ok: true };
    const setup = setupOf(environmentId, projectId);
    if (setup === null) return GONE;
    const handed = queueOf(planId, act, setup);
    if (!handed.ok) return handed;
    const answer = await post(
      environmentId,
      QUEUE_PATH,
      now ? { ...handed.request, now: true } : handed.request,
    );
    if (answer === null) return { ok: false, reason: "That machine can’t be reached from here." };
    const reply = (await answer.json().catch(() => null)) as QueueReply | null;
    if (reply?.ok === true) return { ok: true };
    return { ok: false, reason: reply?.error ?? "The machine didn’t take the Cell." };
  },
  wantsWorktree: (environmentId, act, projectId) =>
    worksApart(act, newCellDefaults(environmentId, projectId).apart),
  exists: cellExists,
  watch: watchCells,
  create: createProject,
  destroy,
  callBack: async (environmentId, threadId) => {
    await stopCell(environmentId, threadId);
    await archiveCell(environmentId, threadId);
  },
  tell: async (environmentId, outcome) => {
    await post(environmentId, OUTCOME_PATH, outcome);
  },
  rows: plannedRowsFeed({
    factsOf: (environmentId, act, projectId) => {
      const world = worldNow(environmentId);
      const chosen = act.selection ?? act.model ?? newCellDefaults(environmentId, projectId).model;
      const slug = chosen === null ? undefined : "model" in chosen ? chosen.model : chosen.id;
      const entry = world.models.find(
        (model) => model.instanceId === chosen?.instanceId && model.id === slug,
      );
      return {
        modelName: entry?.name ?? slug ?? "",
        effort: act.model?.effort?.level ?? act.effort ?? undefined,
        driver: readMachine(environmentId).config?.providers.find(
          (provider) => provider.instanceId === chosen?.instanceId,
        )?.driver,
      };
    },
    throwTo,
    now: () => Date.now(),
    later: (ms, run) => setTimeout(run, ms),
  }),
  now: () => Date.now(),
  later: (ms, run) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
};

let carrier: Carrier | null = null;

/** The app's one carrier, running from the first plan on. */
export function planCarrier(): Carrier {
  carrier ??= carry(trays, hands);
  return carrier;
}

/** The plans made in each of Aski's chats, for the cards under their messages. */
export const kept = makeKept(
  trays,
  (environmentId, path) => askMachine(environmentId, path),
  () => {
    planCarrier();
  },
);

/** Reads a fence's plan into the store, once; what it found. */
export const openPlan = fenceReader(
  trays,
  (environmentId, path) => askMachine(environmentId, path),
  () => {
    planCarrier();
  },
);

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
      else {
        trays.arrived(id, plan);
        // Its card stands under this message once it leaves the composer.
        if (plan.from === "read" && plan.acts.length > 0)
          kept.made(environmentId, threadId, {
            id,
            at: Date.now(),
            messageId: null,
            words: planWords(draft.text),
            plan,
            outcome: null,
          });
      }
    },
    // A compile the server can't read tells whatever waits for the plan that none is coming.
    forget: (id) => void post(environmentId, COMPILE_PATH, { id }).catch(() => undefined),
  };
}
