/**
 * Where upstream builds the text a provider reads for a message, at a turn's
 * start (`ProviderTurnStartService`) and for a steer
 * (`ProviderTurnControlService`), a message from another Cell gets the peer
 * frame (stemcells/tasks/peers.md, decision 2), and a turn's start the note
 * on who's here when it changed (decision 6). Upstream gives the provider
 * the message's text alone, with its composer context references written
 * out; this does the same, then frames it.
 */
import {
  type OrchestrationMessageContext,
  type OrchestrationV2Actor,
  type OrchestrationV2ThreadShell,
  ProjectId,
  repositoryGroupingKeyOf,
  type ThreadId,
} from "@t3tools/contracts";
import { projectComposerContextForProvider } from "@t3tools/shared/composerContextReferences";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import type { ProjectionStoreV2Shape } from "../../orchestration-v2/ProjectionStore.ts";
import type { ProjectService } from "../../project/ProjectService.ts";
import type { ProviderAuthService } from "../../provider/ProviderAuthService.ts";
import { providerTextOf, type ThreadFacts } from "../peers/frame.ts";
import { type RosterThread, rosterOf, rosterText, signatureOf } from "../peers/roster.ts";

type Store = Pick<ProjectionStoreV2Shape, "getThreadShell">;
type Projects = Pick<ProjectService["Service"], "listShells">;

interface Message {
  readonly text: string;
  readonly context?: OrchestrationMessageContext | undefined;
  readonly senderThreadId?: ThreadId | undefined;
}

/**
 * Each project's repository key: upstream's own grouping, by its remote.
 * Who's here is extra: no failure of it, a defect included, may fail a turn.
 */
const repoKeysOf = (projects: Projects) =>
  projects.listShells().pipe(
    Effect.map(
      (shells) =>
        new Map(
          shells.flatMap((project) =>
            project.repositoryIdentity
              ? [[project.id as string, repositoryGroupingKeyOf(project.repositoryIdentity)]]
              : [],
          ),
        ),
    ),
    Effect.catchCause((cause) =>
      Effect.logWarning("Stemcells couldn't read the projects' repositories", cause).pipe(
        Effect.as(new Map<string, string>()),
      ),
    ),
  );

const factsOf = (shell: OrchestrationV2ThreadShell, repo: string | null): ThreadFacts => ({
  id: shell.id,
  title: shell.title,
  projectId: shell.projectId,
  repo,
  providerInstanceId: shell.providerInstanceId,
  parentThreadId: shell.lineage.parentThreadId,
  relationshipToParent: shell.lineage.relationshipToParent,
});

// Untraced, as `rosterNote` is: each runs inside `text`'s or `providerText`'s span.
const framed = Effect.fnUntraced(function* (
  store: Store,
  threadId: ThreadId,
  message: Message,
  repos: ReadonlyMap<string, string>,
) {
  const text = projectComposerContextForProvider({
    text: message.text,
    records: message.context?.records ?? [],
  });
  const senderThreadId = message.senderThreadId;
  if (senderThreadId === undefined) return text;
  const read = (id: ThreadId) =>
    store.getThreadShell(id).pipe(
      Effect.map((shell) =>
        shell === null ? null : factsOf(shell, repos.get(shell.projectId) ?? null),
      ),
      Effect.orElseSucceed(() => null),
    );
  const [sender, recipient] = yield* Effect.all([read(senderThreadId), read(threadId)]);
  return providerTextOf({ text, senderThreadId, sender, recipient });
});

/** The text thread `threadId`'s provider reads for a message that steers its turn. */
export const providerText = Effect.fn("Stemcells.peers.providerText")(function* (
  store: Store,
  threadId: ThreadId,
  message: Message,
) {
  return yield* framed(store, threadId, message, new Map());
});

const toldCap = 2_000;
// Per server (its projection store), the roster each thread's provider
// thread was last told: in memory, so after a restart each Cell is told once
// more, and a fresh provider thread (another provider, a handoff) is told
// anew. Recorded as the text is built: a turn the provider then refuses
// leaves it told until the roster changes.
const told = new WeakMap<object, Map<string, string>>();

const millisOf = (shell: OrchestrationV2ThreadShell) =>
  Math.max(
    DateTime.toEpochMillis(shell.updatedAt),
    ...[shell.latestRunStartedAt, shell.latestRunCompletedAt, shell.latestUserMessageAt].flatMap(
      (at) => (at == null ? [] : [DateTime.toEpochMillis(at)]),
    ),
  );

const rosterThreadOf = (shell: OrchestrationV2ThreadShell): RosterThread => ({
  id: shell.id,
  title: shell.title,
  branch: shell.branch,
  status: shell.status,
  providerInstanceId: shell.providerInstanceId,
  parentThreadId: shell.lineage.parentThreadId,
  relationshipToParent: shell.lineage.relationshipToParent,
  at: millisOf(shell),
});

/** Who's here for thread `threadId`, when it changed since it was last told; else null. */
const rosterNote = Effect.fnUntraced(function* (
  store: Store & Pick<ProjectionStoreV2Shape, "getShellSnapshot">,
  threadId: ThreadId,
  repos: ReadonlyMap<string, string>,
) {
  const self = yield* store.getThreadShell(threadId);
  // A Subcell works for its Cell, which knows who's here.
  if (self === null || self.lineage.relationshipToParent === "subagent") return null;
  const repo = repos.get(self.projectId);
  const projectIds = new Set([
    self.projectId as string,
    ...[...repos].flatMap(([projectId, key]) => (key === repo ? [projectId] : [])),
  ]);
  const snapshots = yield* Effect.forEach(projectIds, (projectId) =>
    store.getShellSnapshot({
      location: "active",
      projectId: ProjectId.make(projectId),
      // A Cell the person settled is done here.
      unsettledOnly: true,
    }),
  );
  const threads = snapshots
    .flatMap((snapshot) => snapshot.threads)
    .filter((thread) => thread.archivedAt === null && thread.deletedAt === null);
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  const roster = rosterOf(rosterThreadOf(self), threads.map(rosterThreadOf), now);

  const signature = signatureOf(roster);
  const byThread = told.get(store) ?? new Map<string, string>();
  told.set(store, byThread);
  const key = `${threadId}\t${self.activeProviderThreadId ?? ""}`;
  if (byThread.get(key) === signature) return null;
  byThread.delete(key);
  byThread.set(key, signature);
  if (byThread.size > toldCap) byThread.delete(byThread.keys().next().value!);
  return rosterText(roster);
});

/**
 * The text thread `threadId`'s provider reads for the message that starts
 * its turn: who's here, when that changed, then the message, framed when
 * another Cell sent it.
 */
export const text = Effect.fn("Stemcells.peers.text")(function* (
  store: Store & Pick<ProjectionStoreV2Shape, "getShellSnapshot">,
  projects: Projects,
  threadId: ThreadId,
  message: Message,
) {
  const repos = yield* repoKeysOf(projects);
  const words = yield* framed(store, threadId, message, repos);
  // A command (`/compact`, a provider's own) works only as the text's start.
  if (words.trimStart().startsWith("/")) return words;
  const note = yield* rosterNote(store, threadId, repos).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Stemcells couldn't say who's here", cause).pipe(Effect.as(null)),
    ),
  );
  return note === null ? words : `${note}\n\nUser message:\n${words}`;
});

type PromptCommands = Pick<ProviderAuthService["Service"], "tryHandlePromptCommand">;

/**
 * Upstream's provider sign-in as a message may use it: a prompt command
 * (`/logout`, for Cursor and Antigravity) runs only from a message the
 * person sent. From anyone else it is words, and another Cell's are framed.
 */
export const promptCommandsOf = (
  auth: PromptCommands,
  message: { readonly createdBy: OrchestrationV2Actor },
): PromptCommands =>
  message.createdBy === "user" ? auth : { tryHandlePromptCommand: () => Effect.succeed(false) };
