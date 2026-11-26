import CoreGraphics

/// How far a top veil under a native bar rises with it. iOS 27 minimizes the bar as the page
/// scrolls and shrinks the safe area with it, so the veil rises by as much as the safe area's top
/// has fallen from its rest: the deepest it stood since the veil's height or the window's size
/// last changed, as a rotation, a fold or a new bar measured by React changes them.
struct BarFollow {
  private var height: CGFloat = -1
  private var window: CGSize = .zero
  private var rest: CGFloat = 0

  mutating func lift(top: CGFloat, height: CGFloat, window: CGSize) -> CGFloat {
    if height != self.height || window != self.window {
      self.height = height
      self.window = window
      rest = top
    }
    rest = max(rest, top)
    return rest - top
  }
}
