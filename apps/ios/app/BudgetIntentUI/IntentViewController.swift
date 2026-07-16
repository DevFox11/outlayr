//
//  IntentViewController.swift
//  BudgetIntentUI
//
//  Created by Rafael Soh on 17/8/22.
//

import IntentsUI

// As an example, this extension's Info.plist has been configured to handle interactions for INSendMessageIntent.
// You will want to replace this or add other intents as appropriate.
// The intents whose interactions you wish to handle must be declared in the extension's Info.plist.

// You can test this example integration by saying things to Siri like:
// "Send a message using <myApp>"

class IntentViewController: UIViewController, INUIHostedViewControlling {
    // MARK: - INUIHostedViewControlling

    // Prepare your view controller for the interaction to handle.
    func configureView(for parameters: Set<INParameter>, of _: INInteraction, interactiveBehavior _: INUIInteractiveBehavior, context _: INUIHostedViewContext, completion: @escaping (Bool, Set<INParameter>, CGSize) -> Void) {
        guard DataController.storeIsAvailable else {
            // Broken app group: surface a visible error instead of hosting a view
            // backed by an unreadable store.
            let label = UILabel()
            label.text = "Storage unavailable"
            label.textAlignment = .center
            label.numberOfLines = 0
            label.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(label)
            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
                label.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 16),
                label.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -16)
            ])
            completion(true, parameters, CGSize(width: 320, height: 60))
            return
        }

        // Do configuration here, including preparing views and calculating a desired size for presentation.
        completion(true, parameters, desiredSize)
    }

    var desiredSize: CGSize {
        return extensionContext!.hostedViewMaximumAllowedSize
    }
}
