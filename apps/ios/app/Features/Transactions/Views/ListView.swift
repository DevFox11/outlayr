//
//  ListView.swift
//  Outlayr

import CoreData
import Foundation
import SwiftUI

struct ListView: View {
    @SectionedFetchRequest<Date?, Transaction> var transactions: SectionedFetchResults<Date?, Transaction>

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency) ?? currency
    }

    @AppStorage(DefaultsKey.showExpenseOrIncomeSign, store: AppIdentifiers.sharedDefaults)
    var showExpenseOrIncomeSign: Bool = true

    @AppStorage(DefaultsKey.swapTimeLabel, store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false

    @Environment(OverallToastPresenter.self) private var toastPresenter

    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(transactions) { day in
                let filtered = filterOutDupes(day: day)
                let dominant = filtered.totals.dominant
                let totalText = dayTotalText(for: dominant)
                let dateText = dateConverter(date: day.id ?? Date.now).uppercased()

                VStack(spacing: 0) {
                    VStack(spacing: 4) {
                        HStack {
                            Text(dateText)
                            Spacer()

                            Text(totalText)
                                .layoutPriority(1)
                        }
                        .font(.system(.callout, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(symbol(for: dominant.currencyCode))\(String(format: "%.2f", dominant.magnitude)) was spent \(dateConverterAccessibilityLabel(date: day.id ?? Date.now))")

                        Line()
                            .stroke(Color.Outline, style: StrokeStyle(lineWidth: 1.3, lineCap: .round))
                    }
                    .padding(.horizontal, 10)
                    .padding(.top, 10)

                    ForEach(filtered.transactions, id: \.id) { transaction in
                        SingleTransactionView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false, showExpenseOrIncomeSign: showExpenseOrIncomeSign)
                    }
                }
                .contentShape(RoundedRectangle(cornerRadius: 10))
                .contextMenu {
                    Button {
                        guard let image = ImageRenderer(content: SingleDayPhotoView(amountText: totalText, dateText: dateText, transactions: filtered.transactions, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false)).uiImage else {
                            return
                        }

                        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)

                        self.toastPresenter.showToast.toggle()
                    } label: {
                        Label("Save as Photo", systemImage: "square.and.arrow.up")
                    }
                }
                .padding(.bottom, 18)
            }
        }
    }

    func filterOutDupes(day: SectionedFetchResults<Date?, Transaction>.Element) -> (transactions: [Transaction], totals: CurrencyTotals) {
        var seen = [Transaction]()
        let filtered = day.filter { entity -> Bool in
            if seen.contains(where: { $0.id == entity.id }) {
                return false
            } else {
                seen.append(entity)
                return true
            }
        }

        let totals = CurrencyTotals(
            globalCurrency: currency,
            entries: filtered.map {
                CurrencyTotals.Entry(currency: $0.wrappedCurrency, amount: $0.income ? $0.amount : -$0.amount)
            }
        )

        return (filtered, totals)
    }

    private func symbol(for currencyCode: String) -> String {
        Locale.current.localizedCurrencySymbol(forCurrencyCode: currencyCode) ?? currencyCode
    }

    private func dayTotalText(for bucket: CurrencyTotals.Bucket) -> String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = bucket.currencyCode
        numberFormatter.maximumFractionDigits = showCents ? 2 : 0

        let formatted = numberFormatter.string(from: NSNumber(value: bucket.amount)) ?? "$0"

        return bucket.isPositive ? "+" + formatted : formatted
    }
}
