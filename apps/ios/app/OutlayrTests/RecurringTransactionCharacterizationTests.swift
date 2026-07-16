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

        controller.updateRecurringTransaction(transaction: original)

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

        controller.updateRecurringTransaction(transaction: original)

        let all = controller.results(for: Transaction.fetchRequest())
        XCTAssertEqual(all.count, 2, "original + a single entry dated today")

        let generated = try XCTUnwrap(all.first { $0.onceRecurring })
        XCTAssertEqual(generated.date, date(2024, 6, 15, 12, 0))
        XCTAssertEqual(original.recurringType, 0)
    }
}
