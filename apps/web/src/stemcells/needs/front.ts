/**
 * Who stands in front of Aski's room, and the line behind (stemcells/tasks/one-ask.md,
 * decisions 1 and 3): an ask that blocks a running turn ahead of steps left to the person,
 * then the list's own order; the one in front stays there until it goes.
 */
import type { Shown } from "./display";

export function lineUp(
  waiting: ReadonlyArray<Shown>,
  pinned: string | null,
): { readonly front: Shown | null; readonly line: ReadonlyArray<Shown> } {
  const order = waiting.toSorted((a, b) => Number(b.need.blocks) - Number(a.need.blocks));
  const front = order.find((each) => each.need.key === pinned) ?? order[0] ?? null;
  return { front, line: order.filter((each) => each !== front) };
}
