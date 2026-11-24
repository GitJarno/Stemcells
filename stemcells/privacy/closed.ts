import { closeCloudSwitches } from "./switches.ts";

/**
 * Where no Stemcells process ever connects, whatever code asks: T3's own services, and the
 * vendors upstream reports to. The last line of defence, under the gates that keep such code
 * out (`stemcells/outbound.txt`): a name here, or under it, never resolves.
 */
export const REFUSED: ReadonlyArray<readonly [domain: string, why: string]> = [
  ["t3.codes", "T3's analytics ingest, relay, Clerk sign-in and hosted app"],
  ["posthog.com", "PostHog, where upstream's analytics end up"],
  ["axiom.co", "Axiom, where upstream's relay and phone traces go"],
  ["clerk.com", "Clerk, T3 Connect's sign-in"],
  ["clerk.accounts.dev", "Clerk's development instances"],
  ["sentry.io", "Sentry, the commonest crash reporter"],
];

export function isRefused(host: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, "");
  return REFUSED.some(([domain]) => name === domain || name.endsWith(`.${domain}`));
}

const refusal = (host: string) =>
  Object.assign(new Error(`getaddrinfo ENOTFOUND ${host} (Stemcells connects to no such host)`), {
    code: "ENOTFOUND",
    errno: -3008,
    syscall: "getaddrinfo",
    hostname: host,
  });

const INSTALLED = Symbol.for("stemcells.closed");
// The lab's watch holds every name on the machine and records it; refusing first would hide
// an attempt from the outbound-live gate.
const LAB_WATCH = Symbol.for("stemcells.netWatch");

/** Refuses every lookup of a `REFUSED` name in this process, and says so once per name. */
export function refuseLookups(): void {
  const flags = globalThis as Record<symbol, unknown>;
  if (flags[INSTALLED] || flags[LAB_WATCH]) return;
  flags[INSTALLED] = true;
  const said = new Set<string>();
  const say = (host: string) => {
    if (said.has(host)) return;
    said.add(host);
    process.emitWarning(`refused a connection to ${host}`, { code: "STEMCELLS_REFUSED" });
  };

  // The module itself, not an import's copy of it: every socket to a name asks its `lookup`,
  // fetch's included.
  const NodeDns = process.getBuiltinModule("node:dns");
  const lookup = NodeDns.lookup;
  NodeDns.lookup = Object.assign(function stemcellsLookup(
    hostname: string,
    ...rest: ReadonlyArray<unknown>
  ) {
    if (typeof hostname !== "string" || !isRefused(hostname)) {
      return Reflect.apply(lookup, NodeDns, [hostname, ...rest]);
    }
    say(hostname);
    const done = rest.findLast((value) => typeof value === "function") as
      | ((error: Error) => void)
      | undefined;
    process.nextTick(() => done?.(refusal(hostname)));
    return {};
  }, lookup) as typeof NodeDns.lookup;

  const promised = NodeDns.promises.lookup;
  NodeDns.promises.lookup = function stemcellsLookup(
    hostname: string,
    ...rest: ReadonlyArray<unknown>
  ) {
    if (typeof hostname !== "string" || !isRefused(hostname)) {
      return Reflect.apply(promised, NodeDns.promises, [hostname, ...rest]);
    }
    say(hostname);
    return Promise.reject(refusal(hostname));
  } as typeof NodeDns.promises.lookup;
}

/** A Stemcells process's first act: no cloud switch in its environment, no way to T3. */
export function closeToT3(env: Record<string, string | undefined> = process.env): void {
  closeCloudSwitches(env);
  refuseLookups();
}
