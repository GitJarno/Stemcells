import { describe, expect, it } from "vite-plus/test";

import type { AdvertisedEndpoint } from "../upstream/devices";
import { wifiRoute } from "./wifiRoute";

const endpoint = (
  id: string,
  httpBaseUrl: string,
  reachability: AdvertisedEndpoint["reachability"],
): AdvertisedEndpoint => ({
  id,
  label: id,
  provider: { id: "desktop-core", label: "Desktop", kind: "private-network", isAddon: false },
  httpBaseUrl,
  wsBaseUrl: httpBaseUrl.replace(/^http/, "ws"),
  reachability,
  compatibility: { hostedHttpsApp: "unknown", desktopApp: "compatible" },
  source: "desktop-core",
  status: "available",
});

const loopback = endpoint("desktop-loopback:1", "http://127.0.0.1:3773", "loopback");
const lan = endpoint("desktop-lan:1", "http://192.168.1.20:3773", "lan");
const tailnetIp = endpoint("tailscale-ip:1", "http://100.64.0.5:3773", "private-network");

describe("the Wi-Fi address a phone's code points at", () => {
  it("is the local network address, never loopback or the tailnet's", () => {
    expect(
      wifiRoute({
        desktop: true,
        exposure: { mode: "network-accessible" },
        endpoints: [loopback, tailnetIp, lan],
      }),
    ).toEqual({ kind: "ready", baseUrl: lan.httpBaseUrl });
  });

  it("is none without Network access, whose server answers only this machine", () => {
    expect(
      wifiRoute({ desktop: true, exposure: { mode: "local-only" }, endpoints: [loopback, lan] }),
    ).toEqual({ kind: "off" });
  });

  it("is a browser's own page, unless that page is this machine's loopback", () => {
    expect(wifiRoute({ desktop: false, pageOrigin: "https://mac.example.ts.net" })).toEqual({
      kind: "ready",
      baseUrl: "https://mac.example.ts.net",
    });
    expect(wifiRoute({ desktop: false, pageOrigin: null })).toEqual({ kind: "unreachable" });
  });
});
