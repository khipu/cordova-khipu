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
