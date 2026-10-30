// The home's disk notice, swiped away until the disk has news (`stemcells/disk/notice.ts`):
// hidden on the machine's own server (`POST /api/stemcells/disk/notice`), so every phone hides
// it and the Mac's Settings › Disk says so; held on the phone meanwhile (`chosen.ts`).

import { createChoices, type MachineConnection, postToMachine, useChoice } from "./chosen";

const PATH = "/api/stemcells/disk/notice";

const chosen = createChoices<number | null>();

/** The free space the notice was hidden at: the phone's choice of the last minute, else the machine's. */
export function useHiddenAt(environmentId: string, reported: number | undefined) {
  const held = useChoice(chosen, environmentId);
  return held === undefined ? reported : (held.choice ?? undefined);
}

/** Hides the machine's notice at `hiddenAt` bytes free, or shows it again (null). */
export function setNoticeHidden(
  environmentId: string,
  connection: MachineConnection,
  hiddenAt: number | null,
): Promise<boolean> {
  return chosen.choose(environmentId, hiddenAt, () =>
    postToMachine(connection, PATH, { hiddenAt }),
  );
}
