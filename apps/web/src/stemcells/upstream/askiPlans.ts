/**
 * What Aski's plans take from upstream (`aski/plan`): the person's projects, models and awake
 * Cells, the plan routes on this Mac's server, and the hands that carry a plan out with the
 * person's own commands, as the app's own views send them. `askiPlans.contract.test.ts` pins it.
 */
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";

import { clampEffort } from "../../../../../stemcells/orchestrator/names.ts";
import type {
  CompileContext,
  ModelEntry,
  Plan,
  Selection,
  StartAct,
} from "../../../../../stemcells/orchestrator/plan.ts";
import { messageOf } from "../../../../../stemcells/orchestrator/plan.ts";
import {
  COMPILE_PATH,
  type CompileReply,
  type CompileRequest,
  EXPECT_PATH,
  type ExpectRequest,
  type KeptPlan,
  LEARNED_PATH,
  OUTCOME_PATH,
  type OutcomeRequest,
  PLAN_PATH,
  PLANS_PATH,
  type PlansReply,
  QUEUE_PATH,
  type QueueReply,
  type QueueRequest,
  thinkWith,
} from "../../../../../stemcells/orchestrator/wire.ts";
import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import {
  readProject,
  readThreadShell,
  readThreadShells,
  useThreadShells,
  waitForProject,
} from "../../state/entities";
import { readEnvironmentProviders } from "../../state/environments";
import { projectEnvironment } from "../../state/projects";
import { environmentServerConfigsAtom } from "../../state/server";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { ASKI_DRIVERS, isAskisInstance } from "../aski/setup";
import { conciseModelName } from "../models/names";
import type { CellRef } from "../tabs/layout";
import { projectRefOf, projectRefOfKey, startingModel } from "./draftWords";
import { type CellStart, type DraftSetup, useStartCells } from "./launch";
import type { PlanModel } from "./planPick";
import { fromPrimary } from "./planner";
import { useRailProjects } from "./rail";
import { useWordsCatalog, useWordsPlaces, wordsCatalogOf } from "./words";

export { promptOf } from "./words";

/** The server may take this long over a plan: two calls and their starts. Past it, it is gone. */
const COMPILE_WAIT_MS = 45_000;
/** A message never waits longer than this for the server to hear a plan is coming. */
const EXPECT_WAIT_MS = 1_500;

const post = (path: string, body: unknown, signal?: AbortSignal) =>
  fromPrimary(resolvePrimaryEnvironmentHttpUrl(path), {
    method: "POST",
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

/** Tells the server a plan is coming for a message about to go; false when it didn't hear in time. */
export async function expectPlan(request: ExpectRequest): Promise<boolean> {
  try {
    return (await post(EXPECT_PATH, request, AbortSignal.timeout(EXPECT_WAIT_MS))).ok;
  } catch {
    return false;
  }
}

/** The message as a plan; null when the server couldn't say. Never throws. */
export async function compilePlan(request: CompileRequest): Promise<Plan | null> {
  try {
    const response = await post(COMPILE_PATH, request, AbortSignal.timeout(COMPILE_WAIT_MS));
    if (!response.ok) return null;
    return ((await response.json()) as CompileReply).plan;
  } catch {
    return null;
  }
}

/** What the server tells of a plan: the plan, and what came of each act so far. */
export interface KnownPlan {
  readonly plan: Plan;
  readonly outcome: OutcomeRequest["acts"] | null;
}

/** A plan by its id (one Aski's chat proposed is read this way); null when the server has none. */
export async function readPlan(id: string): Promise<KnownPlan | null> {
  try {
    const url = new URL(resolvePrimaryEnvironmentHttpUrl(PLAN_PATH));
    url.searchParams.set("id", id);
    const response = await fromPrimary(url.toString());
    return response.ok ? ((await response.json()) as KnownPlan) : null;
  } catch {
    return null;
  }
}

/** The plans made in Aski's chat `threadId`, newest first; null when the server couldn't say. */
export async function readKeptPlans(threadId: string): Promise<ReadonlyArray<KeptPlan> | null> {
  try {
    const url = new URL(resolvePrimaryEnvironmentHttpUrl(PLANS_PATH));
    url.searchParams.set("thread", threadId);
    const response = await fromPrimary(url.toString());
    if (!response.ok) return null;
    const plans = ((await response.json()) as Partial<PlansReply>).plans;
    return Array.isArray(plans) ? plans : null;
  } catch {
    return null;
  }
}

/** Hands the server a Cell to start itself; a refusal comes back in its own words. Never throws. */
async function queueCell(request: QueueRequest): Promise<QueueReply> {
  try {
    const response = await post(QUEUE_PATH, request);
    const reply = (await response.json().catch(() => null)) as {
      readonly ok?: unknown;
      readonly error?: unknown;
    } | null;
    if (reply?.ok === true) return { ok: true };
    return {
      ok: false,
      error: typeof reply?.error === "string" ? reply.error : "Aski's server didn't take the Cell.",
    };
  } catch {
    return { ok: false, error: "Aski's server couldn't be reached." };
  }
}

/** Tells the server what came of a plan's acts; never throws. */
export async function tellOutcome(request: OutcomeRequest): Promise<void> {
  try {
    await post(OUTCOME_PATH, request);
  } catch {
    // Aski's line then says less; the Cells are what they are.
  }
}

/** The names Aski learned from the person's confirms. */
export interface LearnedNames {
  readonly places: ReadonlyArray<{ readonly heard: string; readonly name: string }>;
  readonly models: ReadonlyArray<{ readonly heard: string; readonly name: string }>;
}

export async function readLearned(): Promise<LearnedNames> {
  try {
    const response = await fromPrimary(resolvePrimaryEnvironmentHttpUrl(LEARNED_PATH));
    if (!response.ok) return { places: [], models: [] };
    const body = (await response.json()) as Partial<LearnedNames>;
    return { places: body.places ?? [], models: body.models ?? [] };
  } catch {
    return { places: [], models: [] };
  }
}

export async function forgetLearned(): Promise<boolean> {
  try {
    return (await fromPrimary(resolvePrimaryEnvironmentHttpUrl(LEARNED_PATH), { method: "DELETE" }))
      .ok;
  } catch {
    return false;
  }
}

/** The person's world as a plan is made from it, read when a message is about to go. */
export interface PlanWorld {
  readonly context: Pick<CompileContext, "places" | "models" | "cells">;
  /** The models the compiler thinks with; null when none can. */
  readonly think: { readonly fast: Selection; readonly strong?: Selection } | null;
  /** Every project's name, for telling a message that starts Cells from talk. */
  readonly names: ReadonlySet<string>;
}

/** A catalog's providers as the models a plan names. */
const entriesOf = (providers: ReturnType<typeof wordsCatalogOf>["catalog"]["providers"]) =>
  providers.flatMap((provider): ModelEntry[] =>
    provider.models.map((model) => ({
      instanceId: provider.id,
      id: model.id,
      name: model.name,
      provider: provider.words?.[0] ?? provider.name,
      ...(model.aliases ? { aliases: model.aliases } : {}),
      efforts: model.efforts,
      ...(model.effortOption ? { effortOption: model.effortOption } : {}),
    })),
  );

/** The models of the catalog's ready providers, as a plan names them. */
function modelsOf(environmentId: string): ModelEntry[] {
  const { catalog, ready } = wordsCatalogOf(
    readEnvironmentProviders(environmentId as EnvironmentId) ?? [],
  );
  return entriesOf(catalog.providers.filter((provider) => ready.has(provider.id)));
}

/**
 * The models the compiler thinks with: those of the driver Aski's own chat runs on, on that
 * driver's own instance, which Aski needs installed and on to talk at all (`aski/setup.ts`).
 */
function thinkOf(environmentId: string): PlanWorld["think"] {
  const snapshots = readEnvironmentProviders(environmentId as EnvironmentId) ?? [];
  const usable = (driver: string) =>
    snapshots.find((each) => each.instanceId === driver && each.installed && each.enabled);
  const askis = snapshots.find((each) => isAskisInstance(each.instanceId))?.driver;
  const own =
    (askis === undefined ? undefined : usable(askis)) ??
    ASKI_DRIVERS.map(usable).find((each) => each !== undefined);
  if (own === undefined) return null;
  return thinkWith(entriesOf(wordsCatalogOf([own]).catalog.providers), own.instanceId);
}

/**
 * The projects a plan's Cell can start in. "No project" is where a chat with no project lives,
 * never a project a Cell is sent to by name.
 */
export function usePlanPlaces(): ReturnType<typeof useWordsPlaces> {
  const listed = useWordsPlaces();
  const scratch = new Set(
    useRailProjects().flatMap((project) => (project.scratch ? [project.key] : [])),
  );
  return { ...listed, places: listed.places.filter((place) => !scratch.has(place.id)) };
}

/**
 * A reader of the person's world for Aski's chat `aski`: its projects as the sidebar lists them
 * (the most recently worked in first), the ready models of Aski's server, and the Cells awake.
 */
export function usePlanWorld(aski: CellRef): () => PlanWorld {
  const { places, recency } = usePlanPlaces();
  // Read here so a provider coming ready re-reads the world; the list itself is read at send.
  useWordsCatalog(aski.environmentId);
  return () => {
    const models = modelsOf(aski.environmentId);
    return {
      context: {
        places: places
          .toSorted((a, b) => (recency.get(b.id) ?? 0) - (recency.get(a.id) ?? 0))
          .map((place) => ({ id: place.id, name: place.name })),
        models,
        cells: readThreadShells().flatMap((shell) =>
          shell.archivedAt === null &&
          shell.settledOverride !== "settled" &&
          shell.lineage.parentThreadId === null &&
          !isAskisInstance(shell.providerInstanceId)
            ? [{ threadId: shell.id, name: cellNameOf(shell.id) }]
            : [],
        ),
      },
      think: thinkOf(aski.environmentId),
      names: new Set(places.map((place) => place.name)),
    };
  };
}

export type Carried = { readonly ok: true } | { readonly ok: false; readonly error: string };

const failedWith = (
  result: Parameters<typeof squashAtomCommandFailure>[0],
  fallback: string,
): Carried => {
  const error = squashAtomCommandFailure(result);
  return { ok: false, error: error instanceof Error ? error.message : fallback };
};

/** What a planned row says of a Cell before it exists: its project and the model it will run on. */
export interface StartFacts {
  readonly projectId: string;
  readonly modelName: string;
  readonly effort: string | undefined;
  readonly driver: string | undefined;
}

/** The hands a plan is carried out with: each is the person's own command. */
export interface PlanHands {
  /**
   * Starts the act's Cell as its thread, in the folder of the project `projectKey`
   * (`environmentId:projectId`).
   */
  readonly start: (act: StartAct, projectKey: string) => Promise<Carried>;
  /** Hands an act of plan `planId` to Aski's server to start itself: later, or in a worktree of its own. */
  readonly queue: (
    planId: string,
    act: StartAct,
    projectKey: string,
    /** Start it at once, though the Cells it comes after haven't landed. */
    now: boolean,
  ) => Promise<Carried>;
  /** Whether the project is on Aski's own server, which is the one that can start a Cell. */
  readonly onAskisServer: (projectKey: string) => boolean;
  /** Whether the act's Cell gets a worktree of its own in `projectKey`: the person's word, else the project's default. */
  readonly wantsWorktree: (act: StartAct, projectKey: string) => boolean;
  /** Whether the app lists the thread, on any machine. */
  readonly exists: (threadId: string) => boolean;
  /** Makes a project on Aski's server; its key once it is listed here. */
  readonly newProject: (
    name: string,
  ) => Promise<
    | { readonly ok: true; readonly projectKey: string }
    | { readonly ok: false; readonly error: string }
  >;
  /** Removes a project from the app, on every machine that lists it; its folder stays. */
  readonly removeProject: (placeId: string) => Promise<Carried>;
  /** Archives Cells, stopping one that runs. */
  readonly archive: (cells: ReadonlyArray<CellRef>) => Promise<Carried>;
  /** A place's project where a Cell of Aski's starts: on Aski's server, else its first. */
  readonly projectKeyOf: (place: StartAct["place"]) => string | null;
  /** The Cells of a place that are not archived. */
  readonly cellsIn: (placeId: string) => CellRef[];
  /** A Cell by its thread, on any machine. */
  readonly cellOf: (threadId: string) => CellRef | null;
  readonly factsOf: (act: StartAct) => StartFacts;
}

/** The first ready provider's own default model: what a Cell starts on when nothing else names one. */
function firstReadyModel(environmentId: string): Selection | null {
  const { catalog, ready } = wordsCatalogOf(
    readEnvironmentProviders(environmentId as EnvironmentId) ?? [],
  );
  const provider = catalog.providers.find(
    (each) => ready.has(each.id) && (each.defaultModel ?? each.models[0]?.id) !== undefined,
  );
  const model = provider?.defaultModel ?? provider?.models[0]?.id;
  return provider === undefined || model === undefined ? null : { instanceId: provider.id, model };
}

/** The model a Cell with none named starts on, with the effort the person said when it has it. */
function defaultWith(
  environmentId: string,
  projectKey: string,
  effort: string | null,
): { selection: Selection | null; entry: ModelEntry | null } {
  const models = modelsOf(environmentId);
  // Nothing set and nothing used yet: the first ready provider's own default.
  const selection: Selection | null =
    startingModel(projectRefOfKey(projectKey)) ?? firstReadyModel(environmentId);
  if (selection === null) return { selection: null, entry: null };
  const entry =
    models.find(
      (model) => model.instanceId === selection.instanceId && model.id === selection.model,
    ) ?? null;
  const level = effort === null || entry === null ? null : clampEffort(effort, entry.efforts);
  if (level === null || entry?.effortOption === undefined) return { selection, entry };
  return {
    selection: {
      instanceId: selection.instanceId,
      model: selection.model,
      options: [{ id: entry.effortOption, value: level }],
    },
    entry,
  };
}

const serverSettingsOf = (environmentId: EnvironmentId) =>
  appAtomRegistry.get(environmentServerConfigsAtom).get(environmentId)?.settings;

/**
 * What a plan's Cell launches with, whoever starts it: the person's own default access, as a new
 * chat of theirs would have and never more, and the model its act names, else its project's.
 */
function launchOf(act: StartAct, projectKey: string) {
  const ref = projectRefOfKey(projectKey);
  const settings = serverSettingsOf(ref.environmentId);
  if (!settings) return null;
  const named: Selection | null =
    act.selection ??
    (act.model === null
      ? defaultWith(ref.environmentId, projectKey, act.effort).selection
      : {
          instanceId: act.model.instanceId,
          model: act.model.id,
          ...(act.model.effort
            ? { options: [{ id: act.model.effort.option, value: act.model.effort.level }] }
            : {}),
        });
  return {
    ref,
    runtimeMode: settings.defaultRuntimeMode,
    interactionMode: "default" as const,
    selection:
      named === null
        ? null
        : createModelSelection(named.instanceId as ProviderInstanceId, named.model, [
            ...(named.options ?? []),
          ]),
  };
}

/**
 * Whether a plan's Cell gets a worktree of its own (decision 17): the person's word for the
 * message, else where a new Cell of theirs starts in that project. Only Aski's server gives one.
 */
function wantsWorktree(home: string, act: StartAct, projectKey: string): boolean {
  const ref = projectRefOfKey(projectKey);
  if (ref.environmentId !== home) return false;
  if (act.apart !== undefined) return act.apart;
  const settings = serverSettingsOf(ref.environmentId);
  return (
    settings !== undefined &&
    resolveProjectSettings(settings, ref.projectId, readProject(ref)).settings
      .defaultThreadEnvMode === "worktree"
  );
}

/** A place's project where a Cell of Aski's starts: on Aski's server `home`, else its first. */
function useProjectKeyOf(home: string): PlanHands["projectKeyOf"] {
  const { members } = useWordsPlaces();
  return (place) => {
    if (place === null) return null;
    if (place.projectId !== undefined) return `${home}:${place.projectId}`;
    if (place.id === null) return null;
    const ref = projectRefOf(members.get(place.id) ?? [], home);
    return ref === null ? null : `${ref.environmentId}:${ref.projectId}`;
  };
}

/**
 * Whether an act's Cell will be given a worktree of its own, for its row to say before it
 * starts. A project the plan is yet to make has no default to read: only the person's word.
 */
export function useOwnWorktree(aski: CellRef | null): (act: StartAct) => boolean {
  const home = aski?.environmentId ?? "";
  const projectKeyOf = useProjectKeyOf(home);
  return (act) => {
    const projectKey = projectKeyOf(act.place);
    return projectKey === null ? act.apart === true : wantsWorktree(home, act, projectKey);
  };
}

/** What a row says of a Cell before it exists (`StartFacts`). */
function startFacts(
  home: string,
  projectKeyOf: PlanHands["projectKeyOf"],
  act: StartAct,
): StartFacts {
  const projectKey = projectKeyOf(act.place);
  const environmentId = projectKey?.slice(0, projectKey.indexOf(":")) ?? home;
  const projectId = projectKey?.slice(projectKey.indexOf(":") + 1) ?? "";
  const models = modelsOf(environmentId);
  const instanceId = act.selection?.instanceId ?? act.model?.instanceId;
  const slug = act.selection?.model ?? act.model?.id;
  const named =
    slug === undefined
      ? projectKey === null
        ? null
        : defaultWith(environmentId, projectKey, act.effort).entry
      : (models.find((model) => model.instanceId === instanceId && model.id === slug) ?? null);
  const driver = readEnvironmentProviders(environmentId as EnvironmentId)?.find(
    (provider) => provider.instanceId === (named?.instanceId ?? instanceId),
  )?.driver;
  const said =
    act.model?.effort?.level ??
    act.selection?.options?.find((option) => /effort/iu.test(option.id))?.value ??
    act.effort;
  return {
    projectId,
    modelName: named?.name ?? act.model?.name ?? (slug ? conciseModelName(slug) : ""),
    effort: typeof said === "string" ? said : undefined,
    driver,
  };
}

/**
 * What a plan's row reads of each Cell on Aski's server `aski`: where its project is, what it
 * says of the Cell before it exists, and the model it starts on as its picker shows it (its own,
 * else its project's default with the effort the person said).
 */
export function usePlanRows(aski: CellRef | null): {
  readonly projectOf: (
    act: StartAct,
  ) => { readonly environmentId: string; readonly projectId: string } | null;
  readonly factsOf: (act: StartAct) => StartFacts;
  readonly modelOf: (act: StartAct) => PlanModel | null;
} {
  const home = aski?.environmentId ?? "";
  const projectKeyOf = useProjectKeyOf(home);
  // Read here so a provider coming ready draws the rows again.
  useWordsCatalog(aski?.environmentId ?? null);
  return {
    projectOf: (act) => {
      const projectKey = projectKeyOf(act.place);
      if (projectKey === null) return null;
      const ref = projectRefOfKey(projectKey);
      return { environmentId: ref.environmentId, projectId: ref.projectId };
    },
    factsOf: (act) => startFacts(home, projectKeyOf, act),
    modelOf: (act) => {
      if (act.model !== null)
        return { instanceId: act.model.instanceId, id: act.model.id, effort: act.model.effort };
      const projectKey = projectKeyOf(act.place);
      // As a launch reads it (`launchOf`): the project's own machine names its default.
      const { selection, entry } =
        projectKey === null
          ? { selection: firstReadyModel(home), entry: null }
          : defaultWith(projectRefOfKey(projectKey).environmentId, projectKey, act.effort);
      if (selection === null) return null;
      const level = selection.options?.find(
        (option) => option.id === entry?.effortOption && typeof option.value === "string",
      );
      return {
        instanceId: selection.instanceId,
        id: selection.model,
        effort: level === undefined ? null : { option: level.id, level: String(level.value) },
      };
    },
  };
}

/**
 * Which of `threadIds` the app lists, as one word that changes when one of them appears: the
 * runner looks again then (a queued Cell the server started). Follows nothing for none.
 */
export function useListedCells(threadIds: ReadonlyArray<string>): string {
  const shells = useThreadShells(threadIds.length > 0);
  const listed = new Set(shells.map((shell) => shell.id as string));
  return threadIds.filter((threadId) => listed.has(threadId)).join(" ");
}

export function usePlanHands(aski: CellRef | null): PlanHands {
  const startCells = useStartCells();
  const { members } = useWordsPlaces();
  const createNew = useAtomCommand(projectEnvironment.createNew, { reportFailure: false });
  const removeProject = useOrchestrationCommand(projectEnvironment.delete, {
    reportFailure: false,
  });
  const interrupt = useOrchestrationCommand(threadEnvironment.interruptTurn, {
    reportFailure: false,
  });
  const archive = useOrchestrationCommand(threadEnvironment.archive, { reportFailure: false });
  const home = aski?.environmentId ?? "";
  const projectKeyOf = useProjectKeyOf(home);

  return {
    projectKeyOf,
    exists: (threadId) => readThreadShells().some((shell) => shell.id === threadId),
    wantsWorktree: (act, projectKey) => wantsWorktree(home, act, projectKey),
    onAskisServer: (projectKey) => projectRefOfKey(projectKey).environmentId === home,
    queue: async (planId, act, projectKey, now) => {
      const launch = launchOf(act, projectKey);
      if (launch === null) return { ok: false, error: "That project's machine isn't connected." };
      // The server starts it on itself, where the plan is kept.
      if (launch.ref.environmentId !== home)
        return { ok: false, error: "Aski's server can't start a Cell on another machine." };
      if (launch.selection === null) return { ok: false, error: "No model to start the Cell on." };
      return queueCell({
        id: planId,
        i: act.i,
        projectId: launch.ref.projectId,
        modelSelection: launch.selection,
        runtimeMode: launch.runtimeMode,
        interactionMode: launch.interactionMode,
        worktree: wantsWorktree(home, act, projectKey),
        ...(now ? { now: true } : {}),
      });
    },
    cellOf: (threadId) => {
      const shell = readThreadShells().find((each) => each.id === threadId);
      return shell
        ? { environmentId: shell.environmentId, threadId: shell.id, draftId: null }
        : null;
    },
    cellsIn: (placeId) => {
      const keys = new Set(members.get(placeId) ?? []);
      return readThreadShells().flatMap((shell) =>
        keys.has(`${shell.environmentId}:${shell.projectId}`) &&
        shell.archivedAt === null &&
        !isAskisInstance(shell.providerInstanceId)
          ? [{ environmentId: shell.environmentId, threadId: shell.id, draftId: null }]
          : [],
      );
    },
    factsOf: (act) => startFacts(home, projectKeyOf, act),
    start: async (act, projectKey) => {
      const launch = launchOf(act, projectKey);
      if (launch === null) return { ok: false, error: "That project's machine isn't connected." };
      const setup: DraftSetup = {
        environmentId: launch.ref.environmentId,
        projectId: launch.ref.projectId,
        runtimeMode: launch.runtimeMode,
        interactionMode: launch.interactionMode,
        pick: null,
        current: null,
        branch: null,
        worktree: false,
        startFromOrigin: false,
      };
      const cell: CellStart = {
        projectKey,
        model: null,
        ...(launch.selection === null ? {} : { selection: launch.selection }),
        text: messageOf(act),
        threadId: act.threadId,
        title: act.title,
      };
      const [started] = await startCells(setup, [cell], null);
      return started === undefined || !started.ok
        ? { ok: false, error: started?.error ?? "The Cell didn't start." }
        : { ok: true };
    },
    newProject: async (name) => {
      if (home === "") return { ok: false, error: "Aski has no server to make it on." };
      const result = await createNew({ environmentId: home as EnvironmentId, input: { name } });
      if (result._tag === "Failure") {
        const failed = failedWith(result, "The project couldn't be made.");
        return { ok: false, error: failed.ok ? "" : failed.error };
      }
      const ref = scopeProjectRef(home as EnvironmentId, result.value.projectId);
      // A Cell starts in a project this app lists.
      const listed = await waitForProject(ref).catch(() => null);
      return listed === null
        ? { ok: false, error: "The project was made, but isn't listed here yet." }
        : { ok: true, projectKey: `${home}:${result.value.projectId}` };
    },
    removeProject: async (placeId) => {
      const keys = members.get(placeId) ?? [];
      if (keys.length === 0) return { ok: false, error: "That project isn't here any more." };
      for (const key of keys) {
        const ref = projectRefOfKey(key);
        if (readProject(ref) === null) continue;
        const result = await removeProject({
          environmentId: ref.environmentId,
          input: { projectId: ref.projectId as ProjectId, force: true },
        });
        if (result._tag === "Failure") return failedWith(result, "The project wasn't removed.");
      }
      return { ok: true };
    },
    archive: async (cells) => {
      for (const cell of cells) {
        const environmentId = cell.environmentId as EnvironmentId;
        const threadId = cell.threadId as ThreadId;
        const shell = readThreadShell(scopeThreadRef(environmentId, threadId));
        if (shell === null || shell.archivedAt !== null) continue;
        // A Cell at work stops first; one that won't is archived all the same.
        await interrupt({ environmentId, input: { threadId } });
        const result = await archive({ environmentId, input: { threadId } });
        if (result._tag === "Failure") return failedWith(result, "A Cell wasn't archived.");
      }
      return { ok: true };
    },
  };
}
