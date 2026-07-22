//
//  AnimatedHorizontalBarGraphBudget.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct AnimatedHorizontalBarGraphBudget: View {
    let category: Category

    @State var showBar: Bool = false
    @AppStorage(DefaultsKey.animated, store: AppIdentifiers.sharedDefaults) var animated: Bool = true

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                .foregroundStyle(Color(hex: category.wrappedColor))
                .frame(width: showBar ? nil : 0, alignment: .leading)

            Spacer(minLength: 0)
        }
        .task {
            if !animated {
                showBar = true
            } else {
                withAnimation(.easeInOut(duration: 0.7)) {
                    showBar = true
                }
            }
        }
    }
}
