//
//  InsightsChartComponents.swift
//  Outlayr

import Foundation
import SwiftUI

struct AnimatedBarGraph: View {
    var index: Int

    @AppStorage(DefaultsKey.animated, store: AppIdentifiers.sharedDefaults) var animated: Bool = true
    @State var showBar: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.DarkBackground)
                .frame(height: showBar ? nil : 0, alignment: .bottom)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now()) {
                if !animated {
                    showBar = true
                } else {
                    withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8).delay(Double(index) * 0.1)) {
                        showBar = true
                    }
                }
            }
        }
    }
}
