// What Settings › Your devices takes from upstream: a request to any connected environment's server,
// authenticated as upstream does (the primary's session or desktop token, a paired one's own:
// `machineRequest.ts`), each environment's address as this device reaches it, and this desktop's
// own network addresses (Settings › Sharing & access).

import type { AdvertisedEndpoint, EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";

import { isLoopbackHostname, resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { desktopNetworkAccessStateAtom } from "~/state/desktopNetworkAccess";
import { useEnvironment } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { environmentSession } from "~/state/session";

import { requestMachine } from "./machineRequest";

export type { EnvironmentId };
export { useOtherMachines, usePrimaryEnvironmentId } from "./disk";

/** A connected environment's name, as the app shows it; null while it has none. */
export function useMachineLabel(environmentId: string | null): string | null {
  return useEnvironment(environmentId as EnvironmentId | null)?.label ?? null;
}

export type MachineAnswer =
  | { readonly ok: true; readonly status: number; readonly body: unknown }
  | { readonly ok: false; readonly reason: string };

/** Where environment `environmentId`'s server is, as this device reaches it; null with why when no other server could. */
export function machineAddressOf(
  environmentId: EnvironmentId,
): { readonly url: string } | { readonly reason: string } {
  if (environmentId === appAtomRegistry.get(primaryEnvironmentIdAtom))
    return { url: new URL(resolvePrimaryEnvironmentHttpUrl("/")).origin };
  const prepared = Option.getOrNull(
    appAtomRegistry.get(environmentSession.preparedConnectionValueAtom(environmentId)),
  );
  if (prepared === null) return { reason: "it isn't connected" };
  switch (prepared.target._tag) {
    case "RelayConnectionTarget":
      return { reason: "it's connected through the relay, which no machine's Cells go through" };
    case "SshConnectionTarget":
      return { reason: "it's connected over SSH, through a tunnel only this device reaches" };
    default:
      return { url: prepared.httpBaseUrl };
  }
}

export const isLoopbackAddress = (url: string) => {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
};

/** A JSON request to environment `environmentId`'s server; null `body` for a GET. */
export async function callMachine(
  environmentId: EnvironmentId,
  pathname: string,
  body: unknown = null,
  searchParams?: Record<string, string>,
): Promise<MachineAnswer> {
  const init =
    body === null
      ? { method: "GET" as const }
      : {
          method: "POST" as const,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        };
  try {
    let response: Response | null;
    if (environmentId === appAtomRegistry.get(primaryEnvironmentIdAtom)) {
      const token = await readDesktopPrimaryBearerToken();
      response = await fetch(resolvePrimaryEnvironmentHttpUrl(pathname, searchParams), {
        ...init,
        credentials: token ? "omit" : "include",
        headers: { ...init.headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      });
    } else {
      const address = machineAddressOf(environmentId);
      if (!("url" in address)) return { ok: false, reason: address.reason };
      const search = new URLSearchParams(searchParams).toString();
      response = await requestMachine(
        environmentId,
        search === "" ? pathname : `${pathname}?${search}`,
        init,
      );
      if (response === null) return { ok: false, reason: "it isn't connected" };
    }
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text === "" ? null : JSON.parse(text);
    } catch {
      parsed = null;
    }
    return { ok: true, status: response.status, body: parsed };
  } catch {
    return { ok: false, reason: "it couldn't be reached" };
  }
}

const ORDER: Readonly<Record<AdvertisedEndpoint["reachability"], number>> = {
  "private-network": 0,
  lan: 1,
  public: 2,
  loopback: 3,
};

/**
 * This app's own server as another machine reaches it: the desktop's first
 * address on the network (Tailscale before the local network), or the page's
 * own when it was opened from one. Null while it has none.
 */
export function usePrimaryNetworkAddress(): string | null {
  const desktop = useEnvironmentQuery(
    typeof window !== "undefined" && window.desktopBridge ? desktopNetworkAccessStateAtom : null,
  );
  const endpoint = (desktop.data?.advertisedEndpoints ?? [])
    .filter((one) => one.status !== "unavailable" && one.reachability !== "loopback")
    .toSorted((a, b) => ORDER[a.reachability] - ORDER[b.reachability])[0];
  if (endpoint !== undefined) return endpoint.httpBaseUrl;
  const own = new URL(resolvePrimaryEnvironmentHttpUrl("/")).origin;
  return isLoopbackAddress(own) ? null : own;
}
