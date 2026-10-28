// A row's stage in the Mac's colours in dark (`stageColours.ts`): what works, what asks you and
// what is done. `features/threads/thread-list-v2-items.tsx` hands its labels here (a seam).

interface StageLabel {
  readonly className: string;
  readonly iconTintClassName: string;
}

// Tailwind finds classes by reading the source, so each is written out whole.
export const STAGE_OF_STATUS: Readonly<Partial<Record<string, StageLabel>>> = {
  working: { className: "text-stage-working", iconTintClassName: "accent-stage-working" },
  input: { className: "text-stage-input", iconTintClassName: "accent-stage-input" },
  request: { className: "text-stage-request", iconTintClassName: "accent-stage-request" },
};
export const DONE_STAGE: StageLabel = {
  className: "text-stage-done",
  iconTintClassName: "accent-stage-done",
};

/** Upstream's labels by status, each status that has a stage in its colour. */
export function inStageColours<Label extends StageLabel>(
  labels: Partial<Record<string, Label>>,
): Partial<Record<string, Label>> {
  return Object.fromEntries(
    Object.entries(labels).map(([status, label]) => {
      const stage = STAGE_OF_STATUS[status];
      return [status, label && stage ? { ...label, ...stage } : label];
    }),
  );
}

/** Upstream's label for a finished row the person hasn't seen, in the colour of done. */
export function inDoneColour<Label extends StageLabel>(label: Label): Label {
  return { ...label, ...DONE_STAGE };
}
