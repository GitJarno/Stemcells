import { describe, expect, it } from "vite-plus/test";

import type { AdvertisedEndpoint } from "../upstream/devices";
import { phoneRoute } from "./phoneRoute";

const endpoint = (
  id: string,
  httpBaseUrl: string,
  reachability: AdvertisedEndpoint["reachability"],
  provider = "desktop-core",
): AdvertisedEndpoint => ({
  id,
  label: id,
  provider: { id: provider, label: provider, kind: "private-network", isAddon: false },
  httpBaseUrl,
  wsBaseUrl: httpBaseUrl.replace(/^http/, "ws"),
  reachability,
  compatibility: { hostedHttpsApp: "unknown", desktopApp: "compatible" },
  source: "desktop-core",
  status: "available",
});

const loopback = endpoint("desktop-loopback:1", "http://127.0.0.1:3773", "loopback");
const lan = endpoint("desktop-lan:1", "http://192.168.1.20:3773", "lan");
const tailnetIp = endpoint(
  "tailscale-ip:1",
  "http://100.64.0.5:3773",
  "private-network",
  "tailscale",
);
const tailscaleHttps = endpoint(
  "tailscale-magicdns:https://mac.example.ts.net",
  "https://mac.example.ts.net",
  "private-network",
  "tailscale",
);

const on = { mode: "network-accessible", tailscaleServeEnabled: true } as const;
const off = { mode: "local-only", tailscaleServeEnabled: false } as const;

describe("the address a phone's code points at", () => {
  it("is Tailscale HTTPS ahead of the tailnet IP and the local network, never loopback", () => {
    expect(
      phoneRoute({
        desktop: true,
        exposure: on,
        endpoints: [loopback, lan, tailnetIp, tailscaleHttps],
      }),
    ).toEqual({
      kind: "ready",
      baseUrl: "https://mac.example.ts.net",
      anywhere: true,
      tailnet: true,
      tailscaleOff: false,
    });
  });

  it("is the local network when that's all there is, which the phone leaves with the house", () => {
    expect(
      phoneRoute({
        desktop: true,
        exposure: { mode: "network-accessible", tailscaleServeEnabled: false },
        endpoints: [loopback, lan],
      }),
    ).toEqual({
      kind: "ready",
      baseUrl: lan.httpBaseUrl,
      anywhere: false,
      tailnet: false,
      tailscaleOff: true,
    });
  });

  it("is none while Tailscale HTTPS is on but not answering, not the tailnet IP the server isn't on", () => {
    expect(
      phoneRoute({
        desktop: true,
        exposure: { mode: "local-only", tailscaleServeEnabled: true },
        endpoints: [loopback, tailnetIp, { ...tailscaleHttps, status: "unavailable" }],
      }),
    ).toEqual({ kind: "tailscale-silent", networkOff: true });
  });

  it("is none when this machine answers only itself", () => {
    expect(phoneRoute({ desktop: true, exposure: off, endpoints: [loopback] })).toEqual({
      kind: "off",
      networkOff: true,
    });
  });

  it("is a browser's own page, unless that page is this machine's loopback", () => {
    expect(phoneRoute({ desktop: false, pageOrigin: "https://mac.example.ts.net" })).toMatchObject({
      kind: "ready",
      baseUrl: "https://mac.example.ts.net",
    });
    expect(phoneRoute({ desktop: false, pageOrigin: null })).toEqual({ kind: "unreachable" });
  });
});
