//
//  OutlayrApp.swift
//  Outlayr
//
//  Created by Rafael Soh on 11/7/22.
//

import SwiftUI

@main
struct OutlayrApp: App {
    @State var dataController: DataController
    @State var appLockVM = AppLockViewModel()
    @State var tabBarManager = TabBarManager()

    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            if dataController.storeState == .appGroupUnavailable {
                DataStoreUnavailableView()
            } else {
                ContentView()
                    .environment(\.managedObjectContext, dataController.container.viewContext)
                    .environment(appLockVM)
                    .environment(dataController)
                    .environment(tabBarManager)
            }
        }
    }

    init() {
        _dataController = State(wrappedValue: DataController())
        UITableView.appearance().backgroundColor = .clear
    }
}
