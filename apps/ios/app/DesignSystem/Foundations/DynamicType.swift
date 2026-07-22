//
//  DynamicType.swift
//  Outlayr
//
//  Created by Rafael Soh on 24/10/23.
//

import SwiftUI

extension EnvironmentValues {
    var dynamicTypeMultiplier: CGFloat {
        switch self.dynamicTypeSize {
        case .xSmall:
            0.9
        case .small:
            0.93
        case .medium:
            0.96
        case .large:
            1.0
        case .xLarge:
            1.05
        case .xxLarge:
            1.1
        case .xxxLarge:
            1.15
        case .accessibility1:
            1.25
        case .accessibility2:
            1.4
        case .accessibility3:
            1.6
        case .accessibility4:
            1.8
        case .accessibility5:
            2.0
        @unknown default:
            1.0
        }
    }
}
