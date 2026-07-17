//
//  LogComponents.swift
//  Outlayr
//

import CloudKitSyncMonitor
import CoreData
import Foundation
import Popovers
import SwiftUI

struct NoResultsView: View {
    let fullscreen: Bool

    var body: some View {
        if fullscreen {
            VStack(spacing: 12) {
                Spacer()

                Image(systemName: "tray.full.fill")
                    .font(.system(.largeTitle, design: .rounded))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                    .font(.system(size: 38, weight: .regular, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)

                Text("No entries found.")
                    .font(.system(.title3, design: .rounded).weight(.medium))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                    .font(.system(size: 21, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)

                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .frame(height: UIScreen.main.bounds.height * 0.7)
            .opacity(0.7)
        } else {
            VStack(spacing: 12) {
                Spacer()

                //            Text("📭️")
                //                .font(.system(size: 45))
                //                .padding(.bottom, 9)
                //                .accessibility(hidden: true)

                Image(systemName: "tray.full.fill")
                    .font(.system(size: 38, weight: .regular, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)

                Text("No entries found.")
                    .font(.system(size: 21, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .opacity(0.7)
            .padding(.top, 50)
        }
    }
}

struct BackgroundBlurView: UIViewRepresentable {
    func makeUIView(context _: Context) -> UIView {
        let view = UIView()
        DispatchQueue.main.async {
            view.superview?.superview?.backgroundColor = .clear
        }
        return view
    }

    func updateUIView(_: UIView, context _: Context) {}
}

func dateFormatter(date: Date) -> String {
    let dateFormatter = DateFormatter()

    dateFormatter.dateFormat = "d MMM"
    return dateFormatter.string(from: date).uppercased()
}

func dateConverter(date: Date) -> String {
    let calendar = Calendar.current

    let dateComponents = calendar.dateComponents([.year], from: Date.now)

    let startOfCurrentYear = calendar.date(from: dateComponents) ?? Date.now

    if calendar.isDateInToday(date) {
        return String(localized: "today")
    } else if calendar.isDateInYesterday(date) {
        return String(localized: "yesterday")
    } else if startOfCurrentYear > date {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "EEE, d MMM yy"

        var string = dateFormatter.string(from: date)
        string.insert("'", at: string.index(string.endIndex, offsetBy: -2))

        return string
    } else {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "EEE, d MMM"

        return dateFormatter.string(from: date)
    }
}

func dateConverterAccessibilityLabel(date: Date) -> String {
    let calendar = Calendar.current

    if calendar.isDateInToday(date) {
        return "today"
    } else if calendar.isDateInYesterday(date) {
        return "yesterday"
    } else {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "EEE, d MMM yyyy"

        return "on " + dateFormatter.string(from: date)
    }
}

func timeConverterAccessibilityLabel(date: Date) -> String {
    let dateFormatter = DateFormatter()

    dateFormatter.dateFormat = "h:mm a"

    return dateFormatter.string(from: date)
}

func dayTotal(dayTransaction: [Transaction]) -> Double {
    var total = 0.0

    dayTransaction.forEach { transaction in
        if transaction.income {
            total += transaction.amount
        } else {
            total -= transaction.amount
        }
    }

    return total
}
