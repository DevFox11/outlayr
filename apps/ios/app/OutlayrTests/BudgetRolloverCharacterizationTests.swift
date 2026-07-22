//
//  BudgetRolloverCharacterizationTests.swift
//  OutlayrTests
//
//  Pins DataController.updateBudgetDates (timeframe rollover) and getBudgetLeftover.
//  Frozen clock: 2024-06-15 12:00 (referenceDate).
//

import Foundation
import CoreData
import Testing

@testable import Outlayr

@MainActor
struct BudgetRolloverCharacterizationTests {
    @Test func monthlyBudgetRollsForwardToCurrentPeriod() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)

        // Monthly (type 3) budget three periods stale.
        let budget = f.makeBudget(in: context, amount: 200, startDate: f.date(2024, 3, 15), type: 3, category: category)
        try? controller.save()

        controller.budgets.updateBudgetDates()

        #expect(budget.startDate == f.date(2024, 6, 15, 0, 0))
    }

    @Test func weeklyMainBudgetRollsForwardToCurrentPeriod() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        // Weekly (type 2) main budget starting 2024-06-01.
        let main = f.makeMainBudget(in: context, amount: 1000, startDate: f.date(2024, 6, 1), type: 2)
        try? controller.save()

        controller.budgets.updateBudgetDates()

        #expect(main.startDate == f.date(2024, 6, 15, 0, 0))
    }

    @Test func getBudgetLeftoverSubtractsExpensesInCategorySinceStart() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let food = f.makeCategory(in: context, name: "Food", order: 1)
        let transport = f.makeCategory(in: context, name: "Transport", order: 2)

        let budget = f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 6, 1), type: 3, category: food)

        // Counted: expenses in Food dated on/after startDate (historical, so before wall-clock now).
        f.makeTransaction(in: context, amount: 30, date: f.date(2024, 6, 3), income: false, category: food)
        f.makeTransaction(in: context, amount: 20, date: f.date(2024, 6, 7), income: false, category: food)
        // Excluded: before start, wrong category, and income.
        f.makeTransaction(in: context, amount: 99, date: f.date(2024, 5, 20), income: false, category: food)
        f.makeTransaction(in: context, amount: 40, date: f.date(2024, 6, 4), income: false, category: transport)
        f.makeTransaction(in: context, amount: 55, date: f.date(2024, 6, 5), income: true, category: food)
        try? controller.save()

        let leftover = controller.budgets.getBudgetLeftover(budget: budget)
        #expect(abs(leftover - 50) < 0.0001)
    }
}
