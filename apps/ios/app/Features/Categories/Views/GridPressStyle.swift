//
//  CategoryAlerts.swift
//  Outlayr
//

import CoreData
import HugeiconsCore
import HugeiconsSolidRounded
import HugeiconsStrokeRounded
import SwiftUI
import UIKit

/// The shared press feedback for the category hero: a brief squeeze, no ripple.
struct GridPressStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    var pressedOpacity: Double? = 0.85
    var animation: Animation = .spring(response: 0.25, dampingFraction: 0.7)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .opacity(configuration.isPressed ? (pressedOpacity ?? 1) : 1)
            .animation(animation, value: configuration.isPressed)
    }
}
