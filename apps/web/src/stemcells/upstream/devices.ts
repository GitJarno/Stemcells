// What Settings › Devices takes from upstream, all of it what Settings › Connections uses:
// this machine's addresses and the switches that add one (Tailscale HTTPS, Network access),
// its one-time pairing links and the devices they paired, the computers this app reaches, and
// upstream's dialog that adds one.

import {
  type AdvertisedEndpoint,
  AuthAccessReadScope,
  AuthAccessWriteScope,
  AuthEnvironmentMaintainScope,
  AuthStandardClientScopes,
  type EnvironmentId,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { getPairingTokenFromUrl, readHostedPairingRequest } from "@t3tools/shared/remote";
import * as DateTime from "effect/DateTime";

import {
  sortDesktopClientSessions,
  toDesktopClientSessionRecord,
} from "~/components/settings/ConnectionsSettings.logic";
import { resolveDesktopPairingUrl } from "~/components/settings/pairingUrls";
import { environmentCatalog } from "~/connection/catalog";
import { isDesktopLocalConnectionTarget } from "~/connection/desktopLocal";
import {
  createServerPairingCredential,
  isLoopbackHostname,
  revokeServerClientSession,
  revokeServerPairingLink,
  type ServerClientSessionRecord,
  usePrimarySessionState,
} from "~/environments/primary";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { ensureLocalApi } from "~/localApi";
import { isLocalEnvironmentDisabled } from "~/localEnvironment";
import { authEnvironment } from "~/state/auth";
import {
  desktopNetworkAccessStateAtom,
  refreshDesktopNetworkAccessState,
} from "~/state/desktopNetworkAccess";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";

export type { AdvertisedEndpoint, EnvironmentId };

/** A device paired with this machine: one of its client sessions, by what the device said of itself. */
export interface Device {
  readonly sessionId: ServerClientSessionRecord["sessionId"];
  readonly label: string | null;
  readonly deviceType: ServerClientSessionRecord["client"]["deviceType"];
  readonly os: string | null;
  readonly browser: string | null;
  readonly current: boolean;
  readonly connected: boolean;
  readonly lastConnectedAt: string | null;
}

function toDevice(session: ServerClientSessionRecord): Device {
  // A session's `client` is the device it belongs to, not an RPC client.
  // oxlint-disable-next-line t3code/no-rpc-permission-bypass
  const { client } = session;
  return {
    sessionId: session.sessionId,
    label: client.label ?? null,
    deviceType: client.deviceType,
    os: client.os ?? null,
    browser: client.browser ?? null,
    current: session.current,
    connected: session.connected,
    lastConnectedAt: session.lastConnectedAt,
  };
}

export { AddEnvironmentDialog } from "~/components/settings/AddEnvironmentDialog";
export {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
export { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
export { QRCodeSvg } from "~/components/ui/qr-code";
export { requestConfirmDialog } from "~/confirmDialog";
export { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
export { formatExpiresInLabel } from "~/timestampFormat";

const NO_ENDPOINTS: ReadonlyArray<AdvertisedEndpoint> = [];

/**
 * This app's own machine as a phone would pair with it: who may pair and switch its routes, its
 * routes, paired devices and open links. `desktop` is false in a browser, where the switches
 * are the desktop app's and the page's own address is the route.
 */
export function useThisMachine() {
  const primaryId = usePrimaryEnvironmentId();
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge;
  const canRead = useEnvironmentScope(primaryId, AuthAccessReadScope);
  const canPair = useEnvironmentScope(primaryId, AuthAccessWriteScope);
  const canMaintain = useEnvironmentScope(primaryId, AuthEnvironmentMaintainScope);
  const canSwitch = bridge !== undefined && canMaintain && !isLocalEnvironmentDisabled();
  const session = usePrimarySessionState().data;
  const access = useEnvironmentQuery(
    canRead && primaryId !== null
      ? authEnvironment.accessChanges({ environmentId: primaryId, input: null })
      : null,
  );
  const network = useEnvironmentQuery(canSwitch ? desktopNetworkAccessStateAtom : null);
  const snapshot = access.data?.type === "snapshot" ? access.data.payload : null;
  return {
    desktop: bridge !== undefined,
    /** Whether this device may see what's paired with this machine. */
    canSee: canRead && primaryId !== null,
    canPair,
    canSwitch,
    /** The scopes this session may hand on, which bound a new link's. */
    delegatable: session?.authenticated ? (session.permissions ?? session.scopes ?? []) : [],
    exposure: network.data?.serverExposureState ?? null,
    endpoints: network.data?.advertisedEndpoints ?? NO_ENDPOINTS,
    /** Null until the server's first answer. */
    devices:
      snapshot === null
        ? null
        : sortDesktopClientSessions(snapshot.clientSessions.map(toDesktopClientSessionRecord)).map(
            toDevice,
          ),
    /** The one-time links not yet used or expired; null until the server's first answer. */
    openLinkIds: snapshot === null ? null : new Set(snapshot.pairingLinks.map((link) => link.id)),
  };
}

/** A one-time link with the standard client's scopes, as far as this session may grant them. */
export async function createPairingLink(delegatable: ReadonlyArray<string>) {
  const created = await createServerPairingCredential({
    scopes: AuthStandardClientScopes.filter((scope) => delegatable.includes(scope)),
  });
  return {
    id: created.id,
    credential: created.credential,
    expiresAt: DateTime.formatIso(created.expiresAt),
  };
}

export const revokePairingLink = (id: string) => revokeServerPairingLink(id);
export const removeDevice = (sessionId: Device["sessionId"]) =>
  revokeServerClientSession(sessionId);

/**
 * The address a scanned code opens: this machine's own `/pair`, never T3's
 * hosted app, which upstream's QR prefers for an HTTPS address.
 */
export const pairingUrlFor = (baseUrl: string, credential: string) =>
  resolveDesktopPairingUrl(baseUrl, credential);

/** What a phone reads back from a scanned code: the machine it pairs with and the token. */
export function readPairingUrl(url: string) {
  const parsed = new URL(url);
  return {
    hosted: readHostedPairingRequest(parsed) !== null,
    origin: parsed.origin,
    path: parsed.pathname,
    token: getPairingTokenFromUrl(parsed),
  };
}

/** The page's own origin when another device could reach it; null on loopback. */
export function reachablePageOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return isLoopbackHostname(window.location.hostname) ? null : window.location.origin;
}

export const refreshRoutes = refreshDesktopNetworkAccessState;

/**
 * A request to this computer's own server: the desktop app's bearer token,
 * the session cookie in a browser on its origin.
 */
export async function requestPrimary(method: "GET" | "POST", pathname: string) {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(resolvePrimaryEnvironmentHttpUrl(pathname), {
    method,
    credentials: bearerToken ? "omit" : "include",
    headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : {},
  });
}

/** A page in the person's browser, outside the app. */
export const openExternal = (url: string) => ensureLocalApi().shell.openExternal(url);

/**
 * Turns on Network access in the desktop app: it saves the choice and
 * relaunches the app, as Settings › Connections does.
 */
export async function turnOnNetworkAccess() {
  await window.desktopBridge?.setServerExposureMode("network-accessible");
  refreshDesktopNetworkAccessState();
}

/** The computers this app reaches besides its own, as Settings › Connections lists them. */
export function useComputers() {
  const { environments } = useEnvironments();
  return environments.filter(
    (environment) =>
      environment.entry.target._tag !== "PrimaryConnectionTarget" &&
      !isDesktopLocalConnectionTarget(environment.entry.target),
  );
}

/** Forgets a computer on this device, as Settings › Connections' Remove does; the problem, or null. */
export function useRemoveComputer() {
  const remove = useAtomCommand(environmentCatalog.remove, { reportFailure: false });
  return async (environmentId: EnvironmentId): Promise<string | null> => {
    const result = await remove(environmentId);
    if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return null;
    const error = squashAtomCommandFailure(result);
    return error instanceof Error ? error.message : "It couldn't be removed.";
  };
}
