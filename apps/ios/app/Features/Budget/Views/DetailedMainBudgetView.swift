//
//  DetailedMainBudgetView.swift
//  Outlayr
//

import Foundation
import SwiftUI

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
