//
//  TimePickerView.swift
//  Outlayr

import Foundation
import SwiftUI

struct TimePickerView: View {
    @Namespace var animation

    let timeframes = ["today", "this week", "this month", "this year", "all time"]

    @Binding var showMenu: Bool
    @Binding var timeframe: Int
    @State var holdingTimeframe = 0
    @State private var menuTask: Task<Void, Never>?

    @AppStorage(DefaultsKey.colorScheme, store: AppIdentifiers.sharedDefaults) var colorScheme: Int = 0

    @Environment(\.colorScheme) var systemColorScheme

    var darkMode: Bool {
        (colorScheme == 0 && systemColorScheme == .dark) || colorScheme == 2
    }

    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(Array(timeframes.enumerated()), id: \.element) { index, timeframe in
                Button {
                    if holdingTimeframe == index + 1 {
                        showMenu = false
                    } else {
                        withAnimation(.easeIn(duration: 0.15)) {
                            holdingTimeframe = index + 1
                        }

                        self.timeframe = index + 1

                        menuTask = Task {
                            try? await Task.sleep(for: .seconds(0.4))
                            showMenu = false
                        }
                    }
                } label: {
                    HStack {
                        Text(LocalizedStringKey(timeframe))
                            .font(.system(.body, design: .rounded).weight(.medium))
                            .dynamicTypeSize(...DynamicTypeSize.xxLarge)

                        Spacer()

                        if holdingTimeframe == index + 1 {
                            Image(systemName: "checkmark")
                                .font(.system(.footnote, design: .rounded).weight(.medium))
                                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(5)
                    .background {
                        if holdingTimeframe == index + 1 {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(darkMode ? Color("AlwaysDarkSecondaryBackground") : Color("AlwaysLightSecondaryBackground"))
                                .matchedGeometryEffect(id: "TAB", in: animation)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(holdingTimeframe == index + 1 ? .isSelected : [])
            }
        }
        .foregroundStyle(darkMode ? Color("AlwaysLightBackground") : Color("AlwaysDarkBackground"))
        .padding(4)
        .frame(width: dynamicTypeSize > .xxLarge ? 185 : 160)
        .background(RoundedRectangle(cornerRadius: 9).fill(darkMode ? Color("AlwaysDarkBackground") : Color("AlwaysLightBackground")).shadow(color: darkMode ? Color.clear : Color.gray.opacity(0.25), radius: 6))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(darkMode ? Color.gray.opacity(0.1) : Color.clear, lineWidth: 1.3))
        .onAppear {
            holdingTimeframe = timeframe
        }
    }
}
