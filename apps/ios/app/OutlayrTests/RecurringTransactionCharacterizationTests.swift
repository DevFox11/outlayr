//
//  RecurringTransactionCharacterizationTests.swift
//  OutlayrTests
//
//  Pins the recurring transaction back-fill in DataController.updateRecurringTransaction.
//  Frozen clock: 2024-06-15 12:00 (referenceDate).
//

import Foundation
import CoreData
import Testing

@testable import Outlayr

@MainActor
struct RecurringTransactionCharacterizationTests {
    @Test func dailyBackfillGeneratesOnePerMissedDayThroughToday() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Coffee", order: 1)

        // Daily (type 1, coefficient 1), last posted at midnight three days ago.
        let original = f.makeTransaction(
            in: context,
            amount: 4,
            date: f.date(2024, 6, 12, 0, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = f.date(2024, 6, 12, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        #expect(all.count == 4, "original + one back-filled entry per missed day (06-13, 06-14, 06-15)")

        let generated = all.filter { $0.onceRecurring }
        let generatedDays = generated.compactMap { $0.day }.sorted()
        #expect(generatedDays == [
            f.date(2024, 6, 13, 0, 0),
            f.date(2024, 6, 14, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])

        // The original recurrence is retired once back-filled.
        #expect(original.recurringType == 0)

        // Only the most recent entry (still ahead of today) carries the recurrence forward.
        let stillRecurring = generated.filter { $0.recurringType == 1 }
        #expect(stillRecurring.count == 1)
        #expect(stillRecurring.first?.day == f.date(2024, 6, 15, 0, 0))
    }

    @Test func nextDateTodayGeneratesSingleEntry() throws {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Coffee", order: 1)

        // Next occurrence lands on referenceDate's calendar day (not before start-of-today).
        let original = f.makeTransaction(
            in: context,
            amount: 4,
            date: f.date(2024, 6, 14, 12, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = f.date(2024, 6, 14, 12, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        #expect(all.count == 2, "original + a single entry dated today")

        let generated = try #require(all.first { $0.onceRecurring })
        #expect(generated.date == f.date(2024, 6, 15, 12, 0))
        #expect(original.recurringType == 0)
    }

    // MARK: - Yearly (recurringType 4)

    @Test func yearlyNextTransactionDateAdvancesByCoefficientYears() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context,
            amount: 120,
            date: f.date(2024, 6, 15, 0, 0),
            recurringType: 4,
            recurringCoefficient: 2
        )
        original.day = f.date(2024, 6, 15, 0, 0)

        #expect(original.nextTransactionDate == f.date(2026, 6, 15, 0, 0))
    }

    @Test func yearlyBackfillGeneratesOnePerMissedYearThroughToday() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Domain", order: 1)

        // Yearly, last posted two years ago at midnight.
        let original = f.makeTransaction(
            in: context,
            amount: 12,
            date: f.date(2022, 6, 15, 0, 0),
            note: "Domain",
            category: category,
            recurringType: 4,
            recurringCoefficient: 1
        )
        original.day = f.date(2022, 6, 15, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        let generated = all.filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2023, 6, 15, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
        // The most recent occurrence (today) carries the yearly recurrence forward.
        let stillRecurring = generated.filter { $0.recurringType == 4 }
        #expect(stillRecurring.count == 1)
        #expect(stillRecurring.first?.day == f.date(2024, 6, 15, 0, 0))
        #expect(original.recurringType == 0)
    }

    // MARK: - recurringEndDate cutoff

    @Test func endDateOnOccurrenceIsInclusiveAndStopsAfter() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Domain", order: 1)

        // Yearly since 2021; ends ON the 2023 occurrence.
        let original = f.makeTransaction(
            in: context,
            amount: 12,
            date: f.date(2021, 6, 15, 0, 0),
            note: "Domain",
            category: category,
            recurringType: 4,
            recurringCoefficient: 1
        )
        original.day = f.date(2021, 6, 15, 0, 0)
        original.recurringEndDate = f.date(2023, 6, 15, 12, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        // 2022 and 2023 (inclusive of the end date) are generated; 2024 is not.
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2022, 6, 15, 0, 0),
            f.date(2023, 6, 15, 0, 0)
        ])
        // Nothing carries the recurrence past the end date.
        #expect(generated.allSatisfy { $0.recurringType == 0 })
    }

    @Test func endDateInPastGeneratesNothingAndRetires() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Coffee", order: 1)

        // Daily, but the end date already passed before the next occurrence.
        let original = f.makeTransaction(
            in: context,
            amount: 4,
            date: f.date(2024, 6, 12, 0, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = f.date(2024, 6, 12, 0, 0)
        original.recurringEndDate = f.date(2024, 6, 10, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        #expect(all.count == 1, "no occurrences generated past the end date")
        #expect(original.recurringType == 0, "the expired recurrence is retired")
    }

    @Test func nilEndDateGeneratesEveryMissedOccurrence() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Coffee", order: 1)

        let original = f.makeTransaction(
            in: context,
            amount: 4,
            date: f.date(2024, 6, 12, 0, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = f.date(2024, 6, 12, 0, 0)
        original.recurringEndDate = nil
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2024, 6, 13, 0, 0),
            f.date(2024, 6, 14, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
    }

    // MARK: - Weekly (type 2) and monthly (type 3) back-fill

    @Test func weeklyBackfillGeneratesOnePerMissedWeek() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context, amount: 9, date: f.date(2024, 5, 25, 0, 0),
            note: "Gym", category: f.makeCategory(in: context, name: "Gym", order: 1),
            recurringType: 2, recurringCoefficient: 1
        )
        original.day = f.date(2024, 5, 25, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2024, 6, 1, 0, 0),
            f.date(2024, 6, 8, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
        #expect(generated.filter { $0.recurringType == 2 }.compactMap { $0.day } == [f.date(2024, 6, 15, 0, 0)])
    }

    @Test func monthlyBackfillGeneratesOnePerMissedMonth() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context, amount: 20, date: f.date(2024, 3, 15, 0, 0),
            note: "Netflix", category: f.makeCategory(in: context, name: "Streaming", order: 1),
            recurringType: 3, recurringCoefficient: 1
        )
        original.day = f.date(2024, 3, 15, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2024, 4, 15, 0, 0),
            f.date(2024, 5, 15, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
    }

    @Test func everyTwoWeeksBackfillHonorsCoefficient() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context, amount: 5, date: f.date(2024, 5, 4, 0, 0),
            note: "Allowance", category: f.makeCategory(in: context, name: "Cash", order: 1),
            recurringType: 2, recurringCoefficient: 2
        )
        original.day = f.date(2024, 5, 4, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2024, 5, 18, 0, 0),
            f.date(2024, 6, 1, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
    }

    @Test func everyThreeMonthsBackfillHonorsCoefficient() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context, amount: 50, date: f.date(2023, 12, 15, 0, 0),
            note: "Insurance", category: f.makeCategory(in: context, name: "Bills", order: 1),
            recurringType: 3, recurringCoefficient: 3
        )
        original.day = f.date(2023, 12, 15, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2024, 3, 15, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
    }

    // MARK: - Calendar month-end / leap-day clamp (INTENTIONAL, pinned)

    /// Jan 31 monthly clamps to the last valid day of each month and, once it
    /// lands on a short month, the anchor drifts to that day (29th here) rather
    /// than returning to the 31st. This is intentional Calendar behaviour.
    @Test func monthlyJan31DriftClampsToMonthEnd() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context, amount: 10, date: f.date(2024, 1, 31, 0, 0),
            note: "Rent", category: f.makeCategory(in: context, name: "Housing", order: 1),
            recurringType: 3, recurringCoefficient: 1
        )
        original.day = f.date(2024, 1, 31, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        let days = generated.compactMap { $0.day }.sorted()
        #expect(days == [
            f.date(2024, 2, 29, 0, 0),
            f.date(2024, 3, 29, 0, 0),
            f.date(2024, 4, 29, 0, 0),
            f.date(2024, 5, 29, 0, 0)
        ])
        // Drift confirmed: never returns to the 31st.
        let calendar = Calendar.current
        #expect(days.contains { calendar.component(.day, from: $0) == 31 } == false)
    }

    /// Feb 29 yearly clamps to Feb 28 in common years and stays on the 28th.
    @Test func yearlyFeb29DriftClampsToFeb28() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context, amount: 99, date: f.date(2020, 2, 29, 0, 0),
            note: "Membership", category: f.makeCategory(in: context, name: "Clubs", order: 1),
            recurringType: 4, recurringCoefficient: 1
        )
        original.day = f.date(2020, 2, 29, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2021, 2, 28, 0, 0),
            f.date(2022, 2, 28, 0, 0),
            f.date(2023, 2, 28, 0, 0),
            f.date(2024, 2, 28, 0, 0)
        ])
    }

    // MARK: - Today-branch end-date guard

    @Test func todayOccurrencePastEndDateGeneratesNothingAndRetires() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        // Next occurrence is exactly today (day + 1 = 2024-06-15) but the end date
        // already passed — nothing generated, and the row retires.
        let original = f.makeTransaction(
            in: context, amount: 4, date: f.date(2024, 6, 14, 0, 0),
            note: "Coffee", category: f.makeCategory(in: context, name: "Coffee", order: 1),
            recurringType: 1, recurringCoefficient: 1
        )
        original.day = f.date(2024, 6, 14, 0, 0)
        original.recurringEndDate = f.date(2024, 6, 10, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        #expect(all.count == 1)
        #expect(original.recurringType == 0)
    }

    // MARK: - Malformed coefficient (defensive clamp + forward-progress guard)

    @Test func zeroCoefficientTerminatesWithBoundedOccurrences() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        // A coefficient of 0 would stall a naive loop; clamping to 1 (plus the
        // forward-progress guard) keeps it bounded and terminating.
        let original = f.makeTransaction(
            in: context, amount: 4, date: f.date(2024, 6, 12, 0, 0),
            note: "Coffee", category: f.makeCategory(in: context, name: "Coffee", order: 1),
            recurringType: 1, recurringCoefficient: 0
        )
        original.day = f.date(2024, 6, 12, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        #expect(generated.compactMap { $0.day }.sorted() == [
            f.date(2024, 6, 13, 0, 0),
            f.date(2024, 6, 14, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
    }

    @Test func negativeCoefficientTerminatesWithBoundedOccurrences() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = f.makeTransaction(
            in: context, amount: 4, date: f.date(2024, 6, 12, 0, 0),
            note: "Coffee", category: f.makeCategory(in: context, name: "Coffee", order: 1),
            recurringType: 1, recurringCoefficient: -1
        )
        original.day = f.date(2024, 6, 12, 0, 0)
        try? controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        // Bounded (does not run away) and terminates.
        #expect(all.count <= 5)
        #expect(all.filter { $0.onceRecurring }.compactMap { $0.day }.sorted() == [
            f.date(2024, 6, 13, 0, 0),
            f.date(2024, 6, 14, 0, 0),
            f.date(2024, 6, 15, 0, 0)
        ])
    }
}
