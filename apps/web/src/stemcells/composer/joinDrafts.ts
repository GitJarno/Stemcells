/**
 * A draft's content with another's moved in after it, so neither is lost: words follow words
 * across a blank line, each list follows the list already there (an item already there by id
 * stays once), and a single slot such as the reply keeps its own before taking the moved one.
 */
export function joinDraftContent<Content extends { readonly prompt: string }>(
  kept: Content,
  moved: Content,
): Content {
  const joined: Record<string, unknown> = { ...kept };
  for (const [key, value] of Object.entries(moved)) {
    const own = joined[key];
    if (Array.isArray(own) && Array.isArray(value)) {
      const ids = new Set<unknown>(own.map(idOf));
      joined[key] = [
        ...own,
        ...value.filter((item: unknown) => idOf(item) === undefined || !ids.has(idOf(item))),
      ];
    } else if (own === null || own === undefined) {
      joined[key] = value;
    }
  }
  joined.prompt =
    kept.prompt.trim() === ""
      ? moved.prompt
      : moved.prompt.trim() === ""
        ? kept.prompt
        : `${kept.prompt}\n\n${moved.prompt}`;
  return joined as Content;
}

function idOf(item: unknown): unknown {
  if (typeof item === "string") return item;
  return typeof item === "object" && item !== null && "id" in item ? item.id : undefined;
}
