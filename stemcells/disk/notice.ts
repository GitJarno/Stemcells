/**
 * The phone's home shows a machine's disk once it wants attention: a notice the person can swipe
 * away. A hidden notice stays hidden until the disk has news, never for a set time
 * (`stemcells/tasks/disk-notice-hide.md`). The rule lives here once, for the server that keeps
 * the hide and both apps that read it.
 */

/**
 * Below this, free space wants attention soon, and now below half of it: unless the person
 * chose another `warnBelow` for that machine.
 */
export const SOON_BELOW = 20_000_000_000;

/** Below this the disk is full: Cells, and the server's own database, fail to write. */
export const FULL_BELOW = 2_000_000_000;

export interface NoticeDisk {
  readonly free: number;
  /** The person's threshold; `SOON_BELOW` while they haven't chosen. */
  readonly warnBelow?: number | null | undefined;
  /** The free space when the person hid the notice; none while it isn't hidden. */
  readonly hiddenAt?: number | null | undefined;
}

const calm = ({ free, warnBelow }: NoticeDisk) => free >= (warnBelow ?? SOON_BELOW);

/**
 * The hide that still stands: none once the disk is calm again (the next low disk is news), or
 * once it has news, as free space under half of what it was when hidden, or a disk gone full
 * that wasn't. A notice that showed again stays until it's hidden again.
 */
export function hideKept(disk: NoticeDisk): number | undefined {
  const { free, hiddenAt } = disk;
  if (hiddenAt == null || calm(disk)) return undefined;
  const news = free < hiddenAt / 2 || (free < FULL_BELOW && hiddenAt >= FULL_BELOW);
  return news ? undefined : hiddenAt;
}

/** Whether the home shows the disk's notice: it wants attention, and no hide still stands. */
export function noticeShown(disk: NoticeDisk): boolean {
  return !calm(disk) && hideKept(disk) === undefined;
}
