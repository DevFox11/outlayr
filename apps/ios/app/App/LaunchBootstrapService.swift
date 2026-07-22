//
//  LaunchBootstrapService.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

@MainActor
struct LaunchBootstrapService {
    private let dataController: DataController
    private let defaults: UserDefaults

    init(dataController: DataController) {
        self.dataController = dataController
        self.defaults = AppIdentifiers.defaults
    }

    func run() async -> (showIntro: Bool, currency: String) {
        if defaults.object(forKey: DefaultsKey.firstDayOfMonth) == nil {
            defaults.set(1, forKey: DefaultsKey.firstDayOfMonth)
        }

        let isFirstLaunch = (defaults.object(forKey: DefaultsKey.firstLaunch) as? Bool) ?? true

        if isFirstLaunch {
            writeFirstLaunchDefaults()
            defaults.set(false, forKey: DefaultsKey.firstLaunch)
        }

        let currency = resolveCurrency()
        await runMigrationsIfNeeded()

        return (showIntro: isFirstLaunch, currency: currency)
    }

    private func writeFirstLaunchDefaults() {
        defaults.set(1, forKey: DefaultsKey.firstWeekday)
        defaults.set(1, forKey: DefaultsKey.haptics)
        defaults.set(1, forKey: DefaultsKey.firstDayOfMonth)
        defaults.set(1, forKey: DefaultsKey.notificationOption)
        defaults.set(false, forKey: DefaultsKey.confetti)
        defaults.set(false, forKey: DefaultsKey.chromatic)
        defaults.set(true, forKey: DefaultsKey.showCents)
        defaults.set(true, forKey: DefaultsKey.animated)
        defaults.set(2, forKey: DefaultsKey.numberEntryType)
    }

    private func resolveCurrency() -> String {
        let localeCurrency = Locale.current.currency?.identifier ?? "USD"
        if let stored = NSUbiquitousKeyValueStore.default.string(forKey: "currency") {
            return stored
        }
        NSUbiquitousKeyValueStore.default.set(localeCurrency, forKey: "currency")
        return localeCurrency
    }

    private func runMigrationsIfNeeded() async {
        let migration1Needed = (defaults.object(forKey: DefaultsKey.dataMigration1) as? Bool) ?? true
        let migration2Needed = (defaults.object(forKey: DefaultsKey.dataMigration2) as? Bool) ?? true
        let paletteMigrationNeeded = (defaults.object(forKey: DefaultsKey.categoryPaletteMigrationV2) as? Bool) ?? true

        if migration1Needed {
            let fetchRequest = dataController.categories.fetchRequestForCategoriesMigration(income: false)
            await dataController.performBackground { context in
                let categories = (try? context.fetch(fetchRequest)) ?? []
                for (index, category) in categories.enumerated() {
                    category.order = Int64(index)
                }
                if context.hasChanges { try? context.save() }
            }
            defaults.set(false, forKey: DefaultsKey.dataMigration1)
        }

        if migration2Needed {
            let fetchRequest = dataController.categories.fetchRequestForCategoriesMigration()
            let colorDictionary = Color.colorMigrationDictionary
            await dataController.performBackground { context in
                let categories = (try? context.fetch(fetchRequest)) ?? []
                for category in categories {
                    if category.income {
                        category.color = "#76FBB1"
                    } else if Double(category.wrappedColor) != nil {
                        category.color = colorDictionary[category.wrappedColor] ?? "#FFFFFF"
                    }
                }
                if context.hasChanges { try? context.save() }
            }
            defaults.set(false, forKey: DefaultsKey.dataMigration2)
        }

        if paletteMigrationNeeded {
            let fetchRequest = dataController.categories.fetchRequestForCategoriesMigration()
            await dataController.performBackground { context in
                let categories = (try? context.fetch(fetchRequest)) ?? []
                for category in categories {
                    if let match = SuggestedCategory.match(name: category.wrappedName, income: category.income) {
                        category.color = match.color
                    }
                }
                if context.hasChanges { try? context.save() }
            }
            defaults.set(false, forKey: DefaultsKey.categoryPaletteMigrationV2)
        }
    }
}
