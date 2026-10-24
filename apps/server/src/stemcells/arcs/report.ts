/**
 * What the arcs say, as Aski tells the person how their work with Cells is
 * going (stemcells/tasks/aski-forward.md, Move 3, slice 2): this week
 * against the one before, in three lines, each measure with the last
 * week's beside it. Pure.
 */
import type { WeekArcs } from "./arcs.ts";

/** "3 (5)": this week's, then last week's when it had one. */
const against = (now: number | null, before: number | null | undefined) =>
  now === null ? null : before == null ? `${now}` : `${now} (${before})`;

/** The report for weeks oldest first, the last one this week. */
export function arcsReport(weeks: ReadonlyArray<WeekArcs>): string {
  const now = weeks.at(-1);
  if (now === undefined || weeks.every((week) => week.cells === 0))
    return "No Cells have run on this server in the last eight weeks.";
  const before = weeks.at(-2);
  const turns = against(now.turnsPerCell, before?.turnsPerCell);
  const flight = against(now.flightMinutes, before?.flightMinutes);
  const answer = against(now.answerMinutes, before?.answerMinutes);
  const compared = [before?.turnsPerCell, before?.flightMinutes, before?.answerMinutes].some(
    (value) => value != null,
  );
  const stops = Object.values(now.stops).reduce((sum, count) => sum + count, 0);
  const said = now.stops.done + now.stops.yourStep + now.stops.waiting;
  return [
    [
      `This week (from ${now.week})${compared ? ", last week's in brackets" : ""}: ${now.cells} Cells`,
      turns === null ? null : `${turns} of your turns a Cell`,
      flight === null ? null : `${flight} min of work between your turns`,
    ]
      .filter((part) => part !== null)
      .join(", ") + ".",
    [
      `Asks: ${now.asksThroughTool} on a card, ${now.stops.yourStep} as your step, ${now.stops.asked} in prose`,
      answer === null ? null : `answered in ${answer} min`,
    ]
      .filter((part) => part !== null)
      .join(", ") + ".",
    `${said} of ${stops} stops said where they stood.`,
  ].join("\n");
}
