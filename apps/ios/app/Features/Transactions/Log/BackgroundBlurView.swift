//
//  BackgroundBlurView.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct BackgroundBlurView: UIViewRepresentable {
    func makeUIView(context _: Context) -> UIView {
        let view = UIView()
        Task {
            view.superview?.superview?.backgroundColor = .clear
        }
        return view
    }

    func updateUIView(_: UIView, context _: Context) {}
}
