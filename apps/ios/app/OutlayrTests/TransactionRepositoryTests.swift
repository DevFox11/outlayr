//
//  TransactionRepositoryTests.swift
//  OutlayrTests
//
//  Coverage for TransactionRepository: newTransaction field mapping,
//  note suggestions, log-view totals, and hierarchical category filtering.
//

import CoreData
import Testing
@testable import Outlayr

@MainActor
@Suite("TransactionRepository")
struct TransactionRepositoryTests {

    // MARK: - newTransaction

    @Test("newTransaction sets note, amount, income, day, and month from parameters")
    func newTransaction_setsFields() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food")
        f.save()

        let txn = f.controller.transactions.newTransaction(
            note: "Lunch",
            category: cat,
            income: false,
            amount: 15.50,
            date: testDate(2024, 6, 5, 13, 30),
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        #expect(txn.note == "Lunch")
        #expect(txn.category == cat)
        #expect(abs(txn.amount - 15.50) < 0.001)
        #expect(txn.income == false)
        // day = midnight of transaction date; month = first of that month at midnight.
        #expect(txn.day == testDate(2024, 6, 5, 0, 0))
        #expect(txn.month == testDate(2024, 6, 1, 0, 0))
    }

    @Test("newTransaction falls back to category name when note is blank or whitespace")
    func newTransaction_blankNote_usesCategoryName() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Groceries")
        f.save()

        let txn = f.controller.transactions.newTransaction(
            note: "   ",
            category: cat,
            income: false,
            amount: 10,
            date: testDate(2024, 6, 5),
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        #expect(txn.note == "Groceries")
    }

    @Test("newTransaction strips surrounding whitespace from a non-blank note")
    func newTransaction_tripsLeadingTrailingWhitespace() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food")
        f.save()

        let txn = f.controller.transactions.newTransaction(
            note: "  Dinner  ",
            category: cat,
            income: false,
            amount: 20,
            date: testDate(2024, 6, 5),
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        #expect(txn.note == "Dinner")
    }

    // MARK: - getSuggestedNotes

    @Test("getSuggestedNotes deduplicates transactions sharing the same note")
    func suggestedNotes_deduplicatesByNote() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food")
        f.makeTransaction(amount: 10, date: testDate(2024, 6, 1), note: "Lunch",  category: cat)
        f.makeTransaction(amount: 12, date: testDate(2024, 6, 2), note: "Lunch",  category: cat) // duplicate
        f.makeTransaction(amount: 8,  date: testDate(2024, 6, 3), note: "Coffee", category: cat)
        f.save()

        let results = f.controller.transactions.getSuggestedNotes(searchQuery: "L", category: nil, income: false)
        let lunchMatches = results.filter { $0.wrappedNote == "Lunch" }
        #expect(lunchMatches.count == 1)
    }

    @Test("getSuggestedNotes returns only notes that begin with or contain the query")
    func suggestedNotes_filtersByQuery() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food")
        f.makeTransaction(amount: 10, date: testDate(2024, 6, 1), note: "Lunch",     category: cat)
        f.makeTransaction(amount: 12, date: testDate(2024, 6, 2), note: "Coffee",    category: cat)
        f.makeTransaction(amount: 8,  date: testDate(2024, 6, 3), note: "Brunch out", category: cat)
        f.save()

        // "unch" matches "Lunch" (contains) and "Brunch out" (contains).
        let results = f.controller.transactions.getSuggestedNotes(searchQuery: "unch", category: nil, income: false)
        let notes = Set(results.map(\.wrappedNote))
        #expect(notes.contains("Lunch"))
        #expect(notes.contains("Brunch out"))
        #expect(!notes.contains("Coffee"))
    }

    @Test("getSuggestedNotes restricts to the specified category when provided")
    func suggestedNotes_filtersByCategory() {
        let f = RepositoryFixture()
        let food      = f.makeCategory(name: "Food",      order: 0)
        let transport = f.makeCategory(name: "Transport", order: 1)
        f.makeTransaction(amount: 10, date: testDate(2024, 6, 1), note: "Lunch", category: food)
        f.makeTransaction(amount: 5,  date: testDate(2024, 6, 2), note: "Lunch", category: transport)
        f.save()

        let results = f.controller.transactions.getSuggestedNotes(searchQuery: "Lunch", category: food, income: false)
        #expect(results.count == 1)
        #expect(results[0].category == food)
    }

    @Test("getSuggestedNotes respects the income mode filter")
    func suggestedNotes_filtersByIncome() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Salary", income: true)
        f.makeTransaction(amount: 100, date: testDate(2024, 6, 1), income: true,  note: "Paycheck", category: cat)
        f.makeTransaction(amount: 50,  date: testDate(2024, 6, 2), income: false, note: "Paycheck", category: cat)
        f.save()

        let incomeResults  = f.controller.transactions.getSuggestedNotes(searchQuery: "Paycheck", category: nil, income: true)
        let expenseResults = f.controller.transactions.getSuggestedNotes(searchQuery: "Paycheck", category: nil, income: false)
        #expect(incomeResults.allSatisfy { $0.income })
        #expect(expenseResults.allSatisfy { !$0.income })
    }

    // MARK: - Log-view totals (type 5 = all time, uses Date.now end cap only)

    @Test("getLogViewTotalSpent sums only expense transactions across all time")
    func logView_totalSpent_allTime() {
        let f = RepositoryFixture()
        f.makeTransaction(amount: 60, date: testDate(2024, 6, 5), income: false)
        f.makeTransaction(amount: 40, date: testDate(2024, 6, 8), income: false)
        f.makeTransaction(amount: 25, date: testDate(2024, 6, 9), income: true)  // excluded
        f.save()

        let total = f.controller.transactions.getLogViewTotalSpent(type: 5)
        #expect(abs(total - 100) < 0.001)
    }

    @Test("getLogViewTotalIncome sums only income transactions across all time")
    func logView_totalIncome_allTime() {
        let f = RepositoryFixture()
        f.makeTransaction(amount: 300, date: testDate(2024, 6, 5), income: true)
        f.makeTransaction(amount: 200, date: testDate(2024, 6, 8), income: true)
        f.makeTransaction(amount: 50,  date: testDate(2024, 6, 9), income: false) // excluded
        f.save()

        let total = f.controller.transactions.getLogViewTotalIncome(type: 5)
        #expect(abs(total - 500) < 0.001)
    }

    @Test("getLogViewTotalNet returns positive value and true when income > expenses")
    func logView_net_positiveWhenIncomeDominates() {
        let f = RepositoryFixture()
        f.makeTransaction(amount: 100, date: testDate(2024, 6, 5), income: true)   // +100
        f.makeTransaction(amount: 40,  date: testDate(2024, 6, 8), income: false)  // -40
        f.save()

        let net = f.controller.transactions.getLogViewTotalNet(type: 5)
        #expect(abs(net.value - 60) < 0.001)
        #expect(net.positive == true)
    }

    @Test("getLogViewTotalNet returns positive value and false when expenses > income")
    func logView_net_negativeWhenExpensesDominate() {
        let f = RepositoryFixture()
        f.makeTransaction(amount: 10,  date: testDate(2024, 6, 5), income: true)   // +10
        f.makeTransaction(amount: 80,  date: testDate(2024, 6, 8), income: false)  // -80
        f.save()

        let net = f.controller.transactions.getLogViewTotalNet(type: 5)
        #expect(abs(net.value - 70) < 0.001)
        #expect(net.positive == false)
    }

    // MARK: - Hierarchical category rollup via fetchRequestForLogView

    @Test("getShortcutInsights (all-time) counts child-category transactions under their parent filter")
    func shortcutInsights_hierarchicalRollup() {
        let f = RepositoryFixture()
        let parent = f.makeCategory(name: "Food",      order: 0)
        let child  = f.makeCategory(name: "Coffee",    order: 1)
        child.parent = parent
        let other  = f.makeCategory(name: "Transport", order: 2)
        // All dates in 2024 — before wall-clock now, so they pass the `<= Date.now` cap.
        f.makeTransaction(amount: 60, date: testDate(2024, 6, 5), category: parent)  // direct
        f.makeTransaction(amount: 40, date: testDate(2024, 6, 7), category: child)   // child → included
        f.makeTransaction(amount: 99, date: testDate(2024, 6, 8), category: other)   // excluded
        f.save()

        // type=2 sums without income adjustment; timeframe=5 is all-time.
        let total = f.controller.transactions.getShortcutInsights(
            type: 2,
            timeframe: 5,
            optionalIncome: false,
            categories: [parent]
        )
        #expect(abs(total - 100) < 0.001)  // 60 + 40; other excluded
    }

    @Test("getShortcutInsights (all-time) excludes income transactions when optionalIncome=false")
    func shortcutInsights_excludesIncomeTransactions() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food")
        f.makeTransaction(amount: 50, date: testDate(2024, 6, 5), income: false, category: cat)
        f.makeTransaction(amount: 30, date: testDate(2024, 6, 7), income: true,  category: cat)
        f.save()

        let total = f.controller.transactions.getShortcutInsights(
            type: 2,
            timeframe: 5,
            optionalIncome: false,
            categories: [cat]
        )
        #expect(abs(total - 50) < 0.001)
    }

    // MARK: - fetchRequestForRecurringTransactions

    @Test("fetchRequestForRecurringTransactions returns only transactions with recurringType > 0")
    func recurringFetch_onlyRecurring() throws {
        let f = RepositoryFixture()
        let recurring    = f.makeTransaction(amount: 10, date: testDate(2024, 6, 1))
        recurring.recurringType = 3
        let nonRecurring = f.makeTransaction(amount: 20, date: testDate(2024, 6, 2))
        nonRecurring.recurringType = 0
        try f.context.save()

        let request = f.controller.transactions.fetchRequestForRecurringTransactions()
        let results  = try f.context.fetch(request)
        #expect(results.contains(recurring))
        #expect(!results.contains(nonRecurring))
    }

    // MARK: - LineGraphDataPoint.amountString (currency display helper)

    @Test("amountString shows two decimal places for amounts below 1000")
    func amountString_below1000_twoDecimals() {
        #expect(LineGraphDataPoint(date: testDate(2024, 6, 1), amount: 9.5).amountString == "9.50")
        #expect(LineGraphDataPoint(date: testDate(2024, 6, 1), amount: 999.99).amountString == "999.99")
        #expect(LineGraphDataPoint(date: testDate(2024, 6, 1), amount: 0.01).amountString == "0.01")
    }

    @Test("amountString shows no decimal places for amounts at or above 1000")
    func amountString_atOrAbove1000_noDecimals() {
        #expect(LineGraphDataPoint(date: testDate(2024, 6, 1), amount: 1000).amountString == "1000")
        #expect(LineGraphDataPoint(date: testDate(2024, 6, 1), amount: 1234.56).amountString == "1235")
        #expect(LineGraphDataPoint(date: testDate(2024, 6, 1), amount: 10000).amountString == "10000")
    }

    @Test("amountString uses absolute value so negative amounts format the same as positive")
    func amountString_negative_usesAbsoluteValue() {
        let positive = LineGraphDataPoint(date: testDate(2024, 6, 1), amount:  42.5)
        let negative = LineGraphDataPoint(date: testDate(2024, 6, 1), amount: -42.5)
        #expect(positive.amountString == negative.amountString)
    }
}
