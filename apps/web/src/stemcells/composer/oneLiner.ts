/**
 * What the line over a Cell's composer says its chat is about: upstream's
 * title for the thread. Once the first message is sent, upstream asks a
 * model for a title of a few words that is never the message cut short, so
 * the line takes it as it comes and drops only what says nothing: no title,
 * upstream's placeholder, or a title that is only the names the line
 * already shows ("garden" beside the garden project).
 */
import { UNTITLED_THREAD } from "../upstream/titles";

export function oneLinerOf(title: string | null, names: readonly string[]): string | null {
  const line = title?.trim() ?? "";
  if (line === "" || line === UNTITLED_THREAD) return null;
  return namesOnly(line, names) ? null : line;
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");

/** The line is nothing but the names, in any order, alone or together, whatever stands between them. */
function namesOnly(line: string, names: readonly string[]): boolean {
  const said = words(line);
  const spelled = names.map(words).filter((name) => name.length > 0);
  const spells = (at: number): boolean =>
    at === said.length ||
    spelled.some(
      (name) => name.every((word, i) => said[at + i] === word) && spells(at + name.length),
    );
  return spelled.length > 0 && spells(0);
}
