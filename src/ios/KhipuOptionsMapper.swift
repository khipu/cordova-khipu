#if canImport(Cordova)
import Cordova
#endif
import KhipuClientIOS

/// Representación tipada de las opciones que llegan desde JavaScript.
///
/// Existe separada de `KhipuOptions` por dos razones. La primera es práctica:
/// las propiedades de `KhipuOptions` son internas a `KhipuClientIOS`, así que
/// un test no puede leerlas. La segunda es de diseño: separa lo que puede
/// fallar —interpretar un diccionario que arma un tercero— de lo que no,
/// que es aplicar valores ya validados sobre el Builder.
///
/// `nil` significa "el JavaScript no mandó esta clave", que no es lo mismo que
/// mandarla en `false`: el SDK aplica sus propios valores por omisión y el
/// plugin tiene que dejarlo hacerlo.
struct KhipuOptionsInput: Equatable {
    var topBarTitle: String?
    var topBarImageUrl: String?
    var skipExitPage: Bool?
    var skipExitSuccessPage: Bool?
    var showFooter: Bool?
    var showMerchantLogo: Bool?
    var showPaymentDetails: Bool?
    var locale: String?
    var theme: KhipuOptions.Theme?
    var colors: [String: String]?
}

enum KhipuOptionsMapper {

    /// Las doce claves que acepta `KhipuColors`. Una clave que no esté acá se
    /// descarta en vez de propagarse, para que un typo en el JavaScript del
    /// comercio no llegue silenciosamente al SDK.
    static let colorKeys: [String] = [
        "lightBackground",
        "lightOnBackground",
        "lightPrimary",
        "lightOnPrimary",
        "lightTopBarContainer",
        "lightOnTopBarContainer",
        "darkBackground",
        "darkOnBackground",
        "darkPrimary",
        "darkOnPrimary",
        "darkTopBarContainer",
        "darkOnTopBarContainer"
    ]

    /// Interpreta el diccionario que llega desde JavaScript. No lanza ni cae:
    /// un valor con el tipo equivocado se descarta como si no hubiera venido.
    static func parse(_ call: [String: Any]) -> KhipuOptionsInput {
        guard let options = call["options"] as? [String: Any] else {
            return KhipuOptionsInput()
        }

        var input = KhipuOptionsInput()
        input.topBarTitle = options["title"] as? String
        input.topBarImageUrl = options["titleImageUrl"] as? String
        input.skipExitPage = options["skipExitPage"] as? Bool
        input.skipExitSuccessPage = options["skipExitSuccessPage"] as? Bool
        input.showFooter = options["showFooter"] as? Bool
        input.showMerchantLogo = options["showMerchantLogo"] as? Bool
        input.showPaymentDetails = options["showPaymentDetails"] as? Bool
        input.locale = options["locale"] as? String

        if let theme = options["theme"] as? String {
            input.theme = KhipuOptions.Theme(rawValue: theme)
        }

        if let colors = options["colors"] as? [String: Any] {
            var validos: [String: String] = [:]
            for clave in colorKeys {
                if let valor = colors[clave] as? String {
                    validos[clave] = valor
                }
            }
            input.colors = validos
        }

        return input
    }

    /// Aplica un input ya validado sobre el Builder del SDK.
    static func makeOptions(from input: KhipuOptionsInput) -> KhipuOptions {
        var builder = KhipuOptions.Builder()

        if let valor = input.topBarTitle { builder = builder.topBarTitle(valor) }
        if let valor = input.topBarImageUrl { builder = builder.topBarImageUrl(valor) }
        if let valor = input.skipExitPage { builder = builder.skipExitPage(valor) }
        if let valor = input.skipExitSuccessPage { builder = builder.skipExitSuccessPage(valor) }
        if let valor = input.showFooter { builder = builder.showFooter(valor) }
        if let valor = input.showMerchantLogo { builder = builder.showMerchantLogo(valor) }
        if let valor = input.showPaymentDetails { builder = builder.showPaymentDetails(valor) }
        if let valor = input.locale { builder = builder.locale(valor) }
        if let valor = input.theme { builder = builder.theme(valor) }

        if let colores = input.colors {
            builder = builder.colors(makeColors(from: colores))
        }

        return builder.build()
    }

    static func makeColors(from colors: [String: String]) -> KhipuColors {
        var builder = KhipuColors.Builder()

        if let valor = colors["lightBackground"] { builder = builder.lightBackground(valor) }
        if let valor = colors["lightOnBackground"] { builder = builder.lightOnBackground(valor) }
        if let valor = colors["lightPrimary"] { builder = builder.lightPrimary(valor) }
        if let valor = colors["lightOnPrimary"] { builder = builder.lightOnPrimary(valor) }
        if let valor = colors["lightTopBarContainer"] { builder = builder.lightTopBarContainer(valor) }
        if let valor = colors["lightOnTopBarContainer"] { builder = builder.lightOnTopBarContainer(valor) }
        if let valor = colors["darkBackground"] { builder = builder.darkBackground(valor) }
        if let valor = colors["darkOnBackground"] { builder = builder.darkOnBackground(valor) }
        if let valor = colors["darkPrimary"] { builder = builder.darkPrimary(valor) }
        if let valor = colors["darkOnPrimary"] { builder = builder.darkOnPrimary(valor) }
        if let valor = colors["darkTopBarContainer"] { builder = builder.darkTopBarContainer(valor) }
        if let valor = colors["darkOnTopBarContainer"] { builder = builder.darkOnTopBarContainer(valor) }

        return builder.build()
    }
}
