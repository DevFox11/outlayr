//
//  InsightsBucketingCharacterizationTests.swift
//  OutlayrTests
//
//  Pins DataController.getInsights monthly date-bucketing (type 2), both the
//  completed-period average path and the current-period partial-average path.
//  Frozen clock: 2024-06-15 12:00 (referenceDate).
//

import CoreData
import XCTest

@testable import Outlayr

final class InsightsBucketingCharacterizationTests: CharacterizationTestCase {
    func testMonthlyInsightsBucketsCompletedMonth() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)

        // Two expenses on the same day, one on another day, all in April (a completed month).
        makeTransaction(in: context, amount: 10, date: date(2024, 4, 5, 9, 0), income: false, category: category)
        makeTransaction(in: context, amount: 5, date: date(2024, 4, 5, 15, 0), income: false, category: category)
        makeTransaction(in: context, amount: 7, date: date(2024, 4, 20, 12, 0), income: false, category: category)
        // Excluded: income within range, and an expense outside the month.
        makeTransaction(in: context, amount: 100, date: date(2024, 4, 10, 12, 0), income: true, category: category)
        makeTransaction(in: context, amount: 999, date: date(2024, 5, 2, 12, 0), income: false, category: category)
        try? controller.save()

        let result = controller.transactions.getInsights(type: 2, date: date(2024, 4, 1), income: false)

        XCTAssertEqual(result.amount, 22, accuracy: 0.0001)
        XCTAssertEqual(result.maximum, 15, accuracy: 0.0001)
        XCTAssertEqual(result.numberOfDays, 2)
        XCTAssertEqual(result.average, 22.0 / 30.0, accuracy: 0.0001) // April has 30 days
        XCTAssertEqual(result.dates.count, 30)
        XCTAssertEqual(try XCTUnwrap(result.dateDictionary[date(2024, 4, 5)]), 15, accuracy: 0.0001)
        XCTAssertEqual(try XCTUnwrap(result.dateDictionary[date(2024, 4, 20)]), 7, accuracy: 0.0001)
    }

    func testMonthlyInsightsPartialAverageForCurrentMonth() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)

        makeTransaction(in: context, amount: 12, date: date(2024, 6, 3, 9, 0), income: false, category: category)
        makeTransaction(in: context, amount: 8, date: date(2024, 6, 10, 9, 0), income: false, category: category)
        // Dated after "now" — excluded by the current-period end predicate.
        makeTransaction(in: context, amount: 500, date: date(2024, 6, 20, 9, 0), income: false, category: category)
        try? controller.save()

        let result = controller.transactions.getInsights(type: 2, date: date(2024, 6, 1), income: false)

        XCTAssertEqual(result.amount, 20, accuracy: 0.0001)
        XCTAssertEqual(result.maximum, 12, accuracy: 0.0001)
        XCTAssertEqual(result.numberOfDays, 2)
        // Partial average divides by elapsed days + 1 (06-01 → 06-15 == 14 days).
        XCTAssertEqual(result.average, 20.0 / 15.0, accuracy: 0.0001)
    }
}
