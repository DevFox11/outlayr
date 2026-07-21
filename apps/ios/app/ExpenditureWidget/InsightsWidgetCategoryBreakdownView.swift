//
//  InsightsWidgetCategoryBreakdownView.swift
//  Outlayr
//

import SwiftUI

struct InsightsWidgetCategoryBreakdownView: View {
    let amount: Double
    let income: Bool
    let categories: [HoldingCategory]
    let duration: InsightsTimePeriod
    let ios17: Bool

    var subtitleText1: String {
        switch duration {
        case .unknown:
            return "NIL"
        case .week:
            return String(localized: "THIS WEEK").uppercased()
        case .month:
            return String(localized: "THIS MONTH").uppercased()
        case .year:
            return String(localized: "THIS YEAR").uppercased()
        }
    }

    var body: some View {
        VStack(spacing: 8) {
            if amount != 0 {
                HorizontalBarGraph(categories: categories, income: income)
                    .frame(height: 16)

                VStack(spacing: 5) {
                    ForEach(Array(categories.prefix(3)), id: \.self) { category in
                        HStack(spacing: 7) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(income ? Color(hex: Color.colorArray[categories.firstIndex(of: category) ?? 0]) : Color(hex: category.colour))
                                .frame(width: 8, height: 8)
                            Text(category.name)
                                .lineLimit(1)
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(Color.PrimaryText)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Text("\(Int(round(category.percent * 100)))%")
                                .font(.system(size: 12, weight: .regular, design: .rounded))
                                .foregroundColor(Color.SubtitleText)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            } else {
                Text("NO TRANSACTIONS\n\(subtitleText1)")
                    .font(.system(size: 10,
                                  weight: .medium, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundColor(Color.SubtitleText)
                    .frame(maxHeight: .infinity)
            }

            Link(destination: URL(string: AppIdentifiers.urlScheme + "newExpense")!) {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                        .font(.system(size: 9, weight: .medium, design: .rounded))

                    Text("New Expense")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color.PrimaryText)
                }
                .padding(.vertical, 4)
                .frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 5).fill(ios17 ? Color.SecondaryBackground : Color.PrimaryBackground))
            }
        }
    }
}
