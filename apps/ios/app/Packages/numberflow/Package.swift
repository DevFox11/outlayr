// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NumberFlow",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "NumberFlow", targets: ["NumberFlow"])
    ],
    targets: [
        .target(name: "NumberFlow"),
        .testTarget(name: "NumberFlowTests", dependencies: ["NumberFlow"])
    ]
)
