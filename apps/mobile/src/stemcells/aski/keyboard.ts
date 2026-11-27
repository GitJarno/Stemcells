// Whether the system keyboard is on the screen, for Aski's button, which gives way to it.

/**
 * As the Duo opens or closes, iOS announces a keyboard of no height and never takes it back
 * (seen on iOS 27): only one with a height is on the screen. Believed, it hid the button until the
 * app started again.
 */
export function keyboardShows(frame: { readonly height: number } | null | undefined): boolean {
  return frame != null && frame.height > 0;
}
