//
//  AnimatedBudgetBarGraph.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct AnimatedBudgetBarGraph: View {
    var color: Color
    var percent: Double

    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true
    @State var showBar: Bool = false

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(color.opacity(0.3))
                    .frame(height: proxy.size.height)

                if percent > 0 {
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)

                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(color.opacity(0.73))
                            .frame(height: showBar ? nil : 0, alignment: .bottom)
                    }
                    .frame(height: proxy.size.height * percent)
                }
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now()) {
                if !animated {
                    showBar = true
                } else {
                    withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                        showBar = true
                    }
                }
            }
        }
    }
}
