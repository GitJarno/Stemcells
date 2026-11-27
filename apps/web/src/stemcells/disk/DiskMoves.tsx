import { useEffect, useState } from "react";

import {
  Button,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
  SettingsRow,
  SettingsSection,
  Spinner,
  toastManager,
  type EnvironmentId,
} from "../upstream/disk";
import { DISK_MOVE, diskBytes } from "../../../../../stemcells/words/disk.ts";
import { moveOffer, moveRows, type MoveRow, type MovesAnswer } from "./moves";
import { onMoveEnded, startMove } from "./movesReading";
import type { Drive } from "./wire";

// Settings › Disk's moves: a movable finding offers the machine's drives with room for it, and
// "On other drives" shows a move under way and what's kept away, each with its way back.

const failed = (reason: string | null) =>
  toastManager.add({ type: "error", title: reason ?? DISK_MOVE.unreachable });

/** A finding's offer to move it: one drive by name, several in a menu; nothing when none fit. */
export function MoveControl(props: {
  readonly environmentId: EnvironmentId;
  readonly kind: string;
  readonly bytes: number;
  readonly drives: ReadonlyArray<Drive>;
  readonly moves: MovesAnswer | null;
}) {
  const { environmentId, kind, bytes } = props;
  const [starting, setStarting] = useState(false);
  const offer = moveOffer(props.moves, kind, bytes, props.drives);
  if (offer.length === 0) return null;
  const move = async (driveId: string) => {
    setStarting(true);
    const started = await startMove(environmentId, "away", { kind, driveId });
    setStarting(false);
    if (!started.ok) failed(started.reason);
  };
  if (offer.length === 1) {
    const [drive] = offer as [Drive];
    return (
      <Button size="xs" variant="outline" disabled={starting} onClick={() => void move(drive.id)}>
        {starting ? <Spinner size="xs" /> : null}
        {DISK_MOVE.moveTo(drive.name)}
      </Button>
    );
  }
  return (
    <Select<string>
      value={null}
      onValueChange={(driveId) => {
        if (typeof driveId === "string") void move(driveId);
      }}
    >
      <SelectTrigger size="xs" aria-label={DISK_MOVE.moveToMenu} disabled={starting}>
        <SelectValue placeholder={DISK_MOVE.moveToMenu} />
      </SelectTrigger>
      <SelectPopup>
        {offer.map((drive) => (
          <SelectItem key={drive.id} value={drive.id}>
            {`${drive.name} · ${diskBytes(drive.free)} free`}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

function MoveRowView(props: { readonly environmentId: EnvironmentId; readonly row: MoveRow }) {
  const { environmentId, row } = props;
  const [asking, setAsking] = useState<MoveRow["actions"][number] | null>(null);
  const [acting, setActing] = useState(false);
  const act = async (action: MoveRow["actions"][number]) => {
    setActing(true);
    const started = await startMove(environmentId, action.id, { kind: action.kind });
    setActing(false);
    setAsking(null);
    if (!started.ok) failed(started.reason);
  };
  return (
    <SettingsRow
      title={
        <span className="flex items-center gap-1.5">
          {row.tone === "working" ? <Spinner size="xs" /> : null}
          {row.title}
        </span>
      }
      description={
        <span className={row.tone === "error" ? "text-destructive-foreground" : undefined}>
          {asking?.confirm ?? row.description}
          {row.progress === null ? null : (
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.round(row.progress * 1000) / 10}%` }}
              />
            </span>
          )}
        </span>
      }
      control={
        <span className="flex items-center gap-2">
          {row.size === null ? null : (
            <span className="text-sm text-foreground tabular-nums">{diskBytes(row.size)}</span>
          )}
          {asking !== null ? (
            <>
              <Button size="xs" variant="ghost" disabled={acting} onClick={() => setAsking(null)}>
                Cancel
              </Button>
              <Button
                size="xs"
                variant="destructive"
                disabled={acting}
                onClick={() => void act(asking)}
              >
                {asking.label}
              </Button>
            </>
          ) : (
            row.actions.map((action) => (
              <Button
                key={action.id}
                size="xs"
                variant="outline"
                disabled={acting}
                onClick={() => (action.confirm ? setAsking(action) : void act(action))}
              >
                {acting ? <Spinner size="xs" /> : null}
                {action.label}
              </Button>
            ))
          )}
        </span>
      }
    />
  );
}

/** "On other drives": shown while anything moves, failed lately, or is kept on another drive. */
export function MovesSection(props: {
  readonly environmentId: EnvironmentId;
  readonly moves: MovesAnswer | null;
  readonly nowMs: number;
}) {
  const { environmentId } = props;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a move ends on the machine, outside this page: its outcome is a toast
  useEffect(
    () =>
      onMoveEnded(environmentId, (ended) =>
        toastManager.add({
          type: ended.ok ? "success" : "error",
          title: ended.title,
          ...(ended.description === undefined ? {} : { description: ended.description }),
        }),
      ),
    [environmentId],
  );
  const rows = moveRows(props.moves, props.nowMs);
  if (rows.length === 0) return null;
  return (
    <SettingsSection id="disk-moves" title={DISK_MOVE.section}>
      {rows.map((row) => (
        <MoveRowView key={row.key} environmentId={environmentId} row={row} />
      ))}
    </SettingsSection>
  );
}
