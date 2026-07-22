//
//  LogMeasure.swift
//  Outlayr
//

import Foundation

/// The three figures the Log hero can lead with. Raw values match the
/// `logInsightsType` preference the app has always written, so an existing
/// install keeps showing whatever it was showing.
enum LogMeasure: Int, CaseIterable, Identifiable, Sendable {
    case net = 1
    case earned = 2
    case spent = 3

    init(storedValue: Int) {
        self = LogMeasure(rawValue: storedValue) ?? .net
    }

    var id: Int { rawValue }

    /// One short word, so all three fit across the narrowest phone at the
    /// largest accessibility size.
    var titleKey: String {
        switch self {
        case .net: "Net"
        case .earned: "In"
        case .spent: "Out"
        }
    }

    /// The two measures the hero is not showing, always in declaration order so
    /// the cells under the hero never reshuffle as the promotion changes.
    var alternatives: [LogMeasure] {
        LogMeasure.allCases.filter { $0 != self }
    }

    /// Unsigned — the sign comes from `isPositive(in:)` so a spend of 40 and an
    /// income of 40 render as the same digits with opposite signs.
    func magnitude(in figures: TransactionRepository.LogViewInsights.Figures) -> Double {
        switch self {
        case .net: figures.netMagnitude
        case .earned: figures.totalIncome
        case .spent: figures.totalSpent
        }
    }

    func isPositive(in figures: TransactionRepository.LogViewInsights.Figures) -> Bool {
        switch self {
        case .net: figures.isNetPositive
        case .earned: true
        case .spent: false
        }
    }

    /// Whether the figure earns the income color. Only money actually coming in
    /// does; a positive net is still just a net.
    var isIncome: Bool { self == .earned }

    /// The direction the sparkline should read as good. A net line is only
    /// green when the period ended above where it started.
    func isTrendPositive(firstPoint: Double, lastPoint: Double) -> Bool {
        switch self {
        case .net: firstPoint < lastPoint
        case .earned: true
        case .spent: false
        }
    }
}
