//
//  LineGraph.swift
//  Outlayr
//
//  Created by Rafael Soh on 25/11/22.
//

import Foundation
import SwiftUI

struct DottedLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.width / 2, y: 0))
        path.addLine(to: CGPoint(x: rect.width / 2, y: rect.height))
        return path
    }
}
