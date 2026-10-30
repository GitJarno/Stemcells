import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  Badge,
  Button,
  formatRelativeTimeLabel,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
  sendToPrimary,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  Spinner,
  toastManager,
  useMachineDisk,
  useOpenDiskCell,
  useOtherMachines,
  usePrimaryEnvironmentId,
  useNowMinuteMs,
  type EnvironmentId,
} from "../upstream/disk";
import {
  CLEANUP_PROMISE,
  DISK_NOTICE,
  DISK_WARN,
  diskBytes,
} from "../../../../../stemcells/words/disk.ts";
import { openCleanupCell } from "./cleanupCell";
import { useDiskReading, type DiskReading } from "./diskReading";
import { diskPressure, type DiskPressure, SOON_BELOW, WARN_CHOICES } from "./pressure";

// Settings › Disk: how full each machine's disk is, what is large on this one, and a Cell to
// free space with. The app deletes nothing itself: "Free space" opens a new Cell in that
// machine's Disk project with the ask in its composer, for the person to send; the Cell
// reads that machine's measurement itself.

const GAUGE_TONE: Readonly<Record<DiskPressure, string>> = {
  calm: "bg-primary",
  soon: "bg-warning",
  now: "bg-destructive",
};

function DiskGauge({
  volume,
}: {
  readonly volume: Pick<DiskReading["volume"], "free" | "total" | "warnBelow">;
}) {
  const used = Math.max(0, volume.total - volume.free);
  const share = volume.total > 0 ? Math.min(1, used / volume.total) : 0;
  const tone = GAUGE_TONE[diskPressure(volume.free, volume.warnBelow)];
  return (
    <div className="space-y-1.5 pb-3">
      <div
        role="meter"
        aria-label="Disk used"
        aria-valuemin={0}
        aria-valuemax={volume.total}
        aria-valuenow={used}
        aria-valuetext={`${diskBytes(used)} used of ${diskBytes(volume.total)}`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${share * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{diskBytes(used)} used</span>
        <span>{diskBytes(volume.free)} free</span>
      </div>
    </div>
  );
}

const Size = ({ bytes }: { readonly bytes: number }) => (
  <span className="text-sm text-foreground tabular-nums">{diskBytes(bytes)}</span>
);

function FreeSpaceButton({ openCell }: { readonly openCell: ReturnType<typeof useOpenDiskCell> }) {
  const [opening, setOpening] = useState(false);
  const freeSpace = async () => {
    if (openCell === null) return;
    setOpening(true);
    await openCleanupCell(openCell).finally(() => setOpening(false));
  };
  return (
    <Button size="sm" disabled={openCell === null || opening} onClick={() => void freeSpace()}>
      {opening ? <Spinner /> : null}
      Free space
    </Button>
  );
}

/** How little free space warns about this machine: kept on its server, which the phone reads too. */
function WarnRow(props: {
  readonly warnBelow: number;
  readonly onChosen: (warnBelow: number) => void;
}) {
  const choose = async (next: number) => {
    props.onChosen(next);
    const answer = await sendToPrimary("POST", "/api/stemcells/disk/warn", {
      warnBelow: next,
    }).catch(() => null);
    if (answer?.ok) return;
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
function NoticeRow(props: { readonly onShown: () => void }) {
  const [showing, setShowing] = useState(false);
  const show = async () => {
    setShowing(true);
    const answer = await sendToPrimary("POST", "/api/stemcells/disk/notice", {
      hiddenAt: null,
    }).catch(() => null);
    setShowing(false);
    if (answer?.ok) props.onShown();
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

/** Another machine's free space, and a Cell there to free some. */
function OtherMachineRow({
  environmentId,
  label,
}: {
  readonly environmentId: EnvironmentId;
  readonly label: string;
}) {
  const disk = useMachineDisk(environmentId);
  const openCell = useOpenDiskCell(environmentId);
  const space =
    disk === undefined
      ? "Reading the disk…"
      : disk === null
        ? "Free space unknown"
        : `${diskBytes(disk.free)} free of ${diskBytes(disk.total)}`;
  return (
    <SettingsRow
      title={label}
      description={openCell ? space : `${space} · It can't start a Cell to free space.`}
      control={<FreeSpaceButton openCell={openCell} />}
    >
      {disk ? <DiskGauge volume={disk} /> : null}
    </SettingsRow>
  );
}

export function DiskSettingsPanel() {
  const { reading, failed, measureAgain } = useDiskReading();
  const openCell = useOpenDiskCell(usePrimaryEnvironmentId());
  const otherMachines = useOtherMachines();
  const nowMs = useNowMinuteMs();
  const map = reading?.map ?? null;
  const scanning = reading?.scanning ?? false;
  // The choice stands from the moment it's made; the next reading carries it.
  const [chosen, setChosen] = useState<number | null>(null);
  const warnBelow = chosen ?? reading?.volume.warnBelow ?? SOON_BELOW;
  // A hide shown again stays shown here; a later hide is at another figure.
  const [shownAgain, setShownAgain] = useState<number | null>(null);
  const hiddenAt = reading?.volume.hiddenAt;

  return (
    <SettingsPageContainer>
      <SettingsSection id="disk-free" title="Free space">
        <SettingsRow
          title={
            reading
              ? `${diskBytes(reading.volume.free)} free of ${diskBytes(reading.volume.total)}`
              : failed
                ? "Couldn't read the disk"
                : "Reading the disk…"
          }
          description={
            openCell ? CLEANUP_PROMISE : "This machine can't start a Cell to free space."
          }
          control={<FreeSpaceButton openCell={openCell} />}
        >
          {reading ? <DiskGauge volume={{ ...reading.volume, warnBelow }} /> : null}
        </SettingsRow>
        <WarnRow warnBelow={warnBelow} onChosen={setChosen} />
        {hiddenAt === undefined || hiddenAt === shownAgain ? null : (
          <NoticeRow onShown={() => setShownAgain(hiddenAt)} />
        )}
      </SettingsSection>

      {otherMachines.length > 0 ? (
        <SettingsSection id="disk-other-machines" title="Other machines">
          {otherMachines.map((machine) => (
            <OtherMachineRow
              key={machine.environmentId}
              environmentId={machine.environmentId}
              label={machine.label}
            />
          ))}
        </SettingsSection>
      ) : null}

      <SettingsSection
        id="disk-large"
        title="What's large"
        headerAction={
          scanning ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <Spinner size="xs" />
              {reading && reading.counted > 0
                ? `${diskBytes(reading.counted)} counted`
                : "Measuring"}
            </span>
          ) : map ? (
            <Button size="xs" variant="ghost" onClick={measureAgain}>
              Measure again
            </Button>
          ) : null
        }
      >
        {map === null ? (
          <SettingsRow
            title={
              scanning ? "Measuring…" : failed ? "Couldn't measure the disk" : "Not measured yet"
            }
            description="Caches, developer data, package stores, apps, Cell data and your projects. Documents, Desktop, Downloads and other apps' private folders are never read."
            control={
              scanning ? null : (
                <Button size="xs" variant="outline" onClick={measureAgain}>
                  Measure
                </Button>
              )
            }
          />
        ) : (
          map.buckets
            .filter((bucket) => bucket.kind !== "free")
            .map((bucket) => (
              <SettingsRow
                key={bucket.kind}
                title={bucket.title}
                description={
                  bucket.kind === "system"
                    ? "Not measured: the system, your own files in Documents, Desktop and Downloads, other apps' data."
                    : bucket.items
                        .slice(0, 3)
                        .map((item) => `${item.name} ${diskBytes(item.bytes)}`)
                        .join(" · ")
                }
                control={<Size bytes={bucket.bytes} />}
              />
            ))
        )}
      </SettingsSection>

      {map !== null && map.findings.length > 0 ? (
        <SettingsSection id="disk-worth-a-look" title="Worth a look">
          {map.findings.map((finding) => (
            <SettingsRow
              key={finding.kind}
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
        </SettingsSection>
      ) : null}

      {map !== null ? (
        <p className="px-3 text-xs text-muted-foreground sm:px-4">
          Measured {formatRelativeTimeLabel(new Date(map.measuredAt).toISOString(), nowMs)}
          {map.partial ? ", stopped at its limit: sizes are at least these" : ""}. Documents,
          Desktop, Downloads, iCloud Drive and other apps' private folders are never read.
        </p>
      ) : null}
    </SettingsPageContainer>
  );
}
