import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  Badge,
  Button,
  formatRelativeTimeLabel,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  Spinner,
  toastManager,
  useOpenCellWithDraft,
  useRelativeTimeTick,
} from "../upstream/disk";
import { diskBytes, readCleanupDraft, useDiskReading, type DiskReading } from "./diskReading";
import { diskPressure, type DiskPressure } from "./pressure";

// Settings › Disk: how full the disk is, what is large, and a Cell to free
// space with. The app deletes nothing itself: "Free space" opens a new Cell
// with the measurement in its composer, for the person to send.

const GAUGE_TONE: Readonly<Record<DiskPressure, string>> = {
  calm: "bg-primary",
  soon: "bg-warning",
  now: "bg-destructive",
};

function DiskGauge({ volume }: { readonly volume: DiskReading["volume"] }) {
  const share = volume.total > 0 ? Math.min(1, volume.used / volume.total) : 0;
  const tone = GAUGE_TONE[diskPressure(volume.free)];
  return (
    <div className="space-y-1.5 pb-3">
      <div
        role="meter"
        aria-label="Disk used"
        aria-valuemin={0}
        aria-valuemax={volume.total}
        aria-valuenow={volume.used}
        aria-valuetext={`${diskBytes(volume.used)} used of ${diskBytes(volume.total)}`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${share * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{diskBytes(volume.used)} used</span>
        <span>{diskBytes(volume.free)} free</span>
      </div>
    </div>
  );
}

const Size = ({ bytes }: { readonly bytes: number }) => (
  <span className="text-sm text-foreground tabular-nums">{diskBytes(bytes)}</span>
);

/** Opens the cleanup Cell with its draft, or says it couldn't. */
async function openCleanupCell(
  openCell: NonNullable<ReturnType<typeof useOpenCellWithDraft>>,
): Promise<void> {
  try {
    if (!(await openCell(await readCleanupDraft()))) throw new Error("No Cell opened");
  } catch {
    toastManager.add({
      type: "error",
      title: "Couldn't start a Cell",
      description: "Try Free space again in a moment.",
    });
  }
}

function FreeSpaceButton({
  openCell,
}: {
  readonly openCell: ReturnType<typeof useOpenCellWithDraft>;
}) {
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

export function DiskSettingsPanel() {
  const { reading, failed, measureAgain } = useDiskReading();
  const openCell = useOpenCellWithDraft();
  const nowMs = useRelativeTimeTick(30_000);
  const map = reading?.map ?? null;
  const scanning = reading?.scanning ?? false;

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
            openCell
              ? "A Cell looks for what can go safely, shows you, and removes only what you approve."
              : "Add a project to start a Cell that frees space."
          }
          control={<FreeSpaceButton openCell={openCell} />}
        >
          {reading ? <DiskGauge volume={reading.volume} /> : null}
        </SettingsRow>
      </SettingsSection>

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
                  <Badge size="sm" variant={finding.grade === "Safe" ? "success" : "warning"}>
                    {finding.grade}
                  </Badge>
                </span>
              }
              description={
                <>
                  {finding.countLabel ? `${finding.note} · ${finding.countLabel}` : finding.note}
                  {finding.kind === "worktrees" ? (
                    <>
                      {" · "}
                      <Link to="/settings/storage" className="underline underline-offset-2">
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
