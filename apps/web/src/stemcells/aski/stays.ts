// ⌘W in Aski's tab: Aski never closes, so the key that would close the
// window says so instead, in the toasts where every notice shows (top right).
import { timing } from "../tokens/motion";
import { shortcutLabel } from "../upstream/keys";
import { toastManager } from "../upstream/ui";
import words from "./strings/en.json" with { type: "json" };

const LINES = [
  words["stays.cant"],
  words["stays.respawn"],
  words["stays.save"],
  words["stays.passive"],
  words["stays.hub"],
  words["stays.achievement"],
];

/** Any line but the last one said, with `{keys}` written as this platform writes them. */
export function staysLine(last: string | null, keys: string, random = Math.random): string {
  const fresh = LINES.map((line) => line.replace("{keys}", keys)).filter((line) => line !== last);
  return fresh[Math.floor(random() * fresh.length)]!;
}

// One toast by its id: pressed again, it changes in place rather than stacking.
const STAYS_TOAST_ID = "stemcells-aski-stays";
let lastSaid: string | null = null;

export function showAskiStays(): void {
  lastSaid = staysLine(lastSaid, shortcutLabel("mod+w"));
  toastManager.add({ id: STAYS_TOAST_ID, title: lastSaid, timeout: timing("linger") });
}
