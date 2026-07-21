//
//  CustomCapsule.swift
//  Outlayr
//
//  Created by Rafael Soh on 24/10/23.
//

import Foundation
import SwiftUI

struct CustomCapsule: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let radius = rect.size.height / 2
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: width - radius, y: rect.minY))
        path.addArc(center: CGPoint(x: width - radius, y: rect.midY), radius: radius, startAngle: Angle(degrees: 270), endAngle: Angle(degrees: 90), clockwise: false)
        path.addLine(to: CGPoint(x: radius, y: rect.maxY))
        path.addArc(center: CGPoint(x: radius, y: rect.midY), radius: radius, startAngle: Angle(degrees: 90), endAngle: Angle(degrees: 270), clockwise: false)

        path.closeSubpath()
        return path
    }
}
