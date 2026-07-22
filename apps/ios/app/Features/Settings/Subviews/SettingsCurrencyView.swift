//
//  SettingsCurrencyView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsCurrencyView: View {
  @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults)
  var currencyCode: String = Locale.current.currency!.identifier
  @Environment(\.presentationMode) var presentationMode: Binding<PresentationMode>

  let currencies = Currency.allCurrencies

  @State private var searchText = ""

  private var filteredCurrencies: [Currency] {
    guard !searchText.isEmpty else { return currencies }
    return currencies.filter {
      $0.code.localizedCaseInsensitiveContains(searchText)
        || $0.name.localizedCaseInsensitiveContains(searchText)
    }
  }

  var body: some View {
    List {
      Section {
        ForEach(filteredCurrencies, id: \.self) { currency in
          Button {
            select(currency)
          } label: {
            HStack {
              Text(currency.code)
                .foregroundStyle(Color.SubtitleText)

              Text(currency.name)
                .foregroundStyle(Color.PrimaryText)

              Spacer()

              if currency.code == currencyCode {
                Image(systemName: "checkmark")
                  .font(.body.weight(.semibold))
                  .foregroundStyle(.tint)
              }
            }
          }
          .buttonStyle(.plain)
          .accessibilityAddTraits(currency.code == currencyCode ? .isSelected : [])
          .accessibilityLabel("\(currency.code), \(currency.name)")
        }
      }
    }
    .listStyle(.insetGrouped)
    .contentMargins(.top, 0, for: .scrollContent)
    .contentMargins(.bottom, 90, for: .scrollContent)
    .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always))
    .navigationTitle("Currencies")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }

  private func select(_ currency: Currency) {
    currencyCode = currency.code
    NSUbiquitousKeyValueStore.default.set(currency.code, forKey: "currency")

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
      self.presentationMode.wrappedValue.dismiss()
    }
  }
}
