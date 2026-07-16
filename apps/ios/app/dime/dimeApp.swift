//
//  dimeApp.swift
//  dime
//
//  Created by Rafael Soh on 11/7/22.
//

import SwiftUI

@main
struct dimeApp: App {
    @StateObject var dataController: DataController
    @StateObject var appLockVM = AppLockViewModel()
    @StateObject var tabBarManager = TabBarManager()

    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, dataController.container.viewContext)
                .environmentObject(appLockVM)
                .environmentObject(dataController)
                .environmentObject(tabBarManager)
        }
    }

    init() {
        let dataController = DataController.shared
//        let dataController = DataController()

        _dataController = StateObject(wrappedValue: dataController)

        UITableView.appearance().backgroundColor = .clear
    }
}
