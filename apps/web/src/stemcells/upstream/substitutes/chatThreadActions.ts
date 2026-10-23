// Replaces `lib/chatThreadActions.ts` (`plugin.ts`): a new chat never starts
// on Aski's provider instance, nor in Aski's no-project. Upstream's new chat
// carries the model and the project of the chat on screen, so one opened
// from Aski's chat (its tab's +, ⌘T there, the sidebar's new chat, the
// palette) ran on Aski's instance, with Aski's persona, in no project. From
// Aski's chat a new chat goes where one from no chat would: the first
// project, which is never the scratch project while there is another
// (`firstProject.ts`). A model or a project carried from any other chat is
// upstream's.
import {
  type ChatThreadActionContext,
  resolveNewThreadModelSelectionOverride as resolveUpstreamOverride,
  resolveThreadActionProjectRef as resolveUpstreamProjectRef,
} from "../../../lib/chatThreadActions";
import { isAskisInstance } from "../../aski/setup";
import { firstProject } from "../firstProject";

export * from "../../../lib/chatThreadActions";

export function resolveNewThreadModelSelectionOverride(
  input: Parameters<typeof resolveUpstreamOverride>[0],
): ReturnType<typeof resolveUpstreamOverride> {
  const carriesAskis = isAskisInstance(input.carrySelection?.instanceId);
  return resolveUpstreamOverride(carriesAskis ? { ...input, carrySelection: null } : input);
}

/** Every caller hands upstream's thread shell, which says the model it runs on. */
type ShownThread = NonNullable<ChatThreadActionContext["activeThread"]> & {
  readonly modelSelection?: { readonly instanceId?: string };
};

export function resolveThreadActionProjectRef(
  context: ChatThreadActionContext,
): ReturnType<typeof resolveUpstreamProjectRef> {
  const shown: ShownThread | undefined = context.activeThread;
  const fromAskis = isAskisInstance(shown?.modelSelection?.instanceId);
  return resolveUpstreamProjectRef({
    ...context,
    activeThread: fromAskis ? undefined : context.activeThread,
    defaultProjectRef: firstProject(context.defaultProjectRef),
  });
}

// Upstream's calls the project resolver inside its module, which reaches
// upstream's own: this one calls ours.
export async function startNewThreadFromContext(
  context: ChatThreadActionContext,
): Promise<boolean> {
  const projectRef = resolveThreadActionProjectRef(context);
  if (!projectRef) return false;
  await context.handleNewThread(projectRef);
  return true;
}
