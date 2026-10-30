// The Cells a message names, each held still as its pill's image (`cell/still.ts`). Every
// message on screen asks, so each reads only its own Cells, as strings: another chat's change
// draws nothing. None until composed and drawn, in the compose queue's turn (`cell/compose.ts`).

import { useComposed } from "../cell/compose";
import { crewLooksOf, useCrewDay } from "../cell/roster";
import { stillUri } from "../cell/still";
import { instanceOf } from "../cell/ThreadCell";
import {
  type EnvironmentThreadShell,
  useEnvironmentProvidersSelected,
  useThemeAppearance,
  useThreadShellsSelected,
} from "../upstream/cells";

const NONE: ReadonlyMap<string, string> = new Map();

/** Each of `threadIds` on `environmentId` as a line: its thread id, provider instance and look. */
function wornIn(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  environmentId: string,
  threadIds: ReadonlySet<string>,
  day: string,
): string {
  const looks = crewLooksOf(shells, day);
  return shells
    .filter((shell) => shell.environmentId === environmentId && threadIds.has(shell.id))
    .map((shell) =>
      [shell.id, instanceOf(shell), (looks.get(shell.id)?.worn ?? []).join("+")].join("\t"),
    )
    .join("\n");
}

/** Each Cell of `threadIds` on `environmentId`, by its thread id, as a PNG data URI. */
export function useCellStills(
  environmentId: string,
  threadIds: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const day = useCrewDay();
  const worn = useThreadShellsSelected((shells) =>
    threadIds.size === 0 ? "" : wornIn(shells, environmentId, threadIds, day),
  );
  const cells = (worn === "" ? [] : worn.split("\n")).map((line) => {
    const [threadId = "", instanceId = "", look = ""] = line.split("\t");
    return { threadId, instanceId, look: look === "" ? [] : look.split("+") };
  });
  const drivers = useEnvironmentProvidersSelected((byEnvironment) => {
    if (cells.length === 0) return "";
    const providers = [...byEnvironment].find(([id]) => id === environmentId)?.[1];
    return cells
      .map(
        (cell) =>
          providers?.find((provider) => provider.instanceId === cell.instanceId)?.driver ?? "",
      )
      .join("\n");
  });
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  const driverOf = drivers.split("\n");
  const stills = () =>
    new Map(
      cells.map((cell, at) => [cell.threadId, stillUri(cell.look, driverOf[at] || null, ground)]),
    );
  const ready = useComposed(`still:${ground}:${worn}:${drivers}`, stills);
  return ready && cells.length > 0 ? stills() : NONE;
}
