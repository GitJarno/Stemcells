// A place in Settings named in a chat's words ("Settings → Providers → Antigravity") becomes a
// link to it (stemcells/tasks/settings-in-chat.md). The words are read against `catalog.json`,
// upstream's own index, so no agent learns an id; a path that doesn't read through, such as
// another app's, stays as written. The Mac and the phone share these rules.

import data from "./catalog.json" with { type: "json" };
import { mapProse } from "../words/prose.ts";

/** A page of Settings: its path on the Mac and its title. */
interface SettingsPage {
  readonly path: string;
  readonly label: string;
}

/** A row in Settings' search index: its id, title, page, and the anchor the page scrolls to. */
interface SettingsRow {
  readonly id: string;
  readonly title: string;
  readonly page: string;
  readonly anchor?: string;
}

/** A provider the Providers page shows, by its driver. */
interface SettingsProvider {
  readonly driver: string;
  readonly label: string;
}

export interface SettingsCatalog {
  readonly pages: ReadonlyArray<SettingsPage>;
  readonly rows: ReadonlyArray<SettingsRow>;
  readonly providers: ReadonlyArray<SettingsProvider>;
}

const CATALOG: SettingsCatalog = data;

const PROVIDERS_PAGE = "/settings/providers";

/** Where a link goes: a page, a row on it, or one provider on the Providers page. */
export type SettingsPlace =
  | { readonly kind: "page"; readonly page: string }
  | { readonly kind: "row"; readonly page: string; readonly id: string; readonly anchor: string }
  | { readonly kind: "provider"; readonly page: string; readonly driver: string };

/** An id in the characters a context link's id allows (`keybinding-appearance.cycle`). */
const linkable = (name: string) => name.replace(/[^a-z0-9_-]/gi, "_");

/** A place as a link's id. */
export function placeKey(place: SettingsPlace): string {
  if (place.kind === "page") return `page-${place.page.slice("/settings/".length)}`;
  if (place.kind === "row") return `row-${linkable(place.id)}`;
  return `provider-${place.driver}`;
}

/** The place a key names, or null when the catalog no longer has it. */
export function placeOf(key: string, catalog: SettingsCatalog = CATALOG): SettingsPlace | null {
  const [kind, ...rest] = key.split("-");
  const name = rest.join("-");
  if (kind === "page") {
    const page = catalog.pages.find((each) => each.path === `/settings/${name}`);
    return page === undefined ? null : { kind: "page", page: page.path };
  }
  if (kind === "row") {
    const row = catalog.rows.find((each) => linkable(each.id) === name);
    return row === undefined ? null : rowPlace(row);
  }
  if (kind === "provider") {
    const known = catalog.providers.some((each) => each.driver === name);
    return known ? { kind: "provider", page: PROVIDERS_PAGE, driver: name } : null;
  }
  return null;
}

const rowPlace = (row: SettingsRow): SettingsPlace => ({
  kind: "row",
  page: row.page,
  id: row.id,
  anchor: row.anchor ?? row.id,
});

/** A place's steps as Settings titles them: "Settings", "Providers", "Antigravity". */
export function crumbsFor(place: SettingsPlace, catalog: SettingsCatalog = CATALOG): string[] {
  const page = catalog.pages.find((each) => each.path === place.page)?.label ?? place.page;
  if (place.kind === "page") return ["Settings", page];
  const last =
    place.kind === "row"
      ? catalog.rows.find((row) => row.id === place.id)?.title
      : catalog.providers.find((provider) => provider.driver === place.driver)?.label;
  return ["Settings", page, last ?? ""];
}
const SEPARATOR = /^[ \t]*(?:›|→|»|▸|->|>)[ \t]*/;
const SETTINGS = /(?<![\p{L}\p{N}_./#@-])Settings(?![\p{L}\p{N}_-])/gu;
const WORD_BEFORE = /([\p{L}\p{N}_'’.-]+)[ \t]*$/u;
const WORD_GOES_ON = /^[\p{L}\p{N}_-]/u;

/** Words before "Settings" that make it another app's: "System Settings", "GitHub Settings". */
const ANOTHER_APPS = new Set([
  "system",
  "iphone",
  "ipad",
  "ios",
  "macos",
  "mac",
  "android",
  "windows",
  "chrome",
  "safari",
  "firefox",
  "browser",
  "github",
  "gitlab",
  "xcode",
  "slack",
  "discord",
  "google",
  "apple",
  "repository",
  "repo",
  "organization",
  "account",
  "developer",
  "workspace",
  "project",
  "app",
  "vercel",
  "code",
  "cursor",
  "claude",
  "codex",
  "antigravity",
  "gemini",
  "zed",
]);

interface Step {
  readonly label: string;
  readonly place: SettingsPlace;
}

function stepsAfter(place: SettingsPlace | null, catalog: SettingsCatalog): ReadonlyArray<Step> {
  if (place === null)
    return catalog.pages.map((page) => ({
      label: page.label,
      place: { kind: "page", page: page.path },
    }));
  if (place.kind !== "page") return [];
  const pageLabel = catalog.pages.find((page) => page.path === place.page)?.label;
  const rows: Step[] = catalog.rows
    .filter((row) => row.page === place.page && row.title !== pageLabel)
    .map((row) => ({ label: row.title, place: rowPlace(row) }));
  if (place.page !== PROVIDERS_PAGE) return rows;
  return [
    ...catalog.providers.map((provider): Step => ({
      label: provider.label,
      place: { kind: "provider", page: PROVIDERS_PAGE, driver: provider.driver },
    })),
    ...rows,
  ];
}

/** The longest step whose words start `text` as whole words, any case, one plural "s" either way. */
function stepAt(text: string, steps: ReadonlyArray<Step>): { step: Step; length: number } | null {
  let best: { step: Step; length: number } | null = null;
  const lower = text.toLowerCase();
  for (const step of steps) {
    const label = step.label.toLowerCase();
    const forms = label.endsWith("s") ? [label, label.slice(0, -1)] : [label, `${label}s`];
    for (const form of forms) {
      if (form.length === 0 || !lower.startsWith(form)) continue;
      if (WORD_GOES_ON.test(text.slice(form.length))) continue;
      if (best === null || form.length > best.length) best = { step, length: form.length };
    }
  }
  return best;
}

/**
 * Pages other apps' settings have too ("Settings → General → About" on a phone): one of these
 * links only when the step after it reads as well, or nothing follows.
 */
const SHARED_PAGES = new Set([
  "/settings/general",
  "/settings/appearance",
  "/settings/about",
  "/settings/devices",
  "/settings/browser",
  "/settings/chat",
  "/settings/voice",
  "/settings/projects",
  "/settings/archived",
  "/settings/diagnostics",
  "/settings/maintenance",
]);

/** A path found in prose: where it starts and ends, and the place it reads as. */
interface FoundPlace {
  readonly start: number;
  readonly end: number;
  readonly place: SettingsPlace;
}

/** Every path in `prose` that reads through to a place. */
function findPlaces(prose: string, catalog: SettingsCatalog = CATALOG): FoundPlace[] {
  const found: FoundPlace[] = [];
  for (const match of prose.matchAll(SETTINGS)) {
    const before = WORD_BEFORE.exec(prose.slice(0, match.index))?.[1];
    if (before !== undefined && ANOTHER_APPS.has(before.toLowerCase().replace(/['’]s$/, "")))
      continue;
    let at = match.index + match[0].length;
    let place: SettingsPlace | null = null;
    let depth = 0;
    let unread = false;
    for (;;) {
      const separator = SEPARATOR.exec(prose.slice(at));
      if (separator === null) break;
      const read = stepAt(prose.slice(at + separator[0].length), stepsAfter(place, catalog));
      if (read === null) {
        unread = true;
        break;
      }
      at += separator[0].length + read.length;
      place = read.step.place;
      depth += 1;
    }
    // Past a page of ours alone, or a row, words the catalog lacks are detail.
    if (place === null || (unread && depth === 1 && SHARED_PAGES.has(place.page))) continue;
    found.push({ start: match.index, end: at, place });
  }
  return found;
}

/**
 * The text with each path to a place in its prose written as `[path](hrefOf(place))`. A place
 * `hrefOf` has no link for (one the phone lacks) stays as written.
 */
export function linkPlaces(
  text: string,
  hrefOf: (place: SettingsPlace) => string | null,
  catalog: SettingsCatalog = CATALOG,
): string {
  if (!text.includes("Settings")) return text;
  return mapProse(text, (prose) => {
    let out = "";
    let from = 0;
    for (const { start, end, place } of findPlaces(prose, catalog)) {
      const href = hrefOf(place);
      if (href === null) continue;
      out += `${prose.slice(from, start)}[${prose.slice(start, end)}](${href})`;
      from = end;
    }
    return from === 0 ? prose : out + prose.slice(from);
  });
}
