// @effect-diagnostics nodeBuiltinImport:off - the Tailscale CLI is a command line tool with no Effect counterpart, and `serve` has to be read while it runs.
import * as NodeChildProcess from "node:child_process";

/**
 * Where a phone's way to this Mac over Tailscale stands, read from the CLI
 * (stemcells/tasks/devices.md). Each kind but `ready` names the next step,
 * which `StemcellsTailscale.advance` takes for the person where it can:
 * - `missing`: no Tailscale on this computer.
 * - `stopped`: the app isn't running, or its switch is off.
 * - `signed-out`: running, nobody signed in (or the tailnet hasn't approved it).
 * - `starting`: connecting; look again shortly.
 * - `https-off`: the tailnet hasn't turned on HTTPS certificates, which only
 *   its admin can, on a page Tailscale names (`consentUrlOf`).
 * - `not-serving`: everything's on, but Tailscale Serve isn't in front of this server.
 * - `port-taken`: Serve answers on the tailnet port for something else on
 *   this computer, which is never taken over.
 * - `ready`: phones on the tailnet reach this server at `baseUrl`.
 */
export type TailscaleStep =
  | { readonly kind: "missing" }
  | { readonly kind: "stopped" }
  | { readonly kind: "signed-out" }
  | { readonly kind: "starting" }
  | { readonly kind: "https-off" }
  | { readonly kind: "not-serving" }
  | { readonly kind: "port-taken"; readonly port: number }
  | { readonly kind: "ready"; readonly baseUrl: string };

export interface ServePorts {
  /** This server on loopback, as a URL host: `127.0.0.1` or `[::1]`. */
  readonly localHost: string;
  /** The port this server listens on, on loopback. */
  readonly localPort: number;
  /** The tailnet HTTPS port Tailscale Serve answers on. */
  readonly servePort: number;
}

export const MAC_APP = "/Applications/Tailscale.app";
/**
 * The CLI, first one found: on a Mac the app's own binary, which answers as
 * the CLI. The `tailscale` the app installs on PATH is a shell script that
 * runs it as a child, which a timeout's kill of the script would leave behind.
 */
const cliCandidates = (platform: string) =>
  platform === "darwin" ? [`${MAC_APP}/Contents/MacOS/Tailscale`, "tailscale"] : ["tailscale"];

const parse = (json: string | null): Record<string, unknown> | null => {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** The base URL Tailscale Serve answers on: the default HTTPS port leaves the port out. */
export const serveBaseUrl = (dnsName: string, servePort: number) =>
  servePort === 443 ? `https://${dnsName}` : `https://${dnsName}:${servePort}`;

const LOOPBACK_PROXY = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\/?$/;

/**
 * Who `tailscale serve status --json` sends the tailnet port to: this
 * server, something else, or nobody. Any Serve on the port that isn't ours
 * counts as something else, whatever it is.
 */
function servedTo(
  serveJson: string | null,
  dnsName: string,
  ports: ServePorts,
): "us" | "other" | "nobody" {
  const serve = parse(serveJson);
  const tcp = record(serve?.TCP)[String(ports.servePort)];
  const site = record(serve?.Web)[`${dnsName}:${ports.servePort}`];
  if (tcp === undefined && site === undefined) return "nobody";
  const proxy = record(record(record(site).Handlers)["/"]).Proxy;
  return typeof proxy === "string" && Number(LOOPBACK_PROXY.exec(proxy)?.[1]) === ports.localPort
    ? "us"
    : "other";
}

/** Whether Serve on the tailnet port is ours, from `status --json` and `serve status --json`. */
export function servesUs(statusJson: string, serveJson: string, ports: ServePorts): boolean {
  return stepOf(statusJson, serveJson, ports).kind === "ready";
}

/** `BackendState` of `tailscale status --json`; null when Tailscale didn't answer. */
export const backendStateOf = (statusJson: string): string | null => {
  const state = parse(statusJson)?.BackendState;
  return typeof state === "string" ? state : null;
};

/** The sign-in page of a login Tailscale has under way. */
export const authUrlOf = (statusJson: string): string | null => {
  const url = parse(statusJson)?.AuthURL;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
};

/** A phone or tablet on this computer's tailnet; `online` while its Tailscale is on. */
export interface TailnetPhone {
  readonly name: string;
  readonly online: boolean;
}

/** Tailscale reports an iPad as iOS too. */
const PHONE_OS = new Set(["iOS", "android"]);

/**
 * The tailnet's phones and tablets, and the account this computer is signed
 * in with, from `tailscale status --json`. A phone outside the tailnet can't
 * resolve its names, so a code scanned there fails with nothing to say why.
 */
export function phonesOf(statusJson: string | null): {
  readonly account: string | null;
  readonly phones: ReadonlyArray<TailnetPhone>;
} {
  const status = parse(statusJson);
  const self = record(status?.Self);
  const user = record(record(status?.User)[String(self.UserID)]);
  const phones = Object.values(record(status?.Peer))
    .map(record)
    .filter((peer) => typeof peer.OS === "string" && PHONE_OS.has(peer.OS))
    .map((peer) => {
      // An iPhone can report its host name as "localhost"; its tailnet name is still its own.
      const host = typeof peer.HostName === "string" ? peer.HostName.trim() : "";
      const dns = typeof peer.DNSName === "string" ? (peer.DNSName.split(".")[0] ?? "") : "";
      return {
        name: host !== "" && host !== "localhost" ? host : dns || "A phone",
        online: peer.Online === true,
      };
    });
  return {
    account: typeof user.LoginName === "string" && user.LoginName !== "" ? user.LoginName : null,
    phones,
  };
}

/**
 * The step from `tailscale status --json` (null when the CLI couldn't reach
 * Tailscale: the app isn't running) and `tailscale serve status --json`.
 */
export function stepOf(
  statusJson: string | null,
  serveJson: string | null,
  ports: ServePorts,
): TailscaleStep {
  const status = parse(statusJson);
  if (status === null) return { kind: "stopped" };
  switch (status.BackendState) {
    case "Running":
      break;
    case "Stopped":
      return { kind: "stopped" };
    case "NeedsLogin":
    case "NeedsMachineAuth":
      return { kind: "signed-out" };
    default:
      return { kind: "starting" };
  }
  const self = record(status.Self);
  const dnsName = typeof self.DNSName === "string" ? self.DNSName.trim().replace(/\.$/, "") : "";
  if (dnsName === "") return { kind: "https-off" };
  const served = servedTo(serveJson, dnsName, ports);
  if (served === "us") return { kind: "ready", baseUrl: serveBaseUrl(dnsName, ports.servePort) };
  if (served === "other") return { kind: "port-taken", port: ports.servePort };
  // Serve needs the tailnet's `https` capability. A CLI without a capability
  // map can't say, so Serve is tried and says itself.
  const capMap = self.CapMap;
  return capMap === undefined || Object.hasOwn(record(capMap), "https")
    ? { kind: "not-serving" }
    : { kind: "https-off" };
}

/**
 * The page `tailscale serve` names when the tailnet's HTTPS is off, one click
 * for its admin (`…/f/serve?node=…`), once the line holding it is whole. Not
 * the tailnet address it prints once serving.
 */
export const consentUrlOf = (output: string): string | null =>
  /https:\/\/\S+\/f\/\S+(?=\s)/.exec(output)?.[0] ?? null;

export interface CliRun {
  readonly stdout: string;
  readonly ok: boolean;
  /** No Tailscale CLI on this computer. */
  readonly missing: boolean;
}

const execOnce = (file: string, args: ReadonlyArray<string>, timeoutMs: number) =>
  new Promise<CliRun>((resolve) => {
    NodeChildProcess.execFile(
      file,
      [...args],
      // SIGKILL: a child that ignores the gentler signal still ends at the timeout.
      { timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, windowsHide: true },
      (error, stdout) =>
        resolve({
          stdout: String(stdout),
          ok: error === null,
          missing: (error as NodeJS.ErrnoException | null)?.code === "ENOENT",
        }),
    );
  });

export async function runCli(
  args: ReadonlyArray<string>,
  platform: string,
  timeoutMs = 10_000,
): Promise<CliRun> {
  let run: CliRun = { stdout: "", ok: false, missing: true };
  for (const file of cliCandidates(platform)) {
    run = await execOnce(file, args, timeoutMs);
    if (!run.missing) return run;
  }
  return run;
}

/** Opens (or brings forward) the Tailscale app on a Mac: its switch and sign-in live there. */
export const openMacApp = () =>
  new Promise<boolean>((resolve) =>
    NodeChildProcess.execFile("/usr/bin/open", ["-a", MAC_APP], (error) => resolve(error === null)),
  );

export type ServeOutcome =
  | { readonly kind: "served" }
  | { readonly kind: "consent"; readonly url: string }
  | { readonly kind: "failed" };

/**
 * Starts `tailscale serve --bg` in front of this server and calls `done`
 * once. On a tailnet without HTTPS it prints the page that turns it on and
 * waits for it, so the page is taken from its output and the wait ends
 * here: the person's click comes later. Returns what stops it.
 */
export function startServe(
  ports: ServePorts,
  platform: string,
  done: (outcome: ServeOutcome) => void,
): () => void {
  let settled = false;
  let child: NodeChildProcess.ChildProcess | null = null;
  // The whole group, in case `tailscale` is a script running the binary as its child.
  const stop = () => {
    if (child?.pid === undefined || child.exitCode !== null) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  };
  const settle = (outcome: ServeOutcome) => {
    if (settled) return;
    settled = true;
    stop();
    done(outcome);
  };
  const spawn = (candidates: ReadonlyArray<string>) => {
    const [file, ...rest] = candidates;
    if (file === undefined) return settle({ kind: "failed" });
    let output = "";
    const read = (chunk: Buffer) => {
      output += chunk.toString();
      const url = consentUrlOf(output);
      if (url !== null) settle({ kind: "consent", url });
    };
    const started = NodeChildProcess.spawn(
      file,
      [
        "serve",
        "--bg",
        `--https=${ports.servePort}`,
        `http://${ports.localHost}:${ports.localPort}`,
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, detached: true },
    );
    child = started;
    started.stdout.on("data", read);
    started.stderr.on("data", read);
    started.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") spawn(rest);
      else settle({ kind: "failed" });
    });
    started.on("close", (code) => {
      if (child === started) settle(code === 0 ? { kind: "served" } : { kind: "failed" });
    });
  };
  spawn(cliCandidates(platform));
  return () => {
    settled = true;
    stop();
  };
}
