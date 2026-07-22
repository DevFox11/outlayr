//
//  IncomeFilterToggleView.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct IncomeFilterToggleView: View {
    @Binding var income: Bool

    @Environment(\.colorSchemeContrast) private var colorSchemeContrast

    @Namespace var animation

    var body: some View {
        HStack(spacing: 0) {
            Button {
                withAnimation(.easeIn(duration: 0.15)) {
                    income = false
                }
            } label: {
                Text("Expense")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .foregroundStyle(income == false ? Color.PrimaryText : Color.SubtitleText)
                    .padding(5.5)
                    .padding(.horizontal, 8)
                    .background {
                        if income == false {
                            Capsule()
                                .fill(Color.SecondaryBackground)
                                .matchedGeometryEffect(id: "TAB1", in: animation)
                        }
                    }
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(income == false ? .isSelected : [])

            Button {
                withAnimation(.easeIn(duration: 0.15)) {
                    income = true
                }
            } label: {
                Text("filter-picker-income")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .foregroundStyle(income == true ? Color.PrimaryText : Color.SubtitleText)
                    .padding(5.5)
                    .padding(.horizontal, 8)
                    .background {
                        if income == true {
                            Capsule()
                                .fill(Color.SecondaryBackground)
                                .matchedGeometryEffect(id: "TAB1", in: animation)
                        }
                    }
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(income == true ? .isSelected : [])
        }
        .padding(3)
        .overlay(Capsule().stroke(Color.Outline.opacity(colorSchemeContrast == .increased ? 1.0 : 0.6), lineWidth: colorSchemeContrast == .increased ? 2.0 : 1.3))
    }
}
