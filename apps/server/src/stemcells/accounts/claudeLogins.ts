/**
 * Claude instances signed in with Claude Code's own login are accounts of one kind: a thread
 * moves between them with its whole transcript, since an account only pays for the next turn
 * (stemcells/tasks/account-switch.md). Routers, API keys and cloud providers keep upstream's
 * one continuation per config folder.
 */

/** The continuation every plain-login Claude instance shares, whatever its config folder. */
export const CLAUDE_LOGIN_CONTINUATION = "claude:login";

const CLOUD_PROVIDER_FLAGS = [
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
] as const;

const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const switchedOn = (value: unknown) =>
  filled(value) && !["0", "false"].includes((value as string).trim().toLowerCase());

function reachesAnthropicByLogin(env: Readonly<Record<string, unknown>>): boolean {
  if (filled(env.ANTHROPIC_AUTH_TOKEN) || filled(env.ANTHROPIC_API_KEY)) return false;
  if (CLOUD_PROVIDER_FLAGS.some((flag) => switchedOn(env[flag]))) return false;
  const base = env.ANTHROPIC_BASE_URL;
  if (!filled(base)) return true;
  try {
    return new URL((base as string).trim()).hostname === "api.anthropic.com";
  } catch {
    return false;
  }
}

/**
 * True when the instance reaches Anthropic on Claude Code's own login: by its environment, the
 * `settings.json` in its config folder (`undefined` when there is none, and its `env` wins), and
 * its launch arguments. A settings file that won't parse counts against, as upstream's handoff
 * is the safe side.
 */
export function isPlainClaudeLogin(input: {
  readonly env: NodeJS.ProcessEnv;
  readonly settingsJson?: string | undefined;
  readonly launchArgs?: string | undefined;
}): boolean {
  if (/(^|\s)--settings(\s|=|$)/.test(input.launchArgs ?? "")) return false;
  let settings: { readonly env?: unknown; readonly apiKeyHelper?: unknown } = {};
  if (input.settingsJson !== undefined) {
    try {
      settings = JSON.parse(input.settingsJson) ?? {};
    } catch {
      return false;
    }
  }
  if (filled(settings.apiKeyHelper)) return false;
  const settingsEnv =
    typeof settings.env === "object" && settings.env !== null ? settings.env : undefined;
  return reachesAnthropicByLogin({ ...input.env, ...settingsEnv });
}

// Filled as each Claude instance is built and read when a thread resumes: the two meet in
// different layers, and a stale folder only costs a look for a transcript that isn't there.
const loginFolders = new Map<string, string>();

/** Records where an instance keeps its sessions, or forgets it when it isn't a plain login. */
export function noteLoginFolder(instanceId: string, folder: string | null): void {
  if (folder === null) loginFolders.delete(instanceId);
  else loginFolders.set(instanceId, folder);
}

/** Where a plain-login instance keeps its sessions; none for any other instance. */
export function loginFolderOf(instanceId: string): string | undefined {
  return loginFolders.get(instanceId);
}

/** Every config folder a plain-login instance keeps its sessions in, each once. */
export function knownLoginFolders(): ReadonlyArray<string> {
  return [...new Set(loginFolders.values())];
}
