//
//  CustomCapsuleProgress.swift
//  Outlayr
//
//  Created by Rafael Soh on 24/10/23.
//

import Foundation
import SwiftUI

struct CustomCapsuleProgress: View {
    var percent: Double
    var width: Double
    var topStroke: Color
    var bottomStroke: Color

    var percentString: String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .percent

        return numberFormatter.string(from: NSNumber(value: percent)) ?? "0%"
    }

    var body: some View {
        ZStack {
            CustomCapsule().foregroundStyle(Color.PrimaryBackground)
                .shadow(color: percent == 1 ? Color.IncomeGreen.opacity(0.6) : Color.clear, radius: 5)

            CustomCapsule()
                .stroke(bottomStroke, lineWidth: width)

            CustomCapsule()
                .trim(from: 0, to: percent)
                .stroke(percent == 1 ? Color.IncomeGreen : topStroke, style: StrokeStyle(lineWidth: width, lineCap: .round))

            Text(percentString)
                .foregroundStyle(percent == 1 ? Color.IncomeGreen : topStroke)
                .font(.system(.footnote, design: .rounded).weight(.bold))
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                .font(.system(size: 12, weight: .bold, design: .rounded))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Progress")
        .accessibilityValue(percentString)
    }
}
