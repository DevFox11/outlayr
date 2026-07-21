//
//  InsightsChartMath.swift
//  Outlayr
//

import Foundation
import SwiftUI

func getMaxText(maxi: Int) -> String {
    if maxi == 0 {
        return "10"
    }

    let string = String(maxi)

    let stringArray = string.compactMap { String($0) }

    if maxi >= 1_000_000 {
        return stringArray[0] + "M"
    } else if maxi >= 100_000 {
        return string.prefix(3) + "k"
    } else if maxi >= 10000 {
        return string.prefix(2) + "k"
    } else if maxi >= 1000 {
        let string = String(maxi)

        let stringArray = string.compactMap { String($0) }

        return stringArray[0] + "." + stringArray[1] + "k"
    } else {
        return String(maxi)
    }
}

func getAverageText(average: Double) -> String {
    let string = String(average)

    let stringArray = string.compactMap { String($0) }

    if average >= 1_000_000 {
        return stringArray[0] + "M"
    } else if average >= 100_000 {
        return string.prefix(3) + "k"
    } else if average >= 10000 {
        return string.prefix(2) + "k"
    } else if average >= 1000 {
        return stringArray[0] + "." + stringArray[1] + "k"
    } else {
        return String(Int(round(average)))
    }
}

let barHeight = 150.0

func getOffset(maxi: Int, average: Double) -> Double {
    if maxi == 0 {
        return 0
    } else {
        let shiftedAmount = (average / Double(maxi)) * (barHeight)
        let height = (barHeight) - (shiftedAmount)
        return height - 10
    }
}

func getBarHeight(point: CGFloat, maxi: Int) -> CGFloat {
    if maxi == 0 {
        return 0
    } else {
        let height = (point / CGFloat(maxi)) * barHeight
        return height
    }
}
