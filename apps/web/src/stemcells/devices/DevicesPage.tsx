import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import {
  Button,
  formatRelativeTimeLabel,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  Spinner,
  toastManager,
  useNowMinuteMs,
} from "../upstream/disk";
import {
  AddEnvironmentDialog,
  type Device,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  removeDevice,
  requestConfirmDialog,
  useComputers,
  useThisMachine,
} from "../upstream/devices";
import { AddPhoneDialog } from "./AddPhoneDialog";
import { ComputerRows } from "./Computers";
import { deviceKind, deviceName } from "./devices";
import { turnOffTailnet, useTailnet } from "./tailnet";

// Settings › Your devices (stemcells/tasks/devices.md): the person's devices in
// one list, the computers this app reaches and the phones, browsers and
// computers that reach this one, each with its way in (Add) and its way out
// (Remove). Upstream's Environments and Sharing & access keep the details.

function seenLabel(device: Device, nowMs: number) {
  if (device.connected) return "online";
  return device.lastConnectedAt === null
    ? "not connected yet"
    : `seen ${formatRelativeTimeLabel(device.lastConnectedAt, nowMs)}`;
}

export function DevicesPanel() {
  const here = useThisMachine();
  const computers = useComputers();
  const nowMs = useNowMinuteMs();
  const [adding, setAdding] = useState<"phone" | "computer" | null>(null);
  const [computerError, setComputerError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const tailnet = useTailnet(false);
  const [turningOff, setTurningOff] = useState(false);
  // This app's own session, and the command line's and agents' (bots), aren't devices.
  const devices =
    here.devices?.filter((device) => !device.current && device.deviceType !== "bot") ?? null;

  const remove = async (device: Device) => {
    const name = deviceName(device);
    const confirmed = await requestConfirmDialog(
      `Remove ${name}?\nIt can't reach this computer until it scans a new code.`,
      { variant: "destructive" },
    );
    if (confirmed !== true) return;
    setRemoving(device.sessionId);
    try {
      await removeDevice(device.sessionId);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: `Couldn't remove ${name}`,
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
    setRemoving(null);
  };

  const turnOff = async () => {
    const confirmed = await requestConfirmDialog(
      "Stop reaching this computer over Tailscale?\nPaired phones reach it again once you add a phone.",
      { variant: "destructive" },
    );
    if (confirmed !== true) return;
    setTurningOff(true);
    const next = await turnOffTailnet();
    setTurningOff(false);
    if (next === null)
      toastManager.add({
        type: "error",
        title: "Couldn't turn it off",
        description: "Try again in a moment.",
      });
    else tailnet.setLook(next);
  };
  const tailnetLook = tailnet.look;

  const add = (
    <Menu>
      <MenuTrigger render={<Button size="xs" variant="ghost-muted" aria-label="Add a device" />}>
        <PlusIcon className="size-3" />
        Add
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem onClick={() => setAdding("phone")}>Phone or tablet</MenuItem>
        <MenuItem onClick={() => setAdding("computer")}>Computer</MenuItem>
      </MenuPopup>
    </Menu>
  );

  return (
    <SettingsPageContainer>
      <SettingsSection id="devices" title="Your devices" headerAction={add}>
        <ComputerRows alone={devices !== null && devices.length === 0} />
        {tailnetLook?.on ? (
          <SettingsRow
            title="Over Tailscale"
            description={
              tailnetLook.step.kind === "ready"
                ? `Phones reach this computer at ${new URL(tailnetLook.step.baseUrl).host}`
                : "On, waiting for Tailscale on this computer"
            }
            control={
              turningOff ? (
                <Spinner size="xs" />
              ) : (
                <Button
                  size="xs"
                  variant="destructive-outline"
                  disabled={!here.canPair}
                  onClick={() => void turnOff()}
                >
                  Turn off
                </Button>
              )
            }
          />
        ) : null}
        {!here.canSee ? (
          <SettingsRow
            title="Phones and browsers"
            description="This device can't see what's paired with this computer."
          />
        ) : devices === null ? (
          <SettingsRow title="Phones and browsers" control={<Spinner size="xs" />} />
        ) : (
          devices.map((device) => (
            <SettingsRow
              key={device.sessionId}
              title={deviceName(device)}
              description={[deviceKind(device), seenLabel(device, nowMs), "reaches this computer"]
                .filter(Boolean)
                .join(" · ")}
              control={
                removing === device.sessionId ? (
                  <Spinner size="xs" />
                ) : (
                  <Button
                    size="xs"
                    variant="destructive-outline"
                    disabled={!here.canPair || removing !== null}
                    onClick={() => void remove(device)}
                  >
                    Remove
                  </Button>
                )
              }
            />
          ))
        )}
      </SettingsSection>
      <p className="px-3 text-xs text-muted-foreground sm:px-4">
        Your devices talk directly, over your network or Tailscale, never through anyone&apos;s
        cloud. Cells on two computers see each other only when you switch them on; a message from
        another computer can&apos;t approve anything here. Addresses, permissions and network access
        are in{" "}
        <Link to="/settings/access" className="underline underline-offset-2">
          Sharing &amp; access
        </Link>
        .
      </p>
      <AddPhoneDialog
        open={adding === "phone"}
        onOpenChange={(open) => {
          setAdding(open ? "phone" : null);
          if (!open) tailnet.readAgain();
        }}
      />
      {/* Upstream's dialog draws its own "Add environment" button; Add opens it instead. */}
      <div hidden>
        <AddEnvironmentDialog
          open={adding === "computer"}
          routeTarget={null}
          error={computerError}
          savedEnvironments={computers}
          onOpenChange={(open) => {
            setAdding(open ? "computer" : null);
            if (!open) setComputerError(null);
          }}
          onErrorChange={setComputerError}
        />
      </div>
    </SettingsPageContainer>
  );
}
