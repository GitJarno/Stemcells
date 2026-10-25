// The photos picked on Add to Chat, in the order they were tapped: the order
// they reach the composer, as the original app's card and the Mac's composer stage
// files. A tap picks a photo or lets it go; once a go is full, a tap on
// another is refused, and the card says why.

/**
 * Photos a go takes. T3's picker takes up to its attachment cap (100), but
 * each photo is read into the draft whole; ten keeps a go quick, and the
 * card offers another.
 */
export const GO = 10;

export type Toggled = "picked" | "unpicked" | "full";

/** `picks` after a tap on `id`, and what the tap did. */
export function toggle(
  picks: readonly string[],
  id: string,
  limit: number = GO,
): { readonly picks: readonly string[]; readonly toggled: Toggled } {
  if (picks.includes(id)) {
    return { picks: picks.filter((picked) => picked !== id), toggled: "unpicked" };
  }
  if (picks.length >= limit) return { picks, toggled: "full" };
  return { picks: [...picks, id], toggled: "picked" };
}

/** Where `id` stands among `picks`, from 1; undefined when it isn't picked. */
export function numberOf(picks: readonly string[], id: string): number | undefined {
  const index = picks.indexOf(id);
  return index < 0 ? undefined : index + 1;
}
