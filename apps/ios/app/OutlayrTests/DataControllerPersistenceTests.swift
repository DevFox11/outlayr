//
//  DataControllerPersistenceTests.swift
//  OutlayrTests
//
//  Characterizes DataController persistence/CRUD against an in-memory store.
//

import CoreData
import XCTest

@testable import Outlayr

final class DataControllerPersistenceTests: CharacterizationTestCase {
    func testInMemoryStoreReportsLoadedState() throws {
        // The C2b fail-loud guard must never misfire on a healthy store: the
        // in-memory path (and, by construction, the resolved app-group path) reports
        // `.loaded`. The unreachable nil-container path is verified on-device (C3.5).
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        XCTAssertEqual(controller.storeState, .loaded)
    }

    func testStoreStateForNilContainerReportsAppGroupUnavailable() {
        // Locks the fail-loud decision directly: a nil app-group container URL (a
        // broken App Groups entitlement / provisioning profile) must refuse the
        // silent per-process fallback store. Pure, so it needs no FileManager or
        // fatal build to exercise the branch the runtime guard can't reach on-sim.
        XCTAssertEqual(DataController.storeState(for: nil), .appGroupUnavailable)
    }

    func testStoreStateForResolvedContainerReportsLoaded() {
        // The complement: any resolved container URL keeps the store `.loaded`, so
        // the guard never misfires on a healthy app group.
        XCTAssertEqual(DataController.storeState(for: URL(fileURLWithPath: "/tmp/x")), .loaded)
    }

    func testNewTransactionPersistsWithDerivedDayAndMonth() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Food", income: false, order: 1)
        let txDate = date(2024, 3, 9, 14, 30)

        let transaction = controller.transactions.newTransaction(
            note: "Lunch",
            category: category,
            income: false,
            amount: 12.5,
            date: txDate,
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        XCTAssertEqual(transaction.note, "Lunch")
        XCTAssertEqual(transaction.amount, 12.5, accuracy: 0.0001)
        XCTAssertEqual(transaction.category, category)
        XCTAssertFalse(transaction.income)

        // day is start-of-day of the transaction date; month is first-of-month.
        XCTAssertEqual(transaction.day, date(2024, 3, 9, 0, 0))
        XCTAssertEqual(transaction.month, date(2024, 3, 1, 0, 0))
        XCTAssertNotNil(transaction.id)

        let stored = controller.results(for: controller.transactions.fetchRequestForExport())
        XCTAssertEqual(stored.count, 1)
        XCTAssertEqual(stored.first, transaction)
    }

    func testEmptyNoteFallsBackToCategoryName() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Transport", order: 1)

        let transaction = controller.transactions.newTransaction(
            note: "   ",
            category: category,
            income: false,
            amount: 3,
            date: date(2024, 3, 9),
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        XCTAssertEqual(transaction.note, "Transport")
    }

    func testFetchRequestForExportSortsByDateDescending() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)

        makeTransaction(in: context, amount: 1, date: date(2024, 1, 1), category: category)
        makeTransaction(in: context, amount: 2, date: date(2024, 3, 1), category: category)
        makeTransaction(in: context, amount: 3, date: date(2024, 2, 1), category: category)
        try? controller.save()

        let stored = controller.results(for: controller.transactions.fetchRequestForExport())
        let dates = stored.compactMap { $0.date }
        XCTAssertEqual(dates, [date(2024, 3, 1), date(2024, 2, 1), date(2024, 1, 1)])
    }

    func testDeleteAllClearsEveryEntity() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)
        makeTransaction(in: context, amount: 10, date: date(2024, 2, 1), category: category)
        makeBudget(in: context, amount: 100, startDate: date(2024, 2, 1), type: 3, category: category)
        makeMainBudget(in: context, amount: 500, startDate: date(2024, 2, 1), type: 3)
        try? controller.save()

        try? controller.deleteAll()

        XCTAssertTrue(controller.results(for: Transaction.fetchRequest()).isEmpty)
        XCTAssertTrue(controller.results(for: Outlayr.Category.fetchRequest()).isEmpty)
        XCTAssertTrue(controller.results(for: Budget.fetchRequest()).isEmpty)
        XCTAssertTrue(controller.results(for: MainBudget.fetchRequest()).isEmpty)
    }

    // MARK: - Async overload parity

    /// In an async test the compiler resolves repository calls to the async
    /// overloads, so the sync baselines must be forced through a synchronous
    /// closure. The async tests are @MainActor so these run on the view
    /// context's thread.
    private func syncBaseline<T>(_ body: () -> T) -> T {
        body()
    }

    /// Seeds a small mixed ledger on the view context and saves, so objectIDs are
    /// permanent and background contexts can rematerialize them.
    private func seedLedger(on controller: DataController) -> Outlayr.Category {
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)
        makeTransaction(in: context, amount: 12.5, date: date(2024, 6, 10), category: category)
        makeTransaction(in: context, amount: 7.25, date: date(2024, 6, 12), category: category)
        makeTransaction(in: context, amount: 40, date: date(2024, 6, 14), income: true, category: category)
        makeTransaction(in: context, amount: 3, date: date(2024, 5, 20), category: category)
        try? controller.save()
        return category
    }

    @MainActor
    func testAsyncGetLogViewTotalSpentMatchesSync() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        _ = seedLedger(on: controller)

        let sync = syncBaseline { controller.transactions.getLogViewTotalSpent(type: 5) }
        let background = await controller.transactions.getLogViewTotalSpent(type: 5)

        XCTAssertEqual(sync, 22.75, accuracy: 0.0001)
        XCTAssertEqual(background, sync, accuracy: 0.0001)
    }

    @MainActor
    func testAsyncGetLogViewTotalIncomeMatchesSync() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        _ = seedLedger(on: controller)

        let sync = syncBaseline { controller.transactions.getLogViewTotalIncome(type: 5) }
        let background = await controller.transactions.getLogViewTotalIncome(type: 5)

        XCTAssertEqual(sync, 40, accuracy: 0.0001)
        XCTAssertEqual(background, sync, accuracy: 0.0001)
    }

    @MainActor
    func testAsyncGetLogViewTotalNetMatchesSync() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        _ = seedLedger(on: controller)

        let sync = syncBaseline { controller.transactions.getLogViewTotalNet(type: 5) }
        let background = await controller.transactions.getLogViewTotalNet(type: 5)

        XCTAssertEqual(background.value, sync.value, accuracy: 0.0001)
        XCTAssertEqual(background.positive, sync.positive)
    }

    @MainActor
    func testAsyncGetLineGraphDataNetMatchesSync() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        _ = seedLedger(on: controller)

        let sync = syncBaseline { controller.transactions.getLineGraphDataNet(type: 2) }
        let background = await controller.transactions.getLineGraphDataNet(type: 2)

        XCTAssertFalse(sync.isEmpty)
        XCTAssertEqual(background, sync)
    }

    @MainActor
    func testAsyncGetInsightsSummaryMatchesSync() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        _ = seedLedger(on: controller)

        let sync = syncBaseline { controller.transactions.getInsightsSummary(type: 2, date: date(2024, 6, 1)) }
        let background = await controller.transactions.getInsightsSummary(type: 2, date: date(2024, 6, 1))

        XCTAssertEqual(background.spent, sync.spent, accuracy: 0.0001)
        XCTAssertEqual(background.income, sync.income, accuracy: 0.0001)
        XCTAssertEqual(background.net, sync.net, accuracy: 0.0001)
        XCTAssertEqual(background.positive, sync.positive)
        XCTAssertEqual(background.average, sync.average, accuracy: 0.0001)
    }

    @MainActor
    func testAsyncGetShortcutInsightsMatchesSyncWithCategoryFilter() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let category = seedLedger(on: controller)

        let sync = syncBaseline { controller.transactions.getShortcutInsights(type: 3, timeframe: 5, optionalIncome: false, categories: [category]) }
        let background = try await controller.transactions.getShortcutInsights(type: 3, timeframe: 5, optionalIncome: false, categories: [category])

        XCTAssertEqual(sync, 22.75, accuracy: 0.0001)
        XCTAssertEqual(background, sync, accuracy: 0.0001)
    }

    @MainActor
    func testAsyncGetBudgetLeftoverMatchesSync() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = seedLedger(on: controller)
        let budget = makeBudget(in: context, amount: 100, startDate: date(2024, 6, 1), type: 3, category: category)
        let mainBudget = makeMainBudget(in: context, amount: 500, startDate: date(2024, 6, 1), type: 3)
        try? controller.save()

        let syncBudget = syncBaseline { controller.budgets.getBudgetLeftover(budget: budget) }
        let backgroundBudget = try await controller.budgets.getBudgetLeftover(budget: budget)
        XCTAssertEqual(backgroundBudget, syncBudget, accuracy: 0.0001)

        let syncOverall = syncBaseline { controller.budgets.getBudgetLeftover(overallBudget: mainBudget) }
        let backgroundOverall = try await controller.budgets.getBudgetLeftover(overallBudget: mainBudget)
        XCTAssertEqual(backgroundOverall, syncOverall, accuracy: 0.0001)
    }

    @MainActor
    func testAsyncGetBudgetLeftoverThrowsWhenBudgetCannotBeRematerialized() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)
        // Never saved, so the objectID stays temporary and the background context
        // cannot rematerialize it.
        let budget = makeBudget(in: context, amount: 100, startDate: date(2024, 6, 1), type: 3, category: category)

        do {
            _ = try await controller.budgets.getBudgetLeftover(budget: budget)
            XCTFail("Expected CustomError.notFound for an unmaterializable budget")
        } catch {
            guard case CustomError.notFound = error else {
                return XCTFail("Expected CustomError.notFound, got \(error)")
            }
        }
    }

    @MainActor
    func testAsyncGetShortcutInsightsThrowsWhenCategoryCannotBeRematerialized() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        // Never saved, so the objectID stays temporary and the background context
        // cannot rematerialize it.
        let category = makeCategory(in: context, name: "Food", order: 1)

        do {
            _ = try await controller.transactions.getShortcutInsights(type: 3, timeframe: 5, optionalIncome: false, categories: [category])
            XCTFail("Expected CustomError.notFound for an unmaterializable category filter")
        } catch {
            guard case CustomError.notFound = error else {
                return XCTFail("Expected CustomError.notFound, got \(error)")
            }
        }
    }

    @MainActor
    func testGetLogViewInsightsMatchesIndividualSyncMethods() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        _ = seedLedger(on: controller)

        let net = await controller.transactions.getLogViewInsights(type: 2, insightsType: 1)
        let expense = await controller.transactions.getLogViewInsights(type: 2, insightsType: 3)

        let syncNet = syncBaseline { controller.transactions.getLogViewTotalNet(type: 2) }
        XCTAssertEqual(net.netTotal, syncNet.value, accuracy: 0.0001)
        XCTAssertEqual(net.isNetPositive, syncNet.positive)
        XCTAssertEqual(net.totalSpent, syncBaseline { controller.transactions.getLogViewTotalSpent(type: 2) }, accuracy: 0.0001)
        XCTAssertEqual(net.totalIncome, syncBaseline { controller.transactions.getLogViewTotalIncome(type: 2) }, accuracy: 0.0001)
        XCTAssertEqual(net.lineGraphData, syncBaseline { controller.transactions.getLineGraphDataNet(type: 2) })
        XCTAssertEqual(expense.lineGraphData, syncBaseline { controller.transactions.getLineGraphData(income: false, type: 2) })
    }

    @MainActor
    func testGetGraphViewInsightsMatchesIndividualSyncMethods() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let category = seedLedger(on: controller)

        // The shared ledger has no rows in the prior week (Jun 3-9) or the prior
        // year, so without these the -7d/-1y prior windows would pass as zero
        // under a wrong prior-date derivation too.
        let context = controller.container.viewContext
        makeTransaction(in: context, amount: 5.5, date: date(2024, 6, 5), category: category)
        makeTransaction(in: context, amount: 9, date: date(2023, 3, 10), category: category)
        try? controller.save()

        let payload = await controller.transactions.getGraphViewInsights(type: 2, date: date(2024, 6, 1), income: false)

        let syncSummary = syncBaseline { controller.transactions.getInsightsSummary(type: 2, date: date(2024, 6, 1)) }
        XCTAssertEqual(payload.summary.spent, syncSummary.spent, accuracy: 0.0001)
        XCTAssertEqual(payload.summary.income, syncSummary.income, accuracy: 0.0001)
        XCTAssertEqual(payload.summary.net, syncSummary.net, accuracy: 0.0001)
        XCTAssertEqual(payload.summary.positive, syncSummary.positive)
        XCTAssertEqual(payload.summary.average, syncSummary.average, accuracy: 0.0001)

        let syncPrior = syncBaseline { controller.transactions.getInsightsSummary(type: 2, date: date(2024, 5, 1)) }
        XCTAssertEqual(payload.priorSummary.spent, syncPrior.spent, accuracy: 0.0001)
        XCTAssertEqual(payload.priorSummary.net, syncPrior.net, accuracy: 0.0001)
        XCTAssertEqual(payload.priorSummary.positive, syncPrior.positive)

        let syncBreakdown = syncBaseline { controller.transactions.getInsights(type: 2, date: date(2024, 6, 1), income: false) }
        XCTAssertEqual(payload.breakdown.amount, syncBreakdown.amount, accuracy: 0.0001)
        XCTAssertEqual(payload.breakdown.maximum, syncBreakdown.maximum, accuracy: 0.0001)
        XCTAssertEqual(payload.breakdown.average, syncBreakdown.average, accuracy: 0.0001)
        XCTAssertEqual(payload.breakdown.numberOfDays, syncBreakdown.numberOfDays)
        XCTAssertEqual(payload.breakdown.dates, syncBreakdown.dates)
        XCTAssertEqual(payload.breakdown.dateDictionary, syncBreakdown.dateDictionary)

        // The week type derives its prior period seven days back, not one month.
        // The Jun 5 seed makes that observable: the -1 month window (May 10-16)
        // is empty, so a wrong prior date would report zero here.
        let weekPayload = await controller.transactions.getGraphViewInsights(type: 1, date: date(2024, 6, 10), income: false)
        let syncWeekPrior = syncBaseline { controller.transactions.getInsightsSummary(type: 1, date: date(2024, 6, 3)) }
        XCTAssertEqual(syncWeekPrior.spent, 5.5, accuracy: 0.0001)
        XCTAssertEqual(weekPayload.priorSummary.spent, syncWeekPrior.spent, accuracy: 0.0001)
        XCTAssertEqual(weekPayload.priorSummary.net, syncWeekPrior.net, accuracy: 0.0001)
        XCTAssertEqual(weekPayload.priorSummary.positive, syncWeekPrior.positive)

        // The year type derives its prior period one year back; the 2023 seed
        // pins that window as non-empty.
        let yearPayload = await controller.transactions.getGraphViewInsights(type: 3, date: date(2024, 1, 1), income: false)
        let syncYearPrior = syncBaseline { controller.transactions.getInsightsSummary(type: 3, date: date(2023, 1, 1)) }
        XCTAssertEqual(syncYearPrior.spent, 9, accuracy: 0.0001)
        XCTAssertEqual(yearPayload.priorSummary.spent, syncYearPrior.spent, accuracy: 0.0001)
        XCTAssertEqual(yearPayload.priorSummary.net, syncYearPrior.net, accuracy: 0.0001)
        XCTAssertEqual(yearPayload.priorSummary.positive, syncYearPrior.positive)
    }

    @MainActor
    func testGetMainBudgetWidgetSnapshotMatchesSync() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        _ = seedLedger(on: controller)
        makeMainBudget(in: context, amount: 500, startDate: date(2024, 6, 1), type: 3)
        try? controller.save()

        let sync = syncBaseline { controller.budgets.fetchRequestForMainBudgetWidget() }
        let background = await controller.budgets.getMainBudgetWidgetSnapshot()

        XCTAssertTrue(sync.found)
        XCTAssertEqual(background.found, sync.found)
        XCTAssertEqual(background.totalSpent, sync.totalSpent, accuracy: 0.0001)
        XCTAssertEqual(background.budgetAmount, sync.budgetAmount, accuracy: 0.0001)
        XCTAssertEqual(background.percentage, sync.percentage, accuracy: 0.0001)
        XCTAssertEqual(background.type, sync.type)
        XCTAssertEqual(background.startDate, sync.startDate)
    }

    @MainActor
    func testPerformBackgroundRunsOffMainThread() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())

        let ranOnMainThread = await controller.performBackground { _ in Thread.isMainThread }

        XCTAssertFalse(ranOnMainThread)
    }

    // MARK: - Widget payloads (background-context reads for extension processes)

    @MainActor
    func testAsyncGetWidgetInsightsMatchesSyncAndRollsChildIntoParent() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = makeCategory(in: context, name: "Food", order: 1)
        let child = makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        makeCategory(in: context, name: "Rent", order: 3)
        makeTransaction(in: context, amount: 12.5, date: date(2024, 6, 10), category: child)
        makeTransaction(in: context, amount: 7.25, date: date(2024, 6, 12), category: parent)
        makeTransaction(in: context, amount: 40, date: date(2024, 6, 11), income: true, category: parent)
        makeTransaction(in: context, amount: 3, date: date(2024, 5, 20), category: parent)
        try? controller.save()

        let sync = syncBaseline { controller.transactions.getWidgetInsights(type: .week, income: false) }
        let insights = await controller.transactions.getWidgetInsights(type: .week, income: false)

        // Frozen now is Sat 2024-06-15 12:00; with firstWeekday=1 the week starts
        // Sun 2024-06-09, so the May transaction and the income row are excluded.
        XCTAssertEqual(insights.amount, 19.75, accuracy: 0.0001)
        XCTAssertEqual(insights.maximum, 12.5, accuracy: 0.0001)
        XCTAssertEqual(insights.numberOfDays, 2)
        XCTAssertEqual(insights.dates.count, 7)
        XCTAssertEqual(insights.dates.first, date(2024, 6, 9))
        XCTAssertEqual(insights.dateDictionary[date(2024, 6, 10)] ?? 0, 12.5, accuracy: 0.0001)
        XCTAssertEqual(insights.average, 19.75 / 7, accuracy: 0.0001)

        // The child category's spending rolls up into its top-level parent, and
        // zero-total categories (Rent) are omitted.
        XCTAssertEqual(insights.categories.count, 1)
        XCTAssertEqual(insights.categories.first?.name, "Food")
        XCTAssertEqual(insights.categories.first?.color, "#000000")
        XCTAssertEqual(insights.categories.first?.percent ?? 0, 1.0, accuracy: 0.0001)

        XCTAssertEqual(insights, sync)
    }

    @MainActor
    func testAsyncGetWidgetInsightsMonthMatchesSyncAndRollsChildIntoParent() async throws {
        // The month window starts at getStartOfMonth, which reads the real clock
        // (Date.now) rather than the injected one, so this test freezes the
        // controller clock at the real now and seeds rows relative to the real
        // month start.
        let now = Date.now
        let controller = makeController(now: now, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = makeCategory(in: context, name: "Food", order: 1)
        let child = makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        makeCategory(in: context, name: "Rent", order: 3)

        let monthStart = getStartOfMonth(startDay: 1)
        makeTransaction(in: context, amount: 12.5, date: monthStart, category: child)
        makeTransaction(in: context, amount: 7.25, date: monthStart, category: parent)
        makeTransaction(in: context, amount: 40, date: monthStart, income: true, category: parent)
        makeTransaction(in: context, amount: 3, date: monthStart.addingTimeInterval(-3600), category: parent)
        try? controller.save()

        let sync = syncBaseline { controller.transactions.getWidgetInsights(type: .month, income: false) }
        let insights = await controller.transactions.getWidgetInsights(type: .month, income: false)

        // The pre-month-start transaction and the income row are excluded; both
        // in-month rows land in the first day bucket.
        let daysInMonth = Calendar(identifier: .gregorian).range(of: .day, in: .month, for: monthStart)!.count
        let daysPast = Calendar.current.dateComponents([.day], from: monthStart, to: now).day!
        XCTAssertEqual(insights.amount, 19.75, accuracy: 0.0001)
        XCTAssertEqual(insights.maximum, 19.75, accuracy: 0.0001)
        XCTAssertEqual(insights.numberOfDays, 1)
        XCTAssertEqual(insights.dates.count, daysInMonth)
        XCTAssertEqual(insights.dates.first, monthStart)
        XCTAssertEqual(insights.dateDictionary[monthStart] ?? 0, 19.75, accuracy: 0.0001)
        XCTAssertEqual(insights.average, 19.75 / Double(daysPast + 1), accuracy: 0.0001)

        // The child category's spending rolls up into its top-level parent, and
        // zero-total categories (Rent) are omitted.
        XCTAssertEqual(insights.categories.count, 1)
        XCTAssertEqual(insights.categories.first?.name, "Food")
        XCTAssertEqual(insights.categories.first?.percent ?? 0, 1.0, accuracy: 0.0001)

        XCTAssertEqual(insights, sync)
    }

    @MainActor
    func testAsyncGetWidgetInsightsYearMatchesSyncAndRollsChildIntoParent() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = makeCategory(in: context, name: "Food", order: 1)
        let child = makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        makeCategory(in: context, name: "Rent", order: 3)
        makeTransaction(in: context, amount: 12.5, date: date(2024, 6, 10), category: child)
        makeTransaction(in: context, amount: 7.25, date: date(2024, 6, 12), category: parent)
        makeTransaction(in: context, amount: 40, date: date(2024, 6, 11), income: true, category: parent)
        makeTransaction(in: context, amount: 3, date: date(2024, 5, 20), category: parent)
        try? controller.save()

        let sync = syncBaseline { controller.transactions.getWidgetInsights(type: .year, income: false) }
        let insights = await controller.transactions.getWidgetInsights(type: .year, income: false)

        // Frozen now is 2024-06-15, so the year window is 2024 bucketed by month:
        // the May row now counts, the income row stays excluded, and five full
        // months have elapsed (average divides by six).
        XCTAssertEqual(insights.amount, 22.75, accuracy: 0.0001)
        XCTAssertEqual(insights.maximum, 19.75, accuracy: 0.0001)
        XCTAssertEqual(insights.numberOfDays, 2)
        XCTAssertEqual(insights.dates.count, 12)
        XCTAssertEqual(insights.dates.first, date(2024, 1, 1))
        XCTAssertEqual(insights.dateDictionary[date(2024, 5, 1)] ?? 0, 3, accuracy: 0.0001)
        XCTAssertEqual(insights.dateDictionary[date(2024, 6, 1)] ?? 0, 19.75, accuracy: 0.0001)
        XCTAssertEqual(insights.average, 22.75 / 6, accuracy: 0.0001)

        // The child category's spending rolls up into its top-level parent, and
        // zero-total categories (Rent) are omitted.
        XCTAssertEqual(insights.categories.count, 1)
        XCTAssertEqual(insights.categories.first?.name, "Food")
        XCTAssertEqual(insights.categories.first?.percent ?? 0, 1.0, accuracy: 0.0001)

        XCTAssertEqual(insights, sync)
    }

    @MainActor
    func testAsyncGetWidgetSnapshotMatchesBudgetTransactions() async throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = makeCategory(in: context, name: "Food", order: 1)
        let child = makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        makeTransaction(in: context, amount: 12.5, date: date(2024, 6, 10), category: child)
        makeTransaction(in: context, amount: 7.25, date: date(2024, 6, 12), category: parent)
        makeTransaction(in: context, amount: 40, date: date(2024, 6, 11), income: true, category: parent)
        makeTransaction(in: context, amount: 3, date: date(2024, 5, 20), category: parent)
        let budget = makeBudget(in: context, amount: 100, startDate: date(2024, 6, 1), type: 3, category: parent)
        try? controller.save()

        let identifier = budget.objectID.uriRepresentation().absoluteString
        let snapshot = try await controller.budgets.getWidgetSnapshot(identifier: identifier)

        // Income and pre-start-date transactions are excluded; the child
        // category's spending counts toward the parent's budget.
        let expected = BudgetRepository.WidgetSnapshot(
            totalSpent: 19.75,
            type: 3,
            symbol: budget.displaySymbol,
            name: budget.wrappedName,
            color: budget.wrappedColor,
            budgetAmount: 100,
            startDate: date(2024, 6, 1),
            endDate: budget.endDate
        )
        XCTAssertEqual(snapshot, expected)
    }

    @MainActor
    func testAsyncGetWidgetSnapshotThrowsNotFoundForBudgetMissingStartDate() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)
        let budget = makeBudget(in: context, amount: 100, startDate: date(2024, 6, 1), type: 3, category: category)
        try? controller.save()

        // CloudKit can commit a Budget row before its optional attributes arrive;
        // a half-synced budget must surface as notFound, not crash the widget.
        budget.startDate = nil
        try? controller.save()

        do {
            _ = try await controller.budgets.getWidgetSnapshot(identifier: budget.objectID.uriRepresentation().absoluteString)
            XCTFail("Expected CustomError.notFound for a budget without a start date")
        } catch {
            guard case CustomError.notFound = error else {
                return XCTFail("Expected CustomError.notFound, got \(error)")
            }
        }
    }

    @MainActor
    func testAsyncGetWidgetSnapshotThrowsNotFoundForDeletedBudget() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)
        let budget = makeBudget(in: context, amount: 100, startDate: date(2024, 6, 1), type: 3, category: category)
        try? controller.save()

        let identifier = budget.objectID.uriRepresentation().absoluteString
        context.delete(budget)
        try? controller.save()

        do {
            _ = try await controller.budgets.getWidgetSnapshot(identifier: identifier)
            XCTFail("Expected CustomError.notFound for a deleted budget")
        } catch {
            guard case CustomError.notFound = error else {
                return XCTFail("Expected CustomError.notFound, got \(error)")
            }
        }
    }

    @MainActor
    func testAsyncGetWidgetSnapshotThrowsNotFoundForUnparsableIdentifier() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())

        do {
            _ = try await controller.budgets.getWidgetSnapshot(identifier: "")
            XCTFail("Expected CustomError.notFound for an empty identifier")
        } catch {
            guard case CustomError.notFound = error else {
                return XCTFail("Expected CustomError.notFound, got \(error)")
            }
        }
    }

    @MainActor
    func testAsyncGetWidgetBudgetOptionsListsSavedBudgets() async {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let food = makeCategory(in: context, name: "Food", order: 1)
        let rent = makeCategory(in: context, name: "Rent", order: 2)
        // Distinct start dates give distinct dateCreated values, which is the
        // options list's sort key.
        let first = makeBudget(in: context, amount: 100, startDate: date(2024, 6, 1), type: 3, category: food)
        let second = makeBudget(in: context, amount: 900, startDate: date(2024, 6, 2), type: 3, category: rent)
        try? controller.save()

        let options = await controller.budgets.getWidgetBudgetOptions()

        // The configuration list is user-visible, so its order matters.
        XCTAssertEqual(options.map(\.name), [first.wrappedName, second.wrappedName])
        XCTAssertEqual(
            options.map(\.identifier),
            [first, second].map { $0.objectID.uriRepresentation().absoluteString }
        )
    }
}
