//
//  SettingsEraseView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsEraseView: View {
  @Environment(\.presentationMode) var presentationMode: Binding<PresentationMode>

  @State var showAlert = false

  var body: some View {
    List {
      Section {
        Button(role: .destructive) {
          showAlert = true
        } label: {
          Text("Permanently Delete Everythin'")
        }
      } footer: {
        Text(
          "This action would delete all existing transactions, categories, and budgets, and cannot be undone."
        )
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle("Erase Data")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    .fullScreenCover(isPresented: $showAlert) {
      DeleteAllAlert()
    }
  }
}
