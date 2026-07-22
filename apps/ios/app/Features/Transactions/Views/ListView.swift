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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(transactions) { day in
                let filtered = filterOutDupes(day: day)
                let totalText = dayTotalText(for: filtered.totals.dominant)
                let dateText = dateConverter(date: day.id ?? Date.now).uppercased()

                VStack(spacing: 0) {
                    VStack(spacing: 5) {
                        dayHeader(dateText: dateText, totals: filtered.totals)
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(dateConverterAccessibilityLabel(date: day.id ?? Date.now)), \(accessibilityTotal(for: filtered.totals))")

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

    /// The date and the day's totals share a line until the type size makes one
    /// of them squeeze the other out of existence.
    @ViewBuilder
    private func dayHeader(dateText: String, totals: CurrencyTotals) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 4) {
                MonoLabel(verbatim: dateText)

                dayTotals(for: totals)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack(alignment: .firstTextBaseline) {
                MonoLabel(verbatim: dateText)
                    .layoutPriority(1)

                Spacer(minLength: 8)

                dayTotals(for: totals)
            }
        }
    }

    /// A day that spent two currencies gets two figures, separated but never
    /// added: there is no rate here, so a single number would be an invention.
    private func dayTotals(for totals: CurrencyTotals) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            ForEach(Array(totals.buckets.enumerated()), id: \.element.id) { index, bucket in
                if index > 0 {
                    Text(verbatim: "/")
                        .foregroundStyle(Color.EvenLighterText)
                }

                Text(verbatim: dayTotalText(for: bucket))
                    .foregroundStyle(Color.SubtitleText)
            }
        }
        .font(.system(.footnote, design: .rounded).weight(.semibold))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }

    /// Every bucket, signed — a day that netted positive must not be announced
    /// as spending, and the second currency must not vanish.
    private func accessibilityTotal(for totals: CurrencyTotals) -> String {
        totals.buckets.map { dayTotalText(for: $0) }.joined(separator: ", ")
    }

    private func dayTotalText(for bucket: CurrencyTotals.Bucket) -> String {
        CurrencyAmountFormatter(currencyCode: bucket.currencyCode, showCents: showCents)
            .signedString(bucket.amount)
    }
}
