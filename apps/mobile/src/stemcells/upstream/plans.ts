// What Aski's plans take from upstream (stemcells/tasks/aski-orchestrator.md, decisions 5 and
// 7): a machine's projects, chats and providers; the person's own commands to start a thread,
// make or delete a project, and stop and archive a thread; a new Cell's defaults; a composer's
// draft; and the app's one dictation. `plans.contract.test.ts` pins what this leans on.

import { useAtomValue } from "@effect/atom-react";
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { runAtomCommand, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { REASONING_EFFORT_OPTION_IDS } from "@t3tools/client-runtime/state/thread-execution";
import { voiceInputBlocksSubmission } from "@t3tools/client-runtime/voice-input";
import {
  AuthOrchestrationOperateScope,
  DEFAULT_SERVER_SETTINGS,
  type EnvironmentId,
  isProviderAvailable,
  PROVIDER_DISPLAY_NAMES,
  ProjectId,
  type ServerProvider,
  ThreadId,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";

import type { CatalogProvider } from "../../../../../stemcells/orchestrator/context.ts";
import { threadCanArchive } from "../../features/home/threadArchive";
import { scheduledTaskDefaultModel } from "../../features/settings/scheduledTaskDraft";
import { resolveNewThreadRuntimeMode } from "../../features/threads/thread-settings-options";
import { voiceInputAtom } from "../../features/voice-input/VoiceInputProvider";
import { scopedThreadKey } from "../../lib/scopedEntities";
import { uuidv4 } from "../../lib/uuid";
import { appAtomRegistry } from "../../state/atom-registry";
import { useProjects, waitForProject } from "../../state/entities";
import { environmentProjects, projectEnvironment } from "../../state/projects";
import { environmentServerConfigsAtom } from "../../state/server";
import { readEnvironmentScope } from "../../state/session";
import { environmentThreadShells, threadEnvironment } from "../../state/threads";
import { getComposerDraftSnapshot } from "../../state/use-composer-drafts";
import type { buildProjectThreadStartTurnInput } from "./planLaunch";

export { uuidv4 };
export { AppText } from "../../components/ui/AppText";
export { SymbolView } from "../../components/ui/AppSymbol";
export { Menu } from "../../components/ui/Menu";
export * as Dialog from "../../components/ui/Dialog";
export { useKeyboardState } from "react-native-keyboard-controller";
export { useIsFocused } from "@react-navigation/native";
export { useProjects };

/** The option ids that hold a model's effort, in upstream's order of preference. */
export const EFFORT_OPTIONS = REASONING_EFFORT_OPTION_IDS;

export type Outcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const NO_ACCESS: Outcome = { ok: false, reason: "This connection can’t change Cells." };

const whyOf = (result: Parameters<typeof squashAtomCommandFailure>[0], otherwise: string) => {
  const error = squashAtomCommandFailure(result);
  return error instanceof Error && error.message.length > 0 ? error.message : otherwise;
};

const canOperate = (environmentId: EnvironmentId) =>
  readEnvironmentScope(environmentId, AuthOrchestrationOperateScope);

/** A provider as a model's entry reads it: usable when a Cell could start on it now. */
export function catalogProvider(provider: ServerProvider): CatalogProvider {
  const label = PROVIDER_DISPLAY_NAMES[provider.driver] ?? provider.displayName ?? provider.driver;
  return {
    instanceId: provider.instanceId,
    usable: provider.enabled && isProviderAvailable(provider),
    word: label.trim().split(/\s+/u)[0]!.toLowerCase(),
    models: provider.models,
  };
}

/** A machine's projects, chats and server config as they stand now. */
export function readMachine(environmentIdText: string) {
  const environmentId = environmentIdText as EnvironmentId;
  return {
    projects: appAtomRegistry
      .get(environmentProjects.projectsAtom)
      .filter((project) => project.environmentId === environmentId),
    shells: appAtomRegistry
      .get(environmentThreadShells.threadShellsAtom)
      .filter((shell) => shell.environmentId === environmentId),
    config: appAtomRegistry.get(environmentServerConfigsAtom).get(environmentId) ?? null,
  };
}

/** A machine's server config, for the views. */
export function useMachineConfig(environmentIdText: string) {
  return useAtomValue(environmentServerConfigsAtom).get(environmentIdText as EnvironmentId) ?? null;
}

/** Whether a provider instance on a machine can start a Cell now. */
export function providerReady(environmentIdText: string, instanceId: string): boolean {
  const provider = readMachine(environmentIdText).config?.providers.find(
    (one) => one.instanceId === instanceId,
  );
  return (
    provider !== undefined &&
    provider.enabled &&
    isProviderAvailable(provider) &&
    provider.status === "ready"
  );
}

type Machine = ReturnType<typeof readMachine>;

/** What a new Cell in a project runs on when nothing names it: the project's own, else the app's. */
export function newCellDefaults(environmentIdText: string, projectIdText: string) {
  const { projects, config } = readMachine(environmentIdText);
  return defaultsIn(projects, config, projectIdText);
}

/** The same, for a view: it draws again when the machine's projects or settings change. */
export function useNewCellDefaults(environmentIdText: string, projectIdText: string | null) {
  const projects = useProjects().filter((one) => one.environmentId === environmentIdText);
  return defaultsIn(projects, useMachineConfig(environmentIdText), projectIdText ?? "");
}

function defaultsIn(
  projects: Machine["projects"],
  config: Machine["config"],
  projectIdText: string,
) {
  const project = projects.find((one) => one.id === projectIdText) ?? null;
  const settings = config?.settings ?? DEFAULT_SERVER_SETTINGS;
  const resolved = resolveProjectSettings(settings, project?.id ?? null, project).settings;
  return {
    project,
    /** A new Cell of the project gets a worktree of its own. */
    apart: resolved.defaultThreadEnvMode === "worktree",
    model: scheduledTaskDefaultModel(config, project),
    runtimeMode: resolveNewThreadRuntimeMode(
      undefined,
      resolved.defaultRuntimeMode,
      config?.managedPolicy,
    ),
  };
}

/** Whether a project starts its new Cells in worktrees of their own, for the views. */
export function useStartsApart(environmentIdText: string): (projectId: string) => boolean {
  const projects = useProjects();
  const config = useMachineConfig(environmentIdText);
  return (projectId) => {
    const project =
      projects.find((one) => one.environmentId === environmentIdText && one.id === projectId) ??
      null;
    return (
      resolveProjectSettings(
        config?.settings ?? DEFAULT_SERVER_SETTINGS,
        project?.id ?? null,
        project,
      ).settings.defaultThreadEnvMode === "worktree"
    );
  };
}

/** Runs `run` each time any machine's chats change; returns its stop. */
export function watchCells(run: () => void): () => void {
  return appAtomRegistry.subscribe(environmentThreadShells.threadShellsAtom, run);
}

/** Whether a chat with this id is already on the machine. */
export function cellExists(environmentIdText: string, threadIdText: string): boolean {
  return (
    appAtomRegistry.get(
      environmentThreadShells.threadShellAtom(
        scopeThreadRef(environmentIdText as EnvironmentId, ThreadId.make(threadIdText)),
      ),
    ) !== null
  );
}

/** Starts a thread with its first message, as the phone's new chat does; nothing is opened. */
export async function startCell(
  environmentIdText: string,
  input: ReturnType<typeof buildProjectThreadStartTurnInput>,
): Promise<Outcome> {
  const environmentId = environmentIdText as EnvironmentId;
  if (!canOperate(environmentId)) return NO_ACCESS;
  const result = await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.startTurn,
    { environmentId, input },
    { reportFailure: false },
  );
  return result._tag === "Success"
    ? { ok: true }
    : { ok: false, reason: whyOf(result, "The Cell didn’t start.") };
}

/** Makes a project by name, as the phone's New project does; its id once the app lists it. */
export async function createProject(
  environmentIdText: string,
  name: string,
): Promise<
  | { readonly ok: true; readonly projectId: string }
  | { readonly ok: false; readonly reason: string }
> {
  const environmentId = environmentIdText as EnvironmentId;
  if (!canOperate(environmentId)) return NO_ACCESS as { ok: false; reason: string };
  const result = await runAtomCommand(
    appAtomRegistry,
    projectEnvironment.createNew,
    { environmentId, input: { name } },
    { reportFailure: false },
  );
  if (result._tag !== "Success")
    return { ok: false, reason: whyOf(result, `Couldn’t make ${name}.`) };
  const { projectId } = result.value;
  // A Cell reads its project's defaults from the app's own list.
  await waitForProject(scopeProjectRef(environmentId, projectId));
  return { ok: true, projectId };
}

/** Deletes a project from the app, as Settings' Remove project does. */
export async function deleteProject(
  environmentIdText: string,
  projectIdText: string,
): Promise<Outcome> {
  const environmentId = environmentIdText as EnvironmentId;
  if (!canOperate(environmentId)) return NO_ACCESS;
  const result = await runAtomCommand(
    appAtomRegistry,
    projectEnvironment.delete,
    { environmentId, input: { projectId: ProjectId.make(projectIdText), force: true } },
    { reportFailure: false },
  );
  return result._tag === "Success"
    ? { ok: true }
    : { ok: false, reason: whyOf(result, "The project couldn’t be deleted.") };
}

/** Whether a chat can be archived now, as the home's Archive asks: one at work can't. */
export function cellCanArchive(environmentIdText: string, threadIdText: string): boolean {
  const shell = appAtomRegistry.get(
    environmentThreadShells.threadShellAtom(
      scopeThreadRef(environmentIdText as EnvironmentId, ThreadId.make(threadIdText)),
    ),
  );
  return shell !== null && threadCanArchive(shell.runtime);
}

export async function archiveCell(
  environmentIdText: string,
  threadIdText: string,
): Promise<Outcome> {
  const environmentId = environmentIdText as EnvironmentId;
  if (!canOperate(environmentId)) return NO_ACCESS;
  const result = await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.archive,
    { environmentId, input: { threadId: ThreadId.make(threadIdText) } },
    { reportFailure: false },
  );
  return result._tag === "Success"
    ? { ok: true }
    : { ok: false, reason: whyOf(result, "The Cell couldn’t be archived.") };
}

/** Stops whatever a chat is doing; a chat doing nothing is left as it is. */
export async function stopCell(environmentIdText: string, threadIdText: string): Promise<void> {
  const environmentId = environmentIdText as EnvironmentId;
  if (!canOperate(environmentId)) return;
  await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.interruptTurn,
    { environmentId, input: { threadId: ThreadId.make(threadIdText) } },
    { reportFailure: false },
  );
}

/** What a chat's composer holds unsent, and the key its draft is kept under. */
export function readChatDraft(environmentIdText: string, threadIdText: string, draftKey?: string) {
  const key =
    draftKey ?? scopedThreadKey(environmentIdText as EnvironmentId, ThreadId.make(threadIdText));
  const draft = getComposerDraftSnapshot(key);
  return {
    key,
    text: draft.text.trim(),
    plain: draft.attachments.length === 0 && (draft.context?.records.length ?? 0) === 0,
  };
}

/** The app's one dictation, a store outside React. */
export function useDictationSession() {
  return useAtomValue(voiceInputAtom).session;
}

type DictationSession = ReturnType<typeof useDictationSession>;

/** The draft the dictation writes into, and whether it is recording or transcribing. */
export function readDictation(session: DictationSession) {
  const { ownerKey, state } = session.getSnapshot();
  return { owner: ownerKey, busy: voiceInputBlocksSubmission(state) };
}

/** A draft's words now, by the key its composer keeps it under. */
export const draftTextOf = (owner: string): string => getComposerDraftSnapshot(owner).text;
