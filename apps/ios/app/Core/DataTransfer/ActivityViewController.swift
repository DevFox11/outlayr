//
//  ActivityViewController.swift
//  Outlayr
//
//  Created by Rafael Soh on 21/8/23.
//

import ConfettiSwiftUI
import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ActivityViewController: UIViewControllerRepresentable {
    var activityItems: [Any]
    var applicationActivities: [UIActivity]?

    func makeUIViewController(context _: UIViewControllerRepresentableContext<ActivityViewController>) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
        return controller
    }

    func updateUIViewController(_: UIActivityViewController, context _: UIViewControllerRepresentableContext<ActivityViewController>) {}
}
