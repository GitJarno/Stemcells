// A chat's Cell on the phone: its face from its chat's status, what it was
// dealt with the crew, its provider's colours, on the theme's ground.

import { useEffect, useState } from "react";

import {
  type EnvironmentThreadShell,
  resolveThreadListV2Status,
  useEnvironmentProviders,
  useThemeAppearance,
} from "../upstream/cells";
import { CellFigure } from "./CellFigure";
import { faceOf, faceTurnsAt } from "./mood";
import { useCellLook } from "./roster";

export function ThreadCell(props: {
  readonly thread: EnvironmentThreadShell;
  /** Points a cell of the miniature is drawn. */
  readonly points?: number;
  /** Acts out its scene while it works or cheers; otherwise, and by default, held still, it only blinks. */
  readonly plays?: boolean;
  /** Put away (settled or snoozed): it sleeps. */
  readonly away?: boolean;
  /** Its machine is out of reach: it peers. */
  readonly lineDown?: boolean;
  /** When it forms, if the view showing it is where it's first seen (`forming.ts`). */
  readonly formingFrom?: number | undefined;
}) {
  const { thread } = props;
  const providers = useEnvironmentProviders().get(thread.environmentId);
  const instanceId = thread.runtime?.providerInstanceId ?? thread.modelSelection.instanceId;
  const driver = providers?.find((provider) => provider.instanceId === instanceId)?.driver ?? null;
  const look = useCellLook(thread.id);
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  const [now, setNow] = useState(Date.now);
  const face = faceOf(thread, resolveThreadListV2Status(thread), {
    now,
    driver,
    away: props.away,
    lineDown: props.lineDown,
  });
  const turnsAt = faceTurnsAt(thread, driver, now);
  useEffect(() => {
    if (turnsAt === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, turnsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [turnsAt]);
  return (
    <CellFigure
      name={thread.id}
      mood={face.mood}
      activity={face.activity}
      provider={driver}
      look={look}
      points={props.points}
      plays={props.plays === true && (face.activity !== undefined || face.mood === "pleased")}
      ground={ground}
      formingFrom={props.formingFrom}
    />
  );
}
