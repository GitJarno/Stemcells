// Which settings a reply's card can change, and how its suggested value reads
// (stemcells/tasks/settings-in-chat.md). A control comes from the setting's own schema, so this
// list says only where each lives; a setting not on it draws with Open alone.

/** Where a setting lives: the server's settings, this device's, or a store of ours. */
export type Store = "server" | "client" | "ours";

export interface Binding {
  readonly store: Store;
  readonly key: string;
  /** Widens what reaches the machine, or what agents do alone: a reply may show it, never suggest it. */
  readonly guarded?: true;
}

const server = (key: string, guarded?: true): Binding =>
  guarded ? { store: "server", key, guarded } : { store: "server", key };
const client = (key: string): Binding => ({ store: "client", key });
const ours = (key: string, guarded?: true): Binding =>
  guarded ? { store: "ours", key, guarded } : { store: "ours", key };

/** Each setting a card can change, by its catalog row id. */
export const BINDINGS: Readonly<Record<string, Binding>> = {
  // Upstream's, on the server.
  "agent-browser-access": server("enableAgentBrowserAccess", true),
  "agent-device-access": server("enableAgentDeviceAccess", true),
  "auto-resume-limited-threads": server("autoResumeLimitedThreads"),
  "auto-settle-merged-threads": server("sidebarAutoSettleOnMerge"),
  "compact-idle-threads": server("idleCompaction"),
  "continue-threads-after-server-update": server("continueThreadsAfterServerUpdate"),
  "default-permissions": server("defaultRuntimeMode", true),
  "device-hub": server("enableDeviceSupport", true),
  "ghq-clone-layout": server("ghqCloneLayout"),
  "guest-links": server("guestSharingEnabled", true),
  "keep-awake-while-agents-work": server("keepAwakeWhileAgentsWork"),
  "keep-threads-with-pull-requests": server("sidebarAutoSettleKeepPullRequests"),
  "linked-environments-beta": server("linkedEnvironmentsEnabled", true),
  "new-threads": server("defaultThreadEnvMode"),
  "prompt-suggestions-beta": server("promptSuggestionsEnabled"),
  "provider-update-checks": server("enableProviderUpdateChecks"),
  "pull-request-merge-method": server("pullRequestMergeMethod"),
  "remove-agent-credits-on-merge": server("removeAgentCreditsOnMerge"),
  "response-streaming": server("responseStreamingMode"),
  "review-guides": server("reviewGuidesEnabled"),
  "simlock-hosts": server("simlockDeviceHostsEnabled", true),
  "snooze-limited-threads": server("snoozeLimitedThreads"),
  "start-from-origin": server("newWorktreesStartFromOrigin"),
  "worktree-branch-naming": server("branchNamingMode"),
  "worktree-fast-checkout": server("fastWorktreeCheckout"),
  "worktree-submodules": server("worktreeSubmodules"),
  // Upstream's, on this device.
  "archive-confirmation": client("confirmThreadArchive"),
  "boring-sidebar": client("boringSidebarEnabled"),
  "boring-sidebar-multiline": client("boringSidebarMultilineRows"),
  "browser-auto-show-floating-preview": client("browserAutoShowFloatingPreview"),
  "browser-default-appearance": client("browserDefaultAppearance"),
  "browser-link-target": client("browserLinkTarget"),
  "browser-recording-key-presses": client("browserRecordingShowKeyPresses"),
  "browser-recording-mouse-presses": client("browserRecordingShowMousePresses"),
  "browser-search-engine": client("browserSearchEngine"),
  "chat-width": client("chatWidth"),
  "composer-context": client("persistComposerContextStrip"),
  "composer-rich-text": client("composerRichTextEnabled"),
  "default-diff-file-state": client("diffFilesCollapsed"),
  "delete-confirmation": client("confirmThreadDelete"),
  "dictation-shortcut-mode": client("voiceShortcutMode"),
  "diff-color-scheme": client("diffColorScheme"),
  "diff-layout": client("diffLayout"),
  "effort-display": client("effortDisplay"),
  "environment-identification": client("environmentIdentificationMode"),
  "follow-up-behavior": client("followUpBehavior"),
  "font-smoothing": client("fontSmoothing"),
  "hide-whitespace-changes": client("diffIgnoreWhitespace"),
  "in-app-notifications": client("inAppNotificationsEnabled"),
  "math-rendering": client("mathRenderingEnabled"),
  "proactive-panels": client("proactivePanelsEnabled"),
  "project-grouping": client("sidebarProjectGroupingMode"),
  "project-order": client("sidebarProjectSortOrder"),
  "pull-request-links-open-in-app": client("pullRequestLinksOpenInApp"),
  "quit-confirmation": client("confirmQuit"),
  "remove-filler-words": client("speechRemoveFillerWords"),
  "screen-reader-announcements": client("screenReaderAnnouncements"),
  "screen-reader-window-title": client("screenReaderWindowTitle"),
  "send-shortcut": client("sendShortcut"),
  "skills-in-slash-menu": client("showSkillsInSlashMenu"),
  "speech-silence-filtering": client("speechSilenceFiltering"),
  "speech-streaming": client("speechStreaming"),
  "terminal-close-confirmation": client("confirmTerminalClose"),
  "time-format": client("timestampFormat"),
  "tool-call-visibility": client("toolCallVisibility"),
  "unpin-confirmation": client("confirmThreadUnpin"),
  "word-wrap": client("wordWrap"),
  "working-shelf": client("sidebarWorkingShelfEnabled"),
  // Ours, and upstream's light and dark, which live outside both settings.
  "color-scheme": ours("appearanceMode"),
  // "Settings › Appearance › Theme = Dark" asks for dark: themes are palettes, but the ask is clear.
  theme: ours("appearanceMode"),
  "aski-tab-on": ours("askiTab"),
  "aski-plans": ours("askiPlans"),
  "aski-suggestions": ours("suggestions"),
  "aski-takes-retry": ours("takesRetry", true),
  "aski-takes-go-ahead": ours("takesGoAhead", true),
  "aski-takes-implement": ours("takesImplement", true),
};

export type Control =
  | { readonly kind: "switch" }
  | { readonly kind: "choice"; readonly options: ReadonlyArray<string> };

/** The part of a schema's AST a control reads. */
export interface SchemaAst {
  readonly _tag: string;
  readonly types?: ReadonlyArray<SchemaAst>;
  readonly literal?: unknown;
}

/** A setting's control from its schema: a boolean is a switch, fixed words a choice; else null. */
export function controlOf(ast: SchemaAst): Control | null {
  if (ast._tag === "Boolean") return { kind: "switch" };
  const options: string[] = [];
  const walk = (node: SchemaAst): boolean => {
    if (node._tag === "Null") return true;
    if (node._tag === "Union") return (node.types ?? []).every(walk);
    if (node._tag !== "Literal" || typeof node.literal !== "string") return false;
    if (!options.includes(node.literal)) options.push(node.literal);
    return true;
  };
  return walk(ast) && options.length > 1 ? { kind: "choice", options } : null;
}

/** An option's words: `notifications-and-sound` reads "Notifications and sound". */
export function optionLabel(option: string): string {
  const words = option
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A value as a card says it. */
export function valueLabel(control: Control, value: unknown): string {
  if (control.kind === "switch") return value === true ? "On" : "Off";
  return typeof value === "string" ? optionLabel(value) : "Default";
}

const ON = new Set(["on", "true", "yes", "enabled", "enable"]);
const OFF = new Set(["off", "false", "no", "disabled", "disable"]);

/** The value a reply suggests, read against the control; undefined when the words don't read. */
export function suggestedValue(control: Control, written: string): boolean | string | undefined {
  const word = written
    .trim()
    .replace(/^["'`*]+|["'`*.!]+$/g, "")
    .toLowerCase();
  if (control.kind === "switch") return ON.has(word) ? true : OFF.has(word) ? false : undefined;
  return control.options.find(
    (option) => option.toLowerCase() === word || optionLabel(option).toLowerCase() === word,
  );
}

/** What a card's row says under its title, the Mac's and the phone's alike. */
export type RowStatus =
  | { readonly kind: "changed" }
  | {
      readonly kind: "suggested";
      readonly from: string;
      readonly to: string;
      readonly want: boolean | string;
    }
  | { readonly kind: "already"; readonly words: string }
  | { readonly kind: "yours" }
  | null;

/** A row's status: changed here first, then a suggestion that differs, matches, or is refused. */
export function rowStatus(
  control: Control,
  binding: Binding,
  value: unknown,
  suggested: string | undefined,
  changedHere: boolean,
): RowStatus {
  if (changedHere) return { kind: "changed" };
  if (suggested === undefined) return null;
  if (binding.guarded === true) return { kind: "yours" };
  const want = suggestedValue(control, suggested);
  if (want === undefined) return null;
  if (want !== value)
    return {
      kind: "suggested",
      from: valueLabel(control, value),
      to: valueLabel(control, want),
      want,
    };
  return { kind: "already", words: `Already ${valueLabel(control, want).toLowerCase()}.` };
}

/** A guarded row's words when a reply suggested a value for it. */
export const YOURS = "Change this one yourself: a reply can only show it.";
