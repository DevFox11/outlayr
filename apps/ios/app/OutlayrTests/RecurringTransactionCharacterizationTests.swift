//
//  RecurringTransactionCharacterizationTests.swift
//  OutlayrTests
//
//  Pins the recurring transaction back-fill in DataController.updateRecurringTransaction.
//  Frozen clock: 2024-06-15 12:00 (referenceDate).
//

import CoreData
import XCTest

@testable import Outlayr

final class RecurringTransactionCharacterizationTests: CharacterizationTestCase {
    func testDailyBackfillGeneratesOnePerMissedDayThroughToday() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Coffee", order: 1)

        // Daily (type 1, coefficient 1), last posted at midnight three days ago.
        let original = makeTransaction(
            in: context,
            amount: 4,
            date: date(2024, 6, 12, 0, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = date(2024, 6, 12, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        XCTAssertEqual(all.count, 4, "original + one back-filled entry per missed day (06-13, 06-14, 06-15)")

        let generated = all.filter { $0.onceRecurring }
        let generatedDays = generated.compactMap { $0.day }.sorted()
        XCTAssertEqual(generatedDays, [
            date(2024, 6, 13, 0, 0),
            date(2024, 6, 14, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])

        // The original recurrence is retired once back-filled.
        XCTAssertEqual(original.recurringType, 0)

        // Only the most recent entry (still ahead of today) carries the recurrence forward.
        let stillRecurring = generated.filter { $0.recurringType == 1 }
        XCTAssertEqual(stillRecurring.count, 1)
        XCTAssertEqual(stillRecurring.first?.day, date(2024, 6, 15, 0, 0))
    }

    func testNextDateTodayGeneratesSingleEntry() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Coffee", order: 1)

        // Next occurrence lands on referenceDate's calendar day (not before start-of-today).
        let original = makeTransaction(
            in: context,
            amount: 4,
            date: date(2024, 6, 14, 12, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = date(2024, 6, 14, 12, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        XCTAssertEqual(all.count, 2, "original + a single entry dated today")

        let generated = try XCTUnwrap(all.first { $0.onceRecurring })
        XCTAssertEqual(generated.date, date(2024, 6, 15, 12, 0))
        XCTAssertEqual(original.recurringType, 0)
    }

    // MARK: - Yearly (recurringType 4)

    func testYearlyNextTransactionDateAdvancesByCoefficientYears() {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context,
            amount: 120,
            date: date(2024, 6, 15, 0, 0),
            recurringType: 4,
            recurringCoefficient: 2
        )
        original.day = date(2024, 6, 15, 0, 0)

        XCTAssertEqual(original.nextTransactionDate, date(2026, 6, 15, 0, 0))
    }

    func testYearlyBackfillGeneratesOnePerMissedYearThroughToday() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Domain", order: 1)

        // Yearly, last posted two years ago at midnight.
        let original = makeTransaction(
            in: context,
            amount: 12,
            date: date(2022, 6, 15, 0, 0),
            note: "Domain",
            category: category,
            recurringType: 4,
            recurringCoefficient: 1
        )
        original.day = date(2022, 6, 15, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        let generated = all.filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2023, 6, 15, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
        // The most recent occurrence (today) carries the yearly recurrence forward.
        let stillRecurring = generated.filter { $0.recurringType == 4 }
        XCTAssertEqual(stillRecurring.count, 1)
        XCTAssertEqual(stillRecurring.first?.day, date(2024, 6, 15, 0, 0))
        XCTAssertEqual(original.recurringType, 0)
    }

    // MARK: - recurringEndDate cutoff

    func testEndDateOnOccurrenceIsInclusiveAndStopsAfter() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Domain", order: 1)

        // Yearly since 2021; ends ON the 2023 occurrence.
        let original = makeTransaction(
            in: context,
            amount: 12,
            date: date(2021, 6, 15, 0, 0),
            note: "Domain",
            category: category,
            recurringType: 4,
            recurringCoefficient: 1
        )
        original.day = date(2021, 6, 15, 0, 0)
        original.recurringEndDate = date(2023, 6, 15, 12, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        // 2022 and 2023 (inclusive of the end date) are generated; 2024 is not.
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2022, 6, 15, 0, 0),
            date(2023, 6, 15, 0, 0)
        ])
        // Nothing carries the recurrence past the end date.
        XCTAssertTrue(generated.allSatisfy { $0.recurringType == 0 })
    }

    func testEndDateInPastGeneratesNothingAndRetires() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Coffee", order: 1)

        // Daily, but the end date already passed before the next occurrence.
        let original = makeTransaction(
            in: context,
            amount: 4,
            date: date(2024, 6, 12, 0, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = date(2024, 6, 12, 0, 0)
        original.recurringEndDate = date(2024, 6, 10, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        XCTAssertEqual(all.count, 1, "no occurrences generated past the end date")
        XCTAssertEqual(original.recurringType, 0, "the expired recurrence is retired")
    }

    func testNilEndDateGeneratesEveryMissedOccurrence() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Coffee", order: 1)

        let original = makeTransaction(
            in: context,
            amount: 4,
            date: date(2024, 6, 12, 0, 0),
            note: "Coffee",
            category: category,
            recurringType: 1,
            recurringCoefficient: 1
        )
        original.day = date(2024, 6, 12, 0, 0)
        original.recurringEndDate = nil
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2024, 6, 13, 0, 0),
            date(2024, 6, 14, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
    }

    // MARK: - Weekly (type 2) and monthly (type 3) back-fill

    func testWeeklyBackfillGeneratesOnePerMissedWeek() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context, amount: 9, date: date(2024, 5, 25, 0, 0),
            note: "Gym", category: makeCategory(in: context, name: "Gym", order: 1),
            recurringType: 2, recurringCoefficient: 1
        )
        original.day = date(2024, 5, 25, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2024, 6, 1, 0, 0),
            date(2024, 6, 8, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
        XCTAssertEqual(generated.filter { $0.recurringType == 2 }.compactMap { $0.day }, [date(2024, 6, 15, 0, 0)])
    }

    func testMonthlyBackfillGeneratesOnePerMissedMonth() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context, amount: 20, date: date(2024, 3, 15, 0, 0),
            note: "Netflix", category: makeCategory(in: context, name: "Streaming", order: 1),
            recurringType: 3, recurringCoefficient: 1
        )
        original.day = date(2024, 3, 15, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2024, 4, 15, 0, 0),
            date(2024, 5, 15, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
    }

    func testEveryTwoWeeksBackfillHonorsCoefficient() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context, amount: 5, date: date(2024, 5, 4, 0, 0),
            note: "Allowance", category: makeCategory(in: context, name: "Cash", order: 1),
            recurringType: 2, recurringCoefficient: 2
        )
        original.day = date(2024, 5, 4, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2024, 5, 18, 0, 0),
            date(2024, 6, 1, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
    }

    func testEveryThreeMonthsBackfillHonorsCoefficient() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context, amount: 50, date: date(2023, 12, 15, 0, 0),
            note: "Insurance", category: makeCategory(in: context, name: "Bills", order: 1),
            recurringType: 3, recurringCoefficient: 3
        )
        original.day = date(2023, 12, 15, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2024, 3, 15, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
    }

    // MARK: - Calendar month-end / leap-day clamp (INTENTIONAL, pinned)

    /// Jan 31 monthly clamps to the last valid day of each month and, once it
    /// lands on a short month, the anchor drifts to that day (29th here) rather
    /// than returning to the 31st. This is intentional Calendar behaviour.
    func testMonthlyJan31DriftClampsToMonthEnd() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context, amount: 10, date: date(2024, 1, 31, 0, 0),
            note: "Rent", category: makeCategory(in: context, name: "Housing", order: 1),
            recurringType: 3, recurringCoefficient: 1
        )
        original.day = date(2024, 1, 31, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        let days = generated.compactMap { $0.day }.sorted()
        XCTAssertEqual(days, [
            date(2024, 2, 29, 0, 0),
            date(2024, 3, 29, 0, 0),
            date(2024, 4, 29, 0, 0),
            date(2024, 5, 29, 0, 0)
        ])
        // Drift confirmed: never returns to the 31st.
        let calendar = Calendar.current
        XCTAssertFalse(days.contains { calendar.component(.day, from: $0) == 31 })
    }

    /// Feb 29 yearly clamps to Feb 28 in common years and stays on the 28th.
    func testYearlyFeb29DriftClampsToFeb28() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context, amount: 99, date: date(2020, 2, 29, 0, 0),
            note: "Membership", category: makeCategory(in: context, name: "Clubs", order: 1),
            recurringType: 4, recurringCoefficient: 1
        )
        original.day = date(2020, 2, 29, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2021, 2, 28, 0, 0),
            date(2022, 2, 28, 0, 0),
            date(2023, 2, 28, 0, 0),
            date(2024, 2, 28, 0, 0)
        ])
    }

    // MARK: - Today-branch end-date guard

    func testTodayOccurrencePastEndDateGeneratesNothingAndRetires() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        // Next occurrence is exactly today (day + 1 = 2024-06-15) but the end date
        // already passed — nothing generated, and the row retires.
        let original = makeTransaction(
            in: context, amount: 4, date: date(2024, 6, 14, 0, 0),
            note: "Coffee", category: makeCategory(in: context, name: "Coffee", order: 1),
            recurringType: 1, recurringCoefficient: 1
        )
        original.day = date(2024, 6, 14, 0, 0)
        original.recurringEndDate = date(2024, 6, 10, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        XCTAssertEqual(all.count, 1)
        XCTAssertEqual(original.recurringType, 0)
    }

    // MARK: - Malformed coefficient (defensive clamp + forward-progress guard)

    func testZeroCoefficientTerminatesWithBoundedOccurrences() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        // A coefficient of 0 would stall a naive loop; clamping to 1 (plus the
        // forward-progress guard) keeps it bounded and terminating.
        let original = makeTransaction(
            in: context, amount: 4, date: date(2024, 6, 12, 0, 0),
            note: "Coffee", category: makeCategory(in: context, name: "Coffee", order: 1),
            recurringType: 1, recurringCoefficient: 0
        )
        original.day = date(2024, 6, 12, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let generated = controller.results(for: Transaction.fetchRequest()).filter { $0.onceRecurring }
        XCTAssertEqual(generated.compactMap { $0.day }.sorted(), [
            date(2024, 6, 13, 0, 0),
            date(2024, 6, 14, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
    }

    func testNegativeCoefficientTerminatesWithBoundedOccurrences() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let original = makeTransaction(
            in: context, amount: 4, date: date(2024, 6, 12, 0, 0),
            note: "Coffee", category: makeCategory(in: context, name: "Coffee", order: 1),
            recurringType: 1, recurringCoefficient: -1
        )
        original.day = date(2024, 6, 12, 0, 0)
        controller.save()

        controller.transactions.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        // Bounded (does not run away) and terminates.
        XCTAssertLessThanOrEqual(all.count, 5)
        XCTAssertEqual(all.filter { $0.onceRecurring }.compactMap { $0.day }.sorted(), [
            date(2024, 6, 13, 0, 0),
            date(2024, 6, 14, 0, 0),
            date(2024, 6, 15, 0, 0)
        ])
    }
}
