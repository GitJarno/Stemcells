// Aski shows a Cell, a Settings place or a stage (stemcells/tasks/aski-side.md). The show travels
// as the `stemcells_show` call in Aski's own chat, which the server refuses to any other caller; a
// client turns to it only while that chat is in front and the person is at it. Nothing here writes.

import { findPlaces, placeKey, placeOf } from "../settings/places.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/** The home's stages as both homes' code names them (Input, Awake, Asleep). */
export const SHOW_STAGES = ["needs", "awake", "asleep"] as const;
export type ShowStage = (typeof SHOW_STAGES)[number];

export type AskiShow =
  | { readonly kind: "cell"; readonly environmentId: string; readonly threadId: string }
  /** `place` is a Settings place's key (`stemcells/settings/places.ts`, `placeKey`). */
  | { readonly kind: "settings"; readonly place: string }
  | { readonly kind: "stage"; readonly stage: ShowStage };

export const SHOW_TOOL = "stemcells_show";
/** T3's own MCP server and this tool, as each provider writes it (`mcp__t3-code__…`, `t3-code.…`). */
const T3_SHOW_TOOL = /^(?:mcp__)?t3[-_]?code(?:[-_]direct)?(?:__|[.:/]|\s*·\s*)stemcells_show$/i;
/** Only T3's server's: another MCP server's tool of the same name never moves a screen. */
export const isShowTool = (toolName: string | null): boolean =>
  toolName !== null && T3_SHOW_TOOL.test(toolName.trim());

/** The tool's arguments: exactly one of these. */
export interface ShowInput {
  /** A Cell's thread id. */
  readonly cell?: string;
  /** A place in Settings as Settings words it (`Settings › Providers › Codex`), or a place key. */
  readonly settings?: string;
  /** A stage as the person reads it. */
  readonly stage?: "Input" | "Awake" | "Asleep";
}

const STAGE_OF: ReadonlyMap<string, ShowStage> = new Map([
  ["Input", "needs"],
  ["Awake", "awake"],
  ["Asleep", "asleep"],
  // A server from before the three stages names the four-stage line's.
  ["Flying", "awake"],
  ["Landed", "awake"],
  ["Settled", "asleep"],
]);

/** A Settings place's key from its words or its key, or null when the catalog has no such place. */
export function settingsPlaceKey(words: string): string | null {
  if (placeOf(words) !== null) return words;
  const named = /^settings\b/i.test(words.trim()) ? words : `Settings › ${words}`;
  const found = findPlaces(named)[0];
  return found === undefined ? null : placeKey(found.place);
}

/**
 * The show the tool's arguments name, on Aski's machine `environmentId`, or null when they name
 * none or more than one. A Cell's existence is the caller's to check.
 */
export function showOfInput(input: unknown, environmentId: string): AskiShow | null {
  if (!isRecord(input)) return null;
  const named = ["cell", "settings", "stage"].filter((key) => input[key] !== undefined);
  if (named.length !== 1) return null;
  if (isText(input.cell)) return { kind: "cell", environmentId, threadId: input.cell };
  if (isText(input.settings)) {
    const place = settingsPlaceKey(input.settings);
    return place === null ? null : { kind: "settings", place };
  }
  const stage = isText(input.stage) ? STAGE_OF.get(input.stage) : undefined;
  return stage === undefined ? null : { kind: "stage", stage };
}

export interface AskiShowEvent {
  /** The tool call's item id: each is shown once. */
  readonly id: string;
  /** When the call completed, epoch milliseconds. */
  readonly at: number;
  readonly show: AskiShow;
}

/** `POST`: a fresh Aski chat; the one before settles, still readable. Answers `{ threadId }`. */
export const ASKI_FRESH_PATH = "/api/stemcells/aski/fresh";

/** A show older than this, by the time it arrives, is let go: the moment it was for has passed. */
export const SHOW_FRESH_MS = 15_000;
/** The person is at a device they touched this recently. */
export const AT_DEVICE_MS = 120_000;

export interface ShowGate {
  /** Aski's chat is the one in front on this device. */
  readonly askiInFront: boolean;
  /** The app is in the foreground, its window shown. */
  readonly visible: boolean;
  /** When the person last touched, typed or clicked here, epoch milliseconds. */
  readonly lastTouchAt: number;
  readonly now: number;
}

/** Whether this device turns to a show that arrived at `gate.now`. */
export function mayShow(event: AskiShowEvent, gate: ShowGate): boolean {
  return (
    gate.askiInFront &&
    gate.visible &&
    gate.now - gate.lastTouchAt <= AT_DEVICE_MS &&
    Math.abs(gate.now - event.at) <= SHOW_FRESH_MS
  );
}
