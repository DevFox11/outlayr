//
//  LogSubtitle.swift
//  Outlayr
//

import Foundation

/// Composes the one line of context under the "Log" navigation title.
///
/// The bar affords a single line. With no filter it names the insights period.
/// With a filter it names only what the filter is scoped to: the period menu
/// drives the hero, which a filter replaces, so naming the period would either
/// repeat an off-screen figure or — for filters that ignore the period, like
/// category or upcoming — describe the list wrongly.
struct LogSubtitle: Equatable {
    let text: String

    /// - Parameters:
    ///   - period: the insights period, already localized ("this month").
    ///   - detail: what the active filter is scoped to — a category name, a date
    ///     range, an entry type — or nil when no filter is active.
    init(period: String, detail: String?) {
        guard let detail, !detail.isEmpty else {
            text = LogSubtitle.sentenceCased(period)
            return
        }

        text = detail
    }

    /// Capitalizes the opening letter only. The period strings are written as
    /// mid-sentence fragments ("this month"), and title-casing every word of a
    /// translation is a guess this screen doesn't need to make.
    private static func sentenceCased(_ value: String) -> String {
        guard let first = value.first else { return value }
        return String(first).localizedUppercase + value.dropFirst()
    }
}
