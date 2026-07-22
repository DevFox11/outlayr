//
//  ContentView.swift
//
//  Created by Rafael Soh on 3/6/22.
//

import SwiftUI

struct ContentView: View {
    @Environment(AppLockViewModel.self) private var appLockVM
    @Environment(DataController.self) private var dataController

    @AppStorage(DefaultsKey.colorScheme, store: AppIdentifiers.sharedDefaults) var colorScheme: Int = 0
    @Environment(\.scenePhase) var scenePhase
    @AppStorage(DefaultsKey.showNotifications, store: AppIdentifiers.sharedDefaults) var showNotifications: Bool = false
    @AppStorage(DefaultsKey.notificationsEnabled, store: AppIdentifiers.sharedDefaults) var notificationsEnabled: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency?.identifier ?? "USD"

    @State var showIntro: Bool = false

    var center = UNUserNotificationCenter.current()

    @AppStorage(DefaultsKey.topEdge, store: AppIdentifiers.sharedDefaults) var savedTopEdge: Double = 30
    @AppStorage(DefaultsKey.bottomEdge, store: AppIdentifiers.sharedDefaults) var savedBottomEdge: Double = 15

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
            if appLockVM.isAppLockEnabled {
                Task { await appLockVM.appLockValidation() }
            }

            Task {
                let result = await LaunchBootstrapService(dataController: dataController).run()
                showIntro = result.showIntro
                currency = result.currency
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
