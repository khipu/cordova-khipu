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

    /// El controller sobre el que presentar la vista de Khipu.
    ///
    /// Se parte de `self.viewController`, que es el que Cordova asocia al
    /// webview desde el que llegó la llamada. Es mejor punto de partida que
    /// `UIApplication.shared.windows`: esa API está deprecada desde iOS 15
    /// —sin que el compilador avise a un piso de iOS 13— y devuelve ventanas
    /// de todas las escenas conectadas, incluida alguna que no esté en
    /// pantalla.
    ///
    /// Después se baja por la cadena de presentados. UIKit rechaza presentar
    /// sobre un controller que ya está presentando algo, así que un comercio
    /// que llame al plugin con su propio modal arriba no vería nada. Antes esto
    /// se resolvía haciendo `dismiss` de lo que hubiera, es decir cerrándole el
    /// modal al comercio, y esperando un segundo fijo a que terminara; bajar
    /// por la cadena no destruye nada y no necesita esperar.
    ///
    /// Se deja privado al plugin en vez de como extensión de `UIViewController`:
    /// el plugin se enlaza estáticamente dentro de la app del comercio, donde
    /// una extensión con un nombre así puede chocar con la suya.
    private func presenter() -> UIViewController? {
        var controller: UIViewController? = self.viewController

        while let presentado = controller?.presentedViewController {
            controller = presentado
        }

        return controller
    }

    func handleError(command: CDVInvokedUrlCommand, message: String) {
        let pluginResult = CDVPluginResult(status: .error, messageAs: message)
        self.commandDelegate.send(pluginResult, callbackId: command.callbackId)
    }
}
