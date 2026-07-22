//
//  InsightsChartComponents.swift
//  Outlayr

import Foundation
import SwiftUI

struct ChartTimePickerView: View {
    @Namespace var animation
    @State var timeframe = ChartTimeFrame.week
    @Binding var showMenu: Bool

    @AppStorage(DefaultsKey.colorScheme, store: AppIdentifiers.sharedDefaults) var colorScheme: Int = 0

    @AppStorage(DefaultsKey.chartTimeFrame, store: AppIdentifiers.sharedDefaults) var chartType = 1

    @Environment(\.colorScheme) var systemColorScheme

    var darkMode: Bool {
        (colorScheme == 0 && systemColorScheme == .dark) || colorScheme == 2
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(ChartTimeFrame.allCases, id: \.self) { time in
                HStack {
                    Text(LocalizedStringKey(time.rawValue))
                    Spacer()

                    if time == timeframe {
                        Image(systemName: "checkmark")
                            .scaledFont(14, weight: .medium)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .scaledFont(18, weight: .medium, design: .rounded)
                .padding(5)
                .background {
                    if time == timeframe {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(darkMode ? Color("AlwaysDarkSecondaryBackground") : Color("AlwaysLightSecondaryBackground"))
                            .matchedGeometryEffect(id: "TAB", in: animation)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    if timeframe == time {
                        showMenu = false
                    } else {
                        withAnimation(.easeIn(duration: 0.15)) {
                            timeframe = time
                        }

                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                            showMenu = false
                        }
                    }
                }
            }
        }
        .foregroundStyle(darkMode ? Color("AlwaysLightBackground") : Color("AlwaysDarkBackground"))
        .padding(4)
        .frame(width: 120)
        .background(RoundedRectangle(cornerRadius: 9).fill(darkMode ? Color("AlwaysDarkBackground") : Color("AlwaysLightBackground")).shadow(color: darkMode ? Color.clear : Color.gray.opacity(0.25), radius: 6))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(darkMode ? Color.gray.opacity(0.1) : Color.clear, lineWidth: 1.3))
        .onChange(of: timeframe) { _, _ in
            if timeframe == .week {
                chartType = 1
            } else if timeframe == .month {
                chartType = 2
            } else if timeframe == .year {
                chartType = 3
            }
        }
        .onAppear {
            if chartType == 1 {
                timeframe = ChartTimeFrame.week
            } else if chartType == 2 {
                timeframe = ChartTimeFrame.month
            } else if chartType == 3 {
                timeframe = ChartTimeFrame.year
            }
        }
    }
}
