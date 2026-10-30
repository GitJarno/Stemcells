// How little free space warns about a machine: set on its own server (`POST
// /api/stemcells/disk/warn`), and held on the phone meanwhile (`chosen.ts`).

import { createChoices, type MachineConnection, postToMachine, useChoice } from "./chosen";
import { SOON_BELOW } from "./kit";

const PATH = "/api/stemcells/disk/warn";

const chosen = createChoices<number>();

/** A machine's threshold: the phone's choice of the last minute, else what the machine said. */
export function useWarnBelow(environmentId: string, reported: number | undefined): number {
  return useChoice(chosen, environmentId)?.choice ?? reported ?? SOON_BELOW;
}

/** Chooses `warnBelow` for the machine; false when it didn't take it, and the choice is let go. */
export function chooseWarnBelow(
  environmentId: string,
  connection: MachineConnection,
  warnBelow: number,
): Promise<boolean> {
  return chosen.choose(environmentId, warnBelow, () =>
    postToMachine(connection, PATH, { warnBelow }),
  );
}
