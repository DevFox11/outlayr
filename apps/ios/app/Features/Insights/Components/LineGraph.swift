//
//  LineGraph.swift
//  Outlayr
//
//  Created by Rafael Soh on 25/11/22.
//

import Accessibility
import Foundation
import SwiftUI

struct LineGraph: View {
    var data: [LineGraphDataPoint]
    var green: Bool
    var type: Int
    var range: Int

    @State var currentPlot: LineGraphDataPoint?

    @State var offset: CGSize = .zero

    @State var showPlot = false

    @State var translation: CGFloat = 0

    @GestureState var isDrag: Bool = false

    var color: Color {
        return green ? Color.IncomeGreen : Color.AlertRed
    }

    var overlayColor: Color {
        if let plot = currentPlot {
            let index = data.firstIndex(of: plot) ?? 0

            if data.count - range <= index {
                return color
            } else {
                return Color.Outline
            }
        } else {
            return color
        }
    }

    // Animating Graph
    @State var graphProgress: CGFloat = 0
    @State var animationTask: Task<Void, Never>?

    func getGradient(totalPoints: Double, range: Double) -> Gradient {
        let centreLocation = 1 - (range - 1) / (totalPoints - 1)
        let leftLocation = centreLocation - 0.01

        return Gradient(stops: [Gradient.Stop(color: Color.Outline, location: leftLocation),
                                Gradient.Stop(color: color, location: centreLocation)])
    }

    var body: some View {
        GeometryReader { proxy in

            let height = proxy.size.height
            let width = (proxy.size.width) / CGFloat(data.count - 1)
            let dataValues = data.map { $0.amount }

            let maxPoint = (dataValues.max() ?? 0.0)
            let minPoint = dataValues.min() ?? 0.0

            let points = data.enumerated().compactMap { item -> CGPoint in

                let progress = (item.element.amount - minPoint) / (maxPoint - minPoint)

                let pathHeight = progress * height

                // width..
                let pathWidth = width * CGFloat(item.offset)

                // Since we need peak to top not bottom...
                return CGPoint(x: pathWidth, y: -pathHeight + height)
            }

            ZStack {
                //
                AnimatedGraphPath(progress: graphProgress, points: points)
                    .fill(
                        // Gradient...
                        LinearGradient(gradient: getGradient(totalPoints: Double(data.count), range: Double(range)), startPoint: .leading, endPoint: .trailing)
                    )

//                 Path Bacground Coloring...
//                FillBG()
//                // Clipping the shape..
//                    .clipShape(
//
//                        Path{path in
//
//                            // drawing the points..
//                            path.move(to: CGPoint(x: 0, y: 0))
//
//                            path.addLines(points)
//
//                            path.addLine(to: CGPoint(x: proxy.size.width, y: height))
//
//                            path.addLine(to: CGPoint(x: 0, y: height))
//                        }
//                    )
//                    .opacity(graphProgress)
//
            }
            .overlay(
                // Drag Indiccator...
                VStack(spacing: 0) {
                    VStack(spacing: 1) {
                        if type < 4 {
                            Text(currentPlot?.dateString ?? "")
                                .scaledFont(10, weight: .medium, design: .rounded)
                                .foregroundStyle(Color.SubtitleText)
                        } else {
                            Text(currentPlot?.monthString ?? "")
                                .scaledFont(10, weight: .medium, design: .rounded)
                                .foregroundStyle(Color.SubtitleText)
                        }

                        Text(currentPlot?.amountString ?? "")
                            .scaledFont(12, weight: .semibold, design: .rounded)
                            .foregroundStyle(Color.PrimaryText)
                    }
                    .frame(height: 33)
                    .padding(.horizontal, 7)
                    .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 6))
                    .padding(.bottom, 4)

                    DottedLine()

                        .stroke(style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                        .frame(width: 2.5, height: 25)
                        .foregroundStyle(overlayColor)

                    Circle()
                        .stroke(Color.PrimaryBackground, lineWidth: 2.5)
                        .background(Circle().fill(overlayColor))
                        .frame(width: 14, height: 11)
                }
                // Fixed Frame..
                // For Gesture Calculation...
                .frame(width: 80)
                // 170 / 2 = 85 - 15 => circle ring size...
                .offset(y: 6)
                .offset(offset)
                .opacity(showPlot ? 1 : 0),

                alignment: .bottomLeading
            )
            .contentShape(Rectangle())
            .gesture(DragGesture().onChanged { value in

                withAnimation { showPlot = true }

                let translation = value.location.x

                // Getting index...
                let index = max(min(Int((translation / width).rounded() + 1), data.count - 1), 0)

                currentPlot = data[index]
                self.translation = translation

                // removing half width...
                offset = CGSize(width: points[index].x - 40, height: points[index].y - height)

            }.onEnded { _ in

                withAnimation { showPlot = false }

            }.updating($isDrag, body: { _, out, _ in
                out = true
            }))
        }
        .padding(.horizontal, 10)
        .onChange(of: isDrag) { _, _ in
            if !isDrag {
                showPlot = false
            }
        }
        .task {
            try? await Task.sleep(for: .milliseconds(100))
            withAnimation(.easeInOut(duration: 1.2)) {
                graphProgress = 1
            }
        }
        .onChange(of: data) { _, _ in
            graphProgress = 0
            animationTask?.cancel()
            animationTask = Task {
                try? await Task.sleep(for: .milliseconds(100))
                withAnimation(.easeInOut(duration: 1.2)) {
                    graphProgress = 1
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityChartDescriptor(self)
        .accessibilityLabel(green ? String(localized: "accessibility.incomeHistory") : String(localized: "accessibility.spendingHistory"))
    }

}

extension LineGraph: AXChartDescriptorRepresentable {
    func makeChartDescriptor() -> AXChartDescriptor {
        let title = green ? "Income history" : "Spending history"
        let maxValue = data.map(\.amount).max() ?? 0
        let labels = data.map { type < 4 ? $0.dateString : $0.monthString }

        let xAxis = AXCategoricalDataAxisDescriptor(title: "Date", categoryOrder: labels)
        let yAxis = AXNumericDataAxisDescriptor(
            title: "Amount",
            range: 0...Swift.max(1, maxValue * 1.1),
            gridlinePositions: []
        ) { String(format: "%.0f", $0) }

        let series = AXDataSeriesDescriptor(
            name: green ? "Income" : "Spending",
            isContinuous: true,
            dataPoints: zip(labels, data).map { label, point in
                AXDataPoint(x: label, y: point.amount)
            }
        )

        return AXChartDescriptor(
            title: title,
            summary: nil,
            xAxis: xAxis,
            yAxis: yAxis,
            additionalAxes: [],
            series: [series]
        )
    }
}
