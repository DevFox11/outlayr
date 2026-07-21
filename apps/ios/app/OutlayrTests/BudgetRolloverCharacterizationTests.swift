//
//  BudgetRolloverCharacterizationTests.swift
//  OutlayrTests
//
//  Pins DataController.updateBudgetDates (timeframe rollover) and getBudgetLeftover.
//  Frozen clock: 2024-06-15 12:00 (referenceDate).
//

import CoreData
import XCTest

@testable import Outlayr

final class BudgetRolloverCharacterizationTests: CharacterizationTestCase {
    func testMonthlyBudgetRollsForwardToCurrentPeriod() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)

        // Monthly (type 3) budget three periods stale.
        let budget = makeBudget(in: context, amount: 200, startDate: date(2024, 3, 15), type: 3, category: category)
        try? controller.save()

        controller.budgets.updateBudgetDates()

        XCTAssertEqual(budget.startDate, date(2024, 6, 15, 0, 0))
    }

    func testWeeklyMainBudgetRollsForwardToCurrentPeriod() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        // Weekly (type 2) main budget starting 2024-06-01.
        let main = makeMainBudget(in: context, amount: 1000, startDate: date(2024, 6, 1), type: 2)
        try? controller.save()

        controller.budgets.updateBudgetDates()

        XCTAssertEqual(main.startDate, date(2024, 6, 15, 0, 0))
    }

    func testGetBudgetLeftoverSubtractsExpensesInCategorySinceStart() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let food = makeCategory(in: context, name: "Food", order: 1)
        let transport = makeCategory(in: context, name: "Transport", order: 2)

        let budget = makeBudget(in: context, amount: 100, startDate: date(2024, 6, 1), type: 3, category: food)

        // Counted: expenses in Food dated on/after startDate (historical, so before wall-clock now).
        makeTransaction(in: context, amount: 30, date: date(2024, 6, 3), income: false, category: food)
        makeTransaction(in: context, amount: 20, date: date(2024, 6, 7), income: false, category: food)
        // Excluded: before start, wrong category, and income.
        makeTransaction(in: context, amount: 99, date: date(2024, 5, 20), income: false, category: food)
        makeTransaction(in: context, amount: 40, date: date(2024, 6, 4), income: false, category: transport)
        makeTransaction(in: context, amount: 55, date: date(2024, 6, 5), income: true, category: food)
        try? controller.save()

        let leftover = controller.budgets.getBudgetLeftover(budget: budget)
        XCTAssertEqual(leftover, 50, accuracy: 0.0001)
    }
}
