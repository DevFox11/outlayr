//
//  SingleTransactionView.swift
//  Outlayr
//

import CloudKitSyncMonitor
import CoreData
import Foundation
import HugeiconsCore
import HugeiconsSolidRounded
import Popovers
import SwiftUI

struct SingleTransactionView: View {
    let transaction: Transaction
    let showCents: Bool
    let currencySymbol: String
    let currency: String
    let swapTimeLabel: Bool
    let future: Bool
    let showExpenseOrIncomeSign: Bool

    @State var refreshID = UUID()

    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @Environment(OverallTransactionManager.self) private var transactionManager

    // delete mode
//    @State private var toDelete: Transaction?
//    @State var deleteMode = false
//
//    // edit mode
//    @State private var toEdit: Transaction?

    @State private var offset: CGFloat = 0
    @State private var deleted: Bool = false
    var deletePopup: Bool {
        return abs(offset) > UIScreen.main.bounds.width * 0.2
    }

    var deleteConfirm: Bool {
        return abs(offset) > UIScreen.main.bounds.width * 0.42
    }

    @GestureState var isDragging = false

    var imageSize: Double {
        let scale = min(1.5, 1 + (abs(offset + 40) / 100))
        return scale * 10 as Double
    }

    var imageScale: Double {
        return min(1, 1 + (abs(Double(offset) + 40) / 100))
    }

    var transactionAmountString: String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        if showCents {
            numberFormatter.maximumFractionDigits = 2
        } else {
            numberFormatter.maximumFractionDigits = 0
        }

        return numberFormatter.string(from: NSNumber(value: transaction.amount)) ?? "$0"
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            deleteIndicator

            rowContent
        }
        .onChange(of: deletePopup) { _, _ in
            if deletePopup {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        }
        .onChange(of: deleteConfirm) { _, _ in
            if deleteConfirm {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
        }
        .animation(.easeInOut, value: deletePopup)
        .simultaneousGesture(
            DragGesture()
                .updating($isDragging, body: { _, state, _ in
                    state = true
                })
                .onChanged { value in
                    if value.translation.width < 0 {
                        withAnimation {
                            offset = value.translation.width
                        }
                    }
                }
                .onEnded { _ in
                    if deleteConfirm {
                        deleted = true
                        withAnimation(.easeInOut(duration: 0.3)) {
                            offset -= UIScreen.main.bounds.width
                        }

                        if future, transaction.wrappedDate < Date.now, transaction.recurringType > 0 {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                withAnimation(.easeInOut(duration: 0.5)) {
                                    transaction.recurringType = 0
                                    dataController.save()
                                }
                            }
                        } else {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                withAnimation {
                                    moc.delete(transaction)
                                    transactionManager.showToast = true
                                    transactionManager.toDelete = transaction
//                                    transactionManager.future = future
//                                    transactionManager.toDelete = transaction
//                                    transactionManager.deletionType = .instant
                                }
                            }
                        }

                    } else if deletePopup {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            offset = 0
                        }

                        transactionManager.future = future
                        transactionManager.toDelete = transaction
                        transactionManager.showPopup = true
//
//                        toDelete = transaction
//                        deleteMode = true
                    } else {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            offset = 0
                        }
                    }
                }
        )
        .onChange(of: isDragging) { _, _ in
            if !isDragging && !deleted {
                withAnimation(.easeInOut(duration: 0.3)) {
                    offset = 0
                }
            }
        }
        .onChange(of: transactionManager.toDelete) { _, newValue in
            if newValue == nil {
                deleted = false
                offset = 0
//                withAnimation(.easeInOut(duration: 0.3)){
//                   offset = 0
//                }
            }
        }
    }

    private var deleteIndicator: some View {
        Image(systemName: "xmark")
//                .font(.system(size: 13, weight: .bold))
            .font(.system(.caption, design: .rounded).weight(.bold))
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .foregroundStyle(deleteConfirm ? Color.AlertRed : Color.SubtitleText)
            .padding(5)
            .background(deleteConfirm ? Color.AlertRed.opacity(0.23) : Color.SecondaryBackground, in: Circle())
//                .scaleEffect(imageScale)
            .scaleEffect(deleteConfirm ? 1.1 : 1)
            .contentShape(Circle())
            .opacity(deleted ? 0 : 1)
            .padding(.horizontal, 10)
            .offset(x: 80)
            .offset(x: max(-80, offset))
    }

    private var rowContent: some View {
        HStack(spacing: 12) {
                CategoryIconLogTile(icon: transaction.wrappedIcon,
                                    colour: (transaction.category?.wrappedColour ?? "#FFFFFF"), future: future)
                    .fixedSize(horizontal: true, vertical: true)
                    .overlay(alignment: .bottomTrailing) {
                        if transaction.recurringType > 0 {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.DarkIcon)
                                .padding(3)
                                .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 6))
                                .offset(x: 5, y: 5)
                        }
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(transaction.wrappedNote)
                        .font(.system(.body, design: .rounded).weight(.medium))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .foregroundStyle(future ? Color.SubtitleText : Color.PrimaryText)
                        .lineLimit(1)

                    Text(getSubtitle())
                        .font(.system(.subheadline, design: .rounded).weight(.medium))
                        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                        .foregroundStyle(future ? Color.EvenLighterText : Color.SubtitleText)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if transaction.income {
                    Text(showExpenseOrIncomeSign ? "+\(transactionAmountString)" : transactionAmountString)
                        .font(.system(.title3, design: .rounded).weight(.medium))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .foregroundStyle(future ? Color.SubtitleText : Color.IncomeGreen)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                        .layoutPriority(1)

                } else {
                    Text(showExpenseOrIncomeSign ? "-\(transactionAmountString)" : transactionAmountString)
                        .font(.system(.title3, design: .rounded).weight(.medium))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .foregroundStyle(future ? Color.SubtitleText : Color.PrimaryText)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                        .layoutPriority(1)
                }
            }
            .id(refreshID)
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
            .contentShape(RoundedRectangle(cornerRadius: 10))
            .onTapGesture {
                transactionManager.toEdit = transaction
            }
            .contextMenu {
                if transaction.recurringType > 0 {
                    Button {
                        transaction.recurringType = 0
                        dataController.save()
                    } label: {
                        Label("Stop Recurring", systemImage: "xmark")
                    }
                }

                Button {
                    transactionManager.toEdit = transaction
                } label: {
                    Label("Edit", systemImage: "pencil")
                }

                if !(future && transaction.wrappedDate < Date.now && transaction.recurringType > 0) {
                    Button {
                        transactionManager.toDelete = transaction
                        transactionManager.future = future
                        transactionManager.showPopup = true

//                        toDelete = transaction
//                        deleteMode = true
                    } label: {
                        Label("Delete", systemImage: "xmark.bin")
                    }
                }
            }
            .offset(x: offset)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(transaction.wrappedNote), \(currencySymbol)\(String(format: "%.2f", transaction.wrappedAmount)), Transaction Category: \(transaction.category?.wrappedName ?? "Unknown"), Transaction made at \(timeConverterAccessibilityLabel(date: transaction.wrappedDate))")
    }

    func getSubtitle() -> String {
        if future {
            if transaction.wrappedDate > Date.now {
                return dateFormatter(date: transaction.wrappedDate)
            } else {
                return dateFormatter(date: transaction.nextTransactionDate)
            }
        } else {
            if swapTimeLabel {
                return transaction.wrappedCategoryName
            } else {
                let formatter = DateFormatter()
                formatter.dateFormat = "h:mm a"

                return formatter.string(from: transaction.wrappedDate)
            }
        }
    }
}

/// The transaction-log variant of the category glyph: unlike `CategoryIconTile`
/// it models the `future` stroke state and sizes itself from padding rather than
/// a fixed frame.
struct CategoryIconLogTile: View {
    enum Scale {
        case row
        case hero

        var glyph: CGFloat {
            switch self {
            case .row: 20
            case .hero: 40
            }
        }

        var radius: CGFloat {
            switch self {
            case .row: 9
            case .hero: 20
            }
        }
    }

    let icon: CategoryIcon
    let colour: String
    let future: Bool
    let scale: Scale

    private var tint: Color { Color(hex: colour) }

    var body: some View {
        ZStack {
            if future {
                RoundedRectangle(cornerRadius: scale.radius, style: .continuous)
                    .stroke(tint.opacity(0.73), lineWidth: 2)
                    .foregroundStyle(.clear)
            } else {
                // A monochrome glyph needs a pale wash behind it to stay legible;
                // the palette's lighter hues vanish against a saturated fill.
                RoundedRectangle(cornerRadius: scale.radius, style: .continuous)
                    .fill(tint.opacity(0.18))
            }

            HugeIcon(
                codepoint: icon.codepoint,
                font: HugeiconsSolidRounded.font(size: scale.glyph),
                color: tint
            )
            .padding(8)
        }
        .opacity(future ? 0.6 : 1)
    }

    init(icon: CategoryIcon, colour: String, future: Bool, scale: Scale = .row) {
        self.icon = icon
        self.colour = colour
        self.future = future
        self.scale = scale
    }
}
