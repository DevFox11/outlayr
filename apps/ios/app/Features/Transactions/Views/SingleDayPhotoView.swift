//
//  SingleDayPhotoView.swift
//  Outlayr
//
//  Created by Rafael Soh on 30/9/23.
//

import Foundation
import SwiftUI

struct SingleDayPhotoView: View {
    let amountText: String
    let dateText: String
    let transactions: [Transaction]
    let showCents: Bool
    let currencySymbol: String
    let currency: String
    let swapTimeLabel: Bool
    let future: Bool

    @AppStorage("colorScheme", store: AppIdentifiers.sharedDefaults) var colorScheme: Int = 0

    @Environment(\.colorScheme) var systemColorScheme

    var darkMode: Bool {
        (colorScheme == 0 && systemColorScheme == .dark) || colorScheme == 2
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 50) {
            VStack(spacing: 25) {
                VStack(spacing: 10) {
                    HStack {
                        Text(dateText)
                        Spacer()

                        Text(amountText)
                    }
                    .font(.system(size: 35, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)

                    Line()
                        .stroke(Color.Outline, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                }

                ForEach(transactions, id: \.id) { transaction in
                    SingleTransactionPhotoView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: future)
                }
            }
            .padding(30)
            .frame(maxWidth: .infinity)
            .background(Color.PrimaryBackground, in: RoundedRectangle(cornerRadius: 40))
            .shadow(color: Color.Outline, radius: 30)
//            .background(Color.neuBackground, in: RoundedRectangle(cornerRadius: 40))
//            .shadow(color: .dropShadow, radius: 45, x: 40, y: 40)
//            .shadow(color: .dropLight, radius: 45, x: -40, y: -40)
        }
        .padding(60)
        .background(Color.PrimaryBackground)
        .frame(width: 1100, alignment: .top)
    }
}
