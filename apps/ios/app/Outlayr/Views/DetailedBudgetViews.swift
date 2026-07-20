//
//  DetailedBudgetViews.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

struct DetailedBudgetView: View {
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    let budget: Budget

    @State private var toDelete: Budget?
    @State private var newTransaction = false
    @State private var toEdit: Budget?

    var body: some View {
        TimeBudgetView(budget: budget)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.PrimaryBackground)
            .navigationTitle(budget.wrappedName)
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color.PrimaryText)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            newTransaction = true
                        } label: {
                            Label("New Transaction", systemImage: "plus")
                        }

                        Button {
                            toEdit = budget
                        } label: {
                            Label("Edit Budget", systemImage: "pencil")
                        }

                        Button(role: .destructive) {
                            toDelete = budget
                        } label: {
                            Label("Delete Budget", systemImage: "trash")
                        }
                    } label: {
                        ToolbarIcon("more-vertical-square-01")
                    }                }
            }
            .sheet(item: $toEdit, onDismiss: {
                toEdit = nil
            }) { budget in
                BrandNewBudgetView(overallBudgetCreated: false, toEditBudget: budget)
            }
            .sheet(isPresented: $newTransaction) {
                TransactionView(category: budget.category)
            }
            .deleteBudgetConfirmation($toDelete)
    }
}

struct DetailedMainBudgetView: View {
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    let budget: MainBudget

    @State private var toDelete: MainBudget?
    @State private var toEdit: MainBudget?

    var body: some View {
        TimeMainBudgetView(budget: budget)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.PrimaryBackground)
            .navigationTitle("Overall Budget")
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color.PrimaryText)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            toEdit = budget
                        } label: {
                            Label("Edit Budget", systemImage: "pencil")
                        }

                        Button(role: .destructive) {
                            toDelete = budget
                        } label: {
                            Label("Delete Budget", systemImage: "trash")
                        }
                    } label: {
                        ToolbarIcon("more-vertical-square-01")
                    }                }
            }
            .fullScreenCover(item: $toEdit, onDismiss: {
                toEdit = nil
            }) { budget in
                BrandNewBudgetView(overallBudgetCreated: true, toEditMainBudget: budget)
            }
            .deleteMainBudgetConfirmation($toDelete)
    }
}

struct DetailedBudgetDollarView: View {
    var amount: Double
    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(currencySymbol)
                    .font(.system(.title2, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.SubtitleText) +

                Text("\(amount, specifier: showCents && amount < 100 ? "%.2f" : "%.0f")")
                    .font(.system(.largeTitle, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.PrimaryText)
            }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}

struct DetailedBudgetDifferenceDollarView: View {
    var amount: Double
    var red: Bool

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(currencySymbol)
                    .font(.system(.title2, design: .rounded).weight(.medium))
                    .foregroundStyle(red ? Color("BudgetRed") : Color.SubtitleText) +

                Text("\(amount, specifier: showCents && amount < 100 ? "%.2f" : "%.0f")")
                    .font(.system(.largeTitle, design: .rounded).weight(.medium))
                    .foregroundStyle(red ? Color("BudgetRed") : Color.PrimaryText)
            }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}
