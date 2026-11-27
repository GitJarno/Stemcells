/**
 * Input's all-clear (`stemcells/tasks/inbox.md`, decision 7): one line of what the person did,
 * and a short fact about stem cells, a different one each time.
 */

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** How long a clearing took: "40 seconds", "6 minutes", "1 hour 20 minutes". */
export function clearingTime(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return plural(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? plural(hours, "hour") : `${plural(hours, "hour")} ${plural(rest, "minute")}`;
}

/** "4 Cells flying again, in 6 minutes"; with none flying (all put off or slept), "All clear". */
export function clearedWords(flying: number, ms: number): string {
  const what = flying === 0 ? "All clear" : `${plural(flying, "Cell")} flying again`;
  return `${what}, in ${clearingTime(ms)}`;
}

/** Short, checked facts about stem cells, safe to read at work. */
export const STEM_CELL_FACTS: ReadonlyArray<string> = [
  "A stem cell can make more of itself, or become another kind of cell.",
  "Blood stem cells in your bone marrow make billions of new blood cells every day.",
  "A red blood cell lives about four months, so stem cells keep making new ones.",
  "Your gut's lining renews itself every few days, from stem cells at the base of tiny pits.",
  "Your skin's outer layer is rebuilt from stem cells about once a month.",
  "In 2006 Shinya Yamanaka turned mouse skin cells back into stem cells with four genes.",
  "Yamanaka shared the 2012 Nobel Prize with John Gurdon, who cloned frogs in the 1960s.",
  "Stem cells made from grown-up cells are called induced pluripotent stem cells, or iPS cells.",
  "Embryonic stem cells were first grown from mice in 1981.",
  "Human embryonic stem cells were first grown in a lab in 1998.",
  "In 1961 James Till and Ernest McCulloch first showed blood stem cells, in mice, in Toronto.",
  "A single blood stem cell can rebuild a mouse's whole blood system.",
  "A bone marrow transplant is a stem cell transplant: the donor's cells rebuild the blood.",
  "After a bone marrow transplant, a person's blood type can change to the donor's.",
  "E. Donnall Thomas shared the 1990 Nobel Prize for bone marrow transplants.",
  "Umbilical cord blood is rich in blood stem cells and has been used in transplants since 1988.",
  "A planarian flatworm can regrow its whole body from a small piece, thanks to its stem cells.",
  "An axolotl regrows a lost leg from a bud of cells called a blastema.",
  "Plants keep stem cells at the tips of their shoots and roots, in places called meristems.",
  "Hair follicles keep stem cells that start each new cycle of hair growth.",
  "The clear front of your eye is kept up by stem cells around its rim.",
  "Baby teeth hold stem cells in their soft pulp.",
  "Muscle has stem cells of its own, called satellite cells, which repair it after an injury.",
  "In adult mice, stem cells keep making new neurons in a few parts of the brain.",
  "A fertilised egg can make every cell of the body, and the placenta too.",
  "When a stem cell divides, one daughter can stay a stem cell while the other specialises.",
  "The place a stem cell lives, which tells it when to divide, is called its niche.",
  "A liver regrows after part of it is removed, mostly from liver cells dividing, not stem cells.",
  "Organoids are tiny organ-like clusters grown from stem cells in a dish, such as mini guts.",
  "Hydra, a tiny freshwater animal, keeps renewing its body from stem cells all its life.",
];

/**
 * The fact after `last` (an index, or null for none yet): every one before any comes again.
 * The first is `start`, a number in [0, 1), so each place begins somewhere of its own.
 */
export function factAfter(last: number | null, start: number): number {
  const count = STEM_CELL_FACTS.length;
  return last === null ? Math.floor(start * count) % count : (last + 1) % count;
}
