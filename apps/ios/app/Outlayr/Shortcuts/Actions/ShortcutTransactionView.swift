//
//  NewTransactionIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 23/7/23.
//

import AppIntents
import Foundation
import SwiftUI

struct ShortcutTransactionView: View {
    let transaction: Transaction

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier

    var transactionAmountString: String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        if showCents {
            numberFormatter.maximumFractionDigits = 2
        } else {
            numberFormatter.maximumFractionDigits = 0
        }

        return numberFormatter.string(from: NSNumber(value: transaction.amount)) ?? "$0"
    }

    var body: some View {
        HStack(spacing: 12) {
            CategoryIconLogTile(symbol: transaction.displaySymbol,
                                color: transaction.effectiveColor, future: false)
                .frame(width: 35, height: 35, alignment: .center)
                .overlay(alignment: .bottomTrailing) {
                    if transaction.recurringType > 0 {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.DarkIcon)
                            .padding(3)
                            .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 6))
                            .offset(x: 5, y: 5)
                    }
                }

            VStack(alignment: .leading) {
                Text(transaction.wrappedNote)
                    .font(.system(size: 16, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
                    .lineLimit(1)

                Text(transaction.wrappedDate, format: .dateTime.hour().minute())
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
                    .lineLimit(1)
            }
            Spacer()
            if transaction.income {
                Text("+\(transactionAmountString)")
                    .font(.system(size: 19, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.IncomeGreen)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .layoutPriority(1)
            } else {
                Text("-\(transactionAmountString)")
                    .font(.system(size: 19, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .layoutPriority(1)
            }
        }
        .padding(.vertical, 20)
        .padding(.horizontal, 20)
    }
}
