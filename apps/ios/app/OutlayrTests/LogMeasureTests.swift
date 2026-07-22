//
//  LogMeasureTests.swift
//  OutlayrTests
//
//  Pins which figure the Log hero promotes and which two it hands to the cells
//  underneath. The stored raw values are the ones already written to
//  `logInsightsType`, so an existing install must keep its selection.
//

import Testing

@testable import Outlayr

@Suite("LogMeasure")
struct LogMeasureTests {

    private func figures(
        currency: String = "USD",
        income: Double,
        spent: Double,
        count: Int = 2
    ) -> TransactionRepository.LogViewInsights.Figures {
        TransactionRepository.LogViewInsights.Figures(
            currencyCode: currency,
            totalIncome: income,
            totalSpent: spent,
            transactionCount: count
        )
    }

    // MARK: - Stored selection

    @Test("the stored preference values keep meaning what they always meant")
    func storedValues_mapToTheSameMeasures() {
        #expect(LogMeasure(storedValue: 1) == .net)
        #expect(LogMeasure(storedValue: 2) == .earned)
        #expect(LogMeasure(storedValue: 3) == .spent)
    }

    @Test("an unknown stored value falls back to net rather than to nothing")
    func unknownStoredValue_fallsBackToNet() {
        #expect(LogMeasure(storedValue: 0) == .net)
        #expect(LogMeasure(storedValue: 99) == .net)
    }

    // MARK: - What the cells show

    @Test("the cells always show the two measures the hero is not showing")
    func alternatives_areTheOtherTwo() {
        #expect(LogMeasure.net.alternatives == [.earned, .spent])
        #expect(LogMeasure.earned.alternatives == [.net, .spent])
        #expect(LogMeasure.spent.alternatives == [.net, .earned])
    }

    @Test("promoting a cell never leaves a measure off the screen")
    func everyPromotion_keepsAllThreeReachable() {
        for measure in LogMeasure.allCases {
            let onScreen = Set([measure] + measure.alternatives)
            #expect(onScreen == Set(LogMeasure.allCases))
        }
    }

    @Test("the alternatives keep declaration order, so the cells never reshuffle")
    func alternatives_keepDeclarationOrder() {
        for measure in LogMeasure.allCases {
            let expected = LogMeasure.allCases.filter { $0 != measure }
            #expect(measure.alternatives == expected)
        }
    }

    // MARK: - Figures

    @Test("each measure reads its own figure out of one currency's bucket")
    func magnitude_readsTheMatchingFigure() {
        let bucket = figures(income: 3200, spent: 4484.50)

        #expect(abs(LogMeasure.earned.magnitude(in: bucket) - 3200) < 0.001)
        #expect(abs(LogMeasure.spent.magnitude(in: bucket) - 4484.50) < 0.001)
        #expect(abs(LogMeasure.net.magnitude(in: bucket) - 1284.50) < 0.001)
    }

    @Test("magnitudes are unsigned so the view owns the sign")
    func magnitude_isAlwaysUnsigned() {
        let overspent = figures(income: 100, spent: 400)
        let underspent = figures(income: 400, spent: 100)

        #expect(LogMeasure.net.magnitude(in: overspent) > 0)
        #expect(LogMeasure.net.magnitude(in: underspent) > 0)
    }

    @Test("income always reads positive, spending always reads negative")
    func sign_followsTheDirectionOfTheMoney() {
        let bucket = figures(income: 3200, spent: 4484.50)

        #expect(LogMeasure.earned.isPositive(in: bucket))
        #expect(LogMeasure.spent.isPositive(in: bucket) == false)
    }

    @Test("net takes its sign from the period, not from the measure")
    func netSign_followsThePeriod() {
        #expect(LogMeasure.net.isPositive(in: figures(income: 400, spent: 100)))
        #expect(LogMeasure.net.isPositive(in: figures(income: 100, spent: 400)) == false)
        // Exactly cancelling is not a loss.
        #expect(LogMeasure.net.isPositive(in: figures(income: 100, spent: 100)))
    }

    @Test("only money coming in earns the income color")
    func incomeColor_isReservedForIncome() {
        #expect(LogMeasure.earned.isIncome)
        #expect(LogMeasure.net.isIncome == false)
        #expect(LogMeasure.spent.isIncome == false)
    }

    // MARK: - Sparkline direction

    @Test("a net line is only green when the period ended above where it started")
    func netTrend_comparesEndpoints() {
        #expect(LogMeasure.net.isTrendPositive(firstPoint: 0, lastPoint: 10))
        #expect(LogMeasure.net.isTrendPositive(firstPoint: 10, lastPoint: 0) == false)
        #expect(LogMeasure.net.isTrendPositive(firstPoint: 5, lastPoint: 5) == false)
    }

    @Test("income and spending lines ignore the endpoints entirely")
    func fixedTrends_ignoreEndpoints() {
        #expect(LogMeasure.earned.isTrendPositive(firstPoint: 100, lastPoint: 0))
        #expect(LogMeasure.spent.isTrendPositive(firstPoint: 0, lastPoint: 100) == false)
    }
}
