//
//  SettingsView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import ConfettiSwiftUI
import Foundation
import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI
import UserNotifications
import WidgetKit

struct SettingsView: View {
  @AppStorage("colourScheme", store: AppIdentifiers.sharedDefaults)
  var colourScheme: Int = 0

  @AppStorage("activeIcon", store: AppIdentifiers.sharedDefaults)
  var activeIcon: String = "AppIcon"
  var appIconString: String {
    switch activeIcon {
    case "AppIcon1": return "Ink"
    case "AppIcon2": return "Hairline"
    case "AppIcon3": return "Mono"
    case "AppIcon4": return "Emboss"
    default: return "Default"
    }
  }

  @AppStorage("firstWeekday", store: AppIdentifiers.sharedDefaults)
  var firstWeekday: Int = 1
  var firstWeekdayString: String {
    if firstWeekday == 1 {
      return String(localized: "Sunday")
    } else {
      return String(localized: "Monday")
    }
  }

  @AppStorage("showNotifications", store: AppIdentifiers.sharedDefaults)
  var showNotifications: Bool = false
  @AppStorage("notificationOption", store: AppIdentifiers.sharedDefaults)
  var option: Int = 1
  var notificationString: String {
    if showNotifications {
      if option == 1 {
        return String(localized: "Mornings")
      } else if option == 2 {
        return String(localized: "Evenings")
      } else {
        return String(localized: "Custom")
      }
    } else {
      return String(localized: "Off")
    }
  }

  @Environment(AppLockViewModel.self) private var appLockVM

  var iCloudString: String {
    if NSUbiquitousKeyValueStore.default.bool(forKey: "icloud_sync") {
      return String(localized: "On")
    } else {
      return String(localized: "Off")
    }
  }

  @Environment(\.openURL) var openURL
  let supportEmail = SupportEmail(toAddress: "support@tryoutlayr.com", subject: "Support Email")
  let featureRequestEmail = SupportEmail(
    toAddress: "support@tryoutlayr.com", subject: "Feature Request")

  @AppStorage("numberEntryType", store: AppIdentifiers.sharedDefaults)
  var numberEntryType: Int = 2

  var numberEntryString: String {
    if numberEntryType == 1 {
      return String(localized: "Type 1")
    } else {
      return String(localized: "Type 2")
    }
  }

  @AppStorage("showCents", store: AppIdentifiers.sharedDefaults)
  var showCents: Bool = true

  @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated:
    Bool = true

  @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency:
    String = Locale.current.currency!.identifier

  @AppStorage("incomeTracking", store: AppIdentifiers.sharedDefaults)
  var incomeTracking: Bool = true

  @AppStorage("showExpenseOrIncomeSign", store: AppIdentifiers.sharedDefaults)
  var showExpenseOrIncomeSign: Bool = true

  @AppStorage(
    "showUpcomingTransactions", store: AppIdentifiers.sharedDefaults)
  var showUpcoming: Bool = true

  var upcomingString: String {
    if showUpcoming {
      return String(localized: "Shown")
    } else {
      return String(localized: "Hidden")
    }
  }

  @AppStorage("haptics", store: AppIdentifiers.sharedDefaults)
  var hapticType: Int = 1

  @State var showImportGuide = false

  @Environment(TabBarManager.self) private var tabBarManager

  @Environment(DataController.self) private var dataController

  private var authenticationBinding: Binding<Bool> {
    Binding(
      get: { appLockVM.isAppLockEnabled },
      set: { newValue in
        Task { await appLockVM.appLockStateChange(appLockState: newValue) }
      })
  }

  var body: some View {
    NavigationStack {
      List {
        Section {
          NavigationLink(destination: SettingsNotificationsView()) {
            SettingsRow(
              icon: "notification-03", colour: 102, title: "Notifications",
              value: notificationString)
          }

          NavigationLink(destination: SettingsCurrencyView()) {
            SettingsRow(
              icon: "dollar-circle", colour: 103, title: "Currency",
              value: currency)
          }

          NavigationLink(
            destination: SettingsNumberEntryView()
              .onAppear {
                withAnimation(.easeOut.speed(1.5)) {
                  tabBarManager.navigationHideTab()
                }
              }
              .onDisappear {
                withAnimation(.easeOut.speed(1.5)) {
                  tabBarManager.navigationShowTab()
                }
              }
          ) {
            SettingsRow(
              icon: "keyboard", colour: 104, title: "Number Entry",
              value: numberEntryString)
          }

          Toggle(isOn: authenticationBinding) {
            SettingsRow(icon: "biometric-access", colour: 105, title: "Authentication")
          }

          Toggle(isOn: $incomeTracking) {
            SettingsRow(icon: "money-receive-01", colour: 106, title: "Income Tracking")
          }
          .onChange(of: incomeTracking) { _, newValue in
            if !newValue {
              AppIdentifiers.sharedDefaults!.set(false, forKey: "insightsViewIncomeFiltering")
              AppIdentifiers.sharedDefaults!.set(3, forKey: "logInsightsType")
            }
          }

          NavigationLink(destination: SettingsWeekStartView()) {
            SettingsRow(icon: "calendar-01", colour: 109, title: "Time Frames")
          }
        }

        Section {
          Picker(selection: $colourScheme) {
            Text("System").tag(0)
            Text("Light").tag(1)
            Text("Dark").tag(2)
          } label: {
            SettingsRow(icon: "dark-mode", colour: 100, title: "Theme")
          }
          .pickerStyle(.menu)
          .tint(.secondary)

          NavigationLink(destination: SettingsAppIconView()) {
            SettingsRow(
              icon: "mobile-programming-01", colour: 101, title: "App Icon",
              value: appIconString)
          }

          Toggle(isOn: $showCents) {
            SettingsRow(icon: "coins-01", colour: 107, title: "Display Cents")
          }

          NavigationLink(destination: SettingsUpcomingView()) {
            SettingsRow(
              icon: "sunrise", colour: 108, title: "Upcoming Logs",
              value: upcomingString)
          }

          Toggle(isOn: $showExpenseOrIncomeSign) {
            SettingsRow(icon: "plus-minus", colour: 123, title: "Display +/- Symbol")
          }

          Toggle(isOn: $animated) {
            SettingsRow(icon: "analytics-01", colour: 121, title: "Animated Charts")
          }
        }

        Section {
          NavigationLink(
            destination: SettingsCategoryView()
              .onAppear {
                withAnimation(.easeOut.speed(1.5)) {
                  tabBarManager.navigationHideTab()
                }
              }
              .onDisappear {
                withAnimation(.easeOut.speed(1.5)) {
                  tabBarManager.navigationShowTab()
                }
              }
          ) {
            SettingsRow(icon: "dashboard-square-01", colour: 110, title: "Categories")
          }

          NavigationLink(destination: SettingsCloudView()) {
            SettingsRow(
              icon: "cloud", colour: 111, title: "iCloud Sync",
              value: iCloudString)
          }

          Button {
            showImportGuide = true
          } label: {
            SettingsRow(icon: "file-import", colour: 112, title: "Import Data")
          }

          Button {
            exportData()
          } label: {
            SettingsRow(icon: "file-export", colour: 113, title: "Export Data")
          }

          NavigationLink(destination: SettingsEraseView()) {
            SettingsRow(icon: "delete-02", colour: 114, title: "Erase Data")
          }
        }

        Section {
          Picker(selection: $hapticType) {
            Text("None").tag(0)
            Text("Subtle").tag(1)
            Text("Excessive").tag(2)
          } label: {
            SettingsRow(icon: "tap-01", colour: 100, title: "Haptics")
          }
          .pickerStyle(.menu)
          .tint(.secondary)
          .onChange(of: hapticType) { _, newValue in
            if newValue == 2 {
              UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            } else if newValue == 1 {
              UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
          }

          NavigationLink(destination: SettingsGoofyView()) {
            SettingsRow(icon: "test-tube", colour: 122, title: "Feature Lab")
          }

          Button {
            supportEmail.send(openURL: openURL)
          } label: {
            SettingsRow(icon: "bug-01", colour: 124, title: "Report Bug")
          }

          Button {
            featureRequestEmail.send(openURL: openURL)
          } label: {
            SettingsRow(icon: "idea-01", colour: 125, title: "Feature Request")
          }

          Button {
            let url = "https://tryoutlayr.com"
            guard let writeReviewURL = URL(string: url)
            else { fatalError("Expected a valid URL") }
            UIApplication.shared.open(writeReviewURL, options: [:], completionHandler: nil)
          } label: {
            SettingsRow(icon: "star", colour: 126, title: "Rate on App Store")
          }

          Button {
            shareSheet(url: "https://tryoutlayr.com")
          } label: {
            SettingsRow(icon: "share-08", colour: 127, title: "Share with Friends")
          }

          Button {
            if let url = URL(string: "https://x.com/tryoutlayr") {
              UIApplication.shared.open(url)
            }
          } label: {
            SettingsRow(icon: "new-twitter", colour: 128, title: "Follow Outlayr on X")
          }

          NavigationLink(destination: SettingsAboutView()) {
            SettingsRow(icon: "information-circle", colour: 130, title: "About & Credits")
          }
        } footer: {
          Text("Version \(UIApplication.appVersion ?? "") (\(UIApplication.buildNumber ?? ""))")
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, 8)
        }
      }
      .listStyle(.insetGrouped)
      .navigationTitle("Settings")
      .contentMargins(.bottom, 90, for: .scrollContent)
      .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
      .onChange(of: currency) { _, _ in
        WidgetCenter.shared.reloadAllTimelines()
      }
      .onChange(of: firstWeekday) { _, _ in
        WidgetCenter.shared.reloadAllTimelines()
      }
      .onChange(of: showCents) { _, _ in
        WidgetCenter.shared.reloadAllTimelines()
      }
      .fullScreenCover(isPresented: $showImportGuide) {
        ImportDataView()
      }
    }
  }

  func shareSheet(url: String) {
    let url = URL(string: url)
    let activityView = UIActivityViewController(activityItems: [url!], applicationActivities: nil)

    let allScenes = UIApplication.shared.connectedScenes
    let scene = allScenes.first { $0.activationState == .foregroundActive }

    if let windowScene = scene as? UIWindowScene {
      windowScene.keyWindow?.rootViewController?.present(
        activityView, animated: true, completion: nil)
    }
  }

  func exportData() {
    let fetchRequest = dataController.fetchRequestForExport()
    let transactions = dataController.results(for: fetchRequest)

    let fileName = "export.csv"
    let path = NSURL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(fileName)
    let csvText = TransactionCSV.export(transactions)

    do {
      try csvText.write(to: path!, atomically: true, encoding: String.Encoding.utf8)
    } catch {
      print("\(error)")
    }

    var filesToShare = [Any]()
    filesToShare.append(path!)

    let av = UIActivityViewController(activityItems: filesToShare, applicationActivities: nil)

    let allScenes = UIApplication.shared.connectedScenes
    let scene = allScenes.first { $0.activationState == .foregroundActive }

    if let windowScene = scene as? UIWindowScene {
      windowScene.keyWindow?.rootViewController?.present(av, animated: true, completion: nil)
    }
  }
}

struct SettingsRow: View {
  var icon: String
  var colour: Int
  var title: String
  var value: String?

  var body: some View {
    HStack(spacing: 12) {
      HugeiconsText(icon, font: HugeiconsSolidRounded.hugeiconsFont(size: 18), color: .white)
        .frame(width: 29, height: 29)
        .background(Color("\(colour)"), in: RoundedRectangle(cornerRadius: 7, style: .continuous))

      Text(LocalizedStringKey(title))
        .foregroundStyle(Color.PrimaryText)

      if let value {
        Spacer(minLength: 8)
        Text(value)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
  }
}

struct SettingsCategoryView: View {
  var body: some View {
    CategoryView(mode: .settings, income: false)
      .background(Color.PrimaryBackground)
  }
}
