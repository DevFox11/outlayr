//
//  BudgetRepositoryTests.swift
//  OutlayrTests
//
//  Coverage for BudgetRepository: leftover calculation, date rollover,
//  hierarchical category rollup, and widget fetch helpers.
//

import CoreData
import Testing
@testable import Outlayr

@MainActor
@Suite("BudgetRepository")
struct BudgetRepositoryTests {

    // MARK: - getBudgetLeftover (category budget)

    @Test("category budget: subtracts non-income expenses since startDate")
    func categoryBudget_sumsExpensesSinceStart() {
        let f = RepositoryFixture()
        let food = f.makeCategory(name: "Food")
        let budget = f.makeBudget(amount: 100, startDate: testDate(2024, 6, 1), type: 3, category: food)
        f.makeTransaction(amount: 30, date: testDate(2024, 6, 3), category: food)   // counted
        f.makeTransaction(amount: 20, date: testDate(2024, 6, 7), category: food)   // counted
        f.makeTransaction(amount: 99, date: testDate(2024, 5, 20), category: food)  // before start
        f.makeTransaction(amount: 55, date: testDate(2024, 6, 5), income: true, category: food) // income
        f.save()

        let leftover = f.controller.budgets.getBudgetLeftover(budget: budget)
        #expect(abs(leftover - 50) < 0.001)
    }

    @Test("category budget: includes child-category transactions (hierarchical rollup)")
    func categoryBudget_hierarchicalRollup() {
        let f = RepositoryFixture()
        let parent = f.makeCategory(name: "Food", order: 0)
        let child = f.makeCategory(name: "Coffee", order: 1)
        child.parent = parent
        let other = f.makeCategory(name: "Transport", order: 2)
        let budget = f.makeBudget(amount: 200, startDate: testDate(2024, 6, 1), type: 3, category: parent)
        f.makeTransaction(amount: 50, date: testDate(2024, 6, 5), category: parent)  // direct
        f.makeTransaction(amount: 30, date: testDate(2024, 6, 7), category: child)   // child → counted
        f.makeTransaction(amount: 40, date: testDate(2024, 6, 3), category: other)   // unrelated
        f.save()

        let leftover = f.controller.budgets.getBudgetLeftover(budget: budget)
        #expect(abs(leftover - 120) < 0.001)  // 200 - 50 - 30
    }

    @Test("category budget: excludes income transactions from spent total")
    func categoryBudget_excludesIncome() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Salary", income: true)
        let budget = f.makeBudget(amount: 500, startDate: testDate(2024, 6, 1), type: 3, category: cat)
        f.makeTransaction(amount: 100, date: testDate(2024, 6, 5), income: true, category: cat)
        f.makeTransaction(amount: 80,  date: testDate(2024, 6, 8), income: true, category: cat)
        f.save()

        // Category budget predicate includes `income = false`, so income txns excluded.
        let leftover = f.controller.budgets.getBudgetLeftover(budget: budget)
        #expect(abs(leftover - 500) < 0.001)
    }

    // MARK: - getBudgetLeftover (main budget)

    @Test("main budget: subtracts all non-income expenses since startDate regardless of category")
    func mainBudget_sumsAllExpenses() {
        let f = RepositoryFixture()
        let food = f.makeCategory(name: "Food")
        let transport = f.makeCategory(name: "Transport", order: 1)
        let main = f.makeMainBudget(amount: 500, startDate: testDate(2024, 6, 1), type: 3)
        f.makeTransaction(amount: 100, date: testDate(2024, 6, 5), category: food)      // counted
        f.makeTransaction(amount: 50,  date: testDate(2024, 6, 8), category: transport) // counted
        f.makeTransaction(amount: 200, date: testDate(2024, 5, 20), category: food)     // before start
        f.makeTransaction(amount: 75,  date: testDate(2024, 6, 6), income: true, category: food) // income
        f.save()

        let leftover = f.controller.budgets.getBudgetLeftover(overallBudget: main)
        #expect(abs(leftover - 350) < 0.001)  // 500 - 100 - 50
    }

    // MARK: - getBudgetLeftover async (rematerialization)

    @Test("async: rematerializes budget by objectID and returns correct leftover")
    func asyncGetBudgetLeftover_rematerializes() async throws {
        let f = RepositoryFixture()
        let food = f.makeCategory(name: "Food")
        let budget = f.makeBudget(amount: 200, startDate: testDate(2024, 6, 1), type: 3, category: food)
        f.makeTransaction(amount: 80, date: testDate(2024, 6, 5), category: food)
        // Save so the budget gets a permanent objectID.
        try f.context.save()

        let leftover = try await f.controller.budgets.getBudgetLeftover(budget: budget)
        #expect(abs(leftover - 120) < 0.001)
    }

    @Test("async: throws notFound when budget objectID is no longer in store")
    func asyncGetBudgetLeftover_throwsOnStaleID() async {
        let f = RepositoryFixture()
        let food = f.makeCategory(name: "Food")
        let budget = f.makeBudget(amount: 100, startDate: testDate(2024, 6, 1), type: 3, category: food)
        try? f.context.save()

        // Delete the budget so the rematerialization step fails.
        f.context.delete(budget)
        try? f.context.save()

        await #expect(throws: (any Error).self) {
            _ = try await f.controller.budgets.getBudgetLeftover(budget: budget)
        }
    }

    // MARK: - updateBudgetDates

    @Test("monthly category budget rolls forward past-due startDate to current period")
    func updateBudgetDates_monthlyBudget_rollsForward() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food")
        // Three periods stale at referenceDate 2024-06-15.
        let budget = f.makeBudget(amount: 100, startDate: testDate(2024, 3, 15), type: 3, category: cat)
        f.save()

        f.controller.budgets.updateBudgetDates()

        #expect(budget.startDate == testDate(2024, 6, 15))
    }

    @Test("updateBudgetDates leaves current-period budget unchanged")
    func updateBudgetDates_currentPeriod_unchanged() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food")
        // This budget ends after the frozen now (2024-06-15), so it's not stale.
        let startDate = testDate(2024, 6, 1)
        let budget = f.makeBudget(amount: 100, startDate: startDate, type: 3, category: cat)
        f.save()

        f.controller.budgets.updateBudgetDates()

        #expect(budget.startDate == startDate)
    }

    // MARK: - fetchRequestForMainBudgetWidget

    @Test("widget fetch: returns found=false when no MainBudget exists")
    func mainBudgetWidget_noBudget_returnsFalse() {
        let f = RepositoryFixture()
        let result = f.controller.budgets.fetchRequestForMainBudgetWidget()
        #expect(result.found == false)
    }

    @Test("widget fetch: returns found=true with correct totalSpent and budgetAmount")
    func mainBudgetWidget_withBudget_returnsTotals() {
        let f = RepositoryFixture()
        _ = f.makeMainBudget(amount: 1000, startDate: testDate(2024, 6, 1), type: 3)
        f.makeTransaction(amount: 200, date: testDate(2024, 6, 5))    // counted
        f.makeTransaction(amount: 100, date: testDate(2024, 5, 20))   // before startDate
        f.makeTransaction(amount: 50,  date: testDate(2024, 6, 8), income: true) // income excluded
        f.save()

        let result = f.controller.budgets.fetchRequestForMainBudgetWidget()
        #expect(result.found == true)
        #expect(abs(result.totalSpent - 200) < 0.001)
        #expect(abs(result.budgetAmount - 1000) < 0.001)
    }

    // MARK: - getWidgetBudgetOptions

    @Test("widget options: returned in dateCreated order, each with objectID URI identifier")
    func widgetBudgetOptions_orderedByDateCreated() {
        let f = RepositoryFixture()
        let cat1 = f.makeCategory(name: "Food",      order: 0)
        let cat2 = f.makeCategory(name: "Transport", order: 1)
        // dateCreated = startDate in makeBudget: Food budget created first.
        f.makeBudget(amount: 100, startDate: testDate(2024, 6, 1),  type: 3, category: cat1)
        f.makeBudget(amount: 200, startDate: testDate(2024, 6, 15), type: 3, category: cat2)
        f.save()

        let options = f.controller.budgets.getWidgetBudgetOptions()
        #expect(options.count == 2)
        #expect(options[0].name == "Food")
        #expect(options[1].name == "Transport")
        // Identifiers must be non-empty URI strings the widget can resolve.
        #expect(!options[0].identifier.isEmpty)
        #expect(!options[1].identifier.isEmpty)
    }

    @Test("widget options: empty list when no category budgets exist")
    func widgetBudgetOptions_empty() {
        let f = RepositoryFixture()
        let options = f.controller.budgets.getWidgetBudgetOptions()
        #expect(options.isEmpty)
    }
}
