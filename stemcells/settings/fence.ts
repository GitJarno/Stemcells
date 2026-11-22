// A `setting` fence in a reply draws as a card of live settings (stemcells/tasks/settings-in-chat.md):
// a path a line, as a place in Settings reads in prose, "Settings ›" optional, and `= value` after
// it to suggest one. A line that doesn't read stays in the card as its words.

import { findPlaces, type SettingsCatalog, type SettingsPlace } from "./places.ts";

export type FenceLine =
  | { readonly place: SettingsPlace; readonly suggested?: string }
  | { readonly words: string };

const SUGGESTION = /^[ \t]*(?:=|:)[ \t]*(\S.*)$/;

/** The fence's lines, read; null when none names a place, so it shows as the code it is. */
export function readSettingFence(
  source: string,
  catalog?: SettingsCatalog,
): ReadonlyArray<FenceLine> | null {
  const lines: FenceLine[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim().replace(/^[-*][ \t]+/, "");
    if (line === "") continue;
    const path = /^Settings\b/.test(line) ? line : `Settings › ${line}`;
    const found = findPlaces(path, catalog)[0];
    const rest = found?.start === 0 ? path.slice(found.end) : null;
    const suggestion = rest === null ? null : rest.trim() === "" ? "" : SUGGESTION.exec(rest)?.[1];
    if (found === undefined || suggestion === null || suggestion === undefined) {
      lines.push({ words: line });
      continue;
    }
    lines.push(
      suggestion === ""
        ? { place: found.place }
        : { place: found.place, suggested: suggestion.trim() },
    );
  }
  return lines.some((line) => "place" in line) ? lines : null;
}
