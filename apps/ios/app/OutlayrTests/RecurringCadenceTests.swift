//
//  RecurringCadenceTests.swift
//  OutlayrTests
//
//  The single-source recurrence cadence: raw-value contract, coefficient
//  clamping, day arithmetic, and human labels.
//

import Testing
@testable import Outlayr

struct RecurringCadenceTests {
    private let calendar = Calendar(identifier: .gregorian)

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d))!
    }

    @Test func rawValuesMatchCoreDataContract() {
        #expect(RecurringCadence.none.rawValue == 0)
        #expect(RecurringCadence.daily.rawValue == 1)
        #expect(RecurringCadence.weekly.rawValue == 2)
        #expect(RecurringCadence.monthly.rawValue == 3)
        #expect(RecurringCadence.yearly.rawValue == 4)
    }

    @Test func unknownRawValueIsNil() {
        #expect(RecurringCadence(rawValue: 9) == nil)
    }

    @Test func selectableExcludesNone() {
        #expect(RecurringCadence.selectable == [.daily, .weekly, .monthly, .yearly])
    }

    @Test func noneNeverAdvances() {
        #expect(RecurringCadence.none.next(from: day(2024, 6, 15), coefficient: 1, calendar: calendar) == nil)
    }

    @Test func weeklyAdvancesInDays() {
        let next = RecurringCadence.weekly.next(from: day(2024, 6, 1), coefficient: 1, calendar: calendar)
        #expect(next == day(2024, 6, 8))
    }

    @Test func coefficientClampedToAtLeastOne() {
        let base = day(2024, 6, 15)
        #expect(RecurringCadence.daily.next(from: base, coefficient: 0, calendar: calendar) == day(2024, 6, 16))
        #expect(RecurringCadence.daily.next(from: base, coefficient: -5, calendar: calendar) == day(2024, 6, 16))
    }

    @Test func monthEndClampIsIntentional() {
        // Jan 31 + 1 month lands on Feb 29 (2024 leap), not March.
        #expect(RecurringCadence.monthly.next(from: day(2024, 1, 31), coefficient: 1, calendar: calendar) == day(2024, 2, 29))
        // Feb 29 + 1 year lands on Feb 28 in a common year.
        #expect(RecurringCadence.yearly.next(from: day(2020, 2, 29), coefficient: 1, calendar: calendar) == day(2021, 2, 28))
    }

    @Test func scheduleLabels() {
        #expect(RecurringCadence.monthly.scheduleLabel(coefficient: 1) == "Monthly")
        #expect(RecurringCadence.monthly.scheduleLabel(coefficient: 3) == "Every 3 months")
        #expect(RecurringCadence.weekly.scheduleLabel(coefficient: 2) == "Every 2 weeks")
        #expect(RecurringCadence.yearly.scheduleLabel(coefficient: 1) == "Yearly")
        // A clamped coefficient reads as the singular cadence, not "Every 1 …".
        #expect(RecurringCadence.daily.scheduleLabel(coefficient: 0) == "Daily")
    }
}
