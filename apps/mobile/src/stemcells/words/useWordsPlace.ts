// The phone's new chat follows its words to a project, as the Mac's does (`place.ts`): the
// hero's "in Harbor" and the header show the move, deleting the name moves it back, and a
// project picked by hand is written over the name, so the pick stays; a casual chat, which no
// name says, stays without one (`place.ts`).

import { useEffect, useEffectEvent, useMemo, useRef } from "react";

import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";

import { NOTHING_TAKEN, placesOf, wordsStep } from "./place";

interface WordsDraft {
  readonly prompt: string;
  readonly projectScopes: ReadonlyArray<{
    readonly key: string;
    readonly title: string;
    readonly projects: ReadonlyArray<EnvironmentProject>;
  }>;
  readonly selectedProject: EnvironmentProject | null;
  readonly setProject: (project: EnvironmentProject) => void;
  readonly setPrompt: (value: string) => void;
}

const keyOf = (project: EnvironmentProject) => `${project.environmentId}:${project.id}`;

/** `held` while the composer is locked: a send or an import is writing the draft. */
export function useWordsPlace(draft: WordsDraft, held: boolean): void {
  const taken = useRef(NOTHING_TAKEN);
  // No word names a casual chat: its scope's "No project" would be written over the word.
  const named = draft.projectScopes.filter((scope) => !scope.projects.every((p) => p.isScratch));
  const list = named.map((scope) => ({
    key: scope.key,
    name: scope.title,
    projects: scope.projects.map(keyOf),
  }));
  // The list is rebuilt every render; the reader's roster only when a name or a member changes.
  const signature = JSON.stringify(list);
  const places = useMemo(() => placesOf(JSON.parse(signature) as typeof list), [signature]);
  const current = draft.selectedProject === null ? null : keyOf(draft.selectedProject);

  const step = useEffectEvent((text: string, at: string) => {
    const next = wordsStep(text, places, at, taken.current);
    taken.current = next.taken;
    if (next.move !== null) {
      const project = draft.projectScopes
        .flatMap((scope) => scope.projects)
        .find((p) => keyOf(p) === next.move);
      if (project !== undefined) draft.setProject(project);
    }
    if (next.text !== null) draft.setPrompt(next.text);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the new-task flow's project, a store outside React, in step with the draft's words and with picks made in the picker.
  useEffect(() => {
    if (!held && current !== null) step(draft.prompt, current);
  }, [draft.prompt, current, held]);
}
