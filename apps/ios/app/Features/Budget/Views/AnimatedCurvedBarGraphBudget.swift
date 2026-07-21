//
//  AnimatedCurvedBarGraphBudget.swift
//  Outlayr
//

import Foundation
import CoreData
import SwiftUI

struct AnimatedCurvedBarGraphBudget: View {
    var transactions: FetchedResults<Transaction>
    var budgetTotal: Double
    let cornerRadius: Double
    let width: Double
    let color: String
    @State var percent: Double = 0

    @AppStorage(DefaultsKey.animated, store: AppIdentifiers.sharedDefaults) var animated: Bool = true

    var body: some View {
        DonutSemicircle(percent: percent, cornerRadius: cornerRadius, width: width)
            .fill(Color(color))
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now()) {
                    var holdingTotal = 0.0
                    transactions.forEach { transaction in
                        holdingTotal += transaction.wrappedAmount
                    }

                    if !animated {
                        percent = 1 - (holdingTotal / budgetTotal)
                    } else {
                        withAnimation(.easeInOut(duration: 0.7)) {
                            percent = 1 - (holdingTotal / budgetTotal)
                        }
                    }
                }
            }
    }
}
