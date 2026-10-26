import type { AdvertisedEndpoint } from "../upstream/devices";

/**
 * The Wi-Fi way a phone reaches this machine without Tailscale (stemcells/tasks/devices.md), from
 * the desktop app's advertised routes: `off` until Network access adds a local address, `loading`
 * until the desktop app says. A browser elsewhere is `ready` at its own page's origin; one on this
 * machine's own loopback address is `unreachable`.
 */
export type WifiRoute =
  | { readonly kind: "ready"; readonly baseUrl: string }
  | { readonly kind: "off" }
  | { readonly kind: "loading" }
  | { readonly kind: "unreachable" };

export type WifiRouteInput =
  | {
      readonly desktop: true;
      readonly exposure: { readonly mode: "local-only" | "network-accessible" } | null;
      readonly endpoints: ReadonlyArray<AdvertisedEndpoint>;
    }
  | { readonly desktop: false; readonly pageOrigin: string | null };

export function wifiRoute(input: WifiRouteInput): WifiRoute {
  if (!input.desktop)
    return input.pageOrigin === null
      ? { kind: "unreachable" }
      : { kind: "ready", baseUrl: input.pageOrigin };
  if (input.exposure === null) return { kind: "loading" };
  // Without Network access the server listens on loopback alone.
  if (input.exposure.mode !== "network-accessible") return { kind: "off" };
  const lan = input.endpoints.find(
    (endpoint) => endpoint.reachability === "lan" && endpoint.status !== "unavailable",
  );
  return lan === undefined ? { kind: "off" } : { kind: "ready", baseUrl: lan.httpBaseUrl };
}
