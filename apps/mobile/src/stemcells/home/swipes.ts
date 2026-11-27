// Which way a Cell's row swipes on the home: T3's row hands control here
// (`features/threads/thread-list-v2-items.tsx`, `features/home/thread-swipe-actions.tsx`).

/**
 * Which edge a row's main swipe stands on. A Cell moves the way the stages run, left to right:
 * Sleep is a swipe right, toward Asleep; Wake, back toward Awake, stays a swipe left, and so
 * does Snooze's menu of times, where a swipe left finds options.
 */
export function swipeEdgeOf(primary: string): "leading" | "trailing" {
  return primary === "settle" ? "leading" : "trailing";
}

/** What a row's swipes do, read aloud, in our words whatever upstream's labels say. */
export function swipeHint(primary: string, label: string, snoozes: boolean): string {
  if (primary === "settle")
    return `Opens the Cell. Swipe right to sleep${snoozes ? ", left to choose when it wakes" : ""}.`;
  const action = primary === "unsettle" || primary === "unsnooze" ? "wake" : label.toLowerCase();
  return `Opens the Cell. Swipe left to ${action}${snoozes ? ", or to choose when it wakes" : ""}.`;
}
