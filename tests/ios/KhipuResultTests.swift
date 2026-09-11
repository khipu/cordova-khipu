import XCTest
import KhipuClientIOS
@testable import CordovaKhipu

/// `KhipuResult` (KhipuClientIOS) declares no `CodingKeys`, so its synthesized `Decodable`
/// conformance decodes from JSON keys equal to its own property names: operationId,
/// exitTitle, exitMessage, result, events ([{name, timestamp, type}]), exitUrl,
/// failureReason, continueUrl. Its memberwise initialiser is not public, but
/// `init(from decoder:)` is — Swift gives a synthesized Decodable initialiser the type's
/// own access level — so a fixture can be built with `JSONDecoder` alone.
final class KhipuResultTests: XCTestCase {

    private static func decode(_ json: String) throws -> KhipuResult {
        return try JSONDecoder().decode(KhipuResult.self, from: Data(json.utf8))
    }

    /// The eight keys iOS emits, emitted the same way here. Mirrors
    /// KhipuResultMapperTest.emitsTheEightKeys on Android.
    func testEmitsTheEightKeys() throws {
        let result = try Self.decode("""
        {
            "operationId": "op-123",
            "exitTitle": "",
            "exitMessage": "",
            "result": "ERROR",
            "events": [{"name": "form", "timestamp": "2026-09-09T12:00:00Z", "type": "start"}],
            "exitUrl": "",
            "failureReason": "USER_CANCELED",
            "continueUrl": null
        }
        """)

        let dictionary = KhipuPlugin.makeResult(from: result)

        XCTAssertEqual(dictionary.count, 8)
        XCTAssertEqual(dictionary["operationId"] as? String, "op-123")
        XCTAssertEqual(dictionary["result"] as? String, "ERROR")
        XCTAssertEqual(dictionary["exitTitle"] as? String, "")
        XCTAssertEqual(dictionary["exitMessage"] as? String, "")
        XCTAssertEqual(dictionary["exitUrl"] as? String, "")
        XCTAssertEqual(dictionary["failureReason"] as? String, "USER_CANCELED")
    }

    /// The iOS half of Android's "key present and JSON null" assertion: the key must be
    /// present in the dictionary and its value must be `NSNull`, not simply absent.
    func testANilContinueUrlIsPresentAndIsNSNull() throws {
        let result = try Self.decode("""
        {
            "operationId": "op-123",
            "exitTitle": "",
            "exitMessage": "",
            "result": "ERROR",
            "events": [],
            "exitUrl": "",
            "failureReason": "USER_CANCELED",
            "continueUrl": null
        }
        """)

        let dictionary = KhipuPlugin.makeResult(from: result)

        XCTAssertNotNil(dictionary["continueUrl"], "the key must be present")
        XCTAssertTrue(dictionary["continueUrl"] is NSNull, "and it must be JSON null")
    }

    func testMapsEveryEventField() throws {
        let result = try Self.decode("""
        {
            "operationId": "op",
            "exitTitle": "",
            "exitMessage": "",
            "result": "OK",
            "events": [{"name": "form", "timestamp": "2026-09-09T12:00:00Z", "type": "start"}],
            "exitUrl": null,
            "failureReason": null,
            "continueUrl": null
        }
        """)

        let events = KhipuPlugin.makeResult(from: result)["events"] as? [[String: String]]
        let event = try XCTUnwrap(events?.first)

        XCTAssertEqual(event["name"], "form")
        XCTAssertEqual(event["type"], "start")
        XCTAssertEqual(event["timestamp"], "2026-09-09T12:00:00Z")
    }

    func testAnEmptyEventListIsAnEmptyArray() throws {
        let result = try Self.decode("""
        {
            "operationId": "op",
            "exitTitle": "",
            "exitMessage": "",
            "result": "OK",
            "events": [],
            "exitUrl": null,
            "failureReason": null,
            "continueUrl": null
        }
        """)

        let events = KhipuPlugin.makeResult(from: result)["events"] as? [[String: String]]

        XCTAssertEqual(events?.count, 0)
    }
}
