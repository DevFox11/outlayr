//
//  InsightsChartComponents.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct AnimatedHorizontalBarGraph: View {
    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true
    var category: PowerCategory
    var index: Int

    @State var showBar: Bool = true

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(category.category.income ? Color(hex: Color.colorArray[index]) : Color(hex: category.category.wrappedColor))
                .frame(width: showBar ? nil : 0, alignment: .leading)

            Spacer(minLength: 0)
        }
//        .onAppear {
//            DispatchQueue.main.asyncAfter(deadline: .now()) {
//                if !animated {
//                    showBar = true
//                } else {
//                    withAnimation(.easeInOut(duration: 0.7).delay(Double(index) * 0.5)) {
//                        showBar = true
//                    }
//                }
//            }
//        }
    }
}
