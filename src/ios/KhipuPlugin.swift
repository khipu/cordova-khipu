import UIKit
#if canImport(Cordova)
// cordova-ios 8 exposes CordovaLib as the `Cordova` module (it comes from
// CordovaLib/include/Cordova/). cordova-ios 7 has no module: CDVPlugin arrives
// through the project's bridging header instead, and this import does not apply.
import Cordova
#endif
import KhipuClientIOS

@objc(KhipuPlugin)
public class KhipuPlugin: CDVPlugin {

    @objc(startOperation:)
    func startOperation(command: CDVInvokedUrlCommand) {
        guard let call = command.arguments.first as? [String: Any],
              let operationId = call["operationId"] as? String else {
            handleError(command: command, message: "operationId must be provided and must be a string.")
            return
        }

        let options = KhipuOptionsMapper.makeOptions(from: KhipuOptionsMapper.parse(call))

        startKhipuOperation(operationId: operationId, options: options) { result, error in
            var pluginResult: CDVPluginResult
            if let error = error {
                pluginResult = CDVPluginResult(status: .error, messageAs: error)
            } else if let result = result {
                if (result["result"] as? String == "ERROR") {
                    pluginResult = CDVPluginResult(status: .error, messageAs: result)
                } else {
                    pluginResult = CDVPluginResult(status: .ok, messageAs: result)
                }
            } else {
                pluginResult = CDVPluginResult(status: .error, messageAs: "Unknown error")
            }
            self.commandDelegate.send(pluginResult, callbackId: command.callbackId)
        }
    }

    private func startKhipuOperation(operationId: String, options: KhipuOptions, completion: @escaping ([String: Any]?, String?) -> Void) {
        DispatchQueue.main.async {
            guard let presenter = self.presenter() else {
                completion(nil, "No view controller available to present from")
                return
            }

            KhipuLauncher.launch(presenter: presenter,
                                 operationId: operationId,
                                 options: options) { result in
                completion([
                    "operationId": result.operationId,
                    "result": result.result,
                    "exitTitle": result.exitTitle,
                    "exitMessage": result.exitMessage,
                    "exitUrl": Self.jsonValue(result.exitUrl),
                    "failureReason": Self.jsonValue(result.failureReason),
                    "continueUrl": Self.jsonValue(result.continueUrl),
                    "events": result.events.map { event in
                        return [
                            "name": event.name,
                            "type": event.type,
                            "timestamp": event.timestamp
                        ]
                    }
                ], nil)
            }
        }
    }

    /// `NSNull` rather than a bridged `nil`.
    ///
    /// `result.exitUrl as Any` did reach JavaScript as `null`, because Swift bridges a
    /// nil optional in an `Any` to `NSNull`. Saying so explicitly costs one function and
    /// means the behaviour is a decision rather than a property of the bridge, and it
    /// reads the same as Android's `JSONObject.NULL`, which is the other half of the same
    /// contract.
    private static func jsonValue(_ value: String?) -> Any {
        if let value = value {
            return value
        }
        return NSNull()
    }

    /// The controller to present Khipu's view from.
    ///
    /// It starts at `self.viewController`, which is the one Cordova associates with the
    /// webview the call came from. That is a better starting point than
    /// `UIApplication.shared.windows`: that API has been deprecated since iOS 15 — with
    /// no compiler warning at an iOS 13 floor — and it returns windows from every
    /// connected scene, including ones that are not on screen.
    ///
    /// From there it walks down the chain of presented controllers. UIKit refuses to
    /// present on a controller that is already presenting something, so a merchant who
    /// calls the plugin with their own modal up would see nothing. This used to be
    /// handled by dismissing whatever was there — closing the merchant's own modal — and
    /// waiting a fixed second for it to finish; walking the chain destroys nothing and
    /// needs no wait.
    ///
    /// Kept private to the plugin rather than as a `UIViewController` extension: the
    /// plugin links statically inside the merchant's app, where an extension with a name
    /// like this could collide with theirs.
    private func presenter() -> UIViewController? {
        var controller: UIViewController? = self.viewController

        while let presented = controller?.presentedViewController {
            controller = presented
        }

        return controller
    }

    private func handleError(command: CDVInvokedUrlCommand, message: String) {
        let pluginResult = CDVPluginResult(status: .error, messageAs: message)
        self.commandDelegate.send(pluginResult, callbackId: command.callbackId)
    }
}
