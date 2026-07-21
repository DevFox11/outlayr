//
//  InsightsChartComponents.swift
//  Outlayr
//

import Foundation
import Popovers
import SwiftUI

struct SwipeArrowView: View {
    let left: Bool
    let swipeString: String
    let changeTime: Bool

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: left ? "arrow.backward.circle.fill" : "arrow.forward.circle.fill")
                .font(.system(.body, design: .rounded).weight(.medium))
//                                        .font(.system(size: 18, weight: .medium))
                //                                .scaleEffect(changeTime ? 1.3 : 1)
                .foregroundStyle(changeTime ? Color.PrimaryText : Color.SecondaryBackground)

            Text(swipeString)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
//                                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                .multilineTextAlignment(.center)
                .foregroundStyle(changeTime ? Color.PrimaryText : Color.SecondaryBackground)
        }
        .drawingGroup()
    }
}
