//
//  SettingsFeatureLabView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsFeatureLabView: View {
  @AppStorage("confetti", store: AppIdentifiers.sharedDefaults) var confetti:
    Bool = false

  @AppStorage("logViewLineGraph", store: AppIdentifiers.sharedDefaults)
  var lineGraph: Bool = false

  @AppStorage("budgetViewStyle", store: AppIdentifiers.sharedDefaults)
  var budgetRows: Bool = false

  @AppStorage("swapTimeLabel", store: AppIdentifiers.sharedDefaults)
  var swapTimeLabel: Bool = false

  @AppStorage(
    "showTransactionRecommendations", store: AppIdentifiers.sharedDefaults)
  var showRecommendations: Bool = false

  var body: some View {
    List {
      Section {
        Toggle("Celebrate Expenses", isOn: $confetti)
          .foregroundStyle(Color.PrimaryText)

        Toggle("Show Line Graph", isOn: $lineGraph)
          .foregroundStyle(Color.PrimaryText)

        Toggle("Budget Rows", isOn: $budgetRows)
          .foregroundStyle(Color.PrimaryText)
      } footer: {
        Text("Experimental features - proceed with caution.")
      }

      Section {
        Toggle("Replace Time Label", isOn: $swapTimeLabel)
          .foregroundStyle(Color.PrimaryText)
      } footer: {
        Text(
          "Swaps the time label of each transaction with its category name. However, if you do not manually input a note for each transaction - in which case the note is the category name by default - duplicate text will appear."
        )
      }

      Section {
        Toggle("Show Note Suggestions", isOn: $showRecommendations)
          .foregroundStyle(Color.PrimaryText)
      } footer: {
        Text(
          "Displays transaction suggestions whilst you type in the 'Note' field of the new transaction page."
        )
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle("Feature Lab")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }
}
