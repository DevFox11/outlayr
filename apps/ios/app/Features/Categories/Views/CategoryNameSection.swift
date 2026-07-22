//
//  CategoryAlerts.swift
//  Outlayr
//

import SwiftUI

struct CategoryNameSection: View {
    @Binding var name: String
    var typeSelection: Binding<Bool>?
    let placeholder: LocalizedStringKey
    let caption: Text?
    var focusedField: FocusState<CategoryField?>.Binding
    let onSubmit: () -> Void

    var body: some View {
        Section {
            HStack {
                Text("Name")
                    .foregroundStyle(.secondary)
                Spacer()
                TextField(placeholder, text: $name)
                    .multilineTextAlignment(.trailing)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .focused(focusedField, equals: .name)
                    .onSubmit(onSubmit)
            }

            if let typeSelection {
                HStack {
                    Text("Type")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Picker("Type", selection: typeSelection) {
                        Text("Expense").tag(false)
                        Text("Income").tag(true)
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .tint(.primary)
                }
            }
        } footer: {
            if let caption {
                caption
            }
        }
    }
}
