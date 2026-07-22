//
//  NumberPad.swift
//  Outlayr
//
//  Created by Yumi on 2023-10-29.
//

import SwiftUI

struct NumberPad: View {
    @Binding var price: Double
    @Binding var category: Category?
    @Binding var isEditingDecimal: Bool
    @Binding var decimalValuesAssigned: AssignedDecimal
    var showingNotePicker: Bool = false
    var submit: () -> Void

    @AppStorage(DefaultsKey.numberEntryType, store: AppIdentifiers.sharedDefaults) var numberEntryType: Int = 1
    @AppStorage(DefaultsKey.haptics, store: AppIdentifiers.sharedDefaults)
        var hapticType: Int = 1

    @State private var haptics = HapticTapper()

    var body: some View {
        NumPadGrid(
            onDigit: { number in
                guard price < 100000000 else { return }
                if hapticType == HapticSetting.excessive.rawValue { haptics.tap() }
                if numberEntryType == 1 {
                    price *= 10
                    price += Double(number) / 100
                } else {
                    if isEditingDecimal {
                        switch decimalValuesAssigned {
                        case .none:
                            price += Double(number) / 10
                            decimalValuesAssigned = .first
                        case .first:
                            price += Double(number) / 100
                            decimalValuesAssigned = .second
                        case .second:
                            return
                        }
                    } else {
                        price *= 10
                        price += Double(number)
                    }
                }
            },
            onLeftKey: {
                if numberEntryType == 1 {
                    deleteLastDigit()
                } else {
                    isEditingDecimal = true
                }
            },
            onSubmit: submit,
            leftKeyLabel: { size in
                if numberEntryType == 1 {
                    Image("tag-cross")
                        .resizable()
                        .frame(width: 32, height: 32)
                        .frame(width: size.width * 0.3, height: size.height * 0.22)
                        .background(Color.DarkBackground)
                        .foregroundStyle(Color.LightIcon)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                } else {
                    Text(".")
                        .scaledFont(34, weight: .regular, design: .rounded)
                        .frame(width: size.width * 0.3, height: size.height * 0.22)
                        .background(Color.SecondaryBackground)
                        .foregroundStyle(Color.PrimaryText)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            },
            leftKeyAccessibilityLabel: numberEntryType == 1 ? "Delete" : nil,
            digitsDisabled: price >= 100000000,
            submitBounceValue: price != 0 && category != nil
        )
        .keyboardAwareHeight(showToolbar: showingNotePicker)
        .onAppear { haptics.prepare() }
        .onDisappear { haptics.stop() }
    }

    public func deleteLastDigit() {
        if numberEntryType == 1 {
            price = Double(Int(price * 10)) / 100
        } else if !isEditingDecimal {
            price = Double(Int(price / 10))
        } else {
            switch decimalValuesAssigned {
                case .none:
                    isEditingDecimal = false
                    return
                case .first:
                    price = Double(Int(price))
                    decimalValuesAssigned = .none
                case .second:
                    price = Double(Int(price * 10)) / 10
                    decimalValuesAssigned = .first
            }
        }
    }
}

func splitDouble(_ num: Double) -> [String] {
    let formatter = NumberFormatter()
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 2
    var str = formatter.string(from: NSNumber(value: num))!

    if floor(num) == num {
        str = String(format: "%.0f", num)
    }

    return str.map { String($0) }.filter { $0 != "." }
}
