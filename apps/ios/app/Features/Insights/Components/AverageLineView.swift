//
//  WeekGraphView.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct AverageLineView: View {
    var getMax: Int
    var average: Double

//    @State var showLine: Bool = false
//    @State var offset: CGFloat

//    var calculatedOffset: CGFloat {
//        return getOffset(maxi: getMax, average: average)
//    }

    var body: some View {
        HStack(spacing: 2) {
            PencilView(text: getAverageText(average: average))

            Line()
                .stroke(Color.SubtitleText, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5]))
                .frame(height: 1)
                .frame(maxWidth: .infinity)
        }
//        .opacity(showLine ? 1 : 0)
        .offset(y: getOffset(maxi: getMax, average: average))
        .opacity((average / Double(getMax)) < 0.1 || (average / Double(getMax)) > 0.9 ? 0 : 1)
//        .onAppear {
//            DispatchQueue.main.sync {
//                withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
//                    print(calculatedOffset)
//                    offset = calculatedOffset
//                }
//            }
//        }
//        .onChange(of: showLine) { newValue in
//            if newValue {
//                DispatchQueue.main.asyncAfter(deadline: .now()) {
//                    if !animated {
//                        offset = calculatedOffset
//                    } else {
//                        
//                    }
//                }
//            }
//        }
//        .onChange(of: calculatedOffset) { newValue in
//            print(calculatedOffset)
//            if newValue != 0 {
//                if showLine {
//                    if !animated {
//                        offset = calculatedOffset
//                    } else {
//                        withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
//                            offset = calculatedOffset
//                        }
//                    }
//                }
//            }
//        }

    }
}
