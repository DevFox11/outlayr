//
//  SingleGraphView.swift
//  Outlayr

import Foundation
import SwiftUI

struct SingleGraphView: View {
    @Environment(DataController.self) private var dataController
    var date: Date
    let type: Int

    @Binding var categoryFilterMode: Bool
    @Binding var selectedDate: Date?

    @AppStorage(DefaultsKey.incomeTracking, store: AppIdentifiers.sharedDefaults) var incomeTracking: Bool = true
    let language = Locale.current.language.languageCode?.identifier

    var selectedDateString: String {
        if let unwrappedDate = selectedDate {
            let dateFormatter = DateFormatter()

            if type == 3 {
                dateFormatter.dateFormat = "MMM yyyy"
            } else {
                dateFormatter.dateFormat = "d MMM yyyy"
            }

            if language == "ru" {
                return dateFormatter.string(from: unwrappedDate)
            } else {
                return dateFormatter.string(from: unwrappedDate)
            }
        } else {
            return ""
        }
    }

    @State var selectedDateAmount: Double = 0

    var currencySymbol: String
    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var showCents: Bool

    @AppStorage(DefaultsKey.firstDayOfMonth, store: AppIdentifiers.sharedDefaults) var firstDayOfMonth: Int = 1

    var dateString: String {
        let dateFormatter = DateFormatter()

        if type == 1 {
            let calendar = Calendar.current
            dateFormatter.dateFormat = "d MMM"
            let endComponents = DateComponents(day: 7, second: -1)
            let endWeekDate = calendar.date(byAdding: endComponents, to: date) ?? Date.now

            let startMonth = calendar.component(.month, from: date)
            let endMonth = calendar.component(.month, from: endWeekDate)

            if startMonth == endMonth {
                let anotherDateFormatter = DateFormatter()
                anotherDateFormatter.dateFormat = "d"

                return anotherDateFormatter.string(from: date) + " - " + dateFormatter.string(from: endWeekDate)
            } else {
                return dateFormatter.string(from: date) + " - " + dateFormatter.string(from: endWeekDate)
            }
        } else if type == 2 {
            if firstDayOfMonth == 1 {
                dateFormatter.dateFormat = "MMM yyyy"
            } else {
                dateFormatter.dateFormat = "d MMM"
                let endComponents = DateComponents(month: 1, second: -1)
                let endMonthDate = Calendar.current.date(byAdding: endComponents, to: date) ?? Date.now
                if language == "ru" {
                    return dateFormatter.string(from: date) + " - " + dateFormatter.string(from: endMonthDate)
                } else {
                    return dateFormatter.string(from: date)  + " - " + dateFormatter.string(from: endMonthDate)
                }
            }
        } else if type == 3 {
            dateFormatter.dateFormat = "yyyy"
        }

        if language == "ru" {
            return dateFormatter.string(from: date)
        } else {
            return dateFormatter.string(from: date)
        }
    }

    var selectedCategoryName: String
    var selectedCategoryAmount: Double

    @Binding var income: Bool
    @Binding var incomeFiltering: Bool

    private struct LoadKey: Equatable {
        let type: Int
        let date: Date
        let income: Bool
    }

    @State private var insights: TransactionRepository.GraphViewInsights = .empty
    @State private var loadedKey: LoadKey?

    var totalIncome: Double { insights.summary.income }
    var totalSpent: Double { insights.summary.spent }
    var totalNet: Double { insights.summary.net }
    var netPositive: Bool { insights.summary.positive }
    var average: Double { insights.summary.average }

    var currentNet: Double {
        insights.summary.positive ? insights.summary.net : -insights.summary.net
    }

    var lastNet: Double {
        insights.priorSummary.positive ? insights.priorSummary.net : -insights.priorSummary.net
    }

    var incomeAverage: Double { insights.breakdown.average }

    var percentageDifference: String {
        if lastNet == 0 {
            return ""
        }

        let percentage: Double = ((currentNet - lastNet) / abs(lastNet)) * 100

        let roundedPercentage = Int(ceil(percentage))

        if currentNet > lastNet {
            return "+\(roundedPercentage)%"
        } else {
            return "\(roundedPercentage)%"
        }
    }

    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    var fontSize: CGFloat {
        switch dynamicTypeSize {
        case .xSmall:
            return 14
        case .small:
            return 15
        case .medium:
            return 16
        case .large:
            return 17
        case .xLarge:
            return 19
        case .xxLarge:
            return 21
        case .xxxLarge:
            return 23
        default:
            return 23
        }
    }

    var showPercentage: Bool {
        let amountText = stringConverter(amount: totalNet)
        let supplementalText: String

        if categoryFilterMode {
            supplementalText = stringConverter(amount: selectedCategoryAmount)
        } else if selectedDate != nil {
            supplementalText = stringConverter(amount: selectedDateAmount)
        } else if incomeFiltering {
            supplementalText = stringConverter(amount: incomeAverage)
        } else {
            supplementalText = stringConverter(amount: average)
        }

        let totalWidth = amountText.widthOfRoundedString(size: UIFont.textStyleSize(.title1), weight: .medium)
        let averageWidth = supplementalText.widthOfRoundedString(size: UIFont.textStyleSize(.title1), weight: .medium)
        let percentageWidth = percentageDifference.widthOfRoundedString(size: UIFont.textStyleSize(.footnote), weight: .medium) + 10

        let screenWidth = UIScreen.main.bounds.width - 60

        return totalWidth + averageWidth + percentageWidth + 40 < screenWidth
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 1.3) {
                    Text(dateString)
                        .lineLimit(1)
                        .font(.system(.callout, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .layoutPriority(1)

                    HStack(spacing: 10) {
                        InsightsDollarView(amount: totalNet, currencySymbol: currencySymbol, showCents: showCents, net: netPositive)
                            .layoutPriority(1)

                        if showPercentage {
                            Text(percentageDifference)
                                .font(.system(.footnote, design: .rounded).weight(.medium))
                                .foregroundStyle(currentNet < lastNet ? Color.AlertRed : Color.IncomeGreen)
                                .padding(3)
                                .padding(.horizontal, 3)
                                .background(currentNet < lastNet ? Color.AlertRed.opacity(0.23) : Color.IncomeGreen.opacity(0.23), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                                .opacity(currentNet == 0 || lastNet == 0 ? 0 : 1)
                                .lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if categoryFilterMode {
                    VStack(alignment: .trailing, spacing: 1.3) {
                        Text(selectedCategoryName)
                            .lineLimit(1)
                            .font(.system(.callout, design: .rounded).weight(.semibold))
//                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(Color.SubtitleText)

                        InsightsDollarView(amount: selectedCategoryAmount, currencySymbol: currencySymbol, showCents: showCents)
                            .layoutPriority(1)
                    }
                } else if selectedDate != nil {
                    VStack(alignment: .trailing, spacing: 1.3) {
                        Text(selectedDateString)
                            .lineLimit(1)
                            .font(.system(.callout, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.SubtitleText)
                        InsightsDollarView(amount: selectedDateAmount, currencySymbol: currencySymbol, showCents: showCents)
                            .layoutPriority(1)
                    }
                } else if incomeFiltering {
                    VStack(alignment: .trailing, spacing: 1.3) {
                        Text(type == 3 ? (income ? "Income/Mth" : "Spent/Mth") : (income ? "Income/Day" : "Spent/Day"))
                            .lineLimit(1)
                            .font(.system(.callout, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.SubtitleText)
                        InsightsDollarView(amount: incomeAverage, currencySymbol: currencySymbol, showCents: showCents)
                            .layoutPriority(1)
                    }
                } else {
                    VStack(alignment: .trailing, spacing: 1.3) {
                        Text(type == 3 ? "AVG/MTH" : "AVG/DAY")
                            .lineLimit(1)
                            .font(.system(.callout, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.SubtitleText)
                        InsightsDollarView(amount: average, currencySymbol: currencySymbol, showCents: showCents, net: netPositive)
                            .layoutPriority(1)
                    }
                }
            }
            .padding(.bottom, 5)
            .onTapGesture {
                withAnimation(.easeIn(duration: 0.2)) {
                    selectedDate = nil
                }
            }

            if incomeTracking {
                HStack(spacing: 11) {
                    InsightsSummaryBlockView(income: true, amountString: stringGenerator(amount: totalIncome), showOverlay: income && incomeFiltering) {
                        withAnimation {
                            if incomeFiltering && income {
                                incomeFiltering = false
                            } else {
                                income = true
                                incomeFiltering = true
                            }
                        }
                    }

                    InsightsSummaryBlockView(income: false, amountString: stringGenerator(amount: totalSpent), showOverlay: !income && incomeFiltering) {
                        withAnimation {
                            if incomeFiltering && !income {
                                incomeFiltering = false
                            } else {
                                income = false
                                incomeFiltering = true
                            }
                        }
                    }
                }
                .padding(.horizontal, 2)
                .padding(.bottom, 13)
            }

            if incomeFiltering {
                if type == 1 {
                    SingleWeekBarGraphView(insights: insights.breakdown, date: $selectedDate, mode: $categoryFilterMode, amount: $selectedDateAmount)
                } else if type == 2 {
                    SingleMonthBarGraphView(insights: insights.breakdown, date: $selectedDate, mode: $categoryFilterMode, amount: $selectedDateAmount)
                } else if type == 3 {
                    SingleYearBarGraphView(insights: insights.breakdown, date: $selectedDate, mode: $categoryFilterMode, amount: $selectedDateAmount)
                }
            }
        }
        .task(id: LoadKey(type: type, date: date, income: income)) {
            // Capture the inputs once: a cancelled-but-still-running load must
            // never pick up a newer selection mid-flight.
            let key = LoadKey(type: type, date: date, income: income)

            // Showing another period's numbers under the new date label would be
            // wrong; blank them and let the load fill in. An income toggle keeps
            // the summaries because the period is the same, but the breakdown is
            // income-dependent, so it must blank too.
            if let loadedKey, loadedKey.type != key.type || loadedKey.date != key.date {
                insights = .empty
            } else if let loadedKey, loadedKey.income != key.income {
                insights = TransactionRepository.GraphViewInsights(summary: insights.summary, priorSummary: insights.priorSummary, breakdown: .zero)
            }

            // Saves refresh this view via the parents' refreshID identity reset,
            // so the view itself doesn't observe NSManagedObjectContextDidSave.
            await loadInsights(key: key)
        }
    }

    private func loadInsights(key: LoadKey) async {
        let loaded = await dataController.transactions.getGraphViewInsights(type: key.type, date: key.date, income: key.income)

        guard !Task.isCancelled else { return }

        insights = loaded
        loadedKey = key
    }

    func stringGenerator(amount: Double) -> String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        if showCents && amount < 1000 {
            numberFormatter.maximumFractionDigits = 2
        } else {
            numberFormatter.maximumFractionDigits = 0
        }

        return numberFormatter.string(from: NSNumber(value: amount)) ?? "$0"
    }

    func stringConverter(amount: Double) -> String {
        if showCents && amount < 100 {
            return currencySymbol + String(format: "%.2f", amount)
        } else {
            return currencySymbol + String(format: "%.0f", amount)
        }
    }

    init(showingDate: Date, date: Binding<Date?>?, mode: Binding<Bool>, categoryName: String, categoryAmount: Double, currencySymbol: String, showCents: Bool, income: Binding<Bool>, incomeFiltering: Binding<Bool>, type: Int) {
        _selectedDate = date ?? Binding.constant(nil)
        _categoryFilterMode = mode
        _income = income
        _incomeFiltering = incomeFiltering
        self.date = showingDate
        selectedCategoryName = categoryName
        selectedCategoryAmount = categoryAmount
        self.currencySymbol = currencySymbol
        self.showCents = showCents
        self.type = type
    }
}
