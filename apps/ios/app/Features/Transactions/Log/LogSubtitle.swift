//
//  LogSubtitle.swift
//  Outlayr
//

import Foundation

/// Composes the one line of context under the "Log" navigation title.
///
/// The bar affords a single line, so a filter that already names a stretch of
/// time replaces the insights period instead of contradicting it — "20 Jul
/// 2026 · this month" claims two different windows at once.
struct LogSubtitle: Equatable {
    let text: String

    /// - Parameters:
    ///   - filter: the active list filter.
    ///   - period: the insights period, already localized ("this month").
    ///   - detail: what the filter is scoped to — a category name, a date
    ///     range, an entry type — or nil when the filter names no subject.
    init(filter: FilterType, period: String, detail: String?) {
        let period = LogSubtitle.sentenceCased(period)

        guard let detail, !detail.isEmpty else {
            text = period
            return
        }

        text = filter.namesItsOwnPeriod ? detail : "\(detail) · \(period)"
    }

    /// Capitalizes the opening letter only. The period strings are written as
    /// mid-sentence fragments ("this month"), and title-casing every word of a
    /// translation is a guess this screen doesn't need to make.
    private static func sentenceCased(_ value: String) -> String {
        guard let first = value.first else { return value }
        return String(first).localizedUppercase + value.dropFirst()
    }
}

extension FilterType {
    /// True when picking the filter also picks the window of time it covers.
    var namesItsOwnPeriod: Bool {
        switch self {
        case .day, .week, .month: true
        case .all, .type, .category, .recurring, .upcoming: false
        }
    }
}
