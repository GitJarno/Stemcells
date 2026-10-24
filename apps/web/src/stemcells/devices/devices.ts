import type { Device } from "../upstream/devices";

/** A paired device's name, as upstream's Authorized clients names it. */
export const deviceName = (device: Device) =>
  device.label ?? ([device.os, device.browser].filter(Boolean).join(" · ") || "A device");

const KINDS: Readonly<Record<Device["deviceType"], string | null>> = {
  desktop: "Computer",
  mobile: "Phone",
  tablet: "Tablet",
  bot: "Agent",
  unknown: null,
};

/** What kind of device it is, and on what. */
export const deviceKind = (device: Device) =>
  [KINDS[device.deviceType], device.os].filter(Boolean).join(" · ");

/**
 * The device a one-time link paired: none while the link is still open,
 * then the device that arrived since `seen` was taken. A session the
 * command line or an agent opens meanwhile (a `bot`) is not it.
 */
export function pairedBy(input: {
  readonly linkId: string;
  readonly seen: ReadonlySet<string>;
  readonly devices: ReadonlyArray<Device>;
  readonly openLinkIds: ReadonlySet<string>;
}): Device | null {
  if (input.openLinkIds.has(input.linkId)) return null;
  return (
    input.devices.find(
      (device) =>
        !device.current && device.deviceType !== "bot" && !input.seen.has(device.sessionId),
    ) ?? null
  );
}
