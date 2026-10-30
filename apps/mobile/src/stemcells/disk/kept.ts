// Each machine's last disk figures, kept for the app's run. The home mounts its header again with
// each tab, and a card that waited there for its machine's answer would move Aski as it came in.

export type DiskFigures = {
  readonly free: number;
  readonly total: number;
  readonly warnBelow?: number;
  readonly hiddenAt?: number;
};

/** What a machine's disk shows: its answer, kept; while it's still reading (undefined), the one kept. */
export function keptDisks() {
  const last = new Map<string, DiskFigures | null>();
  return (environmentId: string, answer: DiskFigures | null | undefined) => {
    if (answer === undefined) return last.get(environmentId);
    last.set(environmentId, answer);
    return answer;
  };
}
