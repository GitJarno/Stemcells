/**
 * Aski's instance is Aski's: only Aski's own chat offers it. A Cell's
 * composer never lists it, and a Cell's chat still on it (made before Cells
 * were kept off it) shows, and so sends with, the same model on its
 * driver's own instance. The send moves the chat quietly: upstream's server
 * hands a chat to another instance of its driver by resuming it there. The
 * server refuses a Cell's turn on Aski's instance
 * (`apps/server/src/stemcells/upstream/askiInstance.ts`).
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  defaultInstanceIdForDriver,
  type ModelSelection,
  type ServerProvider,
} from "@t3tools/contracts";

import type { ChatComposerProps } from "../../components/chat/ChatComposer";
import { environmentThreadShells } from "../../state/threads";
import { askiChatAmong, isAskisInstance } from "../aski/setup";
import { chatFactsOf } from "./askiChats";

export interface ComposerInstances {
  readonly providerStatuses: ServerProvider[];
  readonly activeThreadModelSelection: ModelSelection | null | undefined;
}

/** What a Cell's composer offers and sends with: anything but Aski's instance. */
export function cellInstances(composer: ComposerInstances): ComposerInstances {
  const askis = composer.providerStatuses.find((provider) => isAskisInstance(provider.instanceId));
  if (askis === undefined) return composer;
  const selection = composer.activeThreadModelSelection;
  return {
    providerStatuses: composer.providerStatuses.filter((provider) => provider !== askis),
    activeThreadModelSelection:
      selection != null && isAskisInstance(selection.instanceId)
        ? { ...selection, instanceId: defaultInstanceIdForDriver(askis.driver) }
        : selection,
  };
}

/** The composer's instances: as given in Aski's own chat, a Cell's everywhere else. */
export function useComposerInstances(
  props: Pick<
    ChatComposerProps,
    "environmentId" | "activeThread" | "providerStatuses" | "activeThreadModelSelection"
  >,
): ComposerInstances {
  const { environmentId, activeThread, providerStatuses, activeThreadModelSelection } = props;
  const threadId = activeThread?.id ?? null;
  // Aski's own chat is on Aski's instance; only a chat there needs the server's chats read.
  const onAskis =
    isAskisInstance(activeThreadModelSelection?.instanceId) ||
    isAskisInstance(activeThread?.runtime?.providerInstanceId);
  const askisChat = (shells: ReadonlyArray<EnvironmentThreadShell>) =>
    onAskis ? (askiChatAmong(chatFactsOf(shells, environmentId))?.threadId ?? null) : null;
  const askiThreadId = useAtomValue(environmentThreadShells.threadShellsAtom, askisChat);
  // Until the server's chats are known, a chat on Aski's instance is taken for Aski's.
  const askis = onAskis && (askiThreadId === null || askiThreadId === threadId);
  return askis
    ? { providerStatuses, activeThreadModelSelection }
    : cellInstances({ providerStatuses, activeThreadModelSelection });
}
