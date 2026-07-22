//
//  DataControllerPersistenceTests.swift
//  OutlayrTests
//
//  Characterizes DataController persistence/CRUD against an in-memory store.
//

import CoreData
import Testing

@testable import Outlayr

@MainActor
struct DataControllerPersistenceTests {
    @Test func inMemoryStoreReportsLoadedState() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        // The C2b fail-loud guard must never misfire on a healthy store: the
        // in-memory path (and, by construction, the resolved app-group path) reports
        // `.loaded`. The unreachable nil-container path is verified on-device (C3.5).
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        #expect(controller.storeState == .loaded)
    }

    @Test func storeStateForNilContainerReportsAppGroupUnavailable() {
        // Locks the fail-loud decision directly: a nil app-group container URL (a
        // broken App Groups entitlement / provisioning profile) must refuse the
        // silent per-process fallback store. Pure, so it needs no FileManager or
        // fatal build to exercise the branch the runtime guard can't reach on-sim.
        #expect(DataController.storeState(for: nil) == .appGroupUnavailable)
    }

    @Test func storeStateForResolvedContainerReportsLoaded() {
        // The complement: any resolved container URL keeps the store `.loaded`, so
        // the guard never misfires on a healthy app group.
        #expect(DataController.storeState(for: URL(fileURLWithPath: "/tmp/x")) == .loaded)
    }

    @Test func newTransactionPersistsWithDerivedDayAndMonth() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Food", income: false, order: 1)
        let txDate = f.date(2024, 3, 9, 14, 30)

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

        #expect(transaction.note == "Lunch")
        #expect(abs(transaction.amount - 12.5) < 0.0001)
        #expect(transaction.category == category)
        #expect(transaction.income == false)

        // day is start-of-day of the transaction date; month is first-of-month.
        #expect(transaction.day == f.date(2024, 3, 9, 0, 0))
        #expect(transaction.month == f.date(2024, 3, 1, 0, 0))
        #expect(transaction.id != nil)

        let stored = controller.results(for: controller.transactions.fetchRequestForExport())
        #expect(stored.count == 1)
        #expect(stored.first == transaction)
    }

    @Test func emptyNoteFallsBackToCategoryName() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Transport", order: 1)

        let transaction = controller.transactions.newTransaction(
            note: "   ",
            category: category,
            income: false,
            amount: 3,
            date: f.date(2024, 3, 9),
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        #expect(transaction.note == "Transport")
    }

    @Test func fetchRequestForExportSortsByDateDescending() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)

        f.makeTransaction(in: context, amount: 1, date: f.date(2024, 1, 1), category: category)
        f.makeTransaction(in: context, amount: 2, date: f.date(2024, 3, 1), category: category)
        f.makeTransaction(in: context, amount: 3, date: f.date(2024, 2, 1), category: category)
        try? controller.save()

        let stored = controller.results(for: controller.transactions.fetchRequestForExport())
        let dates = stored.compactMap { $0.date }
        #expect(dates == [f.date(2024, 3, 1), f.date(2024, 2, 1), f.date(2024, 1, 1)])
    }

    @Test func deleteAllClearsEveryEntity() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)
        f.makeTransaction(in: context, amount: 10, date: f.date(2024, 2, 1), category: category)
        f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 2, 1), type: 3, category: category)
        f.makeMainBudget(in: context, amount: 500, startDate: f.date(2024, 2, 1), type: 3)
        try? controller.save()

        try? controller.deleteAll()

        #expect(controller.results(for: Transaction.fetchRequest()).isEmpty)
        #expect(controller.results(for: Outlayr.Category.fetchRequest()).isEmpty)
        #expect(controller.results(for: Budget.fetchRequest()).isEmpty)
        #expect(controller.results(for: MainBudget.fetchRequest()).isEmpty)
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
    private func seedLedger(on controller: DataController, f: inout CharacterizationFixture) -> Outlayr.Category {
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)
        f.makeTransaction(in: context, amount: 12.5, date: f.date(2024, 6, 10), category: category)
        f.makeTransaction(in: context, amount: 7.25, date: f.date(2024, 6, 12), category: category)
        f.makeTransaction(in: context, amount: 40, date: f.date(2024, 6, 14), income: true, category: category)
        f.makeTransaction(in: context, amount: 3, date: f.date(2024, 5, 20), category: category)
        try? controller.save()
        return category
    }

    @Test func asyncGetLogViewTotalSpentMatchesSync() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        _ = seedLedger(on: controller, f: &f)

        let sync = syncBaseline { controller.transactions.getLogViewTotalSpent(type: 5) }
        let background = await controller.transactions.getLogViewTotalSpent(type: 5)

        #expect(abs(sync - 22.75) < 0.0001)
        #expect(abs(background - sync) < 0.0001)
    }

    @Test func asyncGetLogViewTotalIncomeMatchesSync() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        _ = seedLedger(on: controller, f: &f)

        let sync = syncBaseline { controller.transactions.getLogViewTotalIncome(type: 5) }
        let background = await controller.transactions.getLogViewTotalIncome(type: 5)

        #expect(abs(sync - 40) < 0.0001)
        #expect(abs(background - sync) < 0.0001)
    }

    @Test func asyncGetLogViewTotalNetMatchesSync() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        _ = seedLedger(on: controller, f: &f)

        let sync = syncBaseline { controller.transactions.getLogViewTotalNet(type: 5) }
        let background = await controller.transactions.getLogViewTotalNet(type: 5)

        #expect(abs(background.value - sync.value) < 0.0001)
        #expect(background.positive == sync.positive)
    }

    @Test func asyncGetLineGraphDataNetMatchesSync() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        _ = seedLedger(on: controller, f: &f)

        let sync = syncBaseline { controller.transactions.getLineGraphDataNet(type: 2) }
        let background = await controller.transactions.getLineGraphDataNet(type: 2)

        #expect(sync.isEmpty == false)
        #expect(background == sync)
    }

    @Test func asyncGetInsightsSummaryMatchesSync() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        _ = seedLedger(on: controller, f: &f)

        let sync = syncBaseline { controller.transactions.getInsightsSummary(type: 2, date: f.date(2024, 6, 1)) }
        let background = await controller.transactions.getInsightsSummary(type: 2, date: f.date(2024, 6, 1))

        #expect(abs(background.spent - sync.spent) < 0.0001)
        #expect(abs(background.income - sync.income) < 0.0001)
        #expect(abs(background.net - sync.net) < 0.0001)
        #expect(background.positive == sync.positive)
        #expect(abs(background.average - sync.average) < 0.0001)
    }

    @Test func asyncGetShortcutInsightsMatchesSyncWithCategoryFilter() async throws {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let category = seedLedger(on: controller, f: &f)

        let sync = syncBaseline { controller.transactions.getShortcutInsights(type: 3, timeframe: 5, optionalIncome: false, categories: [category]) }
        let background = try await controller.transactions.getShortcutInsights(type: 3, timeframe: 5, optionalIncome: false, categories: [category])

        #expect(abs(sync - 22.75) < 0.0001)
        #expect(abs(background - sync) < 0.0001)
    }

    @Test func asyncGetBudgetLeftoverMatchesSync() async throws {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = seedLedger(on: controller, f: &f)
        let budget = f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 6, 1), type: 3, category: category)
        let mainBudget = f.makeMainBudget(in: context, amount: 500, startDate: f.date(2024, 6, 1), type: 3)
        try? controller.save()

        let syncBudget = syncBaseline { controller.budgets.getBudgetLeftover(budget: budget) }
        let backgroundBudget = try await controller.budgets.getBudgetLeftover(budget: budget)
        #expect(abs(backgroundBudget - syncBudget) < 0.0001)

        let syncOverall = syncBaseline { controller.budgets.getBudgetLeftover(overallBudget: mainBudget) }
        let backgroundOverall = try await controller.budgets.getBudgetLeftover(overallBudget: mainBudget)
        #expect(abs(backgroundOverall - syncOverall) < 0.0001)
    }

    @Test func asyncGetBudgetLeftoverThrowsWhenBudgetCannotBeRematerialized() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)
        // Never saved, so the objectID stays temporary and the background context
        // cannot rematerialize it.
        let budget = f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 6, 1), type: 3, category: category)

        await #expect(throws: (any Error).self) {
            _ = try await controller.budgets.getBudgetLeftover(budget: budget)
        }
    }

    @Test func asyncGetShortcutInsightsThrowsWhenCategoryCannotBeRematerialized() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        // Never saved, so the objectID stays temporary and the background context
        // cannot rematerialize it.
        let category = f.makeCategory(in: context, name: "Food", order: 1)

        await #expect(throws: (any Error).self) {
            _ = try await controller.transactions.getShortcutInsights(type: 3, timeframe: 5, optionalIncome: false, categories: [category])
        }
    }

    @Test func getLogViewInsightsMatchesIndividualSyncMethods() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        _ = seedLedger(on: controller, f: &f)

        let net = await controller.transactions.getLogViewInsights(type: 2, insightsType: 1)
        let expense = await controller.transactions.getLogViewInsights(type: 2, insightsType: 3)

        let syncNet = syncBaseline { controller.transactions.getLogViewTotalNet(type: 2) }
        #expect(abs(net.netTotal - syncNet.value) < 0.0001)
        #expect(net.isNetPositive == syncNet.positive)
        #expect(abs(net.totalSpent - syncBaseline { controller.transactions.getLogViewTotalSpent(type: 2) }) < 0.0001)
        #expect(abs(net.totalIncome - syncBaseline { controller.transactions.getLogViewTotalIncome(type: 2) }) < 0.0001)
        #expect(net.lineGraphData == syncBaseline { controller.transactions.getLineGraphDataNet(type: 2) })
        #expect(expense.lineGraphData == syncBaseline { controller.transactions.getLineGraphData(income: false, type: 2) })
    }

    @Test func getGraphViewInsightsMatchesIndividualSyncMethods() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let category = seedLedger(on: controller, f: &f)

        // The shared ledger has no rows in the prior week (Jun 3-9) or the prior
        // year, so without these the -7d/-1y prior windows would pass as zero
        // under a wrong prior-date derivation too.
        let context = controller.container.viewContext
        f.makeTransaction(in: context, amount: 5.5, date: f.date(2024, 6, 5), category: category)
        f.makeTransaction(in: context, amount: 9, date: f.date(2023, 3, 10), category: category)
        try? controller.save()

        let payload = await controller.transactions.getGraphViewInsights(type: 2, date: f.date(2024, 6, 1), income: false)

        let syncSummary = syncBaseline { controller.transactions.getInsightsSummary(type: 2, date: f.date(2024, 6, 1)) }
        #expect(abs(payload.summary.spent - syncSummary.spent) < 0.0001)
        #expect(abs(payload.summary.income - syncSummary.income) < 0.0001)
        #expect(abs(payload.summary.net - syncSummary.net) < 0.0001)
        #expect(payload.summary.positive == syncSummary.positive)
        #expect(abs(payload.summary.average - syncSummary.average) < 0.0001)

        let syncPrior = syncBaseline { controller.transactions.getInsightsSummary(type: 2, date: f.date(2024, 5, 1)) }
        #expect(abs(payload.priorSummary.spent - syncPrior.spent) < 0.0001)
        #expect(abs(payload.priorSummary.net - syncPrior.net) < 0.0001)
        #expect(payload.priorSummary.positive == syncPrior.positive)

        let syncBreakdown = syncBaseline { controller.transactions.getInsights(type: 2, date: f.date(2024, 6, 1), income: false) }
        #expect(abs(payload.breakdown.amount - syncBreakdown.amount) < 0.0001)
        #expect(abs(payload.breakdown.maximum - syncBreakdown.maximum) < 0.0001)
        #expect(abs(payload.breakdown.average - syncBreakdown.average) < 0.0001)
        #expect(payload.breakdown.numberOfDays == syncBreakdown.numberOfDays)
        #expect(payload.breakdown.dates == syncBreakdown.dates)
        #expect(payload.breakdown.dateDictionary == syncBreakdown.dateDictionary)

        // The week type derives its prior period seven days back, not one month.
        // The Jun 5 seed makes that observable: the -1 month window (May 10-16)
        // is empty, so a wrong prior date would report zero here.
        let weekPayload = await controller.transactions.getGraphViewInsights(type: 1, date: f.date(2024, 6, 10), income: false)
        let syncWeekPrior = syncBaseline { controller.transactions.getInsightsSummary(type: 1, date: f.date(2024, 6, 3)) }
        #expect(abs(syncWeekPrior.spent - 5.5) < 0.0001)
        #expect(abs(weekPayload.priorSummary.spent - syncWeekPrior.spent) < 0.0001)
        #expect(abs(weekPayload.priorSummary.net - syncWeekPrior.net) < 0.0001)
        #expect(weekPayload.priorSummary.positive == syncWeekPrior.positive)

        // The year type derives its prior period one year back; the 2023 seed
        // pins that window as non-empty.
        let yearPayload = await controller.transactions.getGraphViewInsights(type: 3, date: f.date(2024, 1, 1), income: false)
        let syncYearPrior = syncBaseline { controller.transactions.getInsightsSummary(type: 3, date: f.date(2023, 1, 1)) }
        #expect(abs(syncYearPrior.spent - 9) < 0.0001)
        #expect(abs(yearPayload.priorSummary.spent - syncYearPrior.spent) < 0.0001)
        #expect(abs(yearPayload.priorSummary.net - syncYearPrior.net) < 0.0001)
        #expect(yearPayload.priorSummary.positive == syncYearPrior.positive)
    }

    @Test func getMainBudgetWidgetSnapshotMatchesSync() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        _ = seedLedger(on: controller, f: &f)
        f.makeMainBudget(in: context, amount: 500, startDate: f.date(2024, 6, 1), type: 3)
        try? controller.save()

        let sync = syncBaseline { controller.budgets.fetchRequestForMainBudgetWidget() }
        let background = await controller.budgets.getMainBudgetWidgetSnapshot()

        #expect(sync.found)
        #expect(background.found == sync.found)
        #expect(abs(background.totalSpent - sync.totalSpent) < 0.0001)
        #expect(abs(background.budgetAmount - sync.budgetAmount) < 0.0001)
        #expect(abs(background.percentage - sync.percentage) < 0.0001)
        #expect(background.type == sync.type)
        #expect(background.startDate == sync.startDate)
    }

    @Test func performBackgroundRunsOffMainThread() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())

        let ranOnMainThread = await controller.performBackground { _ in Thread.isMainThread }

        #expect(ranOnMainThread == false)
    }

    // MARK: - Widget payloads (background-context reads for extension processes)

    @Test func asyncGetWidgetInsightsMatchesSyncAndRollsChildIntoParent() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = f.makeCategory(in: context, name: "Food", order: 1)
        let child = f.makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        f.makeCategory(in: context, name: "Rent", order: 3)
        f.makeTransaction(in: context, amount: 12.5, date: f.date(2024, 6, 10), category: child)
        f.makeTransaction(in: context, amount: 7.25, date: f.date(2024, 6, 12), category: parent)
        f.makeTransaction(in: context, amount: 40, date: f.date(2024, 6, 11), income: true, category: parent)
        f.makeTransaction(in: context, amount: 3, date: f.date(2024, 5, 20), category: parent)
        try? controller.save()

        let sync = syncBaseline { controller.transactions.getWidgetInsights(type: .week, income: false) }
        let insights = await controller.transactions.getWidgetInsights(type: .week, income: false)

        // Frozen now is Sat 2024-06-15 12:00; with firstWeekday=1 the week starts
        // Sun 2024-06-09, so the May transaction and the income row are excluded.
        #expect(abs(insights.amount - 19.75) < 0.0001)
        #expect(abs(insights.maximum - 12.5) < 0.0001)
        #expect(insights.numberOfDays == 2)
        #expect(insights.dates.count == 7)
        #expect(insights.dates.first == f.date(2024, 6, 9))
        #expect(abs((insights.dateDictionary[f.date(2024, 6, 10)] ?? 0) - 12.5) < 0.0001)
        #expect(abs(insights.average - 19.75 / 7) < 0.0001)

        // The child category's spending rolls up into its top-level parent, and
        // zero-total categories (Rent) are omitted.
        #expect(insights.categories.count == 1)
        #expect(insights.categories.first?.name == "Food")
        #expect(insights.categories.first?.color == "#000000")
        #expect(abs((insights.categories.first?.percent ?? 0) - 1.0) < 0.0001)

        #expect(insights == sync)
    }

    @Test func asyncGetWidgetInsightsMonthMatchesSyncAndRollsChildIntoParent() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        // The month window starts at getStartOfMonth, which reads the real clock
        // (Date.now) rather than the injected one, so this test freezes the
        // controller clock at the real now and seeds rows relative to the real
        // month start.
        let now = Date.now
        let controller = f.makeController(now: now, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = f.makeCategory(in: context, name: "Food", order: 1)
        let child = f.makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        f.makeCategory(in: context, name: "Rent", order: 3)

        let monthStart = getStartOfMonth(startDay: 1)
        f.makeTransaction(in: context, amount: 12.5, date: monthStart, category: child)
        f.makeTransaction(in: context, amount: 7.25, date: monthStart, category: parent)
        f.makeTransaction(in: context, amount: 40, date: monthStart, income: true, category: parent)
        f.makeTransaction(in: context, amount: 3, date: monthStart.addingTimeInterval(-3600), category: parent)
        try? controller.save()

        let sync = syncBaseline { controller.transactions.getWidgetInsights(type: .month, income: false) }
        let insights = await controller.transactions.getWidgetInsights(type: .month, income: false)

        // The pre-month-start transaction and the income row are excluded; both
        // in-month rows land in the first day bucket.
        let daysInMonth = Calendar(identifier: .gregorian).range(of: .day, in: .month, for: monthStart)!.count
        let daysPast = Calendar.current.dateComponents([.day], from: monthStart, to: now).day!
        #expect(abs(insights.amount - 19.75) < 0.0001)
        #expect(abs(insights.maximum - 19.75) < 0.0001)
        #expect(insights.numberOfDays == 1)
        #expect(insights.dates.count == daysInMonth)
        #expect(insights.dates.first == monthStart)
        #expect(abs((insights.dateDictionary[monthStart] ?? 0) - 19.75) < 0.0001)
        #expect(abs(insights.average - 19.75 / Double(daysPast + 1)) < 0.0001)

        // The child category's spending rolls up into its top-level parent, and
        // zero-total categories (Rent) are omitted.
        #expect(insights.categories.count == 1)
        #expect(insights.categories.first?.name == "Food")
        #expect(abs((insights.categories.first?.percent ?? 0) - 1.0) < 0.0001)

        #expect(insights == sync)
    }

    @Test func asyncGetWidgetInsightsYearMatchesSyncAndRollsChildIntoParent() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = f.makeCategory(in: context, name: "Food", order: 1)
        let child = f.makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        f.makeCategory(in: context, name: "Rent", order: 3)
        f.makeTransaction(in: context, amount: 12.5, date: f.date(2024, 6, 10), category: child)
        f.makeTransaction(in: context, amount: 7.25, date: f.date(2024, 6, 12), category: parent)
        f.makeTransaction(in: context, amount: 40, date: f.date(2024, 6, 11), income: true, category: parent)
        f.makeTransaction(in: context, amount: 3, date: f.date(2024, 5, 20), category: parent)
        try? controller.save()

        let sync = syncBaseline { controller.transactions.getWidgetInsights(type: .year, income: false) }
        let insights = await controller.transactions.getWidgetInsights(type: .year, income: false)

        // Frozen now is 2024-06-15, so the year window is 2024 bucketed by month:
        // the May row now counts, the income row stays excluded, and five full
        // months have elapsed (average divides by six).
        #expect(abs(insights.amount - 22.75) < 0.0001)
        #expect(abs(insights.maximum - 19.75) < 0.0001)
        #expect(insights.numberOfDays == 2)
        #expect(insights.dates.count == 12)
        #expect(insights.dates.first == f.date(2024, 1, 1))
        #expect(abs((insights.dateDictionary[f.date(2024, 5, 1)] ?? 0) - 3) < 0.0001)
        #expect(abs((insights.dateDictionary[f.date(2024, 6, 1)] ?? 0) - 19.75) < 0.0001)
        #expect(abs(insights.average - 22.75 / 6) < 0.0001)

        // The child category's spending rolls up into its top-level parent, and
        // zero-total categories (Rent) are omitted.
        #expect(insights.categories.count == 1)
        #expect(insights.categories.first?.name == "Food")
        #expect(abs((insights.categories.first?.percent ?? 0) - 1.0) < 0.0001)

        #expect(insights == sync)
    }

    @Test func asyncGetWidgetSnapshotMatchesBudgetTransactions() async throws {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = f.makeCategory(in: context, name: "Food", order: 1)
        let child = f.makeCategory(in: context, name: "Snacks", order: 2)
        child.parent = parent
        f.makeTransaction(in: context, amount: 12.5, date: f.date(2024, 6, 10), category: child)
        f.makeTransaction(in: context, amount: 7.25, date: f.date(2024, 6, 12), category: parent)
        f.makeTransaction(in: context, amount: 40, date: f.date(2024, 6, 11), income: true, category: parent)
        f.makeTransaction(in: context, amount: 3, date: f.date(2024, 5, 20), category: parent)
        let budget = f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 6, 1), type: 3, category: parent)
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
            startDate: f.date(2024, 6, 1),
            endDate: budget.endDate
        )
        #expect(snapshot == expected)
    }

    @Test func asyncGetWidgetSnapshotThrowsNotFoundForBudgetMissingStartDate() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)
        let budget = f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 6, 1), type: 3, category: category)
        try? controller.save()

        // CloudKit can commit a Budget row before its optional attributes arrive;
        // a half-synced budget must surface as notFound, not crash the widget.
        budget.startDate = nil
        try? controller.save()

        await #expect {
            _ = try await controller.budgets.getWidgetSnapshot(identifier: budget.objectID.uriRepresentation().absoluteString)
        } throws: { error in
            if case CustomError.notFound = error { return true }
            return false
        }
    }

    @Test func asyncGetWidgetSnapshotThrowsNotFoundForDeletedBudget() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = f.makeCategory(in: context, name: "Food", order: 1)
        let budget = f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 6, 1), type: 3, category: category)
        try? controller.save()

        let identifier = budget.objectID.uriRepresentation().absoluteString
        context.delete(budget)
        try? controller.save()

        await #expect {
            _ = try await controller.budgets.getWidgetSnapshot(identifier: identifier)
        } throws: { error in
            if case CustomError.notFound = error { return true }
            return false
        }
    }

    @Test func asyncGetWidgetSnapshotThrowsNotFoundForUnparsableIdentifier() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())

        await #expect {
            _ = try await controller.budgets.getWidgetSnapshot(identifier: "")
        } throws: { error in
            if case CustomError.notFound = error { return true }
            return false
        }
    }

    @Test func asyncGetWidgetBudgetOptionsListsSavedBudgets() async {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let food = f.makeCategory(in: context, name: "Food", order: 1)
        let rent = f.makeCategory(in: context, name: "Rent", order: 2)
        // Distinct start dates give distinct dateCreated values, which is the
        // options list's sort key.
        let first = f.makeBudget(in: context, amount: 100, startDate: f.date(2024, 6, 1), type: 3, category: food)
        let second = f.makeBudget(in: context, amount: 900, startDate: f.date(2024, 6, 2), type: 3, category: rent)
        try? controller.save()

        let options = await controller.budgets.getWidgetBudgetOptions()

        // The configuration list is user-visible, so its order matters.
        #expect(options.map(\.name) == [first.wrappedName, second.wrappedName])
        #expect(
            options.map(\.identifier)
                == [first, second].map { $0.objectID.uriRepresentation().absoluteString }
        )
    }
}
