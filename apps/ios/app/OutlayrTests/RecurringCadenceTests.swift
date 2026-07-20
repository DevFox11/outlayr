//
//  RecurringCadenceTests.swift
//  OutlayrTests
//
//  The single-source recurrence cadence: raw-value contract, coefficient
//  clamping, day arithmetic, and human labels.
//

import XCTest
@testable import Outlayr

final class RecurringCadenceTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)
    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d))!
    }

    func testRawValuesMatchCoreDataContract() {
        XCTAssertEqual(RecurringCadence.none.rawValue, 0)
        XCTAssertEqual(RecurringCadence.daily.rawValue, 1)
        XCTAssertEqual(RecurringCadence.weekly.rawValue, 2)
        XCTAssertEqual(RecurringCadence.monthly.rawValue, 3)
        XCTAssertEqual(RecurringCadence.yearly.rawValue, 4)
    }

    func testUnknownRawValueIsNil() {
        XCTAssertNil(RecurringCadence(rawValue: 9))
    }

    func testSelectableExcludesNone() {
        XCTAssertEqual(RecurringCadence.selectable, [.daily, .weekly, .monthly, .yearly])
    }

    func testNoneNeverAdvances() {
        XCTAssertNil(RecurringCadence.none.next(from: day(2024, 6, 15), coefficient: 1, calendar: calendar))
    }

    func testWeeklyAdvancesInDays() {
        let next = RecurringCadence.weekly.next(from: day(2024, 6, 1), coefficient: 1, calendar: calendar)
        XCTAssertEqual(next, day(2024, 6, 8))
    }

    func testCoefficientClampedToAtLeastOne() {
        let base = day(2024, 6, 15)
        XCTAssertEqual(RecurringCadence.daily.next(from: base, coefficient: 0, calendar: calendar), day(2024, 6, 16))
        XCTAssertEqual(RecurringCadence.daily.next(from: base, coefficient: -5, calendar: calendar), day(2024, 6, 16))
    }

    func testMonthEndClampIsIntentional() {
        // Jan 31 + 1 month lands on Feb 29 (2024 leap), not March.
        XCTAssertEqual(RecurringCadence.monthly.next(from: day(2024, 1, 31), coefficient: 1, calendar: calendar), day(2024, 2, 29))
        // Feb 29 + 1 year lands on Feb 28 in a common year.
        XCTAssertEqual(RecurringCadence.yearly.next(from: day(2020, 2, 29), coefficient: 1, calendar: calendar), day(2021, 2, 28))
    }

    func testScheduleLabels() {
        XCTAssertEqual(RecurringCadence.monthly.scheduleLabel(coefficient: 1), "Monthly")
        XCTAssertEqual(RecurringCadence.monthly.scheduleLabel(coefficient: 3), "Every 3 months")
        XCTAssertEqual(RecurringCadence.weekly.scheduleLabel(coefficient: 2), "Every 2 weeks")
        XCTAssertEqual(RecurringCadence.yearly.scheduleLabel(coefficient: 1), "Yearly")
        // A clamped coefficient reads as the singular cadence, not "Every 1 …".
        XCTAssertEqual(RecurringCadence.daily.scheduleLabel(coefficient: 0), "Daily")
    }
}
