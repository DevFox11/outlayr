import SwiftUI

public extension Animation {
    /// Critically-damped fit of NumberFlow's default 900 ms deceleration curve
    /// (zeta = 1.00, omega_n ~= 10.3 rad/s; RMSE 0.0012 against the 90 published
    /// `linear()` control points).
    static var numberFlow: Animation {
        .spring(Spring(duration: 0.61, bounce: 0))
    }

    /// NumberFlow's default enter/exit fade: CSS `ease-out` over 450 ms.
    static var numberFlowOpacity: Animation {
        .timingCurve(0, 0, 0.58, 1, duration: 0.45)
    }
}

/// The three timing channels of a NumberFlow update, mirroring the web's
/// `transformTiming` / `spinTiming` / `opacityTiming`.
public struct NumberFlowTransition: Equatable, Sendable {
    /// Layout transforms: slot translation and width changes.
    public var transform: Animation
    /// The vertical digit roll. `nil` inherits `transform`, like the web default.
    public var spin: Animation?
    /// Character enter/exit fades and symbol crossfades.
    public var opacity: Animation

    public var resolvedSpin: Animation { spin ?? transform }

    public init(
        transform: Animation = .numberFlow,
        spin: Animation? = nil,
        opacity: Animation = .numberFlowOpacity
    ) {
        self.transform = transform
        self.spin = spin
        self.opacity = opacity
    }

    public static let `default` = NumberFlowTransition()
}
