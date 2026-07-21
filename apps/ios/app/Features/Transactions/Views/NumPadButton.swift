//
//  NumPadButton.swift
//  xpenz
//
//  Created by Rafael Soh on 14/5/22.
//

import Foundation
import SwiftUI

struct NumPadButton: ButtonStyle {
    public func makeBody(configuration: Self.Configuration) -> some View {
        return configuration.label
            .scaleEffect(configuration.isPressed ? 0.8 : 1)
            .animation(.easeOut(duration: 0.3), value: configuration.isPressed)
            .opacity(configuration.isPressed ? 0.5 : 1)
    }
}
