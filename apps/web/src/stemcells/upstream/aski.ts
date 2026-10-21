/**
 * Aski's chat, made of upstream's parts: a provider instance whose launch
 * arguments carry Aski's persona (written through upstream's settings), and
 * a normal thread on it, created and pinned through upstream's commands.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  type EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerConfig,
  ThreadId,
} from "@t3tools/contracts";
import { useEffect, useState } from "react";

import { sortScopedProjectsForSidebar } from "../../components/Sidebar.logic";
import { environmentCatalog } from "../../connection/catalog";
import { newThreadId } from "../../lib/utils";
import { getDefaultProviderInstanceModel } from "../../providerInstances";
import {
  readProjects,
  readThreadShells,
  useProjects,
  useThreadShells,
  waitForThreadShell,
} from "../../state/entities";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { primaryServerConfigAtom, serverEnvironment } from "../../state/server";
import { useEnvironmentShellStatus } from "../../state/shell";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { isThreadRouteSnapshotAuthoritative } from "../../threadRoutes";
import {
  ASKI_INSTANCE_ID,
  ASKI_TITLE,
  askiChatAmong,
  askiDriver,
  askiInstance,
  rememberAskiThread,
  rememberedAskiThread,
  sameInstance,
  type AskiInstance,
} from "../aski/setup";
import type { CellRef } from "../tabs/layout";
import { chatFactsOf } from "./askiChats";
import { useCellPresence } from "./chat";

export type AskiChat =
  | { readonly status: "starting" }
  | { readonly status: "ready"; readonly cell: CellRef }
  | {
      readonly status: "unavailable";
      readonly reason: "no-server" | "no-provider" | "no-project" | "failed";
    };

const askiInstanceId = ProviderInstanceId.make(ASKI_INSTANCE_ID);

/** What Aski's instance should be on this server; null until its providers are known. */
function wantedInstance(config: ServerConfig | null): AskiInstance | null | "no-provider" {
  if (config === null || config.providers.length === 0) return null;
  const stored = config.settings.providerInstances[askiInstanceId];
  const driver = askiDriver(config.providers, stored?.driver);
  if (driver === null) return "no-provider";
  return askiInstance(
    driver,
    config.settings.providerInstances[ProviderInstanceId.make(driver)]?.config,
  );
}

// One setup step at a time for the whole page, whoever asks.
let stepInFlight: string | null = null;
const instancesWritten = new Set<string>();
const repinsAsked = new Set<string>();

/**
 * Aski's chat on the primary server: its instance kept current, and its one
 * thread found among the server's chats (pinned again if someone unpinned
 * it), else made in the most recent project and pinned. This browser
 * remembers it, to show it before the server's chats have loaded.
 */
/** `setsUp`: whether this page may set Aski's chat up when there's none (one window does). */
export function useAskiChat(setsUp = true): AskiChat {
  const catalogReady = useAtomValue(environmentCatalog.catalogValueAtom).isReady;
  const environmentId = usePrimaryEnvironmentId();
  const config = useAtomValue(primaryServerConfigAtom);
  const hasProject = useProjects().some((project) => project.environmentId === environmentId);
  const [remembered, setRemembered] = useState<{ environmentId: string; threadId: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const threadId =
    environmentId === null
      ? null
      : remembered?.environmentId === environmentId
        ? remembered.threadId
        : rememberedAskiThread(environmentId);
  const cell: CellRef | null =
    environmentId !== null && threadId !== null ? { environmentId, threadId, draftId: null } : null;
  const presence = useCellPresence(cell);
  // Whether the server's chats have loaded: until then, no chat is known to be missing.
  const chatsLoaded = isThreadRouteSnapshotAuthoritative(useEnvironmentShellStatus(environmentId));

  const mutateInstance = useAtomCommand(serverEnvironment.mutateProviderInstance, {
    reportFailure: false,
  });
  const createThread = useOrchestrationCommand(threadEnvironment.create, { reportFailure: false });
  const pinThread = useOrchestrationCommand(threadEnvironment.pin, { reportFailure: false });

  const wanted = wantedInstance(config);
  const instanceKey = wanted === null || wanted === "no-provider" ? null : JSON.stringify(wanted);
  const instanceStored =
    config !== null &&
    wanted !== null &&
    wanted !== "no-provider" &&
    sameInstance(config.settings.providerInstances[askiInstanceId], wanted);
  const instanceLive =
    instanceStored && config.providers.some((provider) => provider.instanceId === askiInstanceId);
  const needsThread = cell === null || presence.liveness === "gone";
  // A browser that hasn't met Aski's chat, or remembers one since deleted,
  // takes the server's; the server's chats are read only while it looks.
  const serverChats = useThreadShells(needsThread && chatsLoaded);
  const adoptedChat =
    environmentId !== null && needsThread && chatsLoaded
      ? askiChatAmong(chatFactsOf(serverChats, environmentId))
      : null;
  const adopted = adoptedChat?.threadId ?? null;
  const adoptedPinned = adoptedChat?.pinned ?? false;

  useEffect(() => {
    if (environmentId === null || adopted === null) return;
    rememberAskiThread(environmentId, adopted);
    // Asked once per page; a server that can't pin still gives Aski its chat.
    if (adoptedPinned || repinsAsked.has(adopted)) return;
    repinsAsked.add(adopted);
    void pinThread({
      environmentId: environmentId as EnvironmentId,
      input: { threadId: ThreadId.make(adopted) },
    });
  }, [environmentId, adopted, adoptedPinned, pinThread]);

  useEffect(() => {
    if (!setsUp || environmentId === null || failed || stepInFlight !== null) return;
    if (instanceKey === null) return;
    const instance = JSON.parse(instanceKey) as AskiInstance;
    const run = async (step: string, work: () => Promise<void>) => {
      stepInFlight = step;
      try {
        await work();
      } catch {
        setFailed(true);
      } finally {
        stepInFlight = null;
      }
    };

    if (!instanceStored) {
      // Written once per page: a server that keeps another value wins.
      if (instancesWritten.has(instanceKey)) return;
      instancesWritten.add(instanceKey);
      void run("instance", async () => {
        const result = await mutateInstance({
          environmentId: environmentId as EnvironmentId,
          input: {
            patch: {},
            providerInstanceMutation: {
              operation: "upsert",
              instanceId: askiInstanceId,
              instance: { ...instance, driver: ProviderDriverKind.make(instance.driver) },
            },
          },
        });
        if (result._tag !== "Success") setFailed(true);
      });
      return;
    }

    if (!instanceLive || !needsThread || !chatsLoaded || adopted !== null || !hasProject) return;
    void run("thread", async () => {
      const ownProjects = readProjects().filter(
        (project) => project.environmentId === environmentId,
      );
      const project = sortScopedProjectsForSidebar(
        ownProjects,
        readThreadShells(),
        "updated_at",
      )[0];
      if (!project) return;
      const settings = config?.settings;
      const model = getDefaultProviderInstanceModel(config?.providers ?? [], askiInstanceId);
      if (!settings || model === undefined) return;
      const newId: ThreadId = newThreadId();
      const created = await createThread({
        environmentId: environmentId as EnvironmentId,
        input: {
          threadId: newId,
          projectId: project.id,
          title: ASKI_TITLE,
          modelSelection: { instanceId: askiInstanceId, model },
          runtimeMode: settings.defaultRuntimeMode,
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt: new Date().toISOString(),
        },
      });
      if (created._tag !== "Success") {
        setFailed(true);
        return;
      }
      await waitForThreadShell(scopeThreadRef(environmentId as EnvironmentId, newId));
      // A server that can't pin still gives Aski its chat.
      await pinThread({
        environmentId: environmentId as EnvironmentId,
        input: { threadId: newId },
      });
      rememberAskiThread(environmentId, newId);
      setRemembered({ environmentId, threadId: newId });
    });
  });

  if (environmentId === null) {
    return catalogReady ? { status: "unavailable", reason: "no-server" } : { status: "starting" };
  }
  if (wanted === "no-provider") return { status: "unavailable", reason: "no-provider" };
  if (failed) return { status: "unavailable", reason: "failed" };
  if (environmentId !== null && adopted !== null) {
    return { status: "ready", cell: { environmentId, threadId: adopted, draftId: null } };
  }
  if (cell !== null && presence.liveness === "alive") return { status: "ready", cell };
  if (config !== null && !hasProject && needsThread) {
    return { status: "unavailable", reason: "no-project" };
  }
  return { status: "starting" };
}
