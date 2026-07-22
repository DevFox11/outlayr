//
//  ImportDataView.swift
//  Outlayr
//
//  Created by Rafael Soh on 21/8/23.
//

import ConfettiSwiftUI
import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ImportDataView: View {
    @Environment(\.dismiss) var dismiss
    @Environment(DataController.self) var dataController

    @State private var exportSample = false
    @State private var importing = false

    @State var data = ""
    @State var rows = [[String]]()
    @State var numberOfRows: Int = 0
    @State var displayedColumns = [[String]]()
    @State var columns = [[String]]()

    @State var remainingColumns = [Int]()
    @State var selectedColumns = [Int]()

    var indexColumnWidth: CGFloat {
        let additionalPadding: Double

        if dynamicTypeSize > .xLarge {
            additionalPadding = 10
        } else {
            additionalPadding = 0
        }

        if numberOfRows < 10 {
            return "9".widthOfRoundedString(size: 15, weight: .bold) + 16.0 + additionalPadding
        } else if numberOfRows < 100 {
            return "99".widthOfRoundedString(size: 15, weight: .bold) + 16.0 + additionalPadding
        } else {
            return "999".widthOfRoundedString(size: 15, weight: .bold) + 16.0 + additionalPadding
        }
    }

    @State var progress = 1

    @State var selectedColumn = 0
    @State var columnSelectionCompleted = false
    @State var sampleDateString = ""
    @State var dateFormatString = ""
    @State var validDateFormatString = false
    @State var uniqueCategories: [MatchedCategory] = .init()

    @State var processingState = ProcessingState.loading
    @State var errorMessage = "Invalid dates in date column."
    @State var confettiNumber = 0

    var numberOfLinkedCategories: Int {
        uniqueCategories.filter { $0.category != nil }.count
    }

    @State var showToast = false
    @State var toastMessage: String = "Invalid File"

    @State var showingCategoryView = false
    @State var pageIndex = 0

    // just for the adding of transactions
    @State var income = false

    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    var columnWidth: CGFloat {
        if dynamicTypeSize > .xLarge {
            return 150
        } else {
            return 100
        }
    }

    let instructions: [InstructionHeadings] = [
        InstructionHeadings(title: "Import transactions", subtitle: "Begin by adding a CSV file with 4 columns: amount, note, date, and category."),
        InstructionHeadings(title: "Assign category column", subtitle: "Select a column from your import that corresponds to the categories of your transactions."),
        InstructionHeadings(title: "Assign note column", subtitle: "Select a column from your import that corresponds to the notes/subtitles of your transactions."),
        InstructionHeadings(title: "Assign date column", subtitle: "Select a column from your import that corresponds to the dates of your transactions."),
        InstructionHeadings(title: "Assign amount column", subtitle: "Select a column from your import that corresponds to the values of your transactions."),
        InstructionHeadings(title: "Indicate date format", subtitle: "Referencing this article, state the format of the dates in the assigned column."),
        InstructionHeadings(title: "Link categories", subtitle: "Match values found in the 'Category' column to the corresponding categories in Outlayr."),
        InstructionHeadings(title: "Processing import", subtitle: "Please wait while we process your new transactions.")
    ]

    let labels: [ColumnLabel] = [
        ColumnLabel(image: "square.grid.2x2.fill", label: "Category"),
        ColumnLabel(image: "doc.plaintext.fill", label: "Note"),
        ColumnLabel(image: "calendar", label: "Date"),
        ColumnLabel(image: "dollarsign.circle.fill", label: "Amount")
    ]

    let pointers = ["Ensure that the values in the 'Amount' column do not contain any currency symbols.", "All dates should be of a consistent, recognizable format. If no timestamps are provided, the time of transaction will default to 12:00 am.", "Remove all commas in the 'Note' and 'Category' columns as they would disrupt the parsing of your file."]

    var incomeCategories: [Category] {
        dataController.categories.getAllCategories(income: true)
    }

    var expenseCategories: [Category] {
        dataController.categories.getAllCategories(income: false)
    }

    var body: some View {
        VStack(spacing: 0) {
            if progress == 8 {
                ImportProcessingStep(state: processingState, errorMessage: errorMessage)
                    .frame(maxHeight: .infinity)
            } else {
                HStack {
                    if #available(iOS 17.0, *) {
                        Button {
                            if progress == 2 {
                                withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                                    progress -= 1
                                }
                            } else if progress > 6 {
                                withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                                    progress -= 1
                                }
                            } else if progress > 2 {
                                withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                                    if let removedColumn = selectedColumns.popLast() {
                                        remainingColumns.append(removedColumn)
                                        remainingColumns.sort()
                                        selectedColumn = remainingColumns[0]
                                        columnSelectionCompleted = false

                                        progress -= 1
                                    }
                                }
                            } else {
                                dismiss()
                            }
                        } label: {
                            Image(systemName: progress > 1 ? "chevron.left" : "xmark")
                                .font(.system(.callout, design: .rounded).weight(.semibold))

                                .foregroundStyle(Color.SubtitleText)
                                .padding(8)
                                .background(Color.SecondaryBackground, in: Circle())
                        }
                        .contentTransition(.symbolEffect(.replace.downUp.wholeSymbol))
                    } else {
                        Button {
                            if progress > 1 {
                                withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                                    progress -= 1
                                }
                            } else {
                                dismiss()
                            }
                        } label: {
                            Image(systemName: progress > 1 ? "chevron.left" : "xmark")
                                .font(.system(.callout, design: .rounded).weight(.semibold))
                                .foregroundStyle(Color.SubtitleText)
                                .padding(8)
                                .background(Color.SecondaryBackground, in: Circle())
                        }
                    }

                    Spacer()

                    CustomCapsuleProgress(percent: Double(progress) / 7, width: 4, topStroke: Color.DarkBackground, bottomStroke: Color.SecondaryBackground)
                        .frame(width: 60)
                }
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

                .overlay {
                    if showToast {
                        HStack(spacing: 6.5) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(.subheadline, design: .rounded).weight(.semibold))

//                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.AlertRed)

                            Text(toastMessage)
                                .font(.system(.callout, design: .rounded).weight(.semibold))

//                                .font(.system(size: 16, weight: .semibold, design: .rounded))
                                .foregroundStyle(Color.AlertRed)
                        }
                        .padding(8)
                        .background(Color.AlertRed.opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                        .transition(AnyTransition.opacity.combined(with: .move(edge: .top)))
                        .frame(width: 250)
                    }
                }
                .padding(.bottom, 50)
                .animation(.easeInOut, value: progress > 1)

                VStack(alignment: .leading, spacing: 5) {
                    if progress == 6 {
                        HStack {
                            Text("Indicate date format")
                                .foregroundStyle(Color.PrimaryText)
                                .font(.system(.title2, design: .rounded).weight(.semibold))

//                                .font(.system(size: 26, weight: .semibold, design: .rounded))

                            Spacer()
                        }
                        .frame(maxWidth: .infinity)

                        Text("Referencing \(makeAttributedString()), state the format of the dates in the assigned column.")
                            .foregroundStyle(Color.SubtitleText)
                            .font(.system(.body, design: .rounded).weight(.medium))

//                            .font(.system(size: 17, weight: .medium, design: .rounded))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        HStack {
                            Text(instructions[progress - 1].title)
                                .foregroundStyle(Color.PrimaryText)
                                .font(.system(.title2, design: .rounded).weight(.semibold))

//                                .font(.system(size: 26, weight: .semibold, design: .rounded))

                            if progress == 7 {
                                Button {
                                    showingCategoryView = true
                                } label: {
                                    Image(systemName: "plus")
                                        .font(.system(.footnote, design: .rounded).weight(.semibold))
                                        .foregroundStyle(Color.SubtitleText)
                                        .padding(4)
                                        .background(Color.SecondaryBackground, in: Circle())
                                        .contentShape(Circle())
                                }
                            }

                            Spacer()
                        }
                        .frame(maxWidth: .infinity)

                        Text(instructions[progress - 1].subtitle)
                            .foregroundStyle(Color.SubtitleText)
                            .font(.system(.body, design: .rounded).weight(.medium))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .frame(height: UIScreen.main.bounds.size.height / (dynamicTypeSize > .xLarge ? 5.3 : 5.8), alignment: .top)
                .padding(.bottom, 10)

                if progress == 1 {
                    HStack(spacing: 6) {
                        Image(systemName: "info.circle.fill")
                            .font(.system(.subheadline, design: .rounded).weight(.medium))

//                            .font(.system(size: 15, weight: .semibold, design: .rounded))

                        Text("Additional Pointers")
                            .font(.system(.body, design: .rounded).weight(.semibold))

//                            .font(.system(size: 17, weight: .semibold, design: .rounded))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(12)
                    .foregroundStyle(Color.IncomeGreen)
                    .background(Color.IncomeGreen.opacity(0.23), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .padding(.bottom, 20)

                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 22) {
                            ForEach(pointers.indices, id: \.self) { index in
                                PointerView(number: index + 1, text: pointers[index])
                            }
                        }
                    }
                } else if progress < 6 {
                    ImportColumnTable(
                        displayedColumns: displayedColumns,
                        selectedColumns: selectedColumns,
                        selectedColumn: $selectedColumn,
                        columnSelectionCompleted: columnSelectionCompleted,
                        remainingColumns: remainingColumns,
                        labels: labels,
                        numberOfRows: numberOfRows,
                        columnWidth: columnWidth,
                        indexColumnWidth: indexColumnWidth,
                        progress: progress
                    )
                } else if progress == 6 {
                    ImportDateFormatStep(
                        sampleDateString: sampleDateString,
                        dateFormatString: $dateFormatString,
                        validDateFormatString: $validDateFormatString
                    )
                } else if progress == 7 {
                    ImportCategoryMatchStep(
                        uniqueCategories: $uniqueCategories,
                        incomeCategories: incomeCategories,
                        expenseCategories: expenseCategories,
                        numberOfLinkedCategories: numberOfLinkedCategories,
                        pageIndex: $pageIndex
                    )
                }

                Spacer()

                if progress == 1 {
                    VStack(spacing: 13) {
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()

                            importing = true

                        } label: {
                            HStack(spacing: 6) {
                                Text("Import")
                                    .font(.system(.title3, design: .rounded).weight(.semibold))

//                                    .font(.system(size: 19, weight: .semibold, design: .rounded))

                                Image(systemName: "square.and.arrow.up.fill")
                                    .font(.system(.subheadline, design: .rounded).weight(.semibold))

//                                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                            }
                            .frame(height: 50)
                            .frame(maxWidth: .infinity)
                            .foregroundStyle(Color.LightIcon)
                            .background(Color.DarkBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        }
                        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.8))

                        Button {
                            exportSample = true
                        } label: {
                            HStack(spacing: 6) {
//                                Image(systemName: "doc.text")
//                                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                                Text("Sample Sheet")
                                    .underline()
                                    .font(.system(.body, design: .rounded).weight(.semibold))

//                                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                            }
                            .foregroundStyle(Color.SubtitleText)
                        }
                    }

                } else {
                    Button {
                        if progress == 7 {
                            if numberOfLinkedCategories == uniqueCategories.count {
                                withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                                    progress += 1
                                }

                                importData()
                            } else {
                                showToast = true
                                toastMessage = "Unlinked Categories"
                            }

                        } else if progress > 5 {
                            withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                                progress += 1
                            }
                        } else {
                            withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
                                guard !remainingColumns.isEmpty else { return }

                                if progress == 4 {
                                    let sample = displayedColumns[selectedColumn][0]

                                    guard sample.containsDigits else {
                                        showToast = true
                                        toastMessage = "Invalid Column"
                                        return
                                    }
                                }

                                if progress == 5 {
                                    let stringColumn = displayedColumns[selectedColumn]

                                    guard validateDoubles(strings: stringColumn) else {
                                        showToast = true
                                        toastMessage = "Invalid Column"
                                        return
                                    }
                                }

                                // remove from possible pool
                                let index = remainingColumns.firstIndex(of: selectedColumn) ?? 0
                                remainingColumns.remove(at: index)

                                // add to holding pool
                                selectedColumns.append(selectedColumn)

                                if progress < 5 {
                                    guard !remainingColumns.isEmpty else {
                                        showToast = true
                                        toastMessage = "Insufficient Columns"
                                        return
                                    }
                                    selectedColumn = remainingColumns[0]
                                }

                                // reset selected column

                                if progress == 5 {
                                    let dateColumnIndex = selectedColumns[2]
                                    sampleDateString = displayedColumns[dateColumnIndex][0]

                                    if let deducedFormat = deduceDateFormat(from: sampleDateString) {
                                        dateFormatString = deducedFormat
                                        validDateFormatString = true
                                    }

                                    let categoryColumnIndex = selectedColumns[0]
                                    uniqueCategories = columns[categoryColumnIndex].unique().map {
                                        MatchedCategory(excelValue: $0, income: false)
                                    }

                                    columnSelectionCompleted = true
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                                        withAnimation {
                                            progress += 1
                                        }
                                    }
                                } else {
                                    progress += 1
                                }
                            }
                        }
                    } label: {
                        Text("Continue")
                            .font(.system(.title3, design: .rounded).weight(.semibold))

//                            .font(.system(size: 19, weight: .semibold, design: .rounded))
                            .frame(height: 50)
                            .frame(maxWidth: .infinity)
                            .foregroundStyle(Color.LightIcon)
                            .background(Color.DarkBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    }
                    .buttonStyle(BouncyButton(duration: 0.2, scale: 0.8))
                }
            }
        }
        .padding(20)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .ignoresSafeArea(.keyboard)
        .background(Color.PrimaryBackground)
        .fileImporter(
            isPresented: $importing,
            allowedContentTypes: [.commaSeparatedText]
        ) { result in
            switch result {
            case let .success(file):
                do {
                    if file.startAccessingSecurityScopedResource() {
                        guard let message = try String(data: Data(contentsOf: file), encoding: .utf8) else {
                            showToast = true
                            toastMessage = "Invalid File"
                            return
                        }

                        data = message

                        processCSV()

                        do {
                            file.stopAccessingSecurityScopedResource()
                        }
                    }
                } catch {}
            case let .failure(error):
                print(error.localizedDescription)
            }
        }
        .sheet(isPresented: $exportSample) {
            if let url = Bundle.main.url(forResource: "sample", withExtension: "csv") {
                ActivityViewController(activityItems: [url])
            }
        }
        .sheet(isPresented: $showingCategoryView) {
            NewCategoryAlert(income: $income, budgetMode: false)
        }
        .animation(.easeOut(duration: 0.2), value: showToast)
        .onChange(of: showToast) { _, newValue in
            if newValue {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    showToast = false
                }
            }
        }
        .onChange(of: processingState) { _, newValue in
            if newValue == .success {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    dismiss()
                }
            }
        }
        .confettiCannon(counter: $confettiNumber, num: 50, openingAngle: Angle(degrees: 0), closingAngle: Angle(degrees: 360), radius: 200)
    }

}

private struct ImportProcessingStep: View {
    let state: ProcessingState
    let errorMessage: String

    var body: some View {
        VStack(spacing: 15) {
            switch state {
            case .loading:
                ProgressView()
                    .controlSize(.large)
                    .scaleEffect(0.8)

                Text("Processing Import")
                    .font(.system(.title2, design: .rounded).weight(.medium))

//                            .font(.system(size: 22, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
            case .success:

                Image(systemName: "checkmark")
                    .font(.system(.title2, design: .rounded).weight(.semibold))

//                            .font(.system(size: 21, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.IncomeGreen)
                    .frame(width: 35, height: 35)
                    .background(Color.IncomeGreen.opacity(0.3), in: Circle())

                Text("Import Successful")
                    .font(.system(.title2, design: .rounded).weight(.medium))

//                            .font(.system(size: 22, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.IncomeGreen)
            case .error:
                Image(systemName: "x")
                    .font(.system(.title2, design: .rounded).weight(.semibold))

//                            .font(.system(size: 21, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.AlertRed)
                    .frame(width: 35, height: 35)
                    .background(Color.Alert.opacity(0.3), in: Circle())

                Text("Import Failed")
                    .font(.system(.title2, design: .rounded).weight(.medium))

//                            .font(.system(size: 22, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)

                Text(errorMessage)
                    .font(.system(.subheadline, design: .rounded).weight(.medium))

//                            .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
            }
        }
        .frame(maxHeight: .infinity)
    }
}

private struct ImportColumnTable: View {
    let displayedColumns: [[String]]
    let selectedColumns: [Int]
    @Binding var selectedColumn: Int
    let columnSelectionCompleted: Bool
    let remainingColumns: [Int]
    let labels: [ColumnLabel]
    let numberOfRows: Int
    let columnWidth: CGFloat
    let indexColumnWidth: CGFloat
    let progress: Int

    var body: some View {
        VStack(spacing: 10) {
            Text("Sampled Rows from Import CSV")
                .font(.system(.subheadline, design: .rounded).weight(.semibold))

//                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.SubtitleText)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    VStack(spacing: 0) {
                        ForEach(0 ..< (numberOfRows + 1), id: \.self) { number in
                            if number == 0 {
                                Rectangle()
                                    .fill(Color.PrimaryBackground)
                                    .frame(width: indexColumnWidth, height: 30, alignment: .leading)
                            } else {
                                Text("\(number)")
                                    .foregroundStyle(Color.SubtitleText)
                                    .font(.system(.subheadline, design: .rounded).weight(.bold))

//                                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                    .padding(.horizontal, 8)
                                    .frame(width: indexColumnWidth, height: 30, alignment: .leading)
                                    .overlay(Rectangle().stroke(Color.Outline, lineWidth: 1))
                            }
                        }
                    }
                    .background(Color.SecondaryBackground.opacity(0.6))

                    HStack(spacing: 0) {
                        ForEach(displayedColumns.indices, id: \.self) { columnIndex in

                            VStack(spacing: 0) {
                                if selectedColumns.contains(columnIndex) {
                                    if let index = selectedColumns.firstIndex(of: columnIndex) {
                                        HStack(spacing: 4.5) {
                                            Image(systemName: labels[index].image)
                                                .font(.system(.caption, design: .rounded).weight(.semibold))

//                                                            .font(.system(size: 12, weight: .semibold, design: .rounded))

                                            Text(labels[index].label)
                                                .font(.system(.subheadline, design: .rounded).weight(.semibold))

//                                                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                        }
                                        .padding(.horizontal, 10)
                                        .frame(width: columnWidth, height: 30, alignment: .leading)
                                        .foregroundStyle(Color(labels[index].label))
                                        .background(Color(labels[index].label).opacity(0.23), in: RoundedCorner(radius: 10, corners: [.topLeft, .topRight]))
                                    }
                                } else {
                                    Rectangle()
                                        .fill(Color.PrimaryBackground)
                                        .frame(width: columnWidth, height: 30, alignment: .leading)
                                }

                                VStack(spacing: 0) {
                                    ForEach(displayedColumns[columnIndex], id: \.self) { value in
                                        Text(value)
                                            .foregroundStyle(Color.PrimaryText)
                                            .font(.system(.subheadline, design: .rounded).weight(.medium))

//                                                        .font(.system(size: 15, weight: .medium, design: .rounded))
                                            .padding(.horizontal, 8)
                                            .frame(width: columnWidth, height: 30, alignment: .leading)
                                            .overlay(Rectangle().stroke(Color.Outline, lineWidth: 1))
                                        //
                                    }
                                }
                                .onTapGesture {
                                    if progress >= 2 {
                                        if remainingColumns.contains(columnIndex) {
                                            withAnimation {
                                                selectedColumn = columnIndex
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .overlay(alignment: .leading) {
                        if !columnSelectionCompleted && progress < 6 {
                            VStack(spacing: 0) {
                                HStack(spacing: 4.5) {
                                    Image(systemName: labels[progress - 2].image)
                                        .font(.system(.caption, design: .rounded).weight(.semibold))

//                                                    .font(.system(size: 12, weight: .semibold, design: .rounded))

                                    Text(labels[progress - 2].label)
                                        .font(.system(.subheadline, design: .rounded).weight(.semibold))

//                                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .padding(.horizontal, 10)
                                .frame(width: columnWidth + 2, height: 30, alignment: .leading)
                                .foregroundStyle(Color.LightIcon)
                                .background(Color.DarkBackground, in: RoundedCorner(radius: 10, corners: [.topLeft, .topRight]))

                                Rectangle()
                                    .stroke(Color.DarkBackground, lineWidth: 2)
                                    .frame(width: columnWidth)
                                    .frame(maxHeight: .infinity)
                            }
                            .offset(x: CGFloat(CGFloat(selectedColumn) * columnWidth))
                        }
                    }
                }
                .padding(2)
            }
        }
    }
}

private struct ImportDateFormatStep: View {
    let sampleDateString: String
    @Binding var dateFormatString: String
    @Binding var validDateFormatString: Bool

    var body: some View {
        VStack(spacing: 10) {
            Text("Sample from 'Date' Column")
                .font(.system(.subheadline, design: .rounded).weight(.semibold))

//                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.SubtitleText)

            Text(sampleDateString)
                .font(.system(.title3, design: .rounded).weight(.semibold))

//                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.PrimaryText)
                .frame(width: 300, height: 40)
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(Color.Outline, lineWidth: 2)
                )
                .padding(.bottom, 30)

            HStack(spacing: 7) {
                Image(systemName: "calendar")
                    .font(.system(.callout, design: .rounded).weight(.semibold))

//                                .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.SubtitleText)

                TextField("Date Format", text: $dateFormatString)
                    .foregroundStyle(Color.PrimaryText)
                    .font(.system(.title3, design: .rounded).weight(.semibold))

//                                .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .frame(maxWidth: .infinity)

                if validDateFormatString {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(.callout, design: .rounded).weight(.semibold))

//                                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.IncomeGreen)
                } else if !validDateFormatString && dateFormatString != "" {
                    ProgressView()
                }
            }
            .padding(.horizontal, 10)
            .frame(width: 300, height: 40)
            .background {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .stroke(Color.SubtitleText, lineWidth: 2)
                    .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
            .onChange(of: dateFormatString) { _, newValue in
                let dateFormatter = DateFormatter()
                dateFormatter.dateFormat = newValue

                if dateFormatter.date(from: sampleDateString) != nil {
                    validDateFormatString = true
                } else {
                    validDateFormatString = false
                }
            }
        }
    }
}

private struct ImportCategoryMatchStep: View {
    @Binding var uniqueCategories: [MatchedCategory]
    let incomeCategories: [Category]
    let expenseCategories: [Category]
    let numberOfLinkedCategories: Int
    @Binding var pageIndex: Int
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 10) {
            Text("\(numberOfLinkedCategories)/^[\(uniqueCategories.count) category](inflect: true) linked")
                .font(.system(.subheadline, design: .rounded).weight(.semibold))

//                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.SubtitleText)

            TabView(selection: $pageIndex) {
                ForEach(uniqueCategories.indices, id: \.self) { categoryIndex in
                    VStack(spacing: 20) {
                        HStack(spacing: 8) {
                            Text(uniqueCategories[categoryIndex].excelValue)
                                .font(.system(.title3, design: .rounded).weight(.semibold))

                                .lineLimit(1)
//                                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                                .foregroundStyle(Color.PrimaryText)
//                                            .frame(height: 36)
                                .padding(.vertical, 6)
                                .padding(.horizontal, 10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .strokeBorder(Color.Outline, lineWidth: 2)
                                )
                                .minimumScaleFactor(0.7)

                            if let unwrappedCategory = uniqueCategories[categoryIndex].category {
                                HStack(spacing: 8) {
                                    Image(systemName: "triangle.fill")
                                        .rotationEffect(Angle(degrees: 90))
                                        .scaledFont(12, weight: .regular, design: .rounded)
                                        .foregroundStyle(Color.SubtitleText)

                                    HStack(spacing: 5) {
                                        CategoryIconGlyph(symbol: unwrappedCategory.displaySymbol)

                                        Text(unwrappedCategory.wrappedName)
                                            .font(.system(.title3, design: .rounded).weight(.semibold))

                                            .lineLimit(1)

//                                                        .font(.system(size: 19, weight: .semibold, design: .rounded))
                                    }
                                    .padding(.vertical, 6)
                                    .padding(.horizontal, 10)
//                                                .frame(height: 36)
                                    .foregroundStyle(CategoryTileShading.glyph(for: Color(hex: unwrappedCategory.wrappedColor), in: colorScheme, washOpacity: 0.35))
                                    .background(Color(hex: unwrappedCategory.wrappedColor).opacity(0.35), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    .minimumScaleFactor(0.7)
                                }
                                .transition(.opacity)
                            }
                        }
                        .drawingGroup()

                        MatchCategoryStepperView(category: $uniqueCategories[categoryIndex].category, categories: uniqueCategories[categoryIndex].income ? incomeCategories : expenseCategories, pageIndex: $pageIndex, maxIndex: uniqueCategories.count)
                            .overlay(alignment: .bottomTrailing) {
                                let income = uniqueCategories[categoryIndex].income

                                ZStack {
                                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                                        .fill(Color.PrimaryBackground)

                                    Image(systemName: income ? "plus" : "minus")
                                        .scaledFont(18, weight: .semibold)
                                        .foregroundStyle(income ? Color.IncomeGreen : Color.AlertRed)
                                        .frame(width: 30, height: 30)
                                        .background(income ? Color.IncomeGreen.opacity(0.23) : Color.AlertRed.opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                                }
                                .frame(width: 30, height: 30)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    uniqueCategories[categoryIndex].income.toggle()
                                }
                                .padding(12)
                            }

                        Spacer()
                    }
                    .padding(10)
                    .tag(categoryIndex)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .frame(height: 390)
        }
    }
}
