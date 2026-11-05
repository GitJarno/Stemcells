import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  formatRelativeTimeLabel,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  Spinner,
  toastManager,
  observeResize,
  useDiskMachines,
  useMachineDisk,
  useNowMinuteMs,
  useOpenDiskCell,
  usePrimaryEnvironmentId,
  type EnvironmentId,
} from "../upstream/disk";
import {
  CLEANUP_PROMISE,
  DISK_NOTICE,
  DISK_WARN,
  DRIVE_INSIDE,
  diskBytes,
} from "../../../../../stemcells/words/disk.ts";
import { openCleanupCell } from "./cleanupCell";
import { chooseOnMachine, setLookInside, useDriveReading, useDrives } from "./diskReading";
import { DriveHero, useFieldTheme } from "./DriveHero";
import { DriveShelf } from "./DriveShelf";
import { fieldBands, fieldLayout, roundUnit, type FieldFinding, type FieldLayout } from "./field";
import { bandColor, rgbCss, type FieldColors } from "./fieldColors";
import type { FieldFocus } from "./fieldMotion";
import { SOON_BELOW, WARN_CHOICES } from "./pressure";
import { type Drive, type DriveReading, STARTUP_DRIVE } from "./wire";

// Settings › Disk: any drive of any connected machine, one at a time, in the same page. The app
// deletes nothing itself: "Free space" opens a new Cell in that machine's Disk project with the ask
// in its composer, for the person to send; the Cell reads that machine's measurement itself.

const FIELD_HEIGHT = 172;

const Size = ({ bytes }: { readonly bytes: number }) => (
  <span className="text-sm text-foreground tabular-nums">{diskBytes(bytes)}</span>
);

function FreeSpaceButton(props: {
  readonly openCell: ReturnType<typeof useOpenDiskCell>;
  readonly onPreview?: (showing: boolean) => void;
}) {
  const { openCell, onPreview } = props;
  const [opening, setOpening] = useState(false);
  const freeSpace = async () => {
    if (openCell === null) return;
    setOpening(true);
    await openCleanupCell(openCell).finally(() => setOpening(false));
  };
  return (
    <Button
      size="sm"
      disabled={openCell === null || opening}
      onClick={() => void freeSpace()}
      onPointerEnter={() => onPreview?.(true)}
      onPointerLeave={() => onPreview?.(false)}
      onFocus={() => onPreview?.(true)}
      onBlur={() => onPreview?.(false)}
    >
      {opening ? <Spinner /> : null}
      Free space
    </Button>
  );
}

/** How little free space warns about this machine: kept on its server, which the phone reads too. */
function WarnRow(props: {
  readonly environmentId: EnvironmentId;
  readonly warnBelow: number;
  readonly onChosen: (warnBelow: number) => void;
}) {
  const choose = async (next: number) => {
    props.onChosen(next);
    if (await chooseOnMachine(props.environmentId, "warn", { warnBelow: next })) return;
    props.onChosen(props.warnBelow);
    toastManager.add({ type: "error", title: DISK_WARN.failed });
  };
  return (
    <SettingsRow
      title={<label htmlFor="disk-warn-select">{DISK_WARN.title}</label>}
      description={DISK_WARN.note}
      control={
        <Select
          value={String(props.warnBelow)}
          onValueChange={(next) => {
            if (typeof next === "string" && Number(next) !== props.warnBelow)
              void choose(Number(next));
          }}
        >
          <SelectTrigger
            id="disk-warn-select"
            size="sm"
            className="w-28"
            aria-label={DISK_WARN.label}
          >
            <SelectValue>{diskBytes(props.warnBelow)}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {WARN_CHOICES.map((choice) => (
              <SelectItem key={choice} value={String(choice)}>
                {diskBytes(choice)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}

/** While the phone's notice for this machine is swiped away: the way to show it again. */
function NoticeRow(props: { readonly environmentId: EnvironmentId; readonly onShown: () => void }) {
  const [showing, setShowing] = useState(false);
  const show = async () => {
    setShowing(true);
    const taken = await chooseOnMachine(props.environmentId, "notice", { hiddenAt: null });
    setShowing(false);
    if (taken) props.onShown();
    else toastManager.add({ type: "error", title: DISK_NOTICE.showFailed });
  };
  return (
    <SettingsRow
      title={DISK_NOTICE.hidden}
      description={`${DISK_NOTICE.until}.`}
      control={
        <Button size="sm" variant="outline" disabled={showing} onClick={() => void show()}>
          {DISK_NOTICE.showAgain}
        </Button>
      }
    />
  );
}

const Swatch = ({ color }: { readonly color: string }) => (
  <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />
);

/** One band of the field, in words: hovering lights its cells, and it opens to what's in it. */
function BandRow(props: {
  readonly layout: FieldLayout;
  readonly index: number;
  readonly colors: FieldColors;
  readonly description: string;
  readonly focus: FieldFocus | null;
  readonly onFocus: (focus: FieldFocus | null) => void;
}) {
  const { layout, index, colors, onFocus } = props;
  const band = layout.bands[index];
  const [open, setOpen] = useState(false);
  if (band === undefined) return null;
  const opens = band.items.length > 0;
  const toggle = () => {
    if (opens) setOpen((was) => !was);
  };
  const largest = band.items[0]?.bytes ?? 1;
  const swatch = rgbCss(band.kind === "system" ? colors.counting : bandColor(colors, band));
  return (
    <SettingsRow
      tabIndex={0}
      role={opens ? "button" : undefined}
      aria-expanded={opens ? open : undefined}
      className={opens ? "cursor-pointer" : undefined}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      }}
      onPointerEnter={() => onFocus({ band: index, item: null })}
      onPointerLeave={() => onFocus(null)}
      onFocus={() => onFocus({ band: index, item: null })}
      onBlur={() => onFocus(null)}
      title={
        <span className="flex items-center gap-2">
          <Swatch color={swatch} />
          {band.title}
          {opens ? (
            <ChevronRightIcon
              aria-hidden
              className={`size-3.5 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            />
          ) : null}
        </span>
      }
      description={props.description}
      control={<Size bytes={band.bytes} />}
    >
      {open ? (
        <ul className="space-y-1 pb-3 pl-4.5">
          {band.items.map((item, itemIndex) => (
            <li
              key={item.path ?? item.name}
              className="grid grid-cols-[minmax(0,1fr)_72px_56px] items-center gap-3 text-xs text-muted-foreground tabular-nums"
              onPointerEnter={() => onFocus({ band: index, item: itemIndex })}
              onPointerLeave={() => onFocus({ band: index, item: null })}
            >
              <span className="truncate text-foreground/80">{item.name}</span>
              <span className="h-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(item.bytes / largest) * 100}%`, background: swatch }}
                />
              </span>
              <span className="text-right">{diskBytes(item.bytes)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </SettingsRow>
  );
}

/** A drive besides the startup one: closed until the person opens it, and they can close it again. */
function InsideRows(props: {
  readonly environmentId: EnvironmentId;
  readonly drive: Drive;
  readonly machine: string;
  readonly denied: boolean;
  readonly onChanged: () => void;
}) {
  const { environmentId, drive, machine, denied, onChanged } = props;
  const [changing, setChanging] = useState(false);
  const change = async (on: boolean) => {
    setChanging(true);
    const taken = await setLookInside(environmentId, drive.id, on);
    setChanging(false);
    if (taken) onChanged();
    else toastManager.add({ type: "error", title: DRIVE_INSIDE.failed });
  };
  if (!drive.lookInside) {
    return (
      <SettingsRow
        title={DRIVE_INSIDE.closedTitle}
        description={DRIVE_INSIDE.closedNote}
        control={
          drive.canLookInside ? (
            <Button
              size="sm"
              variant="outline"
              disabled={changing}
              onClick={() => void change(true)}
            >
              {DRIVE_INSIDE.open}
            </Button>
          ) : null
        }
      />
    );
  }
  if (!denied) return null;
  return (
    <SettingsRow
      title={DRIVE_INSIDE.deniedTitle}
      description={DRIVE_INSIDE.denied(machine)}
      control={
        <Button size="sm" variant="outline" onClick={onChanged}>
          {DRIVE_INSIDE.again}
        </Button>
      }
    />
  );
}

const measuredNote = (
  reading: DriveReading,
  external: boolean,
  nowMs: number,
  layout: FieldLayout | null,
) => {
  const each = layout === null ? "" : `Each cell is about ${diskBytes(roundUnit(layout.unit))}. `;
  const { map } = reading;
  if (map === null) return each;
  const when = `Measured ${formatRelativeTimeLabel(new Date(map.measuredAt).toISOString(), nowMs)}${
    map.partial ? ", stopped at its limit: sizes are at least these" : ""
  }.`;
  return `${each}${when} ${
    external
      ? DRIVE_INSIDE.footnote
      : "Documents, Desktop, Downloads, iCloud Drive and other apps' private folders are never read."
  }`;
};

export function DiskSettingsPanel() {
  const machines = useDiskMachines();
  const primaryId = usePrimaryEnvironmentId();
  const [picked, setPicked] = useState<{
    readonly environmentId: EnvironmentId;
    readonly driveId: string;
  } | null>(null);
  const pickedMachine = machines.find(
    (machine) => machine.connected && machine.environmentId === picked?.environmentId,
  );
  const environmentId =
    pickedMachine?.environmentId ?? primaryId ?? machines[0]?.environmentId ?? null;
  const machine = machines.find((each) => each.environmentId === environmentId);
  const known = useDrives(environmentId);
  const wanted = pickedMachine !== undefined ? (picked?.driveId ?? STARTUP_DRIVE) : STARTUP_DRIVE;
  // A drive unplugged while it's shown: back to the machine's startup drive.
  const drive =
    known.drives.find((each) => each.id === wanted) ??
    known.drives.find((each) => each.role === "startup") ??
    null;
  const driveId = drive?.id ?? (known.status === "known" ? STARTUP_DRIVE : wanted);
  const external = driveId !== STARTUP_DRIVE;
  const key = `${environmentId}/${driveId}`;

  const { reading, failed, measureAgain } = useDriveReading(environmentId, driveId);
  const snapshot = useMachineDisk(known.status === "known" ? null : environmentId);
  const openCell = useOpenDiskCell(environmentId);
  const nowMs = useNowMinuteMs();
  const { colors } = useFieldTheme();

  const volume =
    reading?.volume ??
    (drive !== null
      ? { total: drive.total, free: drive.free }
      : snapshot
        ? { total: snapshot.total, free: snapshot.free }
        : null);
  const map = reading?.map ?? null;
  const scanning = reading?.scanning ?? false;
  const denied = reading?.denied ?? false;
  const lookInside = drive?.lookInside ?? true;

  // Each choice stands from the moment it's made; the next reading carries it.
  const [chosen, setChosen] = useState<{ readonly key: string; readonly warnBelow: number } | null>(
    null,
  );
  const warnBelow =
    (chosen?.key === environmentId ? chosen.warnBelow : undefined) ??
    reading?.volume.warnBelow ??
    known.warnBelow ??
    snapshot?.warnBelow ??
    SOON_BELOW;
  const [shownAgain, setShownAgain] = useState<number | null>(null);
  const hiddenAt = reading?.volume.hiddenAt;

  const [held, setHeld] = useState<{
    readonly key: string;
    readonly focus: FieldFocus | null;
    readonly preview: ReadonlyArray<FieldFinding> | null;
  } | null>(null);
  const focus = held?.key === key ? held.focus : null;
  const preview = held?.key === key ? held.preview : null;
  const setFocus = (next: FieldFocus | null) =>
    setHeld((last) => ({
      key,
      focus: next,
      preview: last?.key === key ? last.preview : null,
    }));
  const setPreview = (next: ReadonlyArray<FieldFinding> | null) =>
    setHeld({ key, focus: null, preview: next });

  const fieldBox = useRef<HTMLDivElement>(null);
  const [fieldWidth, setFieldWidth] = useState(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Follows the page's width, which React doesn't know, from mount to unmount.
  useEffect(() => {
    const element = fieldBox.current;
    if (element === null) return undefined;
    return observeResize(element, () => setFieldWidth(element.clientWidth));
  }, []);

  const total = volume?.total ?? 0;
  const free = volume?.free ?? 0;
  const counted = reading?.counted ?? 0;
  const buckets = map?.buckets ?? null;
  const layout =
    total > 0 && fieldWidth > 0
      ? fieldLayout(
          { total, bands: fieldBands({ total, free, scanning, counted, buckets }) },
          { width: fieldWidth, height: FIELD_HEIGHT },
        )
      : null;

  const multipleMachines = machines.length > 1;
  const machineName = machine?.label ?? "this machine";
  const where = drive === null ? machineName : drive.name;
  const name = `${where}${drive !== null && multipleMachines ? ` on ${machineName}` : ""}${
    drive?.detail ? ` · ${drive.detail}` : ""
  }`;
  const systemNote = external
    ? map === null
      ? "Stemcells hasn't read what's on this drive."
      : "Everything else: loose files, hidden folders and the smaller folders."
    : "Not measured: the system, your own files in Documents, Desktop and Downloads, other apps' data.";
  const findings = map?.findings ?? [];
  const findingsTotal = findings.reduce((sum, finding) => sum + finding.bytes, 0);

  return (
    <SettingsPageContainer>
      <div ref={fieldBox}>
        {volume === null ? (
          <p className="text-sm text-muted-foreground">
            {failed ? "Couldn't read the disk" : "Reading the disk…"}
          </p>
        ) : (
          <DriveHero
            key={key}
            name={name}
            free={free}
            total={total}
            warnBelow={warnBelow}
            layout={layout}
            systemNote={systemNote}
            focus={focus}
            preview={preview}
            onFocus={setFocus}
            fieldMinHeight={FIELD_HEIGHT}
            action={
              external ? null : (
                <FreeSpaceButton
                  openCell={openCell}
                  onPreview={(showing) =>
                    setPreview(showing && findings.length > 0 ? findings : null)
                  }
                />
              )
            }
          />
        )}
      </div>

      <DriveShelf
        environmentId={environmentId}
        driveId={driveId}
        onSelect={(nextMachine, nextDrive) => {
          // What was lit or previewed belongs to the visit, not the drive.
          setHeld(null);
          setPicked({ environmentId: nextMachine, driveId: nextDrive });
        }}
      />

      {environmentId !== null && drive !== null && external && (!lookInside || denied) ? (
        <SettingsSection id="disk-inside" title="What's on it">
          <InsideRows
            environmentId={environmentId}
            drive={drive}
            machine={machineName}
            denied={denied}
            onChanged={() => measureAgain()}
          />
        </SettingsSection>
      ) : null}

      {lookInside && !denied ? (
        <SettingsSection
          id="disk-large"
          title={external ? "What's on it" : "What's large"}
          headerAction={
            scanning ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <Spinner size="xs" />
                {counted > 0 ? `${diskBytes(counted)} counted` : "Measuring"}
              </span>
            ) : map ? (
              <Button size="xs" variant="ghost" onClick={measureAgain}>
                Measure again
              </Button>
            ) : null
          }
        >
          {map === null || layout === null ? (
            <SettingsRow
              title={
                scanning ? "Measuring…" : failed ? "Couldn't measure the disk" : "Not measured yet"
              }
              description={
                external
                  ? DRIVE_INSIDE.footnote
                  : "Caches, developer data, package stores, apps, Cell data and your projects. Documents, Desktop, Downloads and other apps' private folders are never read."
              }
              control={
                scanning ? null : (
                  <Button size="xs" variant="outline" onClick={measureAgain}>
                    Measure
                  </Button>
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
          id="disk-worth-a-look"
          title="What could come back"
          headerAction={
            <span className="text-xs text-muted-foreground tabular-nums">
              Up to {diskBytes(findingsTotal)}
            </span>
          }
        >
          {findings.map((finding) => (
            <SettingsRow
              key={finding.kind}
              tabIndex={0}
              onPointerEnter={() => setPreview([finding])}
              onPointerLeave={() => setPreview(null)}
              onFocus={() => setPreview([finding])}
              onBlur={() => setPreview(null)}
              title={
                <span className="flex items-center gap-1.5">
                  {finding.title}
                  <Badge size="sm" variant={finding.risk === "low" ? "success" : "warning"}>
                    {finding.risk === "low" ? "Low risk" : "Medium risk"}
                  </Badge>
                </span>
              }
              description={
                <>
                  {finding.countLabel ? `${finding.note} · ${finding.countLabel}` : finding.note}
                  {finding.kind === "worktrees" ? (
                    <>
                      {" · "}
                      <Link to="/settings/worktrees" className="underline underline-offset-2">
                        Worktree cleanup
                      </Link>
                    </>
                  ) : null}
                </>
              }
              control={<Size bytes={finding.bytes} />}
            />
          ))}
          <SettingsRow
            title="Free space"
            description={
              openCell ? CLEANUP_PROMISE : `${machineName} can't start a Cell to free space.`
            }
          />
        </SettingsSection>
      ) : null}

      {environmentId !== null ? (
        <SettingsSection id="disk-warn" title="Warnings">
          <WarnRow
            environmentId={environmentId}
            warnBelow={warnBelow}
            onChosen={(next) => setChosen({ key: environmentId, warnBelow: next })}
          />
          {hiddenAt === undefined || hiddenAt === shownAgain ? null : (
            <NoticeRow environmentId={environmentId} onShown={() => setShownAgain(hiddenAt)} />
          )}
        </SettingsSection>
      ) : null}

      {reading !== null && lookInside ? (
        <p className="px-3 text-xs text-muted-foreground sm:px-4">
          {measuredNote(reading, external, nowMs, layout)}
        </p>
      ) : null}

      {environmentId !== null && drive !== null && external && lookInside ? (
        <CloseDrive environmentId={environmentId} drive={drive} onChanged={() => measureAgain()} />
      ) : null}
    </SettingsPageContainer>
  );
}

/** The way back out of looking inside a drive. */
function CloseDrive(props: {
  readonly environmentId: EnvironmentId;
  readonly drive: Drive;
  readonly onChanged: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const close = async () => {
    setClosing(true);
    const taken = await setLookInside(props.environmentId, props.drive.id, false);
    setClosing(false);
    if (taken) props.onChanged();
    else toastManager.add({ type: "error", title: DRIVE_INSIDE.failed });
  };
  return (
    <div className="px-3 sm:px-4">
      <Button size="xs" variant="ghost" disabled={closing} onClick={() => void close()}>
        {DRIVE_INSIDE.close}
      </Button>
    </div>
  );
}
