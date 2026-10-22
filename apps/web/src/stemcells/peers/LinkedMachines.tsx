import { useEffect, useState } from "react";

import {
  Button,
  formatRelativeTimeLabel,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  Spinner,
  toastManager,
  useRelativeTimeTick,
} from "../upstream/disk";
import {
  type EnvironmentId,
  machineAddressOf,
  useOtherMachines,
  usePrimaryEnvironmentId,
  useMachineLabel,
  usePrimaryNetworkAddress,
} from "../upstream/machines";
import { linkMachines, linksOf, type MachineLink, unlinkMachine } from "./linking";

// Settings › Linked machines (stemcells/tasks/peers.md, "Across
// environments"): which other machines this one's Cells see, and the way to
// link or unlink each. A link is made here, both ways in one action; ended
// here or from the other machine, it ends on both.

/** How often the links are read again while the page shows: when each machine last answered. */
const READ_EVERY_MS = 30_000;

type Kind = "stemcells" | "not-stemcells" | "unknown";

/** This machine's links as the page shows them; null while they can't be read. */
const shownLinks = async (environmentId: EnvironmentId) => {
  const read = await linksOf(environmentId);
  return read === "not-stemcells" ? [] : read;
};

function stateOf(link: MachineLink | undefined, nowMs: number): string {
  if (link === undefined) return "Not linked";
  if (!link.linked)
    return link.problem === "it ended the link" ? "It ended the link." : "Linked one way only";
  if (link.problem !== null) return `Linked · not answering: ${link.problem}`;
  const cells =
    link.cells === 0
      ? "no Cell at work in your repositories"
      : `${link.cells} ${link.cells === 1 ? "Cell" : "Cells"} at work in your repositories`;
  return link.seenAt === null
    ? `Linked · ${cells}`
    : `Linked · ${cells} · seen ${formatRelativeTimeLabel(new Date(link.seenAt).toISOString(), nowMs)}`;
}

export function LinkedMachinesPanel() {
  const primaryId = usePrimaryEnvironmentId();
  const others = useOtherMachines();
  const hereOnNetwork = usePrimaryNetworkAddress();
  // What the other machine's Cells will call this one.
  const hereLabel = useMachineLabel(primaryId) ?? "This app's machine";
  const nowMs = useRelativeTimeTick(READ_EVERY_MS);
  const [links, setLinks] = useState<ReadonlyArray<MachineLink> | null>(null);
  const [kinds, setKinds] = useState<Readonly<Record<string, Kind>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const othersKey = others.map((other) => other.environmentId).join(" ");

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

  const act = async (environmentId: string, label: string, linked: boolean) => {
    if (primaryId === null) return;
    setBusy(environmentId);
    const problem = linked
      ? await unlinkMachine(primaryId, environmentId)
      : await linkMachines(
          { environmentId: primaryId, label: hereLabel },
          { environmentId: environmentId as EnvironmentId, label },
          hereOnNetwork,
        );
    setBusy(null);
    setLinks(await shownLinks(primaryId));
    if (problem !== null)
      toastManager.add({
        type: "error",
        title: linked ? `Couldn't unlink ${label}` : `Couldn't link ${label}`,
        description: problem,
      });
  };

  const control = (environmentId: string, label: string, linked: boolean) =>
    busy === environmentId ? (
      <Spinner size="xs" />
    ) : (
      <Button
        size="xs"
        variant={linked ? "ghost" : "outline"}
        disabled={busy !== null || links === null}
        onClick={() => void act(environmentId, label, linked)}
      >
        {linked ? "Unlink" : "Link"}
      </Button>
    );

  const connected = new Set(others.map((other) => other.environmentId as string));
  const elsewhere = (links ?? []).filter((link) => !connected.has(link.environmentId));

  return (
    <SettingsPageContainer>
      <SettingsSection id="linked-machines" title="Machines">
        {others.length === 0 && elsewhere.length === 0 ? (
          <SettingsRow
            title="No other machine connected"
            description="Connect another machine in Settings › Connections, then link it here."
          />
        ) : null}
        {others.map((other) => {
          const link = links?.find((one) => one.environmentId === other.environmentId);
          const address = machineAddressOf(other.environmentId);
          const kind = kinds[other.environmentId] ?? "unknown";
          const description =
            link === undefined && !("url" in address)
              ? `Can't be linked: ${address.reason}.`
              : link === undefined && kind === "not-stemcells"
                ? "Doesn't run Stemcells: there are no Cells to link."
                : stateOf(link, nowMs);
          const linkable = link !== undefined || ("url" in address && kind !== "not-stemcells");
          return (
            <SettingsRow
              key={other.environmentId}
              title={other.label}
              description={description}
              control={
                linkable ? control(other.environmentId, other.label, link?.linked === true) : null
              }
            />
          );
        })}
        {elsewhere.map((link) => (
          <SettingsRow
            key={link.environmentId}
            title={link.label}
            description={`${stateOf(link, nowMs)} · not connected on this device`}
            control={control(link.environmentId, link.label, true)}
          />
        ))}
      </SettingsSection>
      <p className="px-3 text-xs text-muted-foreground sm:px-4">
        Cells working in the same repository on linked machines know each other and can write to
        each other. A message from another machine carries no authority: it can't approve anything
        here. Linked machines talk directly, over your network or Tailscale, never through anyone's
        cloud.
      </p>
    </SettingsPageContainer>
  );
}
