import XCTest
import KhipuClientIOS
@testable import CordovaKhipu

final class KhipuOptionsMapperTests: XCTestCase {

    /// Parses a fixture the way the plugin really receives one.
    ///
    /// Cordova hands `command.arguments` over after JSON parsing, so a JSON number arrives
    /// as `NSNumber` and a JSON boolean arrives as `NSNumber` too — a `CFBoolean` one. A
    /// Swift dictionary literal does not reproduce that: it boxes a native `Int`, which
    /// `as? Bool` rejects for reasons that have nothing to do with the code under test. A
    /// test written that way passes whether or not the mapper is correct.
    private func parse(_ json: String) throws -> KhipuOptionsInput {
        let data = Data(json.utf8)
        let call = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        return KhipuOptionsMapper.parse(call)
    }

    func testWithNoOptionsKeyEverythingIsNil() {
        let input = KhipuOptionsMapper.parse(["operationId": "abc"])

        XCTAssertEqual(input, KhipuOptionsInput())
    }

    func testMapsEveryScalarField() {
        let input = KhipuOptionsMapper.parse([
            "operationId": "abc",
            "options": [
                "title": "Demo",
                "titleImageUrl": "https://khipu.com/logo.png",
                "skipExitPage": true,
                "skipExitSuccessPage": false,
                "showFooter": false,
                "showMerchantLogo": true,
                "showPaymentDetails": false,
                "locale": "es_CL",
                "theme": "dark"
            ]
        ])

        XCTAssertEqual(input.topBarTitle, "Demo")
        XCTAssertEqual(input.topBarImageUrl, "https://khipu.com/logo.png")
        XCTAssertEqual(input.skipExitPage, true)
        XCTAssertEqual(input.skipExitSuccessPage, false)
        XCTAssertEqual(input.showFooter, false)
        XCTAssertEqual(input.showMerchantLogo, true)
        XCTAssertEqual(input.showPaymentDetails, false)
        XCTAssertEqual(input.locale, "es_CL")
        XCTAssertEqual(input.theme, .dark)
    }

    /// The plugin has to tell "they did not send me the key" apart from "they sent me
    /// false": the SDK applies its own defaults.
    func testAnAbsentKeyIsNotConfusedWithFalse() {
        let input = KhipuOptionsMapper.parse(["options": ["title": "Demo"]])

        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.skipExitPage)
        XCTAssertNil(input.showMerchantLogo)
        XCTAssertNil(input.showPaymentDetails)
        XCTAssertNil(input.skipExitSuccessPage)
    }

    /// This is the divergence that made Android and iOS disagree.
    func testAWrongTypeIsDiscardedRatherThanCoerced() throws {
        let input = try parse(#"{"options":{"title":123,"showFooter":"yes","locale":["es","CL"]}}"#)

        XCTAssertNil(input.topBarTitle)
        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.locale)
    }

    func testAnUnknownThemeIsDiscarded() {
        XCTAssertNil(KhipuOptionsMapper.parse(["options": ["theme": "neon"]]).theme)
    }

    func testMapsTheTwelveColourKeys() {
        var colors: [String: Any] = [:]
        for (index, key) in KhipuOptionsMapper.colorKeys.enumerated() {
            colors[key] = String(format: "#%06X", index)
        }

        let input = KhipuOptionsMapper.parse(["options": ["colors": colors]])

        XCTAssertEqual(input.colors?.count, 12)
        XCTAssertEqual(input.colors?["lightPrimary"], "#000002")
    }

    func testAnUnknownColourKeyIsDiscarded() {
        let input = KhipuOptionsMapper.parse([
            "options": ["colors": ["lightPrimary": "#8347AD", "purple": "#8347AD"]]
        ])

        XCTAssertEqual(input.colors, ["lightPrimary": "#8347AD"])
    }

    func testEmptyColorsIsStillDifferentFromAbsent() {
        XCTAssertEqual(KhipuOptionsMapper.parse(["options": ["colors": [String: Any]()]]).colors, [:])
        XCTAssertNil(KhipuOptionsMapper.parse(["options": [String: Any]()]).colors)
    }

    /// `KhipuColors` has internal properties but is `Codable`, so the object the SDK
    /// actually receives can be verified.
    func testColorsReachTheSdkObject() throws {
        let colors = KhipuOptionsMapper.makeColors(from: [
            "lightPrimary": "#8347AD",
            "darkPrimary": "#3CB4E5"
        ])

        let data = try JSONEncoder().encode(colors)
        let decoded = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(decoded["lightPrimary"] as? String, "#8347AD")
        XCTAssertEqual(decoded["darkPrimary"] as? String, "#3CB4E5")
        XCTAssertNil(decoded["lightBackground"])
    }

    /// The previous test only exercises two of the twelve entries in `colorSetters`. A
    /// setter wired to the wrong key in any of the other ten — for example
    /// `darkOnBackground` calling `darkBackground` — would pass that test just the same,
    /// because `lightPrimary` and `darkPrimary` do not share a setter with anyone. Here,
    /// all twelve keys receive a value distinct from each other, so that a mix-up would
    /// show: if two keys shared a setter, their decoded values would come out swapped or
    /// duplicated instead of each with its own.
    func testAllTwelveColorsReachTheCorrectSetter() throws {
        var colors: [String: String] = [:]
        for (index, key) in KhipuOptionsMapper.colorKeys.enumerated() {
            colors[key] = String(format: "#%06X", index)
        }

        let applied = KhipuOptionsMapper.makeColors(from: colors)

        let data = try JSONEncoder().encode(applied)
        let decoded = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(decoded.count, KhipuOptionsMapper.colorKeys.count)
        for key in KhipuOptionsMapper.colorKeys {
            XCTAssertEqual(
                decoded[key] as? String,
                colors[key],
                "\(key) did not reach the SDK with its own value")
        }
    }

    /// The table is the single source of both the keys and the setters, so unlike the Java
    /// side there is no second structure that could drift out of step with it — `colorKeys`
    /// is derived from `colorSetters`. What is still worth pinning is the count: an entry
    /// dropped or duplicated in a merge would go unnoticed otherwise. That each key reaches
    /// its own field is covered by testAllTwelveColorsReachTheCorrectSetter.
    func testTheColourTableHasTwelveEntries() {
        XCTAssertEqual(KhipuOptionsMapper.colorSetters.count, 12)
        XCTAssertEqual(Set(KhipuOptionsMapper.colorKeys).count, 12, "a duplicated key would silently shadow a setter")
    }

    /// The divergence that survived the rest of this work: `as? Bool` accepts an NSNumber
    /// holding 0 or 1, while Android's `instanceof Boolean` rejects it, so this payload
    /// used to hide the footer on iOS and leave the SDK's default on Android.
    func testANumberIsNotABoolean() throws {
        let input = try parse(#"{"options":{"showFooter":0,"showMerchantLogo":1,"skipExitPage":2}}"#)

        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.showMerchantLogo)
        XCTAssertNil(input.skipExitPage)
    }

    /// The guard above must not cost us real booleans.
    func testRealBooleansStillArrive() throws {
        let input = try parse(#"{"options":{"showFooter":true,"showMerchantLogo":false}}"#)

        XCTAssertEqual(input.showFooter, true)
        XCTAssertEqual(input.showMerchantLogo, false)
    }
}
