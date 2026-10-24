import { describe, expect, it } from "vite-plus/test";

import type { Device } from "../upstream/devices";
import { pairedBy } from "./devices";

const device = (sessionId: string, deviceType: Device["deviceType"]): Device => ({
  sessionId: sessionId as Device["sessionId"],
  label: null,
  deviceType,
  os: null,
  browser: null,
  current: false,
  connected: true,
  lastConnectedAt: null,
});

const here = { ...device("here", "desktop"), current: true };
const phone = device("phone", "mobile");
const cli = device("cli", "bot");
const seen = new Set(["here"]);

describe("the device a code paired", () => {
  it("is none while the code is still open, even when a session arrives", () => {
    expect(
      pairedBy({ linkId: "link", seen, devices: [here, phone], openLinkIds: new Set(["link"]) }),
    ).toBeNull();
  });

  it("is the new phone once the code is used, never the command line's session", () => {
    expect(
      pairedBy({ linkId: "link", seen, devices: [here, cli, phone], openLinkIds: new Set() }),
    ).toBe(phone);
    expect(
      pairedBy({ linkId: "link", seen, devices: [here, cli], openLinkIds: new Set() }),
    ).toBeNull();
  });
});
