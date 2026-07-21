//
//  ContentView.swift
//
//  Created by Rafael Soh on 3/6/22.
//

import SwiftUI
import WidgetKit

struct ContentView: View {
    @Environment(AppLockViewModel.self) private var appLockVM
    @Environment(DataController.self) private var dataController

    @AppStorage("colorScheme", store: AppIdentifiers.sharedDefaults) var colorScheme: Int = 0
    @Environment(\.scenePhase) var scenePhase
    @AppStorage("showNotifications", store: AppIdentifiers.sharedDefaults) var showNotifications: Bool = false
    @AppStorage("notificationsEnabled", store: AppIdentifiers.sharedDefaults) var notificationsEnabled: Bool = true

    @AppStorage("firstLaunch", store: AppIdentifiers.sharedDefaults) var firstLaunch: Bool = true

    // adds category orders
    @AppStorage("dataMigration1", store: AppIdentifiers.sharedDefaults) var dataMigration1: Bool = true

    // converts category colors to hex codes
    @AppStorage("dataMigration2", store: AppIdentifiers.sharedDefaults) var dataMigration2: Bool = true

    @AppStorage("categoryPaletteMigrationV2", store: AppIdentifiers.sharedDefaults) var categoryPaletteMigration: Bool = true

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier

    @State var showIntro: Bool = false

    var center = UNUserNotificationCenter.current()

    @AppStorage("topEdge", store: AppIdentifiers.sharedDefaults) var savedTopEdge: Double = 30
    @AppStorage("bottomEdge", store: AppIdentifiers.sharedDefaults) var savedBottomEdge: Double = 15

    var body: some View {
        GeometryReader { proxy in
            let topEdge = proxy.safeAreaInsets.top
            let bottomEdge = proxy.safeAreaInsets.bottom

            HomeView(topEdge: topEdge, bottomEdge: bottomEdge == 0 ? 15 : bottomEdge)
                .ignoresSafeArea(.all, edges: .bottom)
                .preferredColorScheme(colorScheme == 1 ? .light : colorScheme == 2 ? .dark : nil)
                .fullScreenCover(isPresented: $showIntro) {
                    WelcomeSheetView()
                }
                .onAppear {
                    savedTopEdge = topEdge
                    savedBottomEdge = bottomEdge
                }
        }
        .ignoresSafeArea(.keyboard)
        .onAppear {
//            WidgetCenter.shared.reloadTimelines(ofKind: "TemplateTransactions")

            if appLockVM.isAppLockEnabled {
                Task { await appLockVM.appLockValidation() }
            }

            let defaults =
                AppIdentifiers.sharedDefaults ?? UserDefaults.standard

            if defaults.object(forKey: "firstDayOfMonth") == nil {
                defaults.set(1, forKey: "firstDayOfMonth")
            }

            if firstLaunch {
                showIntro = true
                firstLaunch = false

                defaults.set(1, forKey: "firstWeekday")
                defaults.set(1, forKey: "haptics")
                defaults.set(1, forKey: "firstDayOfMonth")
                defaults.set(1, forKey: "notificationOption")
                defaults.set(false, forKey: "confetti")
                defaults.set(false, forKey: "chromatic")
                defaults.set(true, forKey: "showCents")
                defaults.set(true, forKey: "animated")

                if NSUbiquitousKeyValueStore.default.string(forKey: "currency") == nil {
                    NSUbiquitousKeyValueStore.default.set(Locale.current.currency!.identifier, forKey: "currency")
                } else {
                    currency = NSUbiquitousKeyValueStore.default.string(forKey: "currency")!
                }

                defaults.set(2, forKey: "numberEntryType")
            } else {
                if let holdingCurrency = NSUbiquitousKeyValueStore.default.string(forKey: "currency") {
                    currency = holdingCurrency
                } else {
                    currency = Locale.current.currency!.identifier
                    NSUbiquitousKeyValueStore.default.set(Locale.current.currency!.identifier, forKey: "currency")
                }
            }

            if dataMigration1 {
                let categoryFetch = dataController.categories.fetchRequestForCategoriesMigration(income: false)
                let categories = dataController.results(for: categoryFetch)

                categories.forEach { category in
                    category.order = Int64(categories.firstIndex(of: category) ?? 0)
                }

                try? dataController.save()

                dataMigration1 = false
            }

            if dataMigration2 {
                let categoryFetch = dataController.categories.fetchRequestForCategoriesMigration()
                let categories = dataController.results(for: categoryFetch)

                categories.forEach { category in
                    if category.income {
                        category.color = "#76FBB1"
                    } else {
                        if Double(category.wrappedColor) != nil {
                            category.color = Color.colorMigrationDictionary[category.wrappedColor] ?? "#FFFFFF"
                        }
                    }
                }

                try? dataController.save()

                dataMigration2 = false
            }

            if categoryPaletteMigration {
                let categoryFetch = dataController.categories.fetchRequestForCategoriesMigration()
                let categories = dataController.results(for: categoryFetch)

                categories.forEach { category in
                    if let match = SuggestedCategory.match(name: category.wrappedName, income: category.income) {
                        category.color = match.color
                    }
                }

                try? dataController.save()

                categoryPaletteMigration = false
            }

            center.getNotificationSettings { settings in
                if settings.authorizationStatus == .authorized {
                    if !showNotifications && notificationsEnabled == false {
                        showNotifications = true
                        notificationsEnabled = true
                        newNotification()
                    }
                } else if settings.authorizationStatus == .denied {
                    notificationsEnabled = false

                    if showNotifications {
                        showNotifications = false
                        center.removeAllPendingNotificationRequests()
                    }
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background || newPhase == .inactive {
                if appLockVM.isAppLockEnabled {
                    appLockVM.isAppUnLocked = false
                }
            } else if newPhase == .active {
                center.getNotificationSettings { settings in
                    if settings.authorizationStatus == .authorized {
                        if !showNotifications && notificationsEnabled == false {
                            showNotifications = true
                            notificationsEnabled = true
                            newNotification()
                        }
                    } else if settings.authorizationStatus == .denied {
                        notificationsEnabled = false

                        if showNotifications {
                            showNotifications = false
                            center.removeAllPendingNotificationRequests()
                        }
                    }
                }
            }
        }
    }
}
