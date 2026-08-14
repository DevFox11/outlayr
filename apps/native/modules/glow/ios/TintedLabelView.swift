import ExpoModulesCore
import ExpoUI
import SwiftUI
import UIKit

/**
 * A `Label` whose icon is a `circle.fill` already painted, so a SwiftUI
 * `.menu` picker cannot re-tint it. `UIMenu` discards `foregroundStyle`;
 * `withTintColor(_, renderingMode: .alwaysOriginal)` is the layer below.
 */
public final class TintedLabelProps: UIBaseViewProps {
  @Field var title: String = ""
  @Field var color: String = "#000000"
}

/** Small enough to read as a swatch beside body text, in the row and the list. */
private let SWATCH_POINT_SIZE: CGFloat = 9
private let SWATCH_GAP: CGFloat = 4

public struct TintedLabelView: ExpoSwiftUI.View {
  @ObservedObject public var props: TintedLabelProps

  public init(props: TintedLabelProps) {
    self.props = props
  }

  public var body: some View {
    Label {
      Text(props.title)
    } icon: {
      Image(uiImage: swatch)
    }
    // On the whole label rather than on the image. The closed `.menu` control
    // reads its label off the `UIImage`, so clearing the symbol's own label
    // does not reach it — stating the title here is the only lever left that
    // the picker might honour.
    .accessibilityLabel(Text(props.title))
  }

  /**
   * Pinned rather than left to inherit the surrounding text style. The closed
   * `.menu` picker renders the *selected item's* label, so an unpinned symbol
   * arrives on the settings row at menu size — which is what forced the row to
   * be a hand-built `Menu` label instead of a picker. At a fixed point size the
   * same view reads correctly in both places, and the picker keeps its own
   * chevron, sizing and accessibility.
   */
  private var swatch: UIImage {
    let painted = uiColor(hex: props.color) ?? .label
    let config = UIImage.SymbolConfiguration(pointSize: SWATCH_POINT_SIZE, weight: .regular)
    let image = UIImage(systemName: "circle.fill", withConfiguration: config)?
      .withTintColor(painted, renderingMode: .alwaysOriginal)
      // The gap has to be part of the image. `Label` owns the spacing between
      // its icon and title and ignores padding on either, so a negative right
      // inset is what keeps the dot off the word in the closed picker.
      .withAlignmentRectInsets(UIEdgeInsets(top: 0, left: 0, bottom: 0, right: -SWATCH_GAP))
      ?? UIImage()
    // Decorative, and the closed picker reads its label off the UIImage rather
    // than the SwiftUI view — left alone the control announces "Circle" where
    // the row beside it announces "Dark". SwiftUI's `accessibilityHidden` does
    // not reach this; the symbol's own label has to be cleared.
    image.accessibilityLabel = ""
    return image
  }
}

private func uiColor(hex: String) -> UIColor? {
  var digits = hex.trimmingCharacters(in: .whitespacesAndNewlines)
  if digits.hasPrefix("#") {
    digits.removeFirst()
  }
  guard digits.count == 6, let value = UInt32(digits, radix: 16) else {
    return nil
  }
  return UIColor(
    red: CGFloat((value >> 16) & 0xFF) / 255,
    green: CGFloat((value >> 8) & 0xFF) / 255,
    blue: CGFloat(value & 0xFF) / 255,
    alpha: 1
  )
}
