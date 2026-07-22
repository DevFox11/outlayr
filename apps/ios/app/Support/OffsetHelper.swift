//
//  OffsetHelper.swift
//  Outlayr
//
//  Created by Rafael Soh on 9/7/23.
//

import Foundation
import SwiftUI

struct OffsetKey: PreferenceKey {
    static var defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        value = nextValue()
    }
}

extension View {
    @ViewBuilder
    func offsetExtractor(coordinateSpace _: String, completion: @escaping (CGRect) -> Void) -> some View {
        overlay(alignment: .top) {
            GeometryReader {
                let rect = $0.frame(in: .global)
                Color.clear
                    .preference(key: OffsetKey.self, value: rect)
                    .onPreferenceChange(OffsetKey.self, perform: completion)
            }
        }
    }
}
