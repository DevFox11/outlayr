//
//  LogPeriodCursorTests.swift
//  OutlayrTests
//
//  Pins the normalization the day/week/month filters depend on. The Log fetches
//  a day on an exact `Transaction.day` value and a week or month on its first
//  instant, so a cursor left un-normalized returns an empty screen rather than
//  a wrong one — which is much harder to notice.
//

import Foundation
import Testing

@testable import Outlayr

@Suite("LogPeriodCursor")
struct LogPeriodCursorTests {

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US_POSIX")
        calendar.timeZone = TimeZone(identifier: "UTC")!
        calendar.firstWeekday = 2
        calendar.minimumDaysInFirstWeek = 4
        return calendar
    }

    private var locale: Locale { Locale(identifier: "en_US_POSIX") }

    private func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 0, _ minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour, minute: minute))!
    }

    // MARK: - Normalization

    @Test("a day cursor snaps to the start of that day")
    func dayCursor_snapsToMidnight() {
        let cursor = LogPeriodCursor(unit: .day, containing: date(2026, 7, 20, 17, 42), calendar: calendar)

        #expect(cursor.date == date(2026, 7, 20))
    }

    @Test("a week cursor snaps back to the first weekday, not to the given day")
    func weekCursor_snapsToTheFirstWeekday() {
        // 2026-07-23 is a Thursday; the week starts on Monday the 20th.
        let cursor = LogPeriodCursor(unit: .week, containing: date(2026, 7, 23, 9, 0), calendar: calendar)

        #expect(cursor.date == date(2026, 7, 20))
    }

    @Test("a month cursor snaps to the first of the month")
    func monthCursor_snapsToTheFirst() {
        let cursor = LogPeriodCursor(unit: .month, containing: date(2026, 7, 23, 9, 0), calendar: calendar)

        #expect(cursor.date == date(2026, 7, 1))
    }

    @Test("normalizing an already-normalized cursor changes nothing")
    func normalization_isIdempotent() {
        for unit in [LogPeriodCursor.Unit.day, .week, .month] {
            let once = LogPeriodCursor(unit: unit, containing: date(2026, 7, 23, 9, 0), calendar: calendar)
            let twice = LogPeriodCursor(unit: unit, containing: once.date, calendar: calendar)

            #expect(once == twice)
        }
    }

    // MARK: - Stepping

    @Test("stepping moves by one whole unit and stays normalized")
    func stepping_movesOneWholeUnit() {
        let day = LogPeriodCursor(unit: .day, containing: date(2026, 7, 20, 13, 0), calendar: calendar)
        #expect(day.stepped(by: -1, calendar: calendar).date == date(2026, 7, 19))

        let week = LogPeriodCursor(unit: .week, containing: date(2026, 7, 23), calendar: calendar)
        #expect(week.stepped(by: -1, calendar: calendar).date == date(2026, 7, 13))

        let month = LogPeriodCursor(unit: .month, containing: date(2026, 7, 23), calendar: calendar)
        #expect(month.stepped(by: 1, calendar: calendar).date == date(2026, 8, 1))
    }

    @Test("stepping across a month boundary lands on a real date")
    func stepping_crossesMonthBoundaries() {
        let day = LogPeriodCursor(unit: .day, containing: date(2026, 3, 1), calendar: calendar)

        #expect(day.stepped(by: -1, calendar: calendar).date == date(2026, 2, 28))
    }

    @Test("stepping forward stops at the period holding now — nothing is logged later")
    func forwardStep_stopsAtTheCurrentPeriod() {
        let now = date(2026, 7, 23, 11, 0)

        let current = LogPeriodCursor(unit: .day, containing: now, calendar: calendar)
        #expect(current.canStepForward(now: now, calendar: calendar) == false)

        let past = LogPeriodCursor(unit: .day, containing: date(2026, 7, 22), calendar: calendar)
        #expect(past.canStepForward(now: now, calendar: calendar))
    }

    @Test("the current week and month are also the last steppable ones")
    func forwardStep_stopsForWeeksAndMonths() {
        let now = date(2026, 7, 23, 11, 0)

        #expect(LogPeriodCursor(unit: .week, containing: now, calendar: calendar).canStepForward(now: now, calendar: calendar) == false)
        #expect(LogPeriodCursor(unit: .month, containing: now, calendar: calendar).canStepForward(now: now, calendar: calendar) == false)
        #expect(LogPeriodCursor(unit: .month, containing: date(2026, 6, 10), calendar: calendar).canStepForward(now: now, calendar: calendar))
    }

    // MARK: - Labels

    @Test("each unit labels itself at the resolution it filters on")
    func labels_matchTheirUnit() {
        let day = LogPeriodCursor(unit: .day, containing: date(2026, 7, 20), calendar: calendar)
        #expect(day.label(calendar: calendar, locale: locale) == "20 Jul 2026")

        let month = LogPeriodCursor(unit: .month, containing: date(2026, 7, 20), calendar: calendar)
        #expect(month.label(calendar: calendar, locale: locale) == "Jul 2026")
    }

    @Test("a week label spans the seven days it actually covers")
    func weekLabel_spansSevenDays() {
        let week = LogPeriodCursor(unit: .week, containing: date(2026, 7, 23), calendar: calendar)

        #expect(week.label(calendar: calendar, locale: locale) == "20 Jul – 26 Jul")
    }

    // MARK: - Which filters have a cursor at all

    @Test("only the three period filters step")
    func onlyPeriodFilters_haveAUnit() {
        #expect(FilterType.day.periodUnit == .day)
        #expect(FilterType.week.periodUnit == .week)
        #expect(FilterType.month.periodUnit == .month)

        #expect(FilterType.all.periodUnit == nil)
        #expect(FilterType.type.periodUnit == nil)
        #expect(FilterType.category.periodUnit == nil)
        #expect(FilterType.recurring.periodUnit == nil)
        #expect(FilterType.upcoming.periodUnit == nil)
    }
}
