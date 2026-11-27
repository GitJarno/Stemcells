// Every chat the phone knows, each as T3's quiet shell: the list is the same list while chats
// only stream, so what reads it draws again when a chat changes, not on each streamed word
// (stemcells/tasks/phone-snappy.md). T3's own quiet list leaves out the chats a tag filter
// hides; ours reads those too (a chat opened by its link, Aski's).
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import type { EnvironmentThreadShell } from "./threads";

export function quietShellsOf(shells: {
  readonly threadShellsAtom: Atom.Atom<ReadonlyArray<EnvironmentThreadShell>>;
  readonly quietThreadShellAtom: (ref: ScopedThreadRef) => Atom.Atom<EnvironmentThreadShell | null>;
}): Atom.Atom<ReadonlyArray<EnvironmentThreadShell>> {
  let previous: ReadonlyArray<EnvironmentThreadShell> = [];
  return Atom.make((get) => {
    const next = get(shells.threadShellsAtom).map(
      (shell) =>
        get(
          shells.quietThreadShellAtom({ environmentId: shell.environmentId, threadId: shell.id }),
        ) ?? shell,
    );
    if (next.length === previous.length && next.every((shell, at) => shell === previous[at]))
      return previous;
    previous = next;
    return next;
  }).pipe(Atom.withLabel("stemcells-quiet-thread-shells"));
}
