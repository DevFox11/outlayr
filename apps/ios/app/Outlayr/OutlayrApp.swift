//
//  OutlayrApp.swift
//  Outlayr
//
//  Created by Rafael Soh on 11/7/22.
//

import SwiftUI

@main
struct OutlayrApp: App {
    @StateObject var dataController: DataController
    @StateObject var appLockVM = AppLockViewModel()
    @StateObject var tabBarManager = TabBarManager()

    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            if dataController.storeState == .appGroupUnavailable {
                DataStoreUnavailableView()
            } else {
                ContentView()
                    .environment(\.managedObjectContext, dataController.container.viewContext)
                    .environmentObject(appLockVM)
                    .environmentObject(dataController)
                    .environmentObject(tabBarManager)
            }
        }
    }

    init() {
        let dataController = DataController.shared
//        let dataController = DataController()

        _dataController = StateObject(wrappedValue: dataController)

        UITableView.appearance().backgroundColor = .clear
    }
}

/// Blocking, full-screen error shown when the shared app-group store could not be
/// opened. The app refuses to run against a private, non-shared fallback store
/// rather than silently splitting its data from the widgets and extensions.
struct DataStoreUnavailableView: View {
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "externaldrive.badge.xmark")
                .font(.system(size: 46, weight: .semibold))
                .foregroundColor(.secondary)

            Text("Storage Unavailable")
                .font(.system(size: 20, weight: .bold, design: .rounded))

            Text("The shared app group container could not be opened, so your data can't be loaded safely. Please relaunch the app. If the problem continues, contact support.")
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
