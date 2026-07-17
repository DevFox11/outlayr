//
//  BudgetBarGraphs.swift
//  Outlayr
//

import Foundation
import CoreData
import SwiftUI

struct AnimatedBudgetBarGraph: View {
    var color: Color
    var percent: Double

    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true
    @State var showBar: Bool = false

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(color.opacity(0.3))
                    .frame(height: proxy.size.height)

                if percent > 0 {
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)

                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(color.opacity(0.73))
                            .frame(height: showBar ? nil : 0, alignment: .bottom)
                    }
                    .frame(height: proxy.size.height * percent)
                }
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now()) {
                if !animated {
                    showBar = true
                } else {
                    withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                        showBar = true
                    }
                }
            }
        }
    }
}

struct AnimatedHorizontalBarGraphBudget: View {
    let category: Category

    @State var showBar: Bool = false
    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                .foregroundStyle(Color(hex: category.wrappedColour))
                .frame(width: showBar ? nil : 0, alignment: .leading)

            Spacer(minLength: 0)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now()) {
                if !animated {
                    showBar = true
                } else {
                    withAnimation(.easeInOut(duration: 0.7)) {
                        showBar = true
                    }
                }
            }
        }
    }
}

struct AnimatedHorizontalBarGraphMainBudget: View {
    @State var showBar: Bool = false
    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                .fill(Color.DarkBackground)
                .frame(width: showBar ? nil : 0, alignment: .leading)

            Spacer(minLength: 0)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now()) {
                if !animated {
                    showBar = true
                } else {
                    withAnimation(.easeInOut(duration: 0.7)) {
                        showBar = true
                    }
                }
            }
        }
    }
}

struct AnimatedCurvedBarGraphBudget: View {
    var transactions: FetchedResults<Transaction>
    var budgetTotal: Double
    let cornerRadius: Double
    let width: Double
    let color: String
    @State var percent: Double = 0

    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true

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

struct AnimatedCurvedBarGraphMainBudget: View {
    var transactions: FetchedResults<Transaction>
    var budgetTotal: Double
    let cornerRadius: Double
    let width: Double

    @State var percent: Double = 0

    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true

    var body: some View {
        DonutSemicircle(percent: percent, cornerRadius: cornerRadius, width: width)
            .fill(Color.DarkBackground)
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
