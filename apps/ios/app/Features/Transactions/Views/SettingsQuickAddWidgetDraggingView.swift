//
//  SettingsQuickAddWidgetDraggingView.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import CoreData
import SwiftUI
import WidgetKit

struct SettingsQuickAddWidgetDraggingView: View {
    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier

    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @State private var gridData = GridViewModel()
    @State var selectedItem: Grid?
    @State var lastSelectedIndex: Int = 0

    @State var refreshID = UUID()

    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.order)
    ]) private var transactions: FetchedResults<TemplateTransaction>

    let columns = Array(repeating: GridItem(.fixed(100), spacing: 15), count: 2)

    var body: some View {
        ZStack {
            LazyVGrid(columns: columns, spacing: 15, content: {
                ForEach(0 ..< 4) { index in

                    Image(systemName: "plus")
                        .font(.system(size: 25, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(RoundedRectangle(cornerRadius: 15).fill(Color.SecondaryBackground).shadow(color: gridData.gridItems[index].transaction == nil ? Color.gray.opacity(0.25) : Color.clear, radius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 15).stroke(Color.Outline, lineWidth: 1.3))
                        .frame(height: 100)
                }
            })

            LazyVGrid(columns: columns, spacing: 15, content: {
                ForEach(gridData.gridItems) { grid in

                    Group {
                        if let transaction = grid.transaction {
                            if grid.id == gridData.currentGrid?.id && gridData.dragging {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 15)
                                        .fill(blend(over: Color(hex: transaction.wrappedColor), withAlpha: 0.7))

                                    RoundedRectangle(cornerRadius: 15)
                                        .strokeBorder(Color.DarkIcon, lineWidth: 2)
                                }
                            } else {
                                SingleTemplateButton(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol)
                            }
                        } else {
                            Rectangle()
                                .fill(Color.clear)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .contentShape(Rectangle())
                        }
                    }
                    .frame(height: 100)
                    .transition(.opacity)
                    .contentShape(.dragPreview, RoundedRectangle(cornerRadius: 15))
                    .onDrag({
                        gridData.currentGrid = grid
                        return NSItemProvider(object: String(grid.index) as NSString)
                    }, preview: {
                        if let transaction = grid.transaction {
                            SingleTemplateButton(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol)
                                .frame(width: 100, height: 100)
                                .contentShape(.dragPreview, RoundedRectangle(cornerRadius: 15))
                        }
                    })
                    .onDrop(of: [.text], delegate: DropViewDelegate(grid: grid, gridData: gridData))
                    .onTapGesture {
                        selectedItem = grid
                        print(grid.index)
                        lastSelectedIndex = grid.index
                    }
                }
            })
            .id(refreshID)
//
//            VStack {
//                ForEach(transactions) { transaction in
//                    Text(transaction.category?.wrappedName ?? "")
//                }
//            }
        }
        .padding(15)
        .frame(width: 245)
        .background(RoundedRectangle(cornerRadius: 25).fill(Color.PrimaryBackground).shadow(color: Color.gray.opacity(0.2), radius: 12))
        .fullScreenCover(item: $selectedItem, onDismiss: {
            gridData.reset()
            refreshID = UUID()
        }, content: { grid in
            TemplateTransactionView(order: grid.index)
        })
    }
}
