//
//  ActualBudgetView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import CoreData
import Foundation
import SwiftUI

struct ActualBudgetView: View {
    @Environment(\.colorScheme) var colorScheme
    @State private var showInfo = false

    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.dateCreated)
    ]) private var budgets: FetchedResults<Budget>
    @FetchRequest(sortDescriptors: []) private var mainBudget: FetchedResults<MainBudget>
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @Environment(TabBarManager.self) private var tabBarManager

    @State var newBudget = false

    @State private var showMenu = false

    @State private var toDelete: Budget?
    @State private var toEdit: Budget?

    let layout = [
        GridItem(.flexible(), spacing: 15),
        GridItem(.flexible(), spacing: 15)
    ]

    @AppStorage(DefaultsKey.budgetViewStyle, store: AppIdentifiers.sharedDefaults) var budgetRows: Bool = false

    @Namespace var animation

    var didSave = NotificationCenter.default.publisher(for: .NSManagedObjectContextDidSave) // the publisher
    @AppStorage("UUID") var refreshID = UUID().uuidString

    @State var date = Date.now

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if !budgets.isEmpty || !mainBudget.isEmpty {
                    ScrollView(showsIndicators: false) {
                        VStack {
                            if let first = mainBudget.first {
                                NavigationLink(destination: DetailedMainBudgetView(budget: first)
                                    .onAppear {
                                        withAnimation(.easeOut.speed(2)) {
                                            tabBarManager.navigationHideTab()
                                        }
                                    }
                                    .onDisappear {
                                        withAnimation(.easeOut.speed(2)) {
                                            tabBarManager.navigationShowTab()
                                        }
                                    }

                                ) {
                                    if budgets.count == 0 {
                                        MainBudgetView(budget: first, solo: true)
                                            .padding(.horizontal, 25)
                                            .padding(.bottom, 15)
                                            .id(refreshID)
                                    } else {
                                        MainBudgetView(budget: first, solo: false)
                                            .padding(.horizontal, 25)
                                            .padding(.bottom, 15)
                                            .id(refreshID)
                                    }
                                }
                            }

                            if budgetRows {
                                VStack(spacing: 10) {
                                    ForEach(budgets, id: \.self) { budget in
                                        NavigationLink(destination: DetailedBudgetView(budget: budget)
                                            .onAppear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationHideTab()
                                                }
                                            }
                                            .onDisappear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationShowTab()
                                                }
                                            }

                                        ) {
                                            SingleBudgetView(budget: budget, toDelete: $toDelete, toEdit: $toEdit, budgetRows: budgetRows)
                                        }
                                    }
                                }

                            } else {
                                LazyVGrid(columns: layout, spacing: 15) {
                                    ForEach(budgets, id: \.self) { budget in
                                        NavigationLink(destination: DetailedBudgetView(budget: budget)
                                            .onAppear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationHideTab()
                                                }
                                            }
                                            .onDisappear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationShowTab()
                                                }
                                            }

                                        ) {
                                            SingleBudgetView(budget: budget, toDelete: $toDelete, toEdit: $toEdit, budgetRows: budgetRows)
                                        }
                                    }
                                }
                                .padding(.horizontal, 25)
                                .padding(5)
                            }
                        }
                        .padding(.bottom, 70)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .id(refreshID)
                } else {
                    BudgetEmptyStateView { newBudget = true }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .navigationTitle("Budgets")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        newBudget = true
                    } label: {
                        Label("New Budget", systemImage: "plus")
                    }
                }
            }
            .background(Color.PrimaryBackground)
            .sheet(item: $toEdit, onDismiss: {
                toEdit = nil
            }) { budget in
                NewBudgetView(overallBudgetCreated: !mainBudget.isEmpty, toEditBudget: budget)
            }
            .onAppear {
                dataController.budgets.updateBudgetDates()
            }
            .sheet(isPresented: $newBudget) {
                NewBudgetView(overallBudgetCreated: !mainBudget.isEmpty)
            }
            .deleteBudgetConfirmation($toDelete)
            .onReceive(self.didSave) { _ in // the listener
                withAnimation {
                    refreshID = UUID().uuidString
                }
            }
        }
    }
}
