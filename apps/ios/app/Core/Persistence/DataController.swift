//
//  DataController.swift
//  Bonsai
//
//  Created by Rafael Soh on 3/6/22.
//

import CoreData
import Foundation
import os
import SwiftUI
import WidgetKit

@available(iOS 16, *)
enum CustomError: Swift.Error, CustomLocalizedStringResourceConvertible {
    case notFound,
         coreDataSave,
         unknownId(id: String),
         unknownError(message: String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case let .unknownError(message): return "An unknown error occurred: \(message)"
        case let .unknownId(id): return "No category with an ID matching: \(id)"
        case .notFound: return "Category not found"
        case .coreDataSave: return "Couldn't save to CoreData"
        }
    }
}

@Observable
@MainActor
class DataController {
    static let shared = DataController()

    // nonisolated so the background-context helpers below can call
    // container.newBackgroundContext() without a main-actor hop. Callers must never
    // access container.viewContext from a background thread.
    nonisolated let container = NSPersistentContainer(name: "MainModel")

    // Characterization seams (flagged mechanical, B3). Production defaults keep
    // behavior byte-for-byte identical; tests inject a frozen clock, a pinned
    // calendar, and an isolated UserDefaults suite for deterministic date math.
    // nonisolated so repositories can read them from background-context closures.
    nonisolated let now: () -> Date
    nonisolated let injectedCalendar: Calendar
    nonisolated(unsafe) let sharedDefaults: UserDefaults

    /// Whether the persistent store loaded from the shared app-group container.
    /// `.appGroupUnavailable` means the app↔widget↔extension bridge is broken and
    /// every process must surface a visible error instead of a silent empty store.
    // nonisolated so widgets and shortcuts can read it synchronously without hopping
    // to the main actor. It is a `let`, so it is immutable after init.
    nonisolated let storeState: StoreState

    enum StoreState: Equatable {
        case loaded
        case appGroupUnavailable
    }

    /// `true` when the shared store loaded normally. Widget and app-extension entry
    /// points read this to refuse rendering stale/empty data on a broken bridge.
    // Written once during `shared` initialization; read-only afterwards, so
    // nonisolated(unsafe) is safe — no concurrent writes ever occur.
    private nonisolated(unsafe) static var _storeIsAvailable = false
    nonisolated static var storeIsAvailable: Bool { _storeIsAvailable }

    /// Error returned by intent extensions when the shared store is unavailable.
    nonisolated static let appGroupUnavailableError = NSError(
        domain: "DataStore.AppGroupUnavailable",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "The shared app group container is unavailable, so data cannot be loaded."]
    )

    /// Pure fail-loud decision, extracted from `init` so it can be unit-tested
    /// without a real `FileManager` or a fatal build: a `nil` container URL means
    /// the shared app-group container could not be resolved, so the store must
    /// refuse to open a private per-process fallback. Any resolved URL is `.loaded`.
    nonisolated static func storeState(for containerURL: URL?) -> StoreState {
        containerURL == nil ? .appGroupUnavailable : .loaded
    }

    init(
        inMemory: Bool = false,
        now: @escaping () -> Date = { Date.now },
        calendar: Calendar = .current,
        sharedDefaults: UserDefaults? = nil
    ) {
        self.now = now
        self.injectedCalendar = calendar
        self.sharedDefaults = sharedDefaults ?? AppIdentifiers.sharedDefaults ?? .standard

        let description = NSPersistentStoreDescription()

        description.shouldMigrateStoreAutomatically = true
        description.shouldInferMappingModelAutomatically = true

        if inMemory {
            description.url = URL(fileURLWithPath: "/dev/null")
        } else {
            let groupID = AppIdentifiers.appGroup
            let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)
            let state = Self.storeState(for: containerURL)

            if state == .appGroupUnavailable {
                // The shared app-group container is missing. Falling through here would
                // let Core Data quietly open a private, per-process store — the app and
                // its widgets/extensions would each read a DIFFERENT empty database and
                // masquerade as "working but empty". Refuse the silent fallback so a
                // misconfigured App Groups entitlement / provisioning profile is loud.
                Logger(subsystem: AppIdentifiers.bundleIdRoot, category: "storage")
                    .fault("App group \"\(groupID, privacy: .public)\" is unavailable — refusing to open a non-shared fallback store. Verify the App Groups entitlement and provisioning profile.")
                #if DEBUG
                    fatalError("App group \"\(groupID)\" is unavailable — verify the App Groups entitlement and provisioning profile. Refusing to open a non-shared fallback store.")
                #else
                    storeState = .appGroupUnavailable
                    return
                #endif
            }

            description.url = containerURL!.appendingPathComponent("Main.sqlite")
        }

        storeState = .loaded
        DataController._storeIsAvailable = true

        container.persistentStoreDescriptions = [description]

        container.loadPersistentStores { description, error in
            if let error = error as NSError? {
                Logger(subsystem: AppIdentifiers.bundleIdRoot, category: "storage")
                    .fault("loadPersistentStores failed for \(description, privacy: .public): \(error), \(error.userInfo)")
                return
            }
            self.container.viewContext.automaticallyMergesChangesFromParent = true
        }
    }

    var categories: CategoryRepository { CategoryRepository(dataController: self) }
    var budgets: BudgetRepository { BudgetRepository(dataController: self) }
    var transactions: TransactionRepository { TransactionRepository(dataController: self) }

    var tipCounter: Int {
        get {
            UserDefaults.standard.integer(forKey: "tipCounter")
        }

        set {
            UserDefaults.standard.set(newValue, forKey: "tipCounter")
        }
    }

    var addedTransaction: Bool {
        get {
            AppIdentifiers.defaults.bool(forKey: DefaultsKey.newTransactionAdded)
        }

        set {
            AppIdentifiers.defaults.set(newValue, forKey: DefaultsKey.newTransactionAdded)
        }
    }

    func deleteAll() throws {
        let logger = Logger(subsystem: AppIdentifiers.bundleIdRoot, category: "persistence")
        let fetchRequests: [NSFetchRequest<NSFetchRequestResult>] = [
            Transaction.fetchRequest(),
            Category.fetchRequest(),
            Budget.fetchRequest(),
            MainBudget.fetchRequest()
        ]
        var firstError: Error?
        for request in fetchRequests {
            do {
                try container.viewContext.executeAndMergeChanges(using: NSBatchDeleteRequest(fetchRequest: request))
            } catch {
                logger.error("deleteAll batch delete failed: \(error)")
                if firstError == nil { firstError = error }
            }
        }
        if let error = firstError { throw error }
    }

    func save() throws {
        guard container.viewContext.hasChanges else { return }
        do {
            try container.viewContext.save()
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            Logger(subsystem: AppIdentifiers.bundleIdRoot, category: "persistence")
                .error("viewContext.save() failed: \(error)")
            throw error
        }
    }

    func results<T: NSManagedObject>(for fetchRequest: NSFetchRequest<T>) -> [T] {
        return (try? container.viewContext.fetch(fetchRequest)) ?? []
    }

    nonisolated func newBackgroundContext() -> NSManagedObjectContext {
        let context = container.newBackgroundContext()
        context.automaticallyMergesChangesFromParent = true
        return context
    }

    /// Single funnel for background reads: runs `work` on a fresh background
    /// context's queue so fetches never block (or violate) the main thread.
    nonisolated func performBackground<T>(_ work: @escaping (NSManagedObjectContext) throws -> T) async rethrows -> T {
        let context = newBackgroundContext()
        return try await context.perform { try work(context) }
    }
}

public extension NSManagedObjectContext {
    func executeAndMergeChanges(using batchDeleteRequest: NSBatchDeleteRequest) throws {
        batchDeleteRequest.resultType = .resultTypeObjectIDs
        let result = try execute(batchDeleteRequest) as? NSBatchDeleteResult
        let changes: [AnyHashable: Any] = [NSDeletedObjectsKey: result?.result as? [NSManagedObjectID] ?? []]
        NSManagedObjectContext.mergeChanges(fromRemoteContextSave: changes, into: [self])
    }
}

struct LineGraphDataPoint: Equatable {
    let date: Date
    let amount: Double

    var dateString: String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "d MMM"

        return dateFormatter.string(from: date)
    }

    var monthString: String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "MMM yy"

        return dateFormatter.string(from: date)
    }

    var amountString: String {
        if abs(amount) < 1000 {
            return String(format: "%.2f", amount)
        } else {
            return String(format: "%.0f", amount)
        }
    }
}

func getStartOfMonth(startDay: Int) -> Date {
    let calendar = Calendar.current

    guard startDay > 0 && startDay <= calendar.maximumRange(of: .day)!.upperBound else {
        let dateComponents = calendar.dateComponents([.month, .year], from: Date.now)
        return calendar.date(from: dateComponents) ?? Date.now
    }

    let today = calendar.startOfDay(for: Date.now)
    let currentDay = calendar.component(.day, from: today)

    var startComponents = DateComponents()
    startComponents.month = currentDay >= startDay ? 0 : -1

    startComponents.day = startDay - currentDay

    return calendar.date(byAdding: startComponents, to: today) ?? Date.now
}

func calculateStartOfMonthPeriod(earliestDate: Date, startOfMonthDay: Int) -> Date {
    var components = Calendar.current.dateComponents([.year, .month, .day], from: earliestDate)
    components.day = startOfMonthDay

    let startOfMonth = Calendar.current.date(from: components) ?? Date.now
    return (earliestDate < startOfMonth) ? (Calendar.current.date(byAdding: .month, value: -1, to: startOfMonth) ?? Date.now) : startOfMonth
}
