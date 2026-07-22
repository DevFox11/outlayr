// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "OutlayrCore",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "OutlayrCore",
            targets: ["OutlayrCore"]
        )
    ],
    targets: [
        .target(
            name: "OutlayrCore",
            path: "Sources/OutlayrCore"
        )
    ]
)
