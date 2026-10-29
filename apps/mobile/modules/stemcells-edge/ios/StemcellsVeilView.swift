import ExpoModulesCore
import UIKit

/// The page blurs as it slides under the chrome: heaviest at the screen's edge, clear by the
/// chrome's inner side, nothing painted over it. UIKit has no public variable blur, so this drives
/// a `UIVisualEffectView`'s backdrop with Core Animation's `variableBlur` filter, the one the
/// system's own bars use, and hides the effect's tint. Without the filter it draws nothing: a
/// clear edge beats a grey one.
final class StemcellsVeilView: ExpoView {
  enum Edge { case top, bottom }

  /// Blur radius at the screen's edge, in points.
  static let radius: CGFloat = 3.4
  /// The share of the veil, from its foot, that stays clear.
  static let clearFoot: CGFloat = 0.25

  var edge: Edge = .top {
    didSet {
      guard edge != oldValue else { return }
      filter = Self.filter(edge)
      apply()
    }
  }

  private let effectView = UIVisualEffectView(effect: UIBlurEffect(style: .regular))
  private var filter: NSObject?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    filter = Self.filter(edge)
    isUserInteractionEnabled = false
    addSubview(effectView)
    // UIKit rebuilds the backdrop's filters when the appearance changes.
    registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (view: StemcellsVeilView, _: UITraitCollection) in
      view.apply()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    effectView.frame = bounds
    apply()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    // `scale` is the private backdrop layer's key: blur at the screen's scale.
    guard let scale = window?.screen.scale else { return }
    effectView.subviews.first?.layer.setValue(scale, forKey: "scale")
    apply()
  }

  private func apply() {
    guard let filter, let backdrop = effectView.subviews.first else {
      effectView.isHidden = true
      return
    }
    effectView.isHidden = false
    if backdrop.layer.filters?.first as? NSObject !== filter {
      backdrop.layer.filters = [filter]
    }
    for tint in effectView.subviews.dropFirst() { tint.alpha = 0 }
  }

  /// Alpha is blur strength: none through the clear foot, then an eased ramp to full at the
  /// screen's edge. Row 0 of the image is the view's bottom: a top veil's foot, a bottom one's edge.
  private static func mask(_ edge: Edge) -> CGImage? {
    let height = 128
    guard let context = CGContext(
      data: nil, width: 1, height: height, bitsPerComponent: 8, bytesPerRow: 4,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return nil }
    for y in 0..<height {
      let rise = CGFloat(y) / CGFloat(height - 1)
      let raw = edge == .top ? rise : 1 - rise
      let t = max(0, (raw - clearFoot) / (1 - clearFoot))
      context.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: t * t * (3 - 2 * t)))
      context.fill(CGRect(x: 0, y: y, width: 1, height: 1))
    }
    return context.makeImage()
  }

  /// `CAFilter` and its `variableBlur` type are private Core Animation API; nil without them.
  private static func filter(_ edge: Edge) -> NSObject? {
    guard let mask = mask(edge),
          let filterClass = NSClassFromString("CAFilter") as? NSObject.Type,
          let made = filterClass.perform(NSSelectorFromString("filterWithType:"), with: "variableBlur"),
          let filter = made.takeUnretainedValue() as? NSObject
    else { return nil }
    filter.setValue(radius, forKey: "inputRadius")
    filter.setValue(mask, forKey: "inputMaskImage")
    filter.setValue(true, forKey: "inputNormalizeEdges")
    return filter
  }
}
