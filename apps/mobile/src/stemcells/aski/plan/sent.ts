// The moment a plan is sent (stemcells/tasks/aski-orchestrator.md, decision 18): when each Cell
// forms in its row, a stagger apart, and the taps the hand feels. One firm tap at Send, then a
// light one as each of the first three Cells condenses. Nothing here repeats.

import * as Haptics from "expo-haptics";

import { ARRIVAL_BEAT_MS, ARRIVALS } from "../../../../../../stemcells/aski/arrivals.ts";
import { clockSeconds, GLYPHS } from "../../cell/kit";

/** The light taps after a Send's firm one: one a Cell, three at most. */
const TAPS = 3;
/** How long a Send is remembered, seconds: long past the last Cell forming in its row. */
const KEPT = 60;

/**
 * When each sent Cell forms in its row, ms after the Send, by its act. Where Awake stands beside
 * the chat the rows keep Awake's own stagger, so its row forms a beat after the card's; on a
 * narrow screen they come a beat apart.
 */
export function beatsOf(sent: ReadonlyArray<number>, narrow: boolean): Map<number, number> {
  const stagger = narrow ? ARRIVAL_BEAT_MS : ARRIVALS.stagger;
  return new Map(sent.map((i, place) => [i, Math.round(place * stagger)]));
}

/** When the light taps come, ms after the Send: as a Cell's glyphs have condensed into it. */
export const tapsOf = (beats: ReadonlyMap<number, number>): number[] =>
  [...beats.values()].slice(0, TAPS).map((at) => Math.round(at + GLYPHS.length * ARRIVAL_BEAT_MS));

const moments = new Map<string, { readonly at: number; readonly beats: Map<number, number> }>();

/** The person sent plan `planId`'s Cells `sent` (their acts, in the rows' order), now. */
export function sentNow(planId: string, sent: ReadonlyArray<number>, narrow: boolean): void {
  const at = clockSeconds();
  for (const [id, moment] of moments) if (moment.at < at - KEPT) moments.delete(id);
  const beats = beatsOf(sent, narrow);
  moments.set(planId, { at, beats });
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  for (const tap of tapsOf(beats))
    setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), tap);
}

/**
 * When the Cell of act `i` forms in its row, on the Cells' clock (seconds); undefined for a Cell
 * this phone didn't just send, which stands.
 */
export function formsAt(planId: string, i: number): number | undefined {
  const moment = moments.get(planId);
  const beat = moment?.beats.get(i);
  return moment === undefined || beat === undefined ? undefined : moment.at + beat / 1000;
}
