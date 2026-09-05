const test = require('node:test');
const assert = require('node:assert');

const { compare } = require('../../scripts/check-native-versions.js');

const PACKAGE_SWIFT = version =>
    `.package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "${version}")`;

// El atributo que cordova-ios lee es `spec`, no `version`: Podfile.js solo emite la
// restricción si encuentra `spec`. Un `version=` se ignora en silencio y el pod queda sin pin.
// Envuelto en <platform name="ios" package="swift">, que ahora `compare()` también verifica.
const PLUGIN_XML = version =>
    `<platform name="ios" package="swift"><podspec><pods><pod name="KhipuClientIOS" spec="${version}" swift-version="5.1" nospm="true"/></pods></podspec></platform>`;

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
        '<platform name="ios" package="swift"><pod spec="2.16.5" name="KhipuClientIOS" nospm="true"/></platform>');

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
        PLUGIN_XML('2.16.5') + PLUGIN_XML('2.16.5'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /2 etiquetas/);
});

// Caso simétrico: si el <pod> sin `spec` es el primero, el check no debe dar un falso
// bloqueo por eso solo para aprobar tácitamente el segundo. Falla por cardinalidad antes
// de mirar `spec`, así que el mensaje tiene que hablar de la duplicación, no de `spec`.
test('rechaza dos <pod> aunque el primero no tenga spec y el segundo sí', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" nospm="true"/>' + PLUGIN_XML('2.16.5'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /2 etiquetas/);
});

// I2: `nospm="true"` es lo que hace que cordova-ios 8 descarte el pod. Si se cae, el camino
// SPM empieza a exigir CocoaPods además y el SDK queda enlazado dos veces.
test('rechaza si el <pod> perdió `nospm="true"`', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<platform name="ios" package="swift"><pod name="KhipuClientIOS" spec="2.16.5"/></platform>');

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /nospm/);
});

// I2: `package="swift"` en <platform name="ios"> es lo que hace que cordova-ios 8 reconozca
// el plugin como paquete SPM. Sin él, cordova-ios 8 deja de usar SPM.
test('rechaza si <platform name="ios"> perdió `package="swift"`', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<platform name="ios"><pod name="KhipuClientIOS" spec="2.16.5" nospm="true"/></platform>');

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /package="swift"/);
});

// I2: SPM toma el directorio src/ios/ completo, pero CocoaPods (cordova-ios 7) solo instala lo
// que declara un <source-file> explícito. Un archivo nuevo compilaría bajo cordova-ios 8 y
// faltaría en silencio bajo el 7 si nadie le agrega su <source-file>.
test('acepta cuando todos los .swift de src/ios/ tienen su <source-file>', () => {
    const pluginXml =
        '<platform name="ios" package="swift">' +
        '<podspec><pods><pod name="KhipuClientIOS" spec="2.16.5" nospm="true"/></pods></podspec>' +
        '<source-file src="src/ios/KhipuPlugin.swift"/>' +
        '<source-file src="src/ios/KhipuOptionsMapper.swift"/>' +
        '</platform>';

    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        pluginXml,
        ['KhipuPlugin.swift', 'KhipuOptionsMapper.swift']);

    assert.strictEqual(resultado.ok, true);
});

test('rechaza un .swift de src/ios/ sin su <source-file> en plugin.xml', () => {
    const pluginXml =
        '<platform name="ios" package="swift">' +
        '<podspec><pods><pod name="KhipuClientIOS" spec="2.16.5" nospm="true"/></pods></podspec>' +
        '<source-file src="src/ios/KhipuPlugin.swift"/>' +
        '</platform>';

    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        pluginXml,
        ['KhipuPlugin.swift', 'KhipuArchivoNuevo.swift']);

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /KhipuArchivoNuevo\.swift/);
});
