//
//  LineGraph.swift
//  Outlayr
//
//  Created by Rafael Soh on 25/11/22.
//

import Foundation
import SwiftUI

// MARK: Animated Path

struct AnimatedGraphPath: Shape {
    var progress: CGFloat
    var points: [CGPoint]
    var animatableData: CGFloat {
        get { return progress }
        set { progress = newValue }
    }

    func path(in _: CGRect) -> Path {
        Path { path in

            // drawing the points..
            path.move(to: CGPoint(x: 0, y: 0))

            path.addLines(points)
        }
        .trimmedPath(from: 0, to: progress)
        .strokedPath(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
    }
}
