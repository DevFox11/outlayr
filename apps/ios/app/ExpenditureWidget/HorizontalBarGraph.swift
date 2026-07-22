//
//  HorizontalBarGraph.swift
//  Outlayr
//

import SwiftUI

struct HorizontalBarGraph: View {
    var categories: [HoldingCategory]
    let income: Bool

    private var summary: String {
        categories
            .filter { $0.percent >= 0.02 }
            .map { "\($0.name) \(Int($0.percent * 100))%" }
            .joined(separator: ", ")
    }

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: proxy.size.width * 0.015) {
                ForEach(categories, id: \.self) { category in
                    if category.percent < 0.02 {
                        EmptyView()
                    } else if category.percent < 0.1 {
                        let radius0 = CGFloat(0.09 + (0.25 * category.percent * 100))
                        RoundedRectangle(cornerRadius: radius0, style: .continuous)
                            .fill(income ? Color(hex: Color.colorArray[categories.firstIndex(of: category) ?? 0]) : Color(hex: category.color))
                            .overlay {
                                RoundedRectangle(cornerRadius: radius0, style: .continuous)
                                    .stroke(Color.PrimaryBackground, lineWidth: 1)
                            }
                            .frame(width: (proxy.size.width * (1.0 - (0.015 * Double(categories.count - 1)))) * category.percent)

                    } else {
                        RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                            .fill(income ? Color(hex: Color.colorArray[categories.firstIndex(of: category) ?? 0]) : Color(hex: category.color))
                            .overlay {
                                RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                                    .stroke(Color.PrimaryBackground, lineWidth: 1)
                            }
                            .frame(width: (proxy.size.width * (1.0 - (0.015 * Double(categories.count - 1)))) * category.percent)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(String(localized: "accessibility.categoryBreakdown"))
        .accessibilityValue(summary)
    }
}
