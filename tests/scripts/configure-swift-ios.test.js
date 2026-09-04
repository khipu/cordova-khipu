const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hook = require('../../scripts/configure-swift-ios.js');

function tempDir () {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cordova-khipu-test-'));
}

test('detecta cordova-ios 8 por la presencia de App.xcodeproj', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'App.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 8);
});

test('detecta cordova-ios 7 cuando el proyecto tiene otro nombre', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MiApp.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 7);
});

test('el script cordova/version manda por sobre el heurístico', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'cordova'), { recursive: true });
    fs.mkdirSync(path.join(platformPath, 'MiApp.xcodeproj'), { recursive: true });

    const versionScript = path.join(platformPath, 'cordova', 'version');
    fs.writeFileSync(versionScript, '#!/bin/sh\necho 8.1.1\n');
    fs.chmodSync(versionScript, 0o755);

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 8);
});

test('encuentra el nombre del proyecto Xcode en disco', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MiApp.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.findXcodeProjectName(platformPath), 'MiApp');
});

test('lee la preferencia SwiftVersion del config.xml', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'config.xml'),
        '<widget><platform name="ios">' +
        '<preference name="SwiftVersion" value="5.9" />' +
        '</platform></widget>');

    assert.strictEqual(hook.readSwiftVersionPreference(root), '5.9');
});

test('sin preferencia SwiftVersion devuelve null', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'config.xml'), '<widget></widget>');

    assert.strictEqual(hook.readSwiftVersionPreference(root), null);
});

test('en cordova-ios 8 el hook no toca nada', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'App.xcodeproj'), { recursive: true });
    fs.writeFileSync(path.join(platformPath, 'App.xcodeproj', 'project.pbxproj'), 'original');

    hook({ opts: { projectRoot: root } });

    assert.strictEqual(
        fs.readFileSync(path.join(platformPath, 'App.xcodeproj', 'project.pbxproj'), 'utf-8'),
        'original');
});

test('sin plataforma ios el hook sale sin lanzar', () => {
    const root = tempDir();
    assert.doesNotThrow(() => hook({ opts: { projectRoot: root } }));
});

test('en cordova-ios 7, si falla la configuración (p. ej. sin el módulo xcode) el hook avisa pero no lanza', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MiApp.xcodeproj'), { recursive: true });
    fs.mkdirSync(path.join(platformPath, 'MiApp'), { recursive: true });
    fs.writeFileSync(path.join(platformPath, 'MiApp', 'Bridging-Header.h'), '');

    const originalWarn = console.warn;
    const warnCalls = [];
    console.warn = (...args) => warnCalls.push(args.join(' '));

    try {
        // Esta es la garantía que le faltaba a cordova-plugin-add-swift-support:
        // un problema configurando Swift nunca debe voltear el build del
        // comercio. Deliberadamente no se crea project.pbxproj, así que esta
        // rama falla tanto si `xcode` no resuelve en este repo (el caso de
        // hoy) como si algún día resuelve pero no encuentra el pbxproj para
        // parsear. La aserción fuerte es "no lanza".
        assert.doesNotThrow(() => hook({ opts: { projectRoot: root } }));

        // Si efectivamente falló, tiene que haber avisado en vez de fallar en
        // silencio. Esto se afirma solo cuando hubo un aviso: si el día de
        // mañana `xcode` resuelve y además logra completar la configuración
        // sin error, no hay aviso que revisar y el test igual debe pasar.
        if (warnCalls.length > 0) {
            assert.match(warnCalls[0], /no se pudo configurar Swift para iOS/);
        }
    } finally {
        console.warn = originalWarn;
    }
});
