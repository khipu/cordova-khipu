import XCTest
import KhipuClientIOS
@testable import CordovaKhipu

final class KhipuOptionsMapperTests: XCTestCase {

    func testSinClaveOptionsDevuelveTodoNil() {
        let input = KhipuOptionsMapper.parse(["operationId": "abc"])

        XCTAssertEqual(input, KhipuOptionsInput())
    }

    func testMapeaTodosLosCamposEscalares() {
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

    /// El plugin tiene que poder distinguir "no me mandaron la clave" de
    /// "me mandaron false": el SDK aplica sus propios valores por omisión.
    func testClaveAusenteNoSeConfundeConFalse() {
        let input = KhipuOptionsMapper.parse(["options": ["title": "Demo"]])

        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.skipExitPage)
        XCTAssertNil(input.showMerchantLogo)
        XCTAssertNil(input.showPaymentDetails)
        XCTAssertNil(input.skipExitSuccessPage)
    }

    /// Este es el caso que hoy crashea la app.
    func testTipoEquivocadoSeDescartaEnVezDeCrashear() {
        let input = KhipuOptionsMapper.parse([
            "options": [
                "title": 123,
                "showFooter": "sí",
                "locale": ["es", "CL"]
            ]
        ])

        XCTAssertNil(input.topBarTitle)
        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.locale)
    }

    func testThemeDesconocidoSeDescarta() {
        XCTAssertNil(KhipuOptionsMapper.parse(["options": ["theme": "neón"]]).theme)
    }

    func testMapeaLasDoceClavesDeColor() {
        var colores: [String: Any] = [:]
        for (indice, clave) in KhipuOptionsMapper.colorKeys.enumerated() {
            colores[clave] = String(format: "#%06X", indice)
        }

        let input = KhipuOptionsMapper.parse(["options": ["colors": colores]])

        XCTAssertEqual(input.colors?.count, 12)
        XCTAssertEqual(input.colors?["lightPrimary"], "#000002")
    }

    func testDescartaClavesDeColorDesconocidas() {
        let input = KhipuOptionsMapper.parse([
            "options": ["colors": ["lightPrimary": "#8347AD", "morado": "#8347AD"]]
        ])

        XCTAssertEqual(input.colors, ["lightPrimary": "#8347AD"])
    }

    func testColorsVacioSigueSiendoDistintoDeAusente() {
        XCTAssertEqual(KhipuOptionsMapper.parse(["options": ["colors": [String: Any]()]]).colors, [:])
        XCTAssertNil(KhipuOptionsMapper.parse(["options": [String: Any]()]).colors)
    }

    /// `KhipuColors` tiene propiedades internas pero es `Codable`, así que se
    /// puede verificar el objeto que efectivamente recibe el SDK.
    func testLosColoresLleganAlObjetoDelSdk() throws {
        let colors = KhipuOptionsMapper.makeColors(from: [
            "lightPrimary": "#8347AD",
            "darkPrimary": "#3CB4E5"
        ])

        let datos = try JSONEncoder().encode(colors)
        let decodificado = try XCTUnwrap(
            JSONSerialization.jsonObject(with: datos) as? [String: Any])

        XCTAssertEqual(decodificado["lightPrimary"] as? String, "#8347AD")
        XCTAssertEqual(decodificado["darkPrimary"] as? String, "#3CB4E5")
        XCTAssertNil(decodificado["lightBackground"])
    }

    /// El test anterior solo ejercita dos de los doce `if let` de `makeColors`. Un setter
    /// cruzado en cualquiera de los otros diez —por ejemplo `darkOnBackground` llamando a
    /// `darkBackground`— pasaría esa prueba igual, porque `lightPrimary` y `darkPrimary` no
    /// comparten setter con nadie. Acá las doce claves reciben un valor distinto entre sí, para
    /// que un cruce se note: si dos claves compartieran setter, sus valores decodificados
    /// quedarían intercambiados o duplicados en vez de cada uno con el suyo.
    func testLosDoceColoresLleganAlSetterCorrecto() throws {
        var colores: [String: String] = [:]
        for (indice, clave) in KhipuOptionsMapper.colorKeys.enumerated() {
            colores[clave] = String(format: "#%06X", indice)
        }

        let colors = KhipuOptionsMapper.makeColors(from: colores)

        let datos = try JSONEncoder().encode(colors)
        let decodificado = try XCTUnwrap(
            JSONSerialization.jsonObject(with: datos) as? [String: Any])

        XCTAssertEqual(decodificado.count, KhipuOptionsMapper.colorKeys.count)
        for clave in KhipuOptionsMapper.colorKeys {
            XCTAssertEqual(
                decodificado[clave] as? String,
                colores[clave],
                "\(clave) no llegó al SDK con su propio valor")
        }
    }
}
