// A list's search left for a chat stays open only for a query. Its field reopens when the
// screen comes back (T3's `WorkspaceToolbar.ios.tsx`), which puts results back; an empty one
// filters nothing, so it closes on the way out, as iOS apps leave theirs.

export function closesOnLeave(tab: {
  readonly query: string;
  readonly searchMode: "resting" | "active" | "expanded";
}): boolean {
  return tab.searchMode !== "resting" && tab.query.trim() === "";
}
