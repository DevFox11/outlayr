//
//  SingleTemplateButton.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import SwiftUI

struct SingleTemplateButton: View {
    let transaction: TemplateTransaction
    let showCents: Bool
    let currencySymbol: String
    var dollarOffset: CGFloat {
        let bigFont = UIFont.rounded(ofSize: 21, weight: .semibold)
        let smallFont = UIFont.rounded(ofSize: 15, weight: .medium)

        return bigFont.capHeight - smallFont.capHeight
    }

    var downsize: (big: CGFloat, small: CGFloat, amountText: String) {
        let amountText: String
        let size: CGFloat = 80

        if showCents && transaction.amount < 100 {
            amountText = String(format: "%.2f", transaction.amount)
        } else {
            amountText = String(format: "%.0f", transaction.amount)
        }

        if amountText.widthOfRoundedString(size: 16, weight: .semibold) + currencySymbol.widthOfRoundedString(size: 13, weight: .medium) + 2 > size {
            return (12, 9, amountText)
        } else if amountText.widthOfRoundedString(size: 21, weight: .semibold) + currencySymbol.widthOfRoundedString(size: 18, weight: .medium) + 2 > size {
            return (16, 13, amountText)
        } else {
            return (21, 18, amountText)
        }
    }

    var transactionColor: Color {
        if transaction.category?.income ?? false {
            return Color.IncomeGreen
        } else {
            return Color(hex: transaction.wrappedColour)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: -2) {
            CategoryIconGlyph(symbol: transaction.displaySymbol, size: 14)
                .foregroundStyle(transactionColor)
                .padding(5)
                .background(blend(over: transactionColor, withAlpha: 0.3), in: RoundedRectangle(cornerRadius: 8))

            Spacer()

            Text(transaction.wrappedNote)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.PrimaryText)
                .lineLimit(1)

            HStack(alignment: .lastTextBaseline, spacing: 1.3) {
                Text(currencySymbol)
                    .font(.system(size: downsize.small, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
                    .baselineOffset(getDollarOffset(big: downsize.big, small: downsize.small))

                Text(downsize.amountText)
                    .font(.system(size: downsize.big, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .background(blend(over: transactionColor, withAlpha: 0.8), in: RoundedRectangle(cornerRadius: 15))
        .shadow(color: transactionColor.opacity(0.8), radius: 6)
    }

    func getDollarOffset(big: CGFloat, small: CGFloat) -> CGFloat {
        let bigFont = UIFont.rounded(ofSize: big, weight: .semibold)
        let smallFont = UIFont.rounded(ofSize: small, weight: .medium)

        return bigFont.capHeight - smallFont.capHeight
    }
}
