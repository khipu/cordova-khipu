// swift-tools-version:5.9

import PackageDescription

// El nombre del package y el del product tienen que ser exactamente el id del
// plugin: cordova-ios genera `.product(name: "cordova-khipu", package:
// "cordova-khipu")` a partir de él (SwiftPackage._pluginReference). El nombre
// del target sí es libre.
//
// La dependencia a apache/cordova-ios la reescribe cordova al instalar el
// plugin, apuntándola a la CordovaLib local del proyecto; acá solo se usa para
// compilar y testear el paquete suelto. En la práctica resuelve a 8.0.0 exacto,
// porque Apache etiqueta los releases posteriores como `rel/8.1.1` y SPM no lee
// esos tags como semver.
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
        .package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "2.16.5")
    ],
    targets: [
        .target(
            name: "CordovaKhipu",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "KhipuClientIOS", package: "KhipuClientIOS")
            ],
            path: "src/ios"
        )
    ]
)
