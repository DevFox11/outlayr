//
//  InsightsBucketingCharacterizationTests.swift
//  OutlayrTests
//
//  Pins DataController.getInsights monthly date-bucketing (type 2), both the
//  completed-period average path and the current-period partial-average path.
//  Frozen clock: 2024-06-15 12:00 (referenceDate).
//

import Foundation
import CoreData
import Testing

@testable import Outlayr

@MainActor
struct InsightsBucketingCharacterizationTests {
    @Test func monthlyInsightsBucketsCompletedMonth() throws {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)

        // Two expenses on the same day, one on another day, all in April (a completed month).
        f.makeTransaction(in: context, amount: 10, date: f.date(2024, 4, 5, 9, 0), income: false, category: category)
        f.makeTransaction(in: context, amount: 5, date: f.date(2024, 4, 5, 15, 0), income: false, category: category)
        f.makeTransaction(in: context, amount: 7, date: f.date(2024, 4, 20, 12, 0), income: false, category: category)
        // Excluded: income within range, and an expense outside the month.
        f.makeTransaction(in: context, amount: 100, date: f.date(2024, 4, 10, 12, 0), income: true, category: category)
        f.makeTransaction(in: context, amount: 999, date: f.date(2024, 5, 2, 12, 0), income: false, category: category)
        try? controller.save()

        let result = controller.transactions.getInsights(type: 2, date: f.date(2024, 4, 1), income: false)

        #expect(abs(result.amount - 22) < 0.0001)
        #expect(abs(result.maximum - 15) < 0.0001)
        #expect(result.numberOfDays == 2)
        #expect(abs(result.average - 22.0 / 30.0) < 0.0001) // April has 30 days
        #expect(result.dates.count == 30)

        let aprilFifthValue = try #require(result.dateDictionary[f.date(2024, 4, 5)])
        #expect(abs(aprilFifthValue - 15) < 0.0001)

        let aprilTwentiethValue = try #require(result.dateDictionary[f.date(2024, 4, 20)])
        #expect(abs(aprilTwentiethValue - 7) < 0.0001)
    }

    @Test func monthlyInsightsPartialAverageForCurrentMonth() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)

        f.makeTransaction(in: context, amount: 12, date: f.date(2024, 6, 3, 9, 0), income: false, category: category)
        f.makeTransaction(in: context, amount: 8, date: f.date(2024, 6, 10, 9, 0), income: false, category: category)
        // Dated after "now" — excluded by the current-period end predicate.
        f.makeTransaction(in: context, amount: 500, date: f.date(2024, 6, 20, 9, 0), income: false, category: category)
        try? controller.save()

        let result = controller.transactions.getInsights(type: 2, date: f.date(2024, 6, 1), income: false)

        #expect(abs(result.amount - 20) < 0.0001)
        #expect(abs(result.maximum - 12) < 0.0001)
        #expect(result.numberOfDays == 2)
        // Partial average divides by elapsed days + 1 (06-01 → 06-15 == 14 days).
        #expect(abs(result.average - 20.0 / 15.0) < 0.0001)
    }
}
