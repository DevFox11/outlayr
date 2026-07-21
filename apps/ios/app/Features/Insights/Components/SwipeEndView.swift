//
//  InsightsChartComponents.swift
//  Outlayr
//

import Foundation
import Popovers
import SwiftUI

struct SwipeEndView: View {
    let left: Bool

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: left ? "eyeglasses" : "sun.haze.fill")
                .font(.system(.title2, design: .rounded).weight(.medium))
//                                        .font(.system(size: 22, weight: .medium))
                .foregroundStyle(Color.SubtitleText)

            Text(left ? "That's all, buddy." : "Into the unknown.")
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
//                                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                .frame(width: 90)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.SubtitleText)
        }
        .opacity(0.8)
        .drawingGroup()
    }
}
