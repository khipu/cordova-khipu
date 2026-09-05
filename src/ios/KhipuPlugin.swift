import UIKit
#if canImport(Cordova)
// cordova-ios 8 expone CordovaLib como el módulo `Cordova` (viene de
// CordovaLib/include/Cordova/). En cordova-ios 7 no hay módulo: CDVPlugin llega
// por el bridging header del proyecto y este import no aplica.
import Cordova
#endif
import KhipuClientIOS

@objc(KhipuPlugin)
public class KhipuPlugin: CDVPlugin {

    @objc(startOperation:)
    func startOperation(command: CDVInvokedUrlCommand) {
        guard let call = command.arguments[0] as? [String: Any],
              let operationId = call["operationId"] as? String, !call.isEmpty else {
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

    func startKhipuOperation(operationId: String, options: KhipuOptions, completion: @escaping ([String: Any]?, String?) -> Void) {
        DispatchQueue.main.async {
            guard let presenter = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first?.rootViewController else {
                completion(nil, "No rootViewController found")
                return
            }
            presenter.presentedViewController?.dismiss(animated: false)

            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                KhipuLauncher.launch(presenter: presenter,
                                     operationId: operationId,
                                     options: options) { result in
                    completion([
                        "operationId": result.operationId,
                        "result": result.result,
                        "exitTitle": result.exitTitle,
                        "exitMessage": result.exitMessage,
                        "exitUrl": result.exitUrl as Any,
                        "failureReason": result.failureReason as Any,
                        "continueUrl": result.continueUrl as Any,
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
    }

    func handleError(command: CDVInvokedUrlCommand, message: String) {
        let pluginResult = CDVPluginResult(status: .error, messageAs: message)
        self.commandDelegate.send(pluginResult, callbackId: command.callbackId)
    }
}
