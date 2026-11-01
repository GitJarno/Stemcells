import { Atom } from "effect/reactivity";
import { appAtomRegistry } from "./atom-registry";
import type { QueuedThreadMessage } from "./thread-outbox-model";
import { environmentThreadDetails } from "./threads";

// Bridges an acknowledged send until its thread echoes it; command receipts can precede messages.
// A row ends at that echo, never later: bounded history windows drop old messages from the
// projection, so a row still checked against it would come back and sit below newer replies.
export const acknowledgedThreadMessagesAtom = Atom.make<ReadonlyArray<QueuedThreadMessage>>(
  [],
).pipe(Atom.keepAlive);

const stopWatchingEcho = new Map<string, () => void>();

export function retainAcknowledgedThreadMessage(message: QueuedThreadMessage) {
  if (isRetained(message)) return;
  appAtomRegistry.set(acknowledgedThreadMessagesAtom, [
    ...appAtomRegistry.get(acknowledgedThreadMessagesAtom),
    message,
  ]);
  const threadAtom = environmentThreadDetails.threadAtom({
    environmentId: message.environmentId,
    threadId: message.threadId,
  });
  const stop = appAtomRegistry.subscribe(
    threadAtom,
    (thread) => {
      if (thread?.projection.messages.some((entry) => entry.id === message.messageId)) {
        forgetAcknowledgedThreadMessage(message);
      }
    },
    { immediate: true },
  );
  if (isRetained(message)) stopWatchingEcho.set(message.messageId, stop);
  else stop();
}

function isRetained(message: QueuedThreadMessage): boolean {
  return appAtomRegistry
    .get(acknowledgedThreadMessagesAtom)
    .some((entry) => entry.messageId === message.messageId);
}

export function forgetAcknowledgedThreadMessage(message: QueuedThreadMessage) {
  stopWatchingEcho.get(message.messageId)?.();
  stopWatchingEcho.delete(message.messageId);
  const current = appAtomRegistry.get(acknowledgedThreadMessagesAtom);
  const next = current.filter((entry) => entry.messageId !== message.messageId);
  if (next.length !== current.length) appAtomRegistry.set(acknowledgedThreadMessagesAtom, next);
}
