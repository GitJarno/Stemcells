// Which way a Cell's card swipes on the home: T3's row hands control here
// (`features/threads/thread-list-v2-items.tsx`, `features/home/thread-swipe-actions.tsx`).

/**
 * Which edge a row's main swipe stands on. A Cell moves the way the stages run, left to right:
 * Settle is a swipe right, toward Settled; Un-settle and Wake, back toward Landed, stay a swipe
 * left, and so does Snooze's menu of times, where a swipe left finds options.
 */
export function swipeEdgeOf(primary: string): "leading" | "trailing" {
  return primary === "settle" ? "leading" : "trailing";
}

/** What a row's swipes do, read aloud. */
export function swipeHint(primary: string, label: string, snoozes: boolean): string {
  const action = label.toLowerCase();
  if (swipeEdgeOf(primary) === "leading")
    return `Opens the Cell. Swipe right to ${action}${snoozes ? ", left to snooze" : ""}.`;
  return snoozes
    ? `Opens the Cell. Swipe left for ${action} and snooze actions.`
    : `Opens the Cell. Swipe left to ${action}.`;
}
