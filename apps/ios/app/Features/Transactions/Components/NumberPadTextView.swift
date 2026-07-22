//
//  NumberPadTextView.swift
//  Outlayr
//
//  Created by Yumi on 2023-10-29.
//

import SwiftUI

struct NumberPadTextView: View {
    @Binding var price: Double
    @Binding var isEditingDecimal: Bool
    @Binding var decimalValuesAssigned: AssignedDecimal

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage(DefaultsKey.numberEntryType, store: AppIdentifiers.sharedDefaults) var numberEntryType: Int = 1

    public var amount: String {
        if numberEntryType == 1 {
            return String(format: "%.2f", price)
        }
        if isEditingDecimal {
            switch decimalValuesAssigned {
                case .none:
                    return String(format: "%.0f", price) + "."
                case .first:
                    return String(format: "%.1f", price)
                case .second:
                    return String(format: "%.2f", price)
            }
        }
        return String(format: "%.0f", price)
    }

    @ScaledMetric(relativeTo: .largeTitle) private var largerFontSize: CGFloat = 50

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 0) {
            Group {
                Text(currencySymbol)
                    .font(.system(.largeTitle, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)

                + Text(amount)
                    .font(.system(size: largerFontSize, weight: .regular, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)

            }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
        .padding(.horizontal, numberEntryType == 2 ? 40 : 0)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .trailing) {
            if numberEntryType == 2 {
                DeleteButton()
            }
        }
    }

    @ViewBuilder
   func DeleteButton() -> some View {
       Button {
         deleteLastDigit()
       } label: {
         Image(systemName: "delete.left.fill")
           .scaledFont(16, weight: .semibold)
           .foregroundStyle(Color.SubtitleText)
           .padding(7)
           .background(Color.SecondaryBackground, in: Circle())
           .contentShape(Circle())
       }
       .disabled(price == 0 && !isEditingDecimal)
   }

    public func deleteLastDigit() {
        if numberEntryType == 1 {
            price = Double(Int(price * 10)) / 100
        } else if !isEditingDecimal {
            price = Double(Int(price / 10))
        } else {
            switch decimalValuesAssigned {
                case .none:
                    isEditingDecimal = false
                    return
                case .first:
                    price = Double(Int(price))
                    decimalValuesAssigned = .none
                case .second:
                    price = Double(Int(price * 10)) / 10
                    decimalValuesAssigned = .first
            }
        }
    }
}
