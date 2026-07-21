//
//  HorizontalBarGraph.swift
//  Outlayr
//

import SwiftUI

struct HorizontalBarGraph: View {
    var categories: [HoldingCategory]
    let income: Bool

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: proxy.size.width * 0.015) {
                ForEach(categories, id: \.self) { category in
                    if category.percent < 0.02 {
                        EmptyView()
                    } else if category.percent < 0.1 {
                        RoundedRectangle(cornerRadius: 0.09 + (0.25 * category.percent * 100), style: .continuous)
                            .fill(income ? Color(hex: Color.colorArray[categories.firstIndex(of: category) ?? 0]) : Color(hex: category.colour))
                            .frame(width: (proxy.size.width * (1.0 - (0.015 * Double(categories.count - 1)))) * category.percent)

                    } else {
                        RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                            .fill(income ? Color(hex: Color.colorArray[categories.firstIndex(of: category) ?? 0]) : Color(hex: category.colour))
                            .frame(width: (proxy.size.width * (1.0 - (0.015 * Double(categories.count - 1)))) * category.percent)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
