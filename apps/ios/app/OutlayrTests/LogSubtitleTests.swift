//
//  LogSubtitleTests.swift
//  OutlayrTests
//
//  Pins the one line of context under the "Log" title: with a filter it names
//  only the filter's subject, never the period the filtered list ignores.
//

import Testing

@testable import Outlayr

@Suite("LogSubtitle")
struct LogSubtitleTests {

    @Test("with no filter the subtitle is just the period")
    func noFilter_showsThePeriod() {
        #expect(LogSubtitle(period: "this month", detail: nil).text == "This month")
    }

    @Test("an active filter names only its subject, never the period")
    func activeFilter_showsOnlyTheDetail() {
        #expect(LogSubtitle(period: "this month", detail: "Groceries").text == "Groceries")
        #expect(LogSubtitle(period: "this year", detail: "Income").text == "Income")
        #expect(LogSubtitle(period: "today", detail: "20 Jul 2026").text == "20 Jul 2026")
        #expect(LogSubtitle(period: "this year", detail: "14 Jul – 20 Jul").text == "14 Jul – 20 Jul")
    }

    @Test("a filter with no resolved subject falls back to the period alone")
    func missingDetail_fallsBackToThePeriod() {
        // A category filter before any category has loaded.
        #expect(LogSubtitle(period: "this week", detail: nil).text == "This week")
        #expect(LogSubtitle(period: "this week", detail: "").text == "This week")
    }

    @Test("only the opening letter is capitalized, so translated fragments are left alone")
    func casing_touchesOnlyTheFirstLetter() {
        #expect(LogSubtitle(period: "all time", detail: nil).text == "All time")
        #expect(LogSubtitle(period: "", detail: nil).text == "")
    }
}
