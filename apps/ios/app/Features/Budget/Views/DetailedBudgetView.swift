//
//  DetailedBudgetView.swift
//  Outlayr
//

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
                NewBudgetView(overallBudgetCreated: false, toEditBudget: budget)
            }
            .sheet(isPresented: $newTransaction) {
                TransactionView(category: budget.category)
            }
            .deleteBudgetConfirmation($toDelete)
    }
}
