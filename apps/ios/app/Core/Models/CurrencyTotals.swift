//
//  CurrencyTotals.swift
//  Outlayr
//

import Foundation

/// Money bucketed by ISO 4217 code. Outlayr scopes rather than converts — there
/// are no exchange rates and no network — so a bucket's amount is only ever
/// meaningful rendered in its own currency and must never be summed with
/// another bucket's.
struct CurrencyTotals: Equatable {
    /// One row's contribution. A nil currency means "whatever the global
    /// preference is at display time", matching how a single row resolves it.
    struct Entry: Equatable {
        let currency: String?
        let amount: Double
    }

    struct Bucket: Equatable, Identifiable {
        let currencyCode: String
        let amount: Double
        let transactionCount: Int

        var id: String { currencyCode }
        var isPositive: Bool { amount >= 0 }
        /// Unsigned amount, for UI that renders the sign itself.
        var magnitude: Double { abs(amount) }
    }

    /// The bucket a single-figure header should lead with. Never absent: a period
    /// with no transactions yields a zero bucket in the global currency.
    let dominant: Bucket

    /// Every other currency the period used, in the same dominance order.
    let others: [Bucket]

    init(globalCurrency: String, entries: [Entry]) {
        var amounts = [String: Double]()
        var counts = [String: Int]()

        for entry in entries {
            let code = entry.currency ?? globalCurrency
            amounts[code, default: 0] += entry.amount
            counts[code, default: 0] += 1
        }

        let ordered = CurrencyTotals.dominanceOrder(counts: counts, globalCurrency: globalCurrency).map {
            Bucket(currencyCode: $0, amount: amounts[$0] ?? 0, transactionCount: counts[$0] ?? 0)
        }

        dominant = ordered.first ?? Bucket(currencyCode: globalCurrency, amount: 0, transactionCount: 0)
        others = Array(ordered.dropFirst())
    }

    /// Dominant first, then the rest — the order a multi-currency breakdown reads in.
    var buckets: [Bucket] { [dominant] + others }

    var isMultiCurrency: Bool { !others.isEmpty }

    var isEmpty: Bool { others.isEmpty && dominant.transactionCount == 0 }

    func bucket(for currencyCode: String) -> Bucket? {
        buckets.first { $0.currencyCode == currencyCode }
    }

    /// Zero for a currency the period never used: to a total, an absent bucket
    /// and an exactly-cancelling one mean the same thing.
    func amount(in currencyCode: String) -> Double {
        bucket(for: currencyCode)?.amount ?? 0
    }

    /// Ranks the currencies a period used: most transactions first, the user's
    /// global currency ahead of a tie, then alphabetically — so the order never
    /// depends on dictionary iteration.
    static func dominanceOrder(counts: [String: Int], globalCurrency: String) -> [String] {
        counts.keys.sorted { lhs, rhs in
            let lhsCount = counts[lhs] ?? 0
            let rhsCount = counts[rhs] ?? 0

            if lhsCount != rhsCount {
                return lhsCount > rhsCount
            }

            if (lhs == globalCurrency) != (rhs == globalCurrency) {
                return lhs == globalCurrency
            }

            return lhs < rhs
        }
    }
}
