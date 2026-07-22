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

    var numPadNumbers = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

    @State private var haptics = HapticTapper()

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: proxy.size.height * 0.04) {
                ForEach(numPadNumbers, id: \.self) { array in
                    HStack(spacing: proxy.size.width * 0.05) {
                        ForEach(array, id: \.self) { singleNumber in
                            NumberButton(number: singleNumber, size: proxy.size)
                        }
                    }
                }
                HStack(spacing: proxy.size.width * 0.05) {
                    if numberEntryType == 1 {
                        Button {
                            deleteLastDigit()
                        } label: {
                            Image("tag-cross")
                                .resizable()
                                .frame(width: 32, height: 32)
                                .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
                                .background(Color.DarkBackground)
                                .foregroundStyle(Color.LightIcon)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(NumPadButton())
                        .accessibilityLabel("Delete")
                    } else {
                        Button {
                            isEditingDecimal = true
                        } label: {
                            Text(".")
                                .scaledFont(34, weight: .regular, design: .rounded)
                                .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
                                .background(Color.SecondaryBackground)
                                .foregroundStyle(Color.PrimaryText)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(NumPadButton())
                    }

                    NumberButton(number: 0, size: proxy.size)

                    Button {
                        submit()
                    } label: {
                        Group {
                            if #available(iOS 17.0, *) {
                                Image(systemName: "checkmark.square.fill")
                                    .scaledFont(30, weight: .medium, design: .rounded)
                                    .symbolEffect(.bounce.up.byLayer, value: price != 0 && category != nil)
                            } else {
                                Image(systemName: "checkmark.square.fill")
                                    .scaledFont(30, weight: .medium, design: .rounded)
                            }
                        }
                        .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
                        .foregroundStyle(Color.LightIcon)
                        .background(Color.DarkBackground, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(NumPadButton())
                    .accessibilityLabel("Submit")
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .padding(.bottom, 15)
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

    @ViewBuilder
    private func NumberButton(number: Int, size: CGSize) -> some View {
        var disabled: Bool {
            price >= 100000000
        }

        Button {
            if disabled {
                return
            }

            if hapticType == HapticSetting.excessive.rawValue {
                haptics.tap()
            }

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
        } label: {
            Text("\(number)")
                .scaledFont(34, weight: .regular, design: .rounded)
                .frame(width: size.width * 0.3, height: size.height * 0.22)
                .background(Color.SecondaryBackground)
                .foregroundStyle(Color.PrimaryText)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .opacity(disabled ? 0.6 : 1)
        }
        .disabled(disabled)
        .buttonStyle(NumPadButton())
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
