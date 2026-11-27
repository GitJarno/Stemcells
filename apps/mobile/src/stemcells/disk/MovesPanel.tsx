import { useEffect, useState } from "react";
import { View } from "react-native";

import { DISK_MOVE, diskBytes } from "../../../../../stemcells/words/disk.ts";
import { AppText, Button, Dialog, SettingsSection, useNowMinuteMs } from "../upstream/disk";
import { type Drive, moveOffer, moveRows, type MoveRow, type MovesAnswer } from "./kit";
import { onMoveEnded, startMove } from "./moves";

// The phone's moves, as the Mac's Settings › Disk shows them (`apps/web/src/stemcells/disk/
// DiskMoves.tsx`): a movable finding offers its machine's drives with room, and "On other drives"
// shows a move under way and what's kept away, each with its way back. The machine does the move.

const NUMBERS = { fontVariant: ["tabular-nums" as const] };

const failed = (reason: string | null) =>
  Dialog.alert(DISK_MOVE.couldNot, reason ?? DISK_MOVE.unreachable);

/** Under a finding: "Move to <drive>", or a choice of drives; nothing when none has room. */
export function MoveButton(props: {
  readonly environmentId: string;
  readonly kind: string;
  readonly bytes: number;
  readonly drives: ReadonlyArray<Drive>;
  readonly moves: MovesAnswer | null;
}) {
  const { environmentId, kind } = props;
  const [starting, setStarting] = useState(false);
  const offer = moveOffer(props.moves, kind, props.bytes, props.drives);
  if (offer.length === 0) return null;
  const move = async (driveId: string) => {
    setStarting(true);
    const started = await startMove(environmentId, "away", { kind, driveId });
    setStarting(false);
    if (!started.ok) failed(started.reason);
  };
  const choose = () =>
    Dialog.alert(DISK_MOVE.moveToMenu, DISK_MOVE.moveNote, [
      ...offer.map((drive) => ({
        text: `${drive.name} · ${diskBytes(drive.free)} free`,
        onPress: () => void move(drive.id),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  return (
    <View className="items-start">
      <Button
        label={offer.length === 1 ? DISK_MOVE.moveTo(offer[0]!.name) : DISK_MOVE.moveToMenu}
        tone="text"
        loading={starting}
        accessibilityHint={DISK_MOVE.moveNote}
        onPress={() => (offer.length === 1 ? void move(offer[0]!.id) : choose())}
      />
    </View>
  );
}

function RowView(props: { readonly environmentId: string; readonly row: MoveRow }) {
  const { environmentId, row } = props;
  const [acting, setActing] = useState(false);
  const act = async (action: MoveRow["actions"][number]) => {
    setActing(true);
    const started = await startMove(environmentId, action.id, { kind: action.kind });
    setActing(false);
    if (!started.ok) failed(started.reason);
  };
  const ask = (action: MoveRow["actions"][number]) =>
    action.confirm === undefined
      ? void act(action)
      : Dialog.alert(action.label, action.confirm, [
          { text: "Cancel", style: "cancel" },
          { text: action.label, style: "destructive", onPress: () => void act(action) },
        ]);
  return (
    <View className="gap-1.5 bg-grouped-card px-4 py-3">
      <View className="flex-row items-center gap-3">
        <AppText textRole="body" className="min-w-0 flex-1 text-foreground">
          {row.title}
        </AppText>
        {row.size === null ? null : (
          <AppText textRole="footnote" className="text-foreground" style={NUMBERS}>
            {diskBytes(row.size)}
          </AppText>
        )}
      </View>
      <AppText
        textRole="footnote"
        className={row.tone === "error" ? "text-destructive" : "text-foreground-muted"}
        style={NUMBERS}
      >
        {row.description}
      </AppText>
      {row.progress === null ? null : (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(row.progress * 100) }}
          className="h-1 overflow-hidden rounded-full bg-border"
        >
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${row.progress * 100}%` }}
          />
        </View>
      )}
      {row.actions.length === 0 ? null : (
        <View className="flex-row gap-2">
          {row.actions.map((action) => (
            <Button
              key={action.id}
              label={action.label}
              tone="text"
              loading={acting}
              onPress={() => ask(action)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** "On other drives": shown while anything moves, failed lately, or is kept on another drive. */
export function MovesSection(props: {
  readonly environmentId: string;
  readonly moves: MovesAnswer | null;
}) {
  const { environmentId } = props;
  const nowMs = useNowMinuteMs();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a move ends on the machine, outside this screen: its outcome is an alert
  useEffect(
    () =>
      onMoveEnded(environmentId, (ended) => {
        if (!ended.ok) Dialog.alert(ended.title, ended.description ?? "");
      }),
    [environmentId],
  );
  const rows = moveRows(props.moves, nowMs);
  if (rows.length === 0) return null;
  return (
    <SettingsSection title={DISK_MOVE.section}>
      {rows.map((row, index) => (
        <View key={row.key} className={index === 0 ? undefined : "border-t border-border"}>
          <RowView environmentId={environmentId} row={row} />
        </View>
      ))}
    </SettingsSection>
  );
}
