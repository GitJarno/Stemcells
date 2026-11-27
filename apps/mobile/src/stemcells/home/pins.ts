// A pin is a move (the lists' one motion, `listMotion.ts`): the row glides to its place among the
// pins, or back among the rest, where T3 sends it away first and brings it back. T3's pin and
// unpin hand their dismissal here (`features/home/useThreadListActions.ts`).

/** In place of `withThreadDismissal` for a pin: the move is sent, and no row leaves. */
export function pinInPlace<T>(
  _key: string,
  action: () => Promise<T>,
  _succeeded: (result: T) => boolean,
): Promise<T> {
  return action();
}
