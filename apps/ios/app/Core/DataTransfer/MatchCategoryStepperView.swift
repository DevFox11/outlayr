//
//  MatchCategoryStepperView.swift
//  Outlayr
//
//  Created by Rafael Soh on 21/8/23.
//

import Foundation
import SwiftUI
import UIKit

struct MatchCategoryStepperView: View {
    @Binding var category: Category?
    @Binding var pageIndex: Int
    var categories: [Category]
    var maxIndex: Int
//
//    @Environment(\.dynamicTypeSize) var dynamicTypeSize
//
//    var fontSize: CGFloat {
//        switch dynamicTypeSize {
//        case .xSmall:
//            return 14
//        case .small:
//            return 15
//        case .medium:
//            return 16
//        case .large:
//            return 17
//        case .xLarge:
//            return 19
//        case .xxLarge:
//            return 21
//        case .xxxLarge:
//            return 23
//        default:
//            return 23
//        }
//    }

    var body: some View {
        VStack {
            if categories.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "tray.full.fill")
                        .font(.system(.title, design: .rounded))

//                        .font(.system(size: 28, weight: .regular, design: .rounded))
                        .foregroundStyle(Color.SubtitleText.opacity(0.7))
                        .padding(.top, 20)

                    Text("No remaining\ncategories.")
                        .font(.system(.callout, design: .rounded).weight(.medium))

//                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.SubtitleText.opacity(0.7))
                        .padding(.bottom, 20)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 8) {
                        ForEach(getRows(), id: \.self) { rows in

                            HStack(spacing: 8) {
                                ForEach(rows) { row in

                                    // Row View....
                                    RowView(categoryInput: row)
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(15)
        .frame(height: 250)
        .background(Color.Outline.opacity(0.3), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .stroke(Color.Outline, lineWidth: 2)
        }
//        .background(Color.PrimaryBackground, in: )
    }

    func getRows() -> [[Category]] {
        var rows: [[Category]] = []
        var currentRow: [Category] = []

        var totalWidth: CGFloat = 0

        let screenWidth: CGFloat = UIScreen.main.bounds.width - 80

        categories.forEach { category in

            let roundedFont = UIFont.rounded(ofSize: UIFont.textStyleSize(.body), weight: .semibold)

            let attributes = [NSAttributedString.Key.font: roundedFont]

            let size = (category.wrappedName as NSString).size(withAttributes: attributes)

            // Chip width: name + icon glyph + stack spacing + horizontal padding.
            let chipWidth = size.width + 14 + 5 + 10 + 10 + 8

            totalWidth += chipWidth

            if totalWidth > screenWidth {
                totalWidth = (!currentRow.isEmpty || rows.isEmpty ? chipWidth : 0)

                rows.append(currentRow)
                currentRow.removeAll()
                currentRow.append(category)

            } else {
                currentRow.append(category)
            }
        }

        // Safe check...
        // if having any value storing it in rows...
        if !currentRow.isEmpty {
            rows.append(currentRow)
            currentRow.removeAll()
        }

        return rows
    }

    @ViewBuilder
    func RowView(categoryInput: Category) -> some View {
        Button {
            withAnimation {
                category = categoryInput
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                withAnimation {
                    // remember to check for cap
                    if pageIndex < maxIndex - 1 {
                        pageIndex += 1
                    }
                }
            }

        } label: {
            HStack(spacing: 5) {
                CategoryIconGlyph(symbol: categoryInput.displaySymbol, size: 14)
                Text(categoryInput.wrappedName)
                    .font(.system(.body, design: .rounded).weight(.semibold))

//                    .font(.system(size: 17, weight: .semibold, design: .rounded))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(category == categoryInput ? Color(hex: categoryInput.wrappedColor) : Color.PrimaryText)
            .background(category == categoryInput ? Color(hex: categoryInput.wrappedColor).opacity(0.35) : Color.PrimaryBackground, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay {
                if category != categoryInput {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(Color.Outline,
                                      style: StrokeStyle(lineWidth: 1.5))
                }
            }
//            .opacity(category == nil ? 1 : (category == categoryInput ? 1 : 0.4))
        }
        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.8))
    }

    init(category: Binding<Category?>?, categories: [Category], pageIndex: Binding<Int>, maxIndex: Int) {
        _category = category ?? Binding.constant(nil)
        _pageIndex = pageIndex
        self.categories = categories
        self.maxIndex = maxIndex
    }
}
