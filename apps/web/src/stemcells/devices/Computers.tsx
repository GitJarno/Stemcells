import { useEffect, useState } from "react";

import { linkMachines, linksOf, type MachineLink, unlinkMachine } from "../peers/linking";
import {
  Button,
  formatRelativeTimeLabel,
  SettingsRow,
  Spinner,
  toastManager,
  useNowMinuteMs,
} from "../upstream/disk";
import { requestConfirmDialog, useComputers, useRemoveComputer } from "../upstream/devices";
import {
  type EnvironmentId,
  machineAddressOf,
  useOtherMachines,
  usePrimaryEnvironmentId,
  useMachineLabel,
  usePrimaryNetworkAddress,
} from "../upstream/machines";
import { Switch } from "../upstream/settings";

// Settings › Your devices, the computers (stemcells/tasks/devices.md): the ones this app reaches, the
// way to forget each, and whether this one's Cells and theirs see each other
// (stemcells/tasks/peers.md, "Across environments"). A link is made here, both ways in one
// action; ended here or from the other computer, it ends on both.

/** How often the links are read again while the page shows: when each computer last answered. */
const READ_EVERY_MS = 30_000;

type Kind = "stemcells" | "not-stemcells" | "unknown";

/** This computer's links as the page shows them; null while they can't be read. */
const shownLinks = async (environmentId: EnvironmentId) => {
  const read = await linksOf(environmentId);
  return read === "not-stemcells" ? [] : read;
};

/** What a link says of the two computers' Cells. */
function cellsOf(link: MachineLink | undefined, nowMs: number): string {
  if (link === undefined) return "Cells apart";
  if (!link.linked)
    return link.problem === "it ended the link"
      ? "Cells apart: it ended the link"
      : "Cells see each other one way only";
  if (link.problem !== null) return `Cells see each other · not answering: ${link.problem}`;
  const atWork =
    link.cells === 0
      ? "none at work in your repositories"
      : `${link.cells} at work in your repositories`;
  return link.seenAt === null
    ? `Cells see each other · ${atWork}`
    : `Cells see each other · ${atWork} · seen ${formatRelativeTimeLabel(new Date(link.seenAt).toISOString(), nowMs)}`;
}

/**
 * The computers' rows of Settings › Your devices. `alone` says the page has no
 * other device to show, so with no computer either, this says what Add does.
 */
export function ComputerRows({ alone }: { readonly alone: boolean }) {
  const primaryId = usePrimaryEnvironmentId();
  const computers = useComputers();
  const others = useOtherMachines();
  const removeComputer = useRemoveComputer();
  const hereOnNetwork = usePrimaryNetworkAddress();
  // What the other computer's Cells will call this one.
  const hereLabel = useMachineLabel(primaryId) ?? "This app's computer";
  const nowMs = useNowMinuteMs();
  const [links, setLinks] = useState<ReadonlyArray<MachineLink> | null>(null);
  const [kinds, setKinds] = useState<Readonly<Record<string, Kind>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const othersKey = others.map((other) => other.environmentId).join(" ");

  // oxlint-disable-next-line t3code/react-effect-budget -- Poll this computer's links; stop the timer on unmount.
  useEffect(() => {
    if (primaryId === null) return;
    let live = true;
    const read = () =>
      void shownLinks(primaryId).then((next) => {
        if (live) setLinks(next);
      });
    read();
    const timer = setInterval(read, READ_EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [primaryId]);

  // oxlint-disable-next-line t3code/react-effect-budget -- Ask each other computer if it runs Stemcells; drop stale answers.
  useEffect(() => {
    let live = true;
    for (const environmentId of othersKey.split(" ").filter(Boolean)) {
      void linksOf(environmentId as EnvironmentId).then((read) => {
        const kind: Kind =
          read === "not-stemcells" ? "not-stemcells" : read === null ? "unknown" : "stemcells";
        if (live) setKinds((known) => ({ ...known, [environmentId]: kind }));
      });
    }
    return () => {
      live = false;
    };
  }, [othersKey]);

  const setCellsLinked = async (environmentId: string, label: string, linked: boolean) => {
    if (primaryId === null) return;
    setBusy(environmentId);
    const problem = linked
      ? await linkMachines(
          { environmentId: primaryId, label: hereLabel },
          { environmentId: environmentId as EnvironmentId, label },
          hereOnNetwork,
        )
      : await unlinkMachine(primaryId, environmentId);
    setBusy(null);
    setLinks(await shownLinks(primaryId));
    if (problem !== null)
      toastManager.add({
        type: "error",
        title: linked ? `Couldn't link Cells with ${label}` : `Couldn't unlink ${label}'s Cells`,
        description: problem,
      });
  };

  const forget = async (environmentId: EnvironmentId, label: string) => {
    const confirmed = await requestConfirmDialog(
      `Remove ${label} from this device?\nThis forgets its pairing and cached threads here. To reach it again, pair it again.`,
      { variant: "destructive" },
    );
    if (confirmed !== true) return;
    setBusy(environmentId);
    const problem = await removeComputer(environmentId);
    setBusy(null);
    if (problem !== null)
      toastManager.add({ type: "error", title: `Couldn't remove ${label}`, description: problem });
  };

  const cellsSwitch = (environmentId: string, label: string, linked: boolean) => (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      Cells
      <Switch
        size="sm"
        checked={linked}
        disabled={busy !== null || links === null}
        onCheckedChange={(checked) => void setCellsLinked(environmentId, label, checked)}
        aria-label={`Cells on this computer and ${label} see each other`}
      />
    </label>
  );

  const connected = new Set(others.map((other) => other.environmentId as string));
  const saved = new Set(computers.map((computer) => computer.environmentId as string));
  const elsewhere = (links ?? []).filter((link) => !saved.has(link.environmentId));

  return (
    <>
      {alone && computers.length === 0 && elsewhere.length === 0 ? (
        <SettingsRow
          title="No other device yet"
          description="Choose Add to pair your phone, or to reach another computer from here."
        />
      ) : null}
      {computers.map(({ environmentId, label }) => {
        const link = links?.find((one) => one.environmentId === environmentId);
        const isConnected = connected.has(environmentId);
        const address = machineAddressOf(environmentId);
        const kind = kinds[environmentId] ?? "unknown";
        const cells =
          !isConnected || link !== undefined
            ? cellsOf(link, nowMs)
            : !("url" in address)
              ? `Cells can't see each other: ${address.reason}`
              : kind === "not-stemcells"
                ? "Doesn't run Stemcells"
                : cellsOf(link, nowMs);
        const linkable =
          link !== undefined || (isConnected && "url" in address && kind !== "not-stemcells");
        return (
          <SettingsRow
            key={environmentId}
            title={label}
            description={["Computer", isConnected ? "online" : "not connected", cells].join(" · ")}
            control={
              busy === environmentId ? (
                <Spinner size="xs" />
              ) : (
                <div className="flex items-center gap-3">
                  {linkable ? cellsSwitch(environmentId, label, link?.linked === true) : null}
                  <Button
                    size="xs"
                    variant="destructive-outline"
                    disabled={busy !== null}
                    onClick={() => void forget(environmentId, label)}
                  >
                    Remove
                  </Button>
                </div>
              )
            }
          />
        );
      })}
      {elsewhere.map((link) => (
        <SettingsRow
          key={link.environmentId}
          title={link.label}
          description={`Computer · not on this device · ${cellsOf(link, nowMs)}`}
          control={
            busy === link.environmentId ? (
              <Spinner size="xs" />
            ) : (
              // Turning it off ends the link; this device can't make one with a computer it doesn't reach.
              cellsSwitch(link.environmentId, link.label, true)
            )
          }
        />
      ))}
    </>
  );
}
