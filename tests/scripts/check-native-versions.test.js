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

test('rechaza si el <pod> no tiene ni spec ni version', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" nospm="true"/>');

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /plugin\.xml/);
});

// Regresión del fix de la revisión: dos <pod name="KhipuClientIOS"> instalarían
// versiones distintas de CocoaPods según cuál gane. El check tiene que fallar por
// cardinalidad, no dar por buena una coincidencia parcial con el primero que encuentre.
test('rechaza si hay más de un <pod name="KhipuClientIOS">, aunque las versiones coincidan', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        PLUGIN_XML('2.16.5') + PLUGIN_XML('9.9.9'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /2/);
});

// Caso simétrico: si el <pod> sin `spec` es el primero, el check no debe dar un falso
// bloqueo por eso solo para aprobar tácitamente el segundo. Falla por cardinalidad antes
// de mirar `spec`, así que el mensaje tiene que hablar de la duplicación, no de `spec`.
test('rechaza dos <pod> aunque el primero no tenga spec y el segundo sí', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" nospm="true"/>' + PLUGIN_XML('2.16.5'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /2/);
});
