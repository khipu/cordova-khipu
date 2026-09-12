import Foundation
#if canImport(Cordova)
import Cordova
#endif
import KhipuClientIOS

/// Typed representation of the options that arrived from JavaScript.
///
/// It exists apart from `KhipuOptions` for two reasons. The practical one: that type's
/// properties are internal to `KhipuClientIOS`, so a test cannot read them back. The
/// design one: it separates what can fail — interpreting a dictionary a third party
/// built — from what cannot, which is applying already-validated values to the builder.
///
/// `nil` means "the JavaScript did not send this key", which is not the same as sending
/// it as `false`: the SDK applies its own defaults and the plugin has to let it.
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

    /// The twelve keys `KhipuColors` accepts, each paired with the setter it drives.
    ///
    /// One list rather than two. The keys and the setters used to be written out
    /// separately, which meant twelve names in one place and twelve calls in another with
    /// nothing tying them together. A key that is not here is discarded rather than
    /// propagated, so a typo in a merchant's JavaScript does not reach the SDK in silence.
    static let colorSetters: [(key: String, apply: (KhipuColors.Builder, String) -> KhipuColors.Builder)] = [
        ("lightBackground", { $0.lightBackground($1) }),
        ("lightOnBackground", { $0.lightOnBackground($1) }),
        ("lightPrimary", { $0.lightPrimary($1) }),
        ("lightOnPrimary", { $0.lightOnPrimary($1) }),
        ("lightTopBarContainer", { $0.lightTopBarContainer($1) }),
        ("lightOnTopBarContainer", { $0.lightOnTopBarContainer($1) }),
        ("darkBackground", { $0.darkBackground($1) }),
        ("darkOnBackground", { $0.darkOnBackground($1) }),
        ("darkPrimary", { $0.darkPrimary($1) }),
        ("darkOnPrimary", { $0.darkOnPrimary($1) }),
        ("darkTopBarContainer", { $0.darkTopBarContainer($1) }),
        ("darkOnTopBarContainer", { $0.darkOnTopBarContainer($1) })
    ]

    static var colorKeys: [String] {
        colorSetters.map(\.key)
    }

    /// A boolean, and not the numbers 0 and 1.
    ///
    /// `as? Bool` accepts them: `JSONSerialization` yields an `NSNumber` for a JSON boolean
    /// and for a JSON number alike, and bridging an `NSNumber` holding 0 or 1 to `Bool`
    /// succeeds. Android reads the same field with `instanceof Boolean`, which rejects a
    /// number outright, so `{ "showFooter": 0 }` used to hide the footer on iOS while
    /// leaving the SDK's default on Android — the same payload behaving two ways, which is
    /// what this mapper exists to prevent. `CFBooleanGetTypeID` is what tells the two apart
    /// once they are both `NSNumber`.
    private static func boolean(_ value: Any?) -> Bool? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number as CFTypeRef) == CFBooleanGetTypeID() else {
            return nil
        }

        return number.boolValue
    }

    /// Interprets the dictionary that arrived from JavaScript. It neither throws nor
    /// fails: a value of the wrong type is discarded as though it had never been sent.
    static func parse(_ call: [String: Any]) -> KhipuOptionsInput {
        guard let options = call["options"] as? [String: Any] else {
            return KhipuOptionsInput()
        }

        var input = KhipuOptionsInput()
        input.topBarTitle = options["title"] as? String
        input.topBarImageUrl = options["titleImageUrl"] as? String
        input.skipExitPage = boolean(options["skipExitPage"])
        input.skipExitSuccessPage = boolean(options["skipExitSuccessPage"])
        input.showFooter = boolean(options["showFooter"])
        input.showMerchantLogo = boolean(options["showMerchantLogo"])
        input.showPaymentDetails = boolean(options["showPaymentDetails"])
        input.locale = options["locale"] as? String

        if let theme = options["theme"] as? String {
            input.theme = KhipuOptions.Theme(rawValue: theme)
        }

        if let colors = options["colors"] as? [String: Any] {
            var valid: [String: String] = [:]
            for key in colorKeys {
                if let value = colors[key] as? String {
                    valid[key] = value
                }
            }
            input.colors = valid
        }

        return input
    }

    /// Applies an already-validated input to the SDK's builder.
    static func makeOptions(from input: KhipuOptionsInput) -> KhipuOptions {
        var builder = KhipuOptions.Builder()

        if let value = input.topBarTitle { builder = builder.topBarTitle(value) }
        if let value = input.topBarImageUrl { builder = builder.topBarImageUrl(value) }
        if let value = input.skipExitPage { builder = builder.skipExitPage(value) }
        if let value = input.skipExitSuccessPage { builder = builder.skipExitSuccessPage(value) }
        if let value = input.showFooter { builder = builder.showFooter(value) }
        if let value = input.showMerchantLogo { builder = builder.showMerchantLogo(value) }
        if let value = input.showPaymentDetails { builder = builder.showPaymentDetails(value) }
        if let value = input.locale { builder = builder.locale(value) }
        if let value = input.theme { builder = builder.theme(value) }

        if let colors = input.colors {
            builder = builder.colors(makeColors(from: colors))
        }

        return builder.build()
    }

    static func makeColors(from colors: [String: String]) -> KhipuColors {
        var builder = KhipuColors.Builder()

        for setter in colorSetters {
            if let value = colors[setter.key] {
                builder = setter.apply(builder, value)
            }
        }

        return builder.build()
    }
}
