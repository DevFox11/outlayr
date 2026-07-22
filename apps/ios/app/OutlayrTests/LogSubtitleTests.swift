//
//  LogSubtitleTests.swift
//  OutlayrTests
//
//  Pins the one line of context under the "Log" title: it never claims two
//  windows of time at once, and it never renders an empty fragment.
//

import Testing

@testable import Outlayr

@Suite("LogSubtitle")
struct LogSubtitleTests {

    @Test("with no filter the subtitle is just the period")
    func noFilter_showsThePeriod() {
        let subtitle = LogSubtitle(filter: .all, period: "this month", detail: nil)

        #expect(subtitle.text == "This month")
    }

    @Test("a filter that names a subject is joined to the period")
    func subjectFilter_joinsThePeriod() {
        #expect(LogSubtitle(filter: .category, period: "this month", detail: "Groceries").text == "Groceries · This month")
        #expect(LogSubtitle(filter: .type, period: "this year", detail: "Income").text == "Income · This year")
        #expect(LogSubtitle(filter: .recurring, period: "today", detail: "Recurring").text == "Recurring · Today")
    }

    @Test("a filter that already names a window replaces the period instead of contradicting it")
    func periodFilter_replacesThePeriod() {
        #expect(LogSubtitle(filter: .day, period: "this month", detail: "20 Jul 2026").text == "20 Jul 2026")
        #expect(LogSubtitle(filter: .week, period: "this year", detail: "14 Jul – 20 Jul").text == "14 Jul – 20 Jul")
        #expect(LogSubtitle(filter: .month, period: "today", detail: "Jul 2026").text == "Jul 2026")
    }

    @Test("only day, week and month name their own window")
    func onlyPeriodFilters_ownTheirPeriod() {
        #expect(FilterType.day.namesItsOwnPeriod)
        #expect(FilterType.week.namesItsOwnPeriod)
        #expect(FilterType.month.namesItsOwnPeriod)

        #expect(FilterType.all.namesItsOwnPeriod == false)
        #expect(FilterType.type.namesItsOwnPeriod == false)
        #expect(FilterType.category.namesItsOwnPeriod == false)
        #expect(FilterType.recurring.namesItsOwnPeriod == false)
        #expect(FilterType.upcoming.namesItsOwnPeriod == false)
    }

    @Test("a filter with no resolved subject falls back to the period alone")
    func missingDetail_fallsBackToThePeriod() {
        // A category filter before any category has loaded.
        #expect(LogSubtitle(filter: .category, period: "this week", detail: nil).text == "This week")
        #expect(LogSubtitle(filter: .category, period: "this week", detail: "").text == "This week")
        // Even a period filter has to render something.
        #expect(LogSubtitle(filter: .day, period: "this week", detail: nil).text == "This week")
    }

    @Test("only the opening letter is capitalized, so translated fragments are left alone")
    func casing_touchesOnlyTheFirstLetter() {
        #expect(LogSubtitle(filter: .all, period: "all time", detail: nil).text == "All time")
        #expect(LogSubtitle(filter: .all, period: "", detail: nil).text == "")
    }

    @Test("the period is never capitalized in the middle of a joined subtitle")
    func joinedSubtitle_stillSentenceCasesThePeriod() {
        #expect(LogSubtitle(filter: .category, period: "all time", detail: "Rent").text == "Rent · All time")
    }
}
