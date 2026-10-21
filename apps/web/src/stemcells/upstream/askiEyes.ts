/**
 * What Aski's eyes read from upstream: whether this Mac's server answers,
 * how the open chats stand, what Aski's own chat is doing, and where
 * Aski's field is in the page. `askiEyes.contract.test.ts` pins what they
 * rely on.
 */
import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";

import { isSidebarSubagentThread } from "../../components/Sidebar.logic";
import { useEnvironment, usePrimaryEnvironmentId } from "../../state/environments";
import { useQuietThreadShell, useThreadShells } from "../../state/entities";
import { useUiStateStore } from "../../uiStateStore";
import { standingOf, type Standing } from "../rail/projects";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";
import { statusOfShell, useCellStatus } from "./status";

export { getFromPrimary } from "./disk";

/** How the server and the chats stand, as Aski's eyes read them. */
export interface AskiHome {
  /** This Mac's server answers this page: false while it is offline, reconnecting or refusing it. */
  readonly answers: boolean;
  /** Every open chat that has run, but Aski's own: a chat never sent anything holds no work yet. */
  readonly chats: ReadonlyArray<Standing>;
  /** A chat, Aski's own or a Cell's, waits on the person. */
  readonly waits: boolean;
  /** Aski's chat is answering. */
  readonly thinking: boolean;
  /** When Aski's newest turn failed; null while it didn't. */
  readonly failedAt: string | null;
}

/** The connection phases in which the server doesn't answer: never reached, lost, or refusing this page. */
const SILENT: ReadonlySet<EnvironmentConnectionPhase> = new Set([
  "offline",
  "reconnecting",
  "error",
  "unsupported",
]);

/** An open chat and where it stands. */
export interface OpenChat {
  readonly key: string;
  readonly shell: EnvironmentThreadShell;
  readonly standing: Standing;
}

/** The chats the rail counts (open, the person's own), less Aski's; `now` decides which are still snoozed. */
export function useOpenChats(aski: CellRef | null, now: string): ReadonlyArray<OpenChat> {
  const shells = useThreadShells();
  const visited = useUiStateStore((state) => state.threadLastVisitedAtById);
  return shells.flatMap((chat) => {
    if (chat.archivedAt !== null || chat.settledOverride === "settled") return [];
    if (isSidebarSubagentThread(chat) || effectiveSnoozed(chat, { now })) return [];
    if (aski !== null && chat.environmentId === aski.environmentId && chat.id === aski.threadId)
      return [];
    const key = scopedThreadKey(scopeThreadRef(chat.environmentId, chat.id));
    return [{ key, shell: chat, standing: standingOf(statusOfShell(chat, visited[key])) }];
  });
}

/** How things stand for Aski's eyes, `aski` being Aski's chat; `now` decides which chats are still snoozed. */
export function useAskiHome(aski: CellRef | null, now: string): AskiHome {
  const environment = useEnvironment(usePrimaryEnvironmentId());
  const open = useOpenChats(aski, now);
  const shell = useQuietThreadShell(aski ? threadRefOf(aski) : null);
  const askiStatus = useCellStatus(aski);
  const askiStands = aski ? standingOf(askiStatus) : null;
  // A chat never sent anything holds no work yet.
  const others = open.flatMap(({ shell: chat, standing }) =>
    standing === "done" && chat.latestRun == null ? [] : [standing],
  );
  const latestRun = shell?.latestRun ?? null;
  return {
    answers: environment === null || !SILENT.has(environment.connection.phase),
    chats: others,
    waits: askiStands === "needsYou" || others.includes("needsYou"),
    thinking: askiStands === "working",
    failedAt: latestRun?.status === "failed" ? (latestRun.completedAt ?? "") : null,
  };
}

/** Aski's field: upstream's composer editor inside Aski's place, if it shows one. */
export const composerEditorIn = (place: HTMLElement): HTMLElement | null =>
  place.querySelector<HTMLElement>('[data-testid="composer-editor"]');
