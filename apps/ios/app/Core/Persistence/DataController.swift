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
class DataController {
    static let shared = DataController()

    var container = NSPersistentCloudKitContainer(name: "MainModel")

    // Characterization seams (flagged mechanical, B3). Production defaults keep
    // behavior byte-for-byte identical; tests inject a frozen clock, a pinned
    // calendar, and an isolated UserDefaults suite for deterministic date math.
    let now: () -> Date
    let injectedCalendar: Calendar
    let sharedDefaults: UserDefaults

    /// Whether the persistent store loaded from the shared app-group container.
    /// `.appGroupUnavailable` means the app↔widget↔extension bridge is broken and
    /// every process must surface a visible error instead of a silent empty store.
    let storeState: StoreState

    enum StoreState: Equatable {
        case loaded
        case appGroupUnavailable
    }

    /// `true` when the shared store loaded normally. Widget and app-extension entry
    /// points read this to refuse rendering stale/empty data on a broken bridge.
    static var storeIsAvailable: Bool { shared.storeState == .loaded }

    /// Error returned by intent extensions when the shared store is unavailable.
    static let appGroupUnavailableError = NSError(
        domain: "DataStore.AppGroupUnavailable",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "The shared app group container is unavailable, so data cannot be loaded."]
    )

    /// Pure fail-loud decision, extracted from `init` so it can be unit-tested
    /// without a real `FileManager` or a fatal build: a `nil` container URL means
    /// the shared app-group container could not be resolved, so the store must
    /// refuse to open a private per-process fallback. Any resolved URL is `.loaded`.
    static func storeState(for containerURL: URL?) -> StoreState {
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
        description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
        description.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)

        if inMemory {
            description.url = URL(fileURLWithPath: "/dev/null")
            description.cloudKitContainerOptions = nil
        } else {
            description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(containerIdentifier: AppIdentifiers.cloudKitContainer)

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

        container.persistentStoreDescriptions = [description]

        container.loadPersistentStores { description, error in

            if let error = error as NSError? {
                fatalError("Unresolved error \(error), \(error.userInfo) for \(description)")
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
            AppIdentifiers.sharedDefaults!.bool(forKey: "newTransactionAdded")
        }

        set {
            AppIdentifiers.sharedDefaults!.set(newValue, forKey: "newTransactionAdded")
        }
    }

    func deleteAll() {
        let fetchRequest1: NSFetchRequest<NSFetchRequestResult> = Transaction.fetchRequest()
        let batchDeleteRequest1 = NSBatchDeleteRequest(fetchRequest: fetchRequest1)
        _ = try? container.viewContext.executeAndMergeChanges(using: batchDeleteRequest1)

        let fetchRequest2: NSFetchRequest<NSFetchRequestResult> = Category.fetchRequest()
        let batchDeleteRequest2 = NSBatchDeleteRequest(fetchRequest: fetchRequest2)
        _ = try? container.viewContext.executeAndMergeChanges(using: batchDeleteRequest2)

        let fetchRequest3: NSFetchRequest<NSFetchRequestResult> = Budget.fetchRequest()
        let batchDeleteRequest3 = NSBatchDeleteRequest(fetchRequest: fetchRequest3)
        _ = try? container.viewContext.executeAndMergeChanges(using: batchDeleteRequest3)

        let fetchRequest4: NSFetchRequest<NSFetchRequestResult> = MainBudget.fetchRequest()
        let batchDeleteRequest4 = NSBatchDeleteRequest(fetchRequest: fetchRequest4)
        _ = try? container.viewContext.executeAndMergeChanges(using: batchDeleteRequest4)
    }

    func save() {
        if container.viewContext.hasChanges {
            try? container.viewContext.save()
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    func results<T: NSManagedObject>(for fetchRequest: NSFetchRequest<T>) -> [T] {
        return (try? container.viewContext.fetch(fetchRequest)) ?? []
    }

    func newBackgroundContext() -> NSManagedObjectContext {
        let context = container.newBackgroundContext()
        context.automaticallyMergesChangesFromParent = true
        return context
    }

    /// Single funnel for background reads: runs `work` on a fresh background
    /// context's queue so fetches never block (or violate) the main thread.
    func performBackground<T>(_ work: @escaping (NSManagedObjectContext) throws -> T) async rethrows -> T {
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
