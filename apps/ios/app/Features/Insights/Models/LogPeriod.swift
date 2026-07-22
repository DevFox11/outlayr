//
//  LogPeriod.swift
//  Outlayr
//

import Foundation

/// The window the Log hero measures. Raw values match the
/// `logInsightsTimeFrame` preference the app has always written, and the title
/// keys are the strings already carried in the localization catalog.
enum LogPeriod: Int, CaseIterable, Identifiable, Sendable {
    case day = 1
    case week = 2
    case month = 3
    case year = 4
    case allTime = 5

    init(storedValue: Int) {
        self = LogPeriod(rawValue: storedValue) ?? .month
    }

    var id: Int { rawValue }

    var titleKey: String {
        switch self {
        case .day: "today"
        case .week: "this week"
        case .month: "this month"
        case .year: "this year"
        case .allTime: "all time"
        }
    }
}
