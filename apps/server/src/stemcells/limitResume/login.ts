// @effect-diagnostics nodeBuiltinImport:off - `security` and `claude auth status` are command line tools with no Effect counterpart, and a hash keeps the account out of memory.
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

/**
 * Which account a Claude instance is signed in to, read only while one of its Cells is stopped.
 * The login's modification date (macOS keychain, else `.credentials.json`) also moves when Claude
 * refreshes its token, so a moved date only says to ask `claude auth status --json`. The account
 * is kept as a hash, never the email; the secret is never read (no `-w` or `-g` to `security`).
 */

/** How a Claude instance runs: the CLI and the environment its Cells get. */
export interface ClaudeLogin {
  readonly binaryPath: string;
  readonly env: NodeJS.ProcessEnv;
  /** The config folder the CLI reads (`CLAUDE_CONFIG_DIR`, or `~/.claude`). */
  readonly configDir: string;
}

/** Instances sharing a config folder and binary share a login. */
export const loginKey = (login: ClaudeLogin): string => `${login.binaryPath}\0${login.configDir}`;

/**
 * The keychain item Claude Code keeps its login in, named as the CLI names
 * it (2.1.306): one item per config folder once `CLAUDE_CONFIG_DIR` is set,
 * suffixed with the start of the folder's SHA-256.
 */
export function keychainService(env: NodeJS.ProcessEnv): string {
  const secure = env.CLAUDE_SECURESTORAGE_CONFIG_DIR;
  const configDir = env.CLAUDE_CONFIG_DIR;
  const shared = secure !== undefined ? !secure : !configDir;
  if (shared) return "Claude Code-credentials";
  const folder = (secure !== undefined ? secure : configDir!).normalize("NFC");
  const hash = NodeCrypto.createHash("sha256").update(folder).digest("hex").slice(0, 8);
  return `Claude Code-credentials-${hash}`;
}

/** The item's modification date, from `security find-generic-password`'s attributes. */
export function keychainDateOf(output: string): string | null {
  return /"mdat"<timedate>=\S*\s+"(\d{14}Z)/.exec(output)?.[1] ?? null;
}

/**
 * Who `claude auth status --json` says is signed in, as a hash of the
 * account, organisation, plan and method; null when nobody is or it can't
 * be read. The plan is in it: signing in again on a new plan counts.
 */
export function accountOf(statusJson: string): string | null {
  let status: unknown;
  try {
    status = JSON.parse(statusJson);
  } catch {
    return null;
  }
  if (typeof status !== "object" || status === null) return null;
  const read = status as Record<string, unknown>;
  if (read.loggedIn !== true) return null;
  const who = ["authMethod", "apiProvider", "email", "orgId", "subscriptionType"].map((key) =>
    typeof read[key] === "string" ? read[key] : null,
  );
  if (who.every((part) => part === null)) return null;
  return NodeCrypto.createHash("sha256").update(JSON.stringify(who)).digest("hex").slice(0, 16);
}

const run = (file: string, args: ReadonlyArray<string>, env?: NodeJS.ProcessEnv) =>
  new Promise<{ readonly stdout: string; readonly ok: boolean }>((resolve) => {
    NodeChildProcess.execFile(
      file,
      [...args],
      // SIGKILL: a child that ignores the gentler signal still ends at the timeout.
      { env, timeout: 10_000, killSignal: "SIGKILL", maxBuffer: 256 * 1024, windowsHide: true },
      (error, stdout) => resolve({ stdout: String(stdout), ok: error === null }),
    );
  });

/**
 * What moves when the login changes: the keychain item's date on a Mac and
 * the credentials file's. Never throws; an unreadable part reads "-".
 */
export async function readLoginMark(login: ClaudeLogin, platform: string): Promise<string> {
  const keychain =
    platform === "darwin"
      ? await run("/usr/bin/security", [
          "find-generic-password",
          "-s",
          keychainService(login.env),
        ]).then(({ stdout, ok }) => (ok ? keychainDateOf(stdout) : null))
      : null;
  const file = await NodeFSP.stat(NodePath.join(login.configDir, ".credentials.json")).then(
    (stat) => String(stat.mtimeMs),
    () => null,
  );
  return `${keychain ?? "-"}|${file ?? "-"}`;
}

/** The account the instance is signed in to now, hashed; null when it can't say. */
export async function readAccount(login: ClaudeLogin): Promise<string | null> {
  const { stdout, ok } = await run(login.binaryPath, ["auth", "status", "--json"], login.env);
  return ok ? accountOf(stdout) : null;
}
