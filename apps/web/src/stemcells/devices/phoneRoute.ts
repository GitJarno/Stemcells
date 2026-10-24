import { type AdvertisedEndpoint, isTailscaleHttpsEndpoint } from "../upstream/devices";

/**
 * How a phone reaches this machine, read from the routes the desktop app
 * advertises (stemcells/tasks/devices.md):
 * - `ready`: the address the code points at; `anywhere` is false for the
 *   local network, which a phone leaves with the house, and `tailnet` says
 *   the phone needs Tailscale too.
 * - `off`: no route a phone could use, until Network access adds one.
 * - `loading`: the desktop app hasn't said yet.
 * - `unreachable`: a browser on this machine's own loopback address.
 *
 * The tailnet IP needs no Tailscale Serve and no HTTPS certificates: the
 * phone app speaks plain HTTP to it, inside Tailscale's encrypted tunnel.
 * Tailscale HTTPS still comes first when someone set it up and it answers.
 */
export type PhoneRoute =
  | {
      readonly kind: "ready";
      readonly baseUrl: string;
      readonly anywhere: boolean;
      readonly tailnet: boolean;
    }
  | { readonly kind: "off" }
  | { readonly kind: "loading" }
  | { readonly kind: "unreachable" };

export type PhoneRouteInput =
  | {
      readonly desktop: true;
      readonly exposure: { readonly mode: "local-only" | "network-accessible" } | null;
      readonly endpoints: ReadonlyArray<AdvertisedEndpoint>;
    }
  | { readonly desktop: false; readonly pageOrigin: string | null };

const rank = (endpoint: AdvertisedEndpoint) =>
  isTailscaleHttpsEndpoint(endpoint)
    ? 0
    : endpoint.provider.id === "tailscale"
      ? 1
      : endpoint.reachability === "private-network"
        ? 2
        : endpoint.reachability === "public"
          ? 3
          : 4;

export function phoneRoute(input: PhoneRouteInput): PhoneRoute {
  if (!input.desktop)
    return input.pageOrigin === null
      ? { kind: "unreachable" }
      : { kind: "ready", baseUrl: input.pageOrigin, anywhere: true, tailnet: false };
  if (input.exposure === null) return { kind: "loading" };
  const networkOff = input.exposure.mode !== "network-accessible";
  // Without Network access the server listens on loopback alone, so only
  // Tailscale HTTPS (Tailscale Serve, in front of it) reaches it; the
  // tailnet IP the desktop app still lists doesn't.
  const best = input.endpoints
    .filter((endpoint) => !networkOff || isTailscaleHttpsEndpoint(endpoint))
    .filter((endpoint) => endpoint.status !== "unavailable" && endpoint.reachability !== "loopback")
    .toSorted((a, b) => rank(a) - rank(b))[0];
  if (best === undefined) return { kind: "off" };
  return {
    kind: "ready",
    baseUrl: best.httpBaseUrl,
    anywhere: best.reachability !== "lan",
    tailnet: best.provider.id === "tailscale",
  };
}
