// swift-tools-version:5.9

import PackageDescription

// The package name and the product name have to be exactly the plugin's id:
// cordova-ios generates `.product(name: "cordova-khipu", package:
// "cordova-khipu")` from it (SwiftPackage._pluginReference). The target's
// name is free.
//
// The dependency on apache/cordova-ios gets rewritten by cordova when
// installing the plugin, pointing it at the project's local CordovaLib; here
// it is only used to compile and test the standalone package. In practice it
// resolves to exact 8.0.0, because Apache tags later releases as `rel/8.1.1`
// and SPM does not read those tags as semver.
let package = Package(
    name: "cordova-khipu",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(name: "cordova-khipu", targets: ["CordovaKhipu"])
    ],
    dependencies: [
        .package(url: "https://github.com/apache/cordova-ios.git", from: "8.0.0"),
        .package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "2.17.1")
    ],
    targets: [
        .target(
            name: "CordovaKhipu",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "KhipuClientIOS", package: "KhipuClientIOS")
            ],
            path: "src/ios"
        ),
        .testTarget(
            name: "CordovaKhipuTests",
            dependencies: ["CordovaKhipu"],
            path: "tests/ios"
        )
    ]
)
