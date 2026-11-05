import { type ReactNode, useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { DRIVE_INSIDE, diskBytes } from "../../../../../stemcells/words/disk.ts";
import {
  AppText,
  Button,
  Dialog,
  RowPressable,
  SettingsSection,
  SymbolView,
  useMachineDisk,
  useMachineLine,
  type MachineLine,
} from "../upstream/disk";
import { DriveHero } from "./DriveHero";
import { setLookInside, useDriveReading, useDrives } from "./drives";
import { shelfGroups, useFieldTheme } from "./fieldPicture";
import {
  bandColor,
  diskPressure,
  type Drive,
  type DriveReading,
  fieldBands,
  fieldLayout,
  type FieldColors,
  type FieldFinding,
  type FieldFocus,
  type FieldLayout,
  rgbCss,
  roundUnit,
  SHELF_MOST_CELLS,
  STARTUP_DRIVE,
} from "./kit";
import { useWarnBelow } from "./warn";

// One drive of any connected machine at a time, as the Mac's Settings › Disk shows it
// (`apps/web/src/stemcells/disk/DiskSettings.tsx`): the drive, every drive to switch to, what's
// on it and what could come back. The phone measures and deletes nothing; it asks the machine.

export interface PanelMachine {
  readonly environmentId: string;
  readonly label: string;
  readonly connection: "connected" | "connecting" | "offline";
}

const FIELD_HEIGHT = 150;
const TILE_WIDTH = 118;
const TILE_FIELD = { width: TILE_WIDTH - 22, height: 22 };
const NUMBERS = { fontVariant: ["tabular-nums" as const] };

/** "5 min ago": when a measurement was made, roundly. */
function ago(measuredAt: number, now: number): string {
  const minutes = Math.round((now - measuredAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** A machine's drives; without the drives route, its home's disk as its snapshot gives it. */
function useMachineDrives(environmentId: string, label: string) {
  const known = useDrives(environmentId);
  const snapshot = useMachineDisk(environmentId);
  const drives: ReadonlyArray<Drive> =
    known.status === "known"
      ? known.drives
      : snapshot
        ? [
            {
              id: STARTUP_DRIVE,
              name: label,
              role: "startup",
              total: snapshot.total,
              free: snapshot.free,
              detail: null,
              lookInside: true,
              canLookInside: false,
            },
          ]
        : [];
  return { known, snapshot, drives };
}

function TileField(props: {
  readonly total: number;
  readonly free: number;
  readonly warnBelow: number;
}) {
  const { total, free, warnBelow } = props;
  const { colors, tones } = useFieldTheme();
  const layout = fieldLayout(
    { total, bands: fieldBands({ total, free, scanning: false, counted: 0, buckets: null }) },
    TILE_FIELD,
    SHELF_MOST_CELLS,
  );
  const groups = shelfGroups(layout, colors, tones[diskPressure(free, warnBelow)]);
  return (
    <View style={{ height: TILE_FIELD.height }} className="overflow-hidden">
      <Svg width={layout.cols * layout.pitch} height={layout.rows * layout.pitch}>
        {groups.map((group) => (
          <Path key={group.key} d={group.d} fill={group.fill} />
        ))}
      </Svg>
    </View>
  );
}

/** A machine's drives, each a small field; a machine alone with one drive shows none. */
function MachineTiles(props: {
  readonly machine: PanelMachine;
  readonly alone: boolean;
  readonly selected: string | null;
  readonly onSelect: (environmentId: string, driveId: string) => void;
}) {
  const { machine, selected } = props;
  const { known, snapshot, drives } = useMachineDrives(machine.environmentId, machine.label);
  const warnBelow = useWarnBelow(machine.environmentId, known.warnBelow ?? snapshot?.warnBelow);
  if (props.alone && drives.length < 2) return null;
  const connected = machine.connection === "connected";
  return (
    <View className="gap-1.5">
      <AppText className="ml-1 text-2xs font-t3-medium text-foreground-muted" numberOfLines={1}>
        {machine.label}
      </AppText>
      <View className="flex-row gap-2">
        {!connected || drives.length === 0 ? (
          <View
            className="justify-center rounded-2xl border border-dashed border-border px-3 py-2.5"
            style={{ width: TILE_WIDTH, minHeight: 76 }}
          >
            <AppText className="text-xs text-foreground-muted">
              {!connected
                ? machine.connection === "connecting"
                  ? "Connecting…"
                  : "Not connected"
                : snapshot === null
                  ? "Free space unknown"
                  : "Reading the disk…"}
            </AppText>
          </View>
        ) : (
          drives.map((drive) => {
            const on = selected === drive.id;
            return (
              <RowPressable
                key={drive.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${drive.name}, ${diskBytes(drive.free)} free of ${diskBytes(drive.total)}`}
                onPress={() => props.onSelect(machine.environmentId, drive.id)}
                className={`rounded-2xl border px-2.5 py-2 ${on ? "border-transparent bg-grouped-card" : "border-border"}`}
                style={{ width: TILE_WIDTH }}
              >
                <AppText
                  className={`text-xs font-t3-medium ${on ? "text-foreground" : "text-foreground-muted"}`}
                  numberOfLines={1}
                >
                  {drive.name}
                </AppText>
                <View className="my-1.5">
                  <TileField total={drive.total} free={drive.free} warnBelow={warnBelow} />
                </View>
                <AppText className="text-2xs text-foreground-muted" numberOfLines={1}>
                  <AppText className="text-2xs font-t3-medium text-foreground" style={NUMBERS}>
                    {diskBytes(drive.free)}
                  </AppText>{" "}
                  free
                </AppText>
              </RowPressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const Swatch = ({ color }: { readonly color: string }) => (
  <View className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
);

/** One band in words: a tap lights its cells and opens it to what's in it. */
function BandRow(props: {
  readonly layout: FieldLayout;
  readonly index: number;
  readonly colors: FieldColors;
  readonly description: string;
  readonly focus: FieldFocus | null;
  readonly onFocus: (focus: FieldFocus | null) => void;
}) {
  const { layout, index, colors, focus, onFocus } = props;
  const [open, setOpen] = useState(false);
  const band = layout.bands[index];
  if (band === undefined) return null;
  const opens = band.items.length > 0;
  const lit = focus?.band === index;
  const swatch = rgbCss(band.kind === "system" ? colors.counting : bandColor(colors, band));
  const largest = band.items[0]?.bytes ?? 1;
  const press = () => {
    const next = opens ? !open : !lit;
    setOpen(opens && next);
    onFocus(next ? { band: index, item: null } : null);
  };
  return (
    <View className={index === 0 ? undefined : "border-t border-border"}>
      <RowPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: opens ? open : undefined, selected: lit }}
        accessibilityLabel={`${band.title}, ${diskBytes(band.bytes)}`}
        onPress={press}
        className="bg-grouped-card"
      >
        <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">
          <Swatch color={swatch} />
          <View className="min-w-0 flex-1 gap-0.5">
            <AppText textRole="body" className="text-foreground" numberOfLines={1}>
              {band.title}
            </AppText>
            {props.description === "" ? null : (
              <AppText textRole="footnote" className="text-foreground-muted" numberOfLines={2}>
                {props.description}
              </AppText>
            )}
          </View>
          <AppText textRole="footnote" className="text-foreground" style={NUMBERS}>
            {diskBytes(band.bytes)}
          </AppText>
          {opens ? (
            <SymbolView
              name={open ? "chevron.down" : "chevron.right"}
              size={13}
              tintColorClassName="accent-chevron"
              type="monochrome"
              weight="semibold"
            />
          ) : null}
        </View>
      </RowPressable>
      {open ? (
        <View className="gap-0.5 px-4 pb-3 pl-9">
          {band.items.map((item, itemIndex) => {
            const on = focus?.band === index && focus.item === itemIndex;
            return (
              <RowPressable
                key={item.path ?? item.name}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onFocus({ band: index, item: on ? null : itemIndex })}
                className="rounded-lg"
              >
                <View className="flex-row items-center gap-3 py-1">
                  <AppText
                    className={`min-w-0 flex-1 text-xs ${on ? "font-t3-medium text-foreground" : "text-foreground-muted"}`}
                    numberOfLines={1}
                  >
                    {item.name}
                  </AppText>
                  <View className="h-1 w-14 overflow-hidden rounded-full bg-border">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${(item.bytes / largest) * 100}%`, backgroundColor: swatch }}
                    />
                  </View>
                  <AppText
                    className="w-14 text-right text-xs text-foreground-muted"
                    style={NUMBERS}
                  >
                    {diskBytes(item.bytes)}
                  </AppText>
                </View>
              </RowPressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** A plain row of the panel: words on the left, an action or a figure on the right. */
function PanelRow(props: {
  readonly title: string;
  readonly note?: string;
  readonly trailing?: ReactNode;
  readonly first?: boolean;
}) {
  return (
    <View
      className={`min-h-14 flex-row items-center gap-3 px-4 py-3 ${props.first === false ? "border-t border-border" : ""}`}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText textRole="body" className="text-foreground">
          {props.title}
        </AppText>
        {props.note ? (
          <AppText textRole="footnote" className="text-foreground-muted">
            {props.note}
          </AppText>
        ) : null}
      </View>
      {props.trailing}
    </View>
  );
}

/** Opening a drive to be looked inside, or closing it again: a choice kept on its machine. */
function useLookInside(
  environmentId: string,
  line: MachineLine | null,
  drive: Drive | null,
  onChanged: () => void,
) {
  const [changing, setChanging] = useState(false);
  if (line === null || drive === null) return null;
  return {
    changing,
    change: async (on: boolean) => {
      setChanging(true);
      const taken = await setLookInside(environmentId, line, drive.id, on);
      setChanging(false);
      if (taken) onChanged();
      else Dialog.alert(DRIVE_INSIDE.failed, "Try again in a moment.");
    },
  };
}

function measuredNote(reading: DriveReading, external: boolean, layout: FieldLayout | null) {
  const each = layout === null ? "" : `Each cell is about ${diskBytes(roundUnit(layout.unit))}. `;
  const { map } = reading;
  if (map === null) return each;
  const when = `Measured ${ago(map.measuredAt, Date.now())}${
    map.partial ? ", stopped at its limit: sizes are at least these" : ""
  }.`;
  return `${each}${when} ${
    external
      ? DRIVE_INSIDE.footnote
      : "Documents, Desktop, Downloads, iCloud Drive and other apps' private folders are never read."
  }`;
}

export function DrivePanel(props: {
  readonly machines: ReadonlyArray<PanelMachine>;
  readonly environmentId: string;
  readonly wanted: string;
  readonly onSelect: (environmentId: string, driveId: string) => void;
}) {
  const { machines, environmentId } = props;
  const machine = machines.find((each) => each.environmentId === environmentId);
  const machineName = machine?.label ?? "this machine";
  const { known, snapshot } = useMachineDrives(environmentId, machineName);
  // A drive unplugged while it's shown: back to the machine's startup drive.
  const drive =
    known.drives.find((each) => each.id === props.wanted) ??
    known.drives.find((each) => each.role === "startup") ??
    null;
  const driveId = drive?.id ?? (known.status === "known" ? STARTUP_DRIVE : props.wanted);
  const external = driveId !== STARTUP_DRIVE;
  const key = `${environmentId}/${driveId}`;
  const line = useMachineLine(environmentId);
  const { reading, failed, measureAgain } = useDriveReading(environmentId, driveId);
  const { colors, tones } = useFieldTheme();
  // Once the machine takes the choice, the drive it was made for is measured, if it still shows.
  const lookInsideChoice = useLookInside(environmentId, line, drive, () => measureAgain(key));
  const [width, setWidth] = useState(0);

  const volume =
    reading?.volume ??
    (drive !== null
      ? { total: drive.total, free: drive.free }
      : snapshot
        ? { total: snapshot.total, free: snapshot.free }
        : null);
  const warnBelow = useWarnBelow(
    environmentId,
    reading?.volume.warnBelow ?? known.warnBelow ?? snapshot?.warnBelow,
  );
  const map = reading?.map ?? null;
  const scanning = reading?.scanning ?? false;
  const counted = reading?.counted ?? 0;
  const denied = reading?.denied ?? false;
  const lookInside = drive?.lookInside ?? true;

  const [held, setHeld] = useState<{
    readonly key: string;
    readonly focus: FieldFocus | null;
    readonly preview: ReadonlyArray<FieldFinding> | null;
  } | null>(null);
  const focus = held?.key === key ? held.focus : null;
  const preview = held?.key === key ? held.preview : null;
  const setFocus = (next: FieldFocus | null) =>
    setHeld((last) => ({ key, focus: next, preview: last?.key === key ? last.preview : null }));
  const setPreview = (next: ReadonlyArray<FieldFinding> | null) =>
    setHeld({ key, focus: null, preview: next });

  const total = volume?.total ?? 0;
  const free = volume?.free ?? 0;
  const layout =
    total > 0 && width > 0
      ? fieldLayout(
          {
            total,
            bands: fieldBands({ total, free, scanning, counted, buckets: map?.buckets ?? null }),
          },
          { width, height: FIELD_HEIGHT },
        )
      : null;

  const where = drive === null ? machineName : drive.name;
  const name = `${where}${drive !== null && machines.length > 1 ? ` on ${machineName}` : ""}`;
  const systemNote = external
    ? map === null
      ? "Stemcells hasn't read what's on this drive."
      : "Everything else: loose files, hidden folders and the smaller folders."
    : "Not measured: the system, your own files in Documents, Desktop and Downloads, other apps' data.";
  const findings = map?.findings ?? [];
  const findingsTotal = findings.reduce((sum, finding) => sum + finding.bytes, 0);
  const previewing = (kind: string) =>
    preview !== null && preview.length === 1 && preview[0]?.kind === kind;
  const statusColor = (bytes: number) => rgbCss(tones[diskPressure(free + bytes, warnBelow)]);
  const ownDrives = known.status === "known" ? known.drives.length : 1;

  return (
    <>
      <View onLayout={({ nativeEvent }) => setWidth(Math.floor(nativeEvent.layout.width))}>
        {volume === null ? (
          <AppText textRole="footnote" className="text-foreground-muted">
            {failed ? "Couldn't read the disk" : "Reading the disk…"}
          </AppText>
        ) : (
          <DriveHero
            key={key}
            name={name}
            free={free}
            total={total}
            warnBelow={warnBelow}
            layout={layout}
            fieldHeight={FIELD_HEIGHT}
            systemNote={systemNote}
            focus={focus}
            preview={preview}
            onFocus={setFocus}
          />
        )}
      </View>

      {machines.length > 1 || ownDrives > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5"
          contentContainerClassName="gap-4 px-5"
        >
          {machines.map((each) => (
            <MachineTiles
              key={each.environmentId}
              machine={each}
              alone={machines.length === 1}
              selected={each.environmentId === environmentId ? driveId : null}
              onSelect={(nextMachine, nextDrive) => {
                // What was lit or previewed belongs to the visit, not the drive.
                setHeld(null);
                props.onSelect(nextMachine, nextDrive);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      {line === null ? (
        <AppText textRole="footnote" className="px-2 text-foreground-muted">
          {`Only free space shows for ${machineName}: the phone reaches it through the relay.`}
        </AppText>
      ) : null}

      {line !== null && drive !== null && external && (!lookInside || denied) ? (
        <SettingsSection title="What's on it">
          {!lookInside ? (
            <PanelRow
              title={DRIVE_INSIDE.closedTitle}
              note={DRIVE_INSIDE.closedNote}
              trailing={
                drive.canLookInside && lookInsideChoice !== null ? (
                  <Button
                    label={DRIVE_INSIDE.open}
                    tone="secondary"
                    loading={lookInsideChoice.changing}
                    onPress={() => void lookInsideChoice.change(true)}
                  />
                ) : null
              }
            />
          ) : (
            <PanelRow
              title={DRIVE_INSIDE.deniedTitle}
              note={DRIVE_INSIDE.denied(machineName)}
              trailing={
                <Button
                  label={DRIVE_INSIDE.again}
                  tone="secondary"
                  onPress={() => measureAgain()}
                />
              }
            />
          )}
        </SettingsSection>
      ) : null}

      {line !== null && lookInside && !denied ? (
        <SettingsSection
          title={external ? "What's on it" : "What's large"}
          trailing={
            scanning ? (
              <AppText textRole="footnote" className="px-2 text-foreground-muted" style={NUMBERS}>
                {counted > 0 ? `${diskBytes(counted)} counted` : "Measuring…"}
              </AppText>
            ) : map ? (
              <Button label="Measure again" tone="text" onPress={() => measureAgain()} />
            ) : null
          }
        >
          {map === null || layout === null ? (
            <PanelRow
              title={
                scanning ? "Measuring…" : failed ? "Couldn't measure the disk" : "Not measured yet"
              }
              note={
                external
                  ? DRIVE_INSIDE.footnote
                  : "Caches, developer data, package stores, apps, Cell data and your projects. Documents, Desktop, Downloads and other apps' private folders are never read."
              }
              trailing={
                scanning ? null : (
                  <Button label="Measure" tone="secondary" onPress={() => measureAgain()} />
                )
              }
            />
          ) : (
            layout.bands.map((band, index) =>
              band.kind === "free" ? null : (
                <BandRow
                  key={band.id}
                  layout={layout}
                  index={index}
                  colors={colors}
                  focus={focus}
                  onFocus={setFocus}
                  description={
                    band.kind === "system"
                      ? systemNote
                      : band.items
                          .slice(0, 3)
                          .map((item) => `${item.name} ${diskBytes(item.bytes)}`)
                          .join(" · ")
                  }
                />
              ),
            )
          )}
        </SettingsSection>
      ) : null}

      {!external && map !== null && findings.length > 0 ? (
        <SettingsSection
          title="What could come back"
          trailing={
            <Button
              label={`Up to ${diskBytes(findingsTotal)}`}
              tone="text"
              accessibilityHint="Shows on the drive what would come back"
              onPress={() => setPreview(preview?.length === findings.length ? null : findings)}
            />
          }
        >
          {findings.map((finding, index) => {
            const on = previewing(finding.kind);
            return (
              <View
                key={finding.kind}
                className={index === 0 ? undefined : "border-t border-border"}
              >
                <RowPressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPreview(on ? null : [finding])}
                  className="bg-grouped-card"
                >
                  <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">
                    <View className="min-w-0 flex-1 gap-0.5">
                      <AppText textRole="body" className="text-foreground">
                        {finding.title}
                        <AppText
                          textRole="footnote"
                          style={{
                            color: rgbCss(finding.risk === "low" ? tones.calm : tones.soon),
                          }}
                        >
                          {finding.risk === "low" ? "  Low risk" : "  Medium risk"}
                        </AppText>
                      </AppText>
                      <AppText
                        textRole="footnote"
                        className={on ? undefined : "text-foreground-muted"}
                        style={on ? { color: statusColor(finding.bytes) } : undefined}
                      >
                        {on
                          ? `Free space would reach ${diskBytes(free + finding.bytes)}.`
                          : finding.countLabel
                            ? `${finding.note} · ${finding.countLabel}`
                            : finding.note}
                      </AppText>
                    </View>
                    <AppText textRole="footnote" className="text-foreground" style={NUMBERS}>
                      {diskBytes(finding.bytes)}
                    </AppText>
                  </View>
                </RowPressable>
              </View>
            );
          })}
        </SettingsSection>
      ) : null}

      {reading !== null && lookInside ? (
        <AppText textRole="footnote" className="-mt-3 px-2 text-foreground-muted">
          {measuredNote(reading, external, layout)}
        </AppText>
      ) : null}

      {lookInsideChoice !== null && external && lookInside ? (
        <View className="-mt-2 items-start">
          <Button
            label={DRIVE_INSIDE.close}
            tone="text"
            loading={lookInsideChoice.changing}
            onPress={() => void lookInsideChoice.change(false)}
          />
        </View>
      ) : null}
    </>
  );
}
