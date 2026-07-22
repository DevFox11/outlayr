//
//  LogPeriodCursor.swift
//  Outlayr
//

import Foundation

/// Where a day, week or month filter is currently pointed.
///
/// The Log fetches a day on an exact `Transaction.day` value and a week or
/// month on its first instant, so a cursor that isn't normalized to the start
/// of the unit it names quietly returns nothing at all.
struct LogPeriodCursor: Equatable {
    enum Unit: Equatable {
        case day
        case week
        case month

        var component: Calendar.Component {
            switch self {
            case .day: .day
            case .week: .weekOfYear
            case .month: .month
            }
        }

        var dateFormat: String {
            switch self {
            case .day: "d MMM yyyy"
            case .week: "d MMM"
            case .month: "MMM yyyy"
            }
        }
    }

    let unit: Unit
    let date: Date

    init(unit: Unit, containing date: Date, calendar: Calendar) {
        self.unit = unit
        self.date = LogPeriodCursor.start(of: unit, containing: date, calendar: calendar)
    }

    func stepped(by count: Int, calendar: Calendar) -> LogPeriodCursor {
        let moved = calendar.date(byAdding: unit.component, value: count, to: date) ?? date
        return LogPeriodCursor(unit: unit, containing: moved, calendar: calendar)
    }

    /// False once the next step would land in the future — nothing is logged
    /// there, so the step would only ever produce an empty screen.
    func canStepForward(now: Date, calendar: Calendar) -> Bool {
        stepped(by: 1, calendar: calendar).date <= now
    }

    func label(calendar: Calendar, locale: Locale) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = locale
        formatter.dateFormat = unit.dateFormat

        guard unit == .week else {
            return formatter.string(from: date)
        }

        let end = calendar.date(byAdding: .day, value: 6, to: date) ?? date
        return formatter.string(from: date) + " – " + formatter.string(from: end)
    }

    private static func start(of unit: Unit, containing date: Date, calendar: Calendar) -> Date {
        switch unit {
        case .day:
            calendar.startOfDay(for: date)
        case .week:
            calendar.date(from: calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: date)) ?? date
        case .month:
            calendar.date(from: calendar.dateComponents([.month, .year], from: date)) ?? date
        }
    }

    /// The calendar the Log's week and month boundaries are cut on. It has to
    /// match the one the filtered fetch requests build, or the chip and the
    /// list disagree about which week it is.
    static var appCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = AppIdentifiers.defaults.integer(forKey: DefaultsKey.firstWeekday)
        calendar.minimumDaysInFirstWeek = 4
        return calendar
    }
}

extension FilterType {
    /// The unit a period filter steps in, or nil for the filters that don't
    /// name a stretch of time.
    var periodUnit: LogPeriodCursor.Unit? {
        switch self {
        case .day: .day
        case .week: .week
        case .month: .month
        case .all, .type, .category, .recurring, .upcoming: nil
        }
    }
}
