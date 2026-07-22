//
//  FilterPickerView.swift
//  Outlayr

import Foundation
import SwiftUI

struct FilterPickerView: View {
    @Namespace var animation
    @Namespace var animation1
    @Binding var filterType: FilterType
    @Binding var showMenu: Bool
    @State private var menuTask: Task<Void, Never>?

    @AppStorage(DefaultsKey.colorScheme, store: AppIdentifiers.sharedDefaults) var colorScheme: Int = 0

    @Environment(\.colorScheme) var systemColorScheme
    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    var darkMode: Bool {
        (colorScheme == 0 && systemColorScheme == .dark) || colorScheme == 2
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(FilterType.allCases, id: \.self) { filter in
                Button {
                    if filterType == filter {
                        showMenu = false
                    } else {
                        withAnimation(.easeIn(duration: 0.15)) {
                            filterType = filter
                        }

                        menuTask = Task {
                            try? await Task.sleep(for: .seconds(0.5))
                            showMenu = false
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: FilterType.imageDictionary[filter] ?? "")
                            .font(.system(.callout, design: .rounded).weight(.regular))
                            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                            .frame(width: 20)
                        Text(LocalizedStringKey(filter.rawValue))
                            .font(.system(.body, design: .rounded).weight(.medium))
                            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                            .lineLimit(1)
                        Spacer()

                        if filterType == filter {
                            Image(systemName: "checkmark")
                                .font(.system(.footnote, design: .rounded).weight(.medium))
                                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(5)
                    .background {
                        if filterType == filter {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(darkMode ? Color("AlwaysDarkSecondaryBackground") : Color("AlwaysLightSecondaryBackground"))
                                .matchedGeometryEffect(id: "TAB", in: animation)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(filterType == filter ? .isSelected : [])
                .accessibilityLabel(LocalizedStringKey(filter.rawValue))
            }
        }
        .foregroundStyle(darkMode ? Color("AlwaysLightBackground") : Color("AlwaysDarkBackground"))
        .padding(4)
        .frame(width: dynamicTypeSize > .xLarge ? 220 : 190)
        .background(RoundedRectangle(cornerRadius: 9).fill(darkMode ? Color("AlwaysDarkBackground") : Color("AlwaysLightBackground")).shadow(color: darkMode ? Color.clear : Color.gray.opacity(0.25), radius: 6))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(darkMode ? Color.gray.opacity(0.1) : Color.clear, lineWidth: 1.3))
    }
}
