//
//  InsightsView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import Foundation
import Popovers
import CoreData
import SwiftUI

struct InsightsView: View {
    @FetchRequest(sortDescriptors: []) private var transactions: FetchedResults<Transaction>

    @State private var showTimeMenu = false
    @AppStorage(DefaultsKey.chartTimeFrame, store: AppIdentifiers.sharedDefaults) var chartType = 1

    @State private var refreshID = UUID()

    var chartTypeString: String {
        if chartType == 1 {
            return "week"
        } else if chartType == 2 {
            return "month"
        } else if chartType == 3 {
            return "year"
        } else {
            return ""
        }
    }

//    @State private var holdingIncome = false
//    @Namespace var animation

    var body: some View {
        if transactions.isEmpty {
            VStack(spacing: 5) {
                Image("chart")
                    .resizable()
                    .frame(width: 75, height: 75)
                    .padding(.bottom, 20)

                Text("Analyse Your Expenditure")
                    .font(.system(.title2, design: .rounded).weight(.medium))
//                    .font(.system(size: 23.5, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.PrimaryText.opacity(0.8))
                    .multilineTextAlignment(.center)

                Text("As transactions start piling up")
                    .font(.system(.body, design: .rounded).weight(.medium))
//                    .font(.system(size: 18, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 30)
            .frame(height: 250, alignment: .top)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea(.all)
            .background(Color.PrimaryBackground)
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)

        } else {
            VStack(spacing: 5) {
                HStack {
                    Text("Insights")
                        .font(.system(.title, design: .rounded).weight(.semibold))
                        .accessibility(addTraits: .isHeader)
                    Spacer()

                    Button {
                        showTimeMenu = true
                    } label: {
                        HStack(spacing: 4.5) {
                            Text(chartTypeString)
                                .font(.system(.body, design: .rounded).weight(.medium))

                            Image(systemName: "chevron.up.chevron.down")
                                .font(.system(.caption, design: .rounded).weight(.medium))
                        }
                        .padding(3)
                        .padding(.horizontal, 6)
                        .foregroundStyle(Color.PrimaryText.opacity(0.9))
                        .background(Color.Outline, in: RoundedRectangle(cornerRadius: 6))
                    }
                    .popover(present: $showTimeMenu, attributes: {
                        $0.position = .absolute(
                            originAnchor: .bottomRight,
                            popoverAnchor: .topRight
                        )
                        $0.rubberBandingMode = .none
                        $0.sourceFrameInset = UIEdgeInsets(top: 0, left: 0, bottom: -10, right: 0)
                        $0.presentation.animation = .easeInOut(duration: 0.2)
                        $0.dismissal.animation = .easeInOut(duration: 0.3)
                    }) {
                        ChartTimePickerView(showMenu: $showTimeMenu)
                    }
                }
                .padding(.horizontal, 30)
                .padding(.top, 20)
                .padding(.bottom, 20)

                if chartType == 1 {
                    PagedGraphView(unit: .week)
                        .id(refreshID)
                } else if chartType == 2 {
                    PagedGraphView(unit: .month)
                        .id(refreshID)
                } else if chartType == 3 {
                    PagedGraphView(unit: .year)
                        .id(refreshID)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.PrimaryBackground)
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .task {
                for await _ in NotificationCenter.default.notifications(named: .NSManagedObjectContextDidSave) {
                    guard !Task.isCancelled else { return }
                    refreshID = UUID()
                }
            }
        }
    }
}
