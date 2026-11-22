// A place in Settings a reply names, on the phone (stemcells/tasks/settings-in-chat.md): its path
// becomes a pill titled as Settings titles it, and a tap opens the phone's own page for it, as a
// `settings/…` link does. A place the phone has no page for stays as written.
import {
  crumbsFor,
  linkPlaces,
  placeKey,
  placeOf,
  type SettingsPlace,
} from "../../../../../stemcells/settings/places.ts";

const PREFIX = "t3-context://v1/stemcells-place/";

/** The phone's page, by its link path, for each page of the Mac's Settings it has one for. */
export const PHONE_PAGES: Readonly<Record<string, string>> = {
  "/settings/providers": "settings/provider-accounts",
  "/settings/appearance": "settings/appearance",
  "/settings/threads": "settings/thread-preferences",
  "/settings/chat": "settings/follow-ups",
  "/settings/worktrees": "settings/worktrees",
  "/settings/source-control": "settings/source-control",
  "/settings/scheduled-tasks": "settings/scheduled-tasks",
  "/settings/connections": "settings/environments",
  "/settings/maintenance": "settings/maintenance",
  "/settings/diagnostics": "settings/diagnostics",
  "/settings/labs": "settings/labs",
  "/settings/about": "settings/about",
  "/settings/voice": "settings/voice",
  "/settings/keybindings": "settings/keyboard",
  "/settings/archived": "settings/archive",
  "/settings/disk": "settings/disk",
  "/settings/collection": "settings/collection",
};

const hrefFor = (place: SettingsPlace) =>
  PHONE_PAGES[place.page] === undefined ? null : `${PREFIX}${placeKey(place)}`;

/** The words with each place the phone can open written as its link. */
export function linkPlacesOnPhone(markdown: string): string {
  return linkPlaces(markdown, hrefFor);
}

const placeIn = (href: string) =>
  href.startsWith(PREFIX) ? placeOf(href.slice(PREFIX.length)) : null;

/** A place's pill: its steps as Settings titles them. Undefined for any other link. */
export function placePill(
  href: string,
  accent: string,
): { readonly label: string; readonly chip: { accent: string; tintsIcon: boolean } } | undefined {
  const place = placeIn(href);
  if (place === null) return undefined;
  return { label: crumbsFor(place).join(" › "), chip: { accent, tintsIcon: false } };
}

/** The `settings/…` link path of a place's page on the phone; undefined for any other link. */
export function placePage(href: string): string | undefined {
  const place = placeIn(href);
  return place === null ? undefined : PHONE_PAGES[place.page];
}
