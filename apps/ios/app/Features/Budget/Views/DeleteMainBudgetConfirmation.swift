//
//  DeleteMainBudgetConfirmation.swift
//  Outlayr
//

import SwiftUI

struct DeleteMainBudgetConfirmation: ViewModifier {
    @Binding var budget: MainBudget?
    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    func body(content: Content) -> some View {
        content.alert(
            "Delete your overall budget?",
            isPresented: Binding(get: { budget != nil }, set: { if !$0 { budget = nil } }),
            presenting: budget
        ) { budget in
            Button("Delete", role: .destructive) {
                withAnimation {
                    moc.delete(budget)
                    try? dataController.save()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("This action cannot be undone.")
        }
    }
}

extension View {
    func deleteMainBudgetConfirmation(_ budget: Binding<MainBudget?>) -> some View {
        modifier(DeleteMainBudgetConfirmation(budget: budget))
    }
}
