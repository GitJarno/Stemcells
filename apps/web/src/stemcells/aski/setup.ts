/**
 * How Aski comes to be, as plain data: the provider it runs on, the
 * provider instance that gives it its persona, and the chat it keeps.
 */
import persona from "./persona.md?raw";

/** The provider instance Aski's chat runs on. */
export const ASKI_INSTANCE_ID = "aski";

/** Aski's chat's title. */
export const ASKI_TITLE = "Aski";

/** The drivers Aski runs on, preferred first. */
export const ASKI_DRIVERS = ["claudeAgent", "codex"] as const;
export type AskiDriver = (typeof ASKI_DRIVERS)[number];

/** What Aski reads of a provider. */
export interface ProviderFact {
  readonly instanceId: string;
  readonly driver: string;
  readonly installed: boolean;
  readonly enabled: boolean;
}

/** What Aski writes of its provider instance. */
export interface AskiInstance {
  readonly driver: AskiDriver;
  readonly displayName: string;
  readonly enabled: true;
  readonly config: Readonly<Record<string, unknown>>;
}

function isAskiDriver(driver: string): driver is AskiDriver {
  return (ASKI_DRIVERS as readonly string[]).includes(driver);
}

/** Whether a driver's own instance (its id is the driver's name) is installed and on. */
function usable(providers: readonly ProviderFact[], driver: AskiDriver): boolean {
  return providers.some(
    (provider) => provider.instanceId === driver && provider.installed && provider.enabled,
  );
}

/**
 * The driver Aski runs on: the one it already runs on while that stays
 * usable (its chat keeps its provider), else Claude, else Codex. Null when
 * neither is installed and on.
 */
export function askiDriver(
  providers: readonly ProviderFact[],
  current: string | undefined,
): AskiDriver | null {
  if (current !== undefined && isAskiDriver(current) && usable(providers, current)) return current;
  return ASKI_DRIVERS.find((driver) => usable(providers, driver)) ?? null;
}

/** A word quoted the way upstream's launch arguments are read (POSIX double quotes). */
function quoted(text: string): string {
  return `"${text.replace(/["\\$`]/g, (char) => `\\${char}`)}"`;
}

/**
 * The persona Aski runs with on `driver`. `{driverInstance}` names the
 * driver's own instance, where the Cells Aski starts run when their project
 * has no default model.
 */
export function personaFor(driver: AskiDriver, text: string = persona): string {
  return text.replaceAll("{driverInstance}", driver).trim();
}

/**
 * The persona as launch arguments for `driver`. Claude appends it to its
 * system prompt; Codex takes it as developer instructions, a TOML string.
 */
export function personaArgs(driver: AskiDriver, text: string = persona): string {
  const words = personaFor(driver, text);
  return driver === "claudeAgent"
    ? `--append-system-prompt ${quoted(words)}`
    : `-c ${quoted(`developer_instructions=${JSON.stringify(words)}`)}`;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Aski's instance: the driver's own instance's settings (binary, home), its
 * launch arguments followed by the persona's, so the persona wins a flag
 * both name.
 */
export function askiInstance(driver: AskiDriver, driverConfig: unknown): AskiInstance {
  const base = recordOf(driverConfig);
  const baseArgs = typeof base.launchArgs === "string" ? base.launchArgs.trim() : "";
  const args = personaArgs(driver);
  return {
    driver,
    displayName: ASKI_TITLE,
    enabled: true,
    config: { ...base, launchArgs: baseArgs === "" ? args : `${baseArgs} ${args}` },
  };
}

/**
 * Whether the stored instance already says what Aski would write. Settings
 * the server fills in with their defaults don't count.
 */
export function sameInstance(stored: unknown, wanted: AskiInstance): boolean {
  const current = recordOf(stored);
  const config = recordOf(current.config);
  return (
    current.driver === wanted.driver &&
    current.displayName === wanted.displayName &&
    current.enabled !== false &&
    Object.entries(wanted.config).every(
      ([key, value]) => JSON.stringify(config[key]) === JSON.stringify(value),
    )
  );
}

/** What Aski reads of a chat on the server. */
export interface ChatFact {
  readonly threadId: string;
  readonly instanceId: string;
  readonly pinned: boolean;
  /** Not a fork or a subagent of another chat. */
  readonly topLevel: boolean;
  readonly deleted: boolean;
  readonly createdAt: string;
}

/**
 * Aski's chat among a server's chats: the top-level chat on Aski's
 * instance, the pinned one first, else the first made. There is one Aski
 * chat per server, so a browser that hasn't met it adopts it rather than
 * make another, even after someone unpinned it.
 */
export function askiChatAmong(chats: readonly ChatFact[]): ChatFact | null {
  const own = chats
    .filter((chat) => chat.instanceId === ASKI_INSTANCE_ID && chat.topLevel && !chat.deleted)
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  return own.find((chat) => chat.pinned) ?? own[0] ?? null;
}

// Each browser remembers Aski's chat per environment (a server), by its
// thread id: a fast path to it before the server's chats have loaded.

const STORAGE_KEY = "stemcells.aski";

function readAll(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return Object.fromEntries(
      Object.entries(recordOf(parsed)).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
      ),
    );
  } catch {
    return {};
  }
}

/** The thread Aski's chat is on in an environment, if one was made there. */
export function rememberedAskiThread(environmentId: string): string | null {
  return readAll()[environmentId] ?? null;
}

export function rememberAskiThread(environmentId: string, threadId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [environmentId]: threadId }));
  } catch {
    // Blocked storage: Aski's chat is made again on the next start, nothing more.
  }
}
