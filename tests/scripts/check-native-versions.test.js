const test = require('node:test');
const assert = require('node:assert');

const { compare } = require('../../scripts/check-native-versions.js');

const PACKAGE_SWIFT = version =>
    `.package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "${version}")`;

// El atributo que cordova-ios lee es `spec`, no `version`: Podfile.js solo emite la
// restricción si encuentra `spec`. Un `version=` se ignora en silencio y el pod queda sin pin.
const PLUGIN_XML = version =>
    `<pod name="KhipuClientIOS" spec="${version}" swift-version="5.1" nospm="true"/>`;

test('acepta versiones iguales', () => {
    const resultado = compare(PACKAGE_SWIFT('2.16.5'), PLUGIN_XML('2.16.5'));

    assert.strictEqual(resultado.ok, true);
    assert.match(resultado.message, /2\.16\.5/);
});

test('rechaza versiones distintas', () => {
    const resultado = compare(PACKAGE_SWIFT('2.16.5'), PLUGIN_XML('2.16.2'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /2\.16\.5/);
    assert.match(resultado.message, /2\.16\.2/);
});

test('rechaza si falta la versión en Package.swift', () => {
    const resultado = compare('let package = Package(name: "cordova-khipu")', PLUGIN_XML('2.16.5'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /Package\.swift/);
});

test('rechaza si falta el pod en plugin.xml', () => {
    const resultado = compare(PACKAGE_SWIFT('2.16.5'), '<plugin id="cordova-khipu"></plugin>');

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /plugin\.xml/);
});

test('tolera que los atributos del pod vengan en otro orden', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod spec="2.16.5" name="KhipuClientIOS" nospm="true"/>');

    assert.strictEqual(resultado.ok, true);
});

// Regresión del bug que encontró la Task 3: con `version=` el pod queda sin pin y cada
// comercio recibe la versión que CocoaPods resuelva. El check tiene que gritar, no pasar.
test('rechaza version= en vez de spec=, que cordova-ios ignora', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" version="2.16.5" nospm="true"/>');

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /plugin\.xml/);
});
