//
//  Sequence+Unique.swift
//  Outlayr
//
//  Created by Rafael Soh on 21/8/23.
//

import Foundation
import SwiftUI

extension Sequence where Iterator.Element: Hashable {
    func unique() -> [Iterator.Element] {
        var seen: Set<Iterator.Element> = []
        return filter { seen.insert($0).inserted }
    }
}
