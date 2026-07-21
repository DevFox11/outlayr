//
//  RoundedCorner.swift
//  Outlayr
//
//  Created by Rafael Soh on 21/8/23.
//

import ConfettiSwiftUI
import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}
