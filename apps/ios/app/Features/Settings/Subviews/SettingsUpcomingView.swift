//
//  SettingsUpcomingView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsUpcomingView: View {
  @Environment(\.dismiss) var dismiss
  @State private var showFuture: Bool = true

  @State private var showSoon: Bool = false
  @Environment(DataController.self) private var dataController

  private var showFutureBinding: Binding<Bool> {
    Binding(
      get: { showFuture },
      set: { newValue in
        showFuture = newValue
        AppIdentifiers.defaults.set(newValue, forKey: DefaultsKey.showUpcomingTransactions)

        if !newValue {
          showSoon = false
          AppIdentifiers.defaults.set(
            false, forKey: DefaultsKey.showUpcomingTransactionsWhenUpcoming)
        }
      }
    )
  }

  private var showSoonBinding: Binding<Bool> {
    Binding(
      get: { showSoon },
      set: { newValue in
        showSoon = newValue
        AppIdentifiers.defaults.set(
          newValue, forKey: DefaultsKey.showUpcomingTransactionsWhenUpcoming)
      }
    )
  }

  var body: some View {
    List {
      Section {
        Toggle("Display on Log Page", isOn: showFutureBinding)
          .foregroundStyle(Color.PrimaryText)

        Toggle("Limit to 14-Day Outlook", isOn: showSoonBinding)
          .foregroundStyle(Color.PrimaryText)
      } footer: {
        Text(
          "Don't worry, even if you do hide them there, you will always be able to find all upcoming transactions right here."
        )
      }

      Section {
        FutureListView(dataController: dataController, filterMode: false, limitedMode: false)
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle("Upcoming Logs")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    .onAppear {
      showFuture = AppIdentifiers.defaults.bool(
        forKey: DefaultsKey.showUpcomingTransactions)
      showSoon = AppIdentifiers.defaults.bool(
        forKey: DefaultsKey.showUpcomingTransactionsWhenUpcoming)
    }
  }
}
