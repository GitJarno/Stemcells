// A native bar's inset at rest. iOS minimizes the bar as the page scrolls and shrinks the inset
// React reads with it; a veil cut to that live inset shrank too, and the native veil took the
// shrunk bar for its rest and stayed, blurring the top of a page with no bar over it.

export interface Resting {
  readonly width: number;
  readonly height: number;
  /** The deepest the bar has stood in a window of this size. */
  readonly bar: number;
}

/** A turn or a fold makes a new window, and a new bar to learn. */
export function restingBar(
  held: Resting | null,
  window: { readonly width: number; readonly height: number },
  bar: number,
): Resting {
  if (held === null || held.width !== window.width || held.height !== window.height)
    return { width: window.width, height: window.height, bar };
  return bar > held.bar ? { ...held, bar } : held;
}
