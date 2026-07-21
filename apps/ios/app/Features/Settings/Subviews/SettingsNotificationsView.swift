//
//  SettingsNotificationsView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsNotificationsView: View {
  @AppStorage(DefaultsKey.showNotifications, store: AppIdentifiers.sharedDefaults)
  var showNotifications: Bool = false
  @AppStorage(DefaultsKey.notificationsEnabled, store: AppIdentifiers.sharedDefaults)
  var notificationsEnabled: Bool = true
  @State var option = 1
  @State var customTime = Date.now

  var center = UNUserNotificationCenter.current()

  private var notificationsBinding: Binding<Bool> {
    Binding(get: { showNotifications }, set: { setNotifications(enabled: $0) })
  }

  var body: some View {
    List {
      Section {
        Toggle("Enable Notifications", isOn: notificationsBinding)
          .foregroundStyle(Color.PrimaryText)
      }

      if showNotifications {
        Section {
          optionRow("Every morning (8:00 AM)", tag: 1)
          optionRow("Every evening (8:00 PM)", tag: 2)

          HStack {
            Text("Custom Time")
              .foregroundStyle(Color.PrimaryText)

            Spacer()

            if option == 3 {
              DatePicker(
                "Custom notification time", selection: $customTime,
                displayedComponents: .hourAndMinute
              )
              .labelsHidden()
            }
          }
          .contentShape(Rectangle())
          .onTapGesture {
            option = 3
          }
        }
        .onChange(of: option) { _, newValue in
          AppIdentifiers.defaults.set(option, forKey: DefaultsKey.notificationOption)

          if newValue == 3 {
            let components = Calendar.current.dateComponents([.hour, .minute], from: customTime)
            AppIdentifiers.defaults.set(components.hour!, forKey: DefaultsKey.customHour)
            AppIdentifiers.defaults.set(components.minute!, forKey: DefaultsKey.customMinute)
          }

          newNotification()
        }
        .onChange(of: customTime) { _, _ in
          let components = Calendar.current.dateComponents([.hour, .minute], from: customTime)
          AppIdentifiers.defaults.set(components.hour!, forKey: DefaultsKey.customHour)
          AppIdentifiers.defaults.set(components.minute!, forKey: DefaultsKey.customMinute)

          newNotification()
        }
        .onAppear {
          if AppIdentifiers.defaults.object(forKey: DefaultsKey.notificationOption) != nil {
            option = AppIdentifiers.defaults.integer(forKey: DefaultsKey.notificationOption)
          }

          if AppIdentifiers.defaults.object(forKey: DefaultsKey.customHour) != nil
            && AppIdentifiers.defaults.object(forKey: DefaultsKey.customMinute) != nil {
            var components = DateComponents()
            components.hour = AppIdentifiers.defaults.integer(forKey: DefaultsKey.customHour)
            components.minute = AppIdentifiers.defaults.integer(forKey: DefaultsKey.customMinute)
            customTime = Calendar.current.date(from: components)!
          }
        }
      }
    }
    .navigationTitle("Notifications")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }

  @ViewBuilder
  private func optionRow(_ title: LocalizedStringKey, tag: Int) -> some View {
    HStack {
      Text(title)
        .foregroundStyle(Color.PrimaryText)

      Spacer()

      if option == tag {
        Image(systemName: "checkmark")
          .font(.body.weight(.semibold))
          .foregroundStyle(.tint)
      }
    }
    .contentShape(Rectangle())
    .onTapGesture {
      option = tag
    }
  }

  private func setNotifications(enabled: Bool) {
    if !enabled {
      center.removeAllPendingNotificationRequests()
      showNotifications = false
      return
    }

    center.getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .notDetermined:
        center.requestAuthorization(options: [.alert, .badge, .sound]) { success, error in
          if success {
            DispatchQueue.main.async {
              showNotifications = true
              newNotification()
            }
          } else if let error {
            print(error.localizedDescription)
            DispatchQueue.main.async { notificationsEnabled = false }
          }
        }
      case .denied:
        DispatchQueue.main.async {
          notificationsEnabled = false
          if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsURL)
          }
        }
      default:
        DispatchQueue.main.async {
          showNotifications = true
          newNotification()
        }
      }
    }
  }
}

func newNotification() {
  UNUserNotificationCenter.current().removeAllPendingNotificationRequests()

  let content = UNMutableNotificationContent()
  content.title = String(localized: "Keep the streak going!")
  content.subtitle = String(localized: "Remember to input your expenses today.")
  content.sound = UNNotificationSound.default

  // show this notification five seconds from now
  var components = DateComponents()
  var option = 1

  if AppIdentifiers.defaults.object(forKey: DefaultsKey.notificationOption) != nil {
    option = AppIdentifiers.defaults.integer(forKey: DefaultsKey.notificationOption)
  }

  if option == 1 {
    components.hour = 8
    components.minute = 0
  } else if option == 2 {
    components.hour = 20
    components.minute = 0
  } else {
    if AppIdentifiers.defaults.object(forKey: DefaultsKey.customHour) != nil,
      AppIdentifiers.defaults.object(forKey: DefaultsKey.customMinute) != nil {
      components.hour = AppIdentifiers.defaults.integer(forKey: DefaultsKey.customHour)
      components.minute = AppIdentifiers.defaults.integer(forKey: DefaultsKey.customMinute)
    } else {
      components.hour = 8
      components.minute = 0
    }
  }

  let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)

  // choose a random identifier
  let request = UNNotificationRequest(
    identifier: UUID().uuidString, content: content, trigger: trigger)

  // add our notification request
  UNUserNotificationCenter.current().add(request)
}
