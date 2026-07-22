//
//  CurrencyTotalsTests.swift
//  OutlayrTests
//
//  Pins the bucketing and dominance rules every Log total depends on: amounts
//  never cross currencies, and the currency a period leads with is decided the
//  same way everywhere.
//

import Testing
@testable import Outlayr

@Suite("CurrencyTotals")
struct CurrencyTotalsTests {

    private func totals(_ entries: [(String?, Double)], global: String = "USD") -> CurrencyTotals {
        CurrencyTotals(
            globalCurrency: global,
            entries: entries.map { CurrencyTotals.Entry(currency: $0.0, amount: $0.1) }
        )
    }

    // MARK: - Single currency behaves exactly like a bare sum

    @Test("a single-currency period sums into one bucket")
    func singleCurrency_sumsIntoOneBucket() {
        let result = totals([("USD", 10), ("USD", 20), ("USD", -5)])

        #expect(result.buckets.count == 1)
        #expect(result.dominant.currencyCode == "USD")
        #expect(abs(result.dominant.amount - 25) < 0.001)
        #expect(result.dominant.transactionCount == 3)
        #expect(result.isMultiCurrency == false)
        #expect(result.isEmpty == false)
    }

    @Test("nil currencies land in the global bucket alongside explicit ones")
    func nilCurrency_joinsGlobalBucket() {
        let result = totals([(nil, 10), ("GBP", 20), (nil, 5)], global: "GBP")

        #expect(result.buckets.count == 1)
        #expect(result.dominant.currencyCode == "GBP")
        #expect(abs(result.dominant.amount - 35) < 0.001)
        #expect(result.dominant.transactionCount == 3)
    }

    // MARK: - Mixed currencies

    @Test("mixed currencies stay in separate buckets and are never added")
    func mixedCurrencies_neverAdded() {
        let result = totals([("USD", 10), ("EUR", 100), ("USD", 15), ("JPY", 900)])

        #expect(abs(result.amount(in: "USD") - 25) < 0.001)
        #expect(abs(result.amount(in: "EUR") - 100) < 0.001)
        #expect(abs(result.amount(in: "JPY") - 900) < 0.001)
        #expect(result.isMultiCurrency)
        #expect(result.buckets.count == 3)
    }

    @Test("a currency the period never used reports zero, not a bucket")
    func absentCurrency_reportsZero() {
        let result = totals([("USD", 10)])

        #expect(result.amount(in: "EUR") == 0)
        #expect(result.bucket(for: "EUR") == nil)
    }

    @Test("bucket signs are independent of each other")
    func bucketSigns_areIndependent() {
        let result = totals([("USD", 60), ("EUR", -25)])

        #expect(result.bucket(for: "USD")?.isPositive == true)
        #expect(result.bucket(for: "EUR")?.isPositive == false)
        #expect(result.bucket(for: "EUR")?.magnitude == 25)
    }

    // MARK: - Dominance

    @Test("dominance follows transaction count, not amount")
    func dominance_countsRowsNotMoney() {
        let result = totals([("USD", 1), ("USD", 1), ("EUR", 10_000)])

        #expect(result.dominant.currencyCode == "USD")
        #expect(result.others.map(\.currencyCode) == ["EUR"])
    }

    @Test("a tie goes to the user's global currency")
    func dominance_tieFavorsGlobalCurrency() {
        let result = totals([("EUR", 10), ("USD", 10)], global: "USD")

        #expect(result.dominant.currencyCode == "USD")
        #expect(result.others.map(\.currencyCode) == ["EUR"])
    }

    @Test("a tie without the global currency falls back to alphabetical order")
    func dominance_tieWithoutGlobalIsAlphabetical() {
        let result = totals([("JPY", 10), ("EUR", 10), ("GBP", 10)], global: "USD")

        #expect(result.buckets.map(\.currencyCode) == ["EUR", "GBP", "JPY"])
    }

    @Test("dominance order is stable across equivalent inputs in any order")
    func dominance_isOrderIndependent() {
        let forward = totals([("EUR", 1), ("EUR", 1), ("GBP", 1), ("USD", 1)], global: "USD")
        let reverse = totals([("USD", 1), ("GBP", 1), ("EUR", 1), ("EUR", 1)], global: "USD")

        #expect(forward == reverse)
        #expect(forward.buckets.map(\.currencyCode) == ["EUR", "USD", "GBP"])
    }

    // MARK: - Empty period

    @Test("an empty period yields one zero bucket in the global currency")
    func emptyPeriod_yieldsZeroGlobalBucket() {
        let result = totals([], global: "CHF")

        #expect(result.isEmpty)
        #expect(result.isMultiCurrency == false)
        #expect(result.dominant.currencyCode == "CHF")
        #expect(result.dominant.amount == 0)
        #expect(result.dominant.transactionCount == 0)
        #expect(result.buckets.count == 1)
    }

    @Test("a period whose amounts cancel out is not empty")
    func cancellingAmounts_areNotEmpty() {
        let result = totals([("USD", 10), ("USD", -10)])

        #expect(result.isEmpty == false)
        #expect(result.dominant.amount == 0)
        #expect(result.dominant.transactionCount == 2)
    }
}
