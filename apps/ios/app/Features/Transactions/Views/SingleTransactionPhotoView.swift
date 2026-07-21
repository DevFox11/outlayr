//
//  SingleTransactionPhotoView.swift
//  Outlayr
//
//  Created by Rafael Soh on 30/9/23.
//

import Foundation
import SwiftUI

struct SingleTransactionPhotoView: View {
    let transaction: Transaction
    let showCents: Bool
    let currencySymbol: String
    let currency: String
    let swapTimeLabel: Bool
    let future: Bool

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
        HStack(spacing: 25) {
            CategoryIconLogTile(symbol: transaction.displaySymbol,
                                color: (transaction.category?.wrappedColor ?? "#FFFFFF"), future: future, scale: .hero)
                .frame(width: 100, height: 100, alignment: .center)
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

            VStack(alignment: .leading, spacing: 5.5) {
                Text(transaction.wrappedNote)
                    .font(.system(size: 42, weight: .medium, design: .rounded))
                    .foregroundStyle(future ? Color.SubtitleText : Color.PrimaryText)
                    .lineLimit(1)

                if future {
                    if transaction.wrappedDate > Date.now {
                        Text(dateFormatter(date: transaction.wrappedDate))
                            .font(.system(size: 35, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.EvenLighterText)
                            .lineLimit(1)
                    } else {
                        Text(dateFormatter(date: transaction.nextTransactionDate))
                            .font(.system(size: 35, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.EvenLighterText)
                            .lineLimit(1)
                    }

                } else {
                    if swapTimeLabel {
                        Text(transaction.wrappedCategoryName)
                            .font(.system(size: 35, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.SubtitleText)
                            .lineLimit(1)
                    } else {
                        Text(transaction.wrappedDate, format: .dateTime.hour().minute())
                            .font(.system(size: 35, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.SubtitleText)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            if transaction.income {
                Text("+\(transactionAmountString)")
                    .font(.system(size: 45, weight: .medium, design: .rounded))
                    .foregroundStyle(future ? Color.SubtitleText : Color.IncomeGreen)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .layoutPriority(1)
            } else {
                Text("-\(transactionAmountString)")
                    .font(.system(size: 45, weight: .medium, design: .rounded))
                    .foregroundStyle(future ? Color.SubtitleText : Color.PrimaryText)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .layoutPriority(1)
            }
        }
//        .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 40))

        .frame(maxWidth: .infinity)
    }

    func dateFormatter(date: Date) -> String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "d MMM"
        return dateFormatter.string(from: date).uppercased()
    }
}
