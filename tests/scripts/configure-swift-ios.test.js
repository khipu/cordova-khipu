const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hook = require('../../scripts/configure-swift-ios.js');

function tempDir () {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cordova-khipu-test-'));
}

test('detects cordova-ios 8 from the presence of App.xcodeproj', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'App.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 8);
});

test('detects cordova-ios 7 when the project has a different name', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MyApp.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 7);
});

test('with no .xcodeproj and no version script, falls back to the inert side (8)', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(platformPath, { recursive: true });

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 8);
});

test('the cordova/version script wins over the heuristic', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'cordova'), { recursive: true });
    fs.mkdirSync(path.join(platformPath, 'MyApp.xcodeproj'), { recursive: true });

    const versionScript = path.join(platformPath, 'cordova', 'version');
    fs.writeFileSync(versionScript, '#!/bin/sh\necho 8.1.1\n');
    fs.chmodSync(versionScript, 0o755);

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 8);
});

test('finds the Xcode project name on disk', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MyApp.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.findXcodeProjectName(platformPath), 'MyApp');
});

test('reads the SwiftVersion preference from config.xml', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'config.xml'),
        '<widget><platform name="ios">' +
        '<preference name="SwiftVersion" value="5.9" />' +
        '</platform></widget>');

    assert.strictEqual(hook.readSwiftVersionPreference(root), '5.9');
});

test('returns null with no SwiftVersion preference', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'config.xml'), '<widget></widget>');

    assert.strictEqual(hook.readSwiftVersionPreference(root), null);
});

test('on cordova-ios 8 the hook touches nothing', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'App.xcodeproj'), { recursive: true });
    fs.writeFileSync(path.join(platformPath, 'App.xcodeproj', 'project.pbxproj'), 'original');

    hook({ opts: { projectRoot: root } });

    assert.strictEqual(
        fs.readFileSync(path.join(platformPath, 'App.xcodeproj', 'project.pbxproj'), 'utf-8'),
        'original');
});

test('with no ios platform the hook exits without throwing', () => {
    const root = tempDir();
    assert.doesNotThrow(() => hook({ opts: { projectRoot: root } }));
});

test('on cordova-ios 7, if configuration fails (e.g. without the xcode module) the hook warns but does not throw', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MyApp.xcodeproj'), { recursive: true });
    fs.mkdirSync(path.join(platformPath, 'MyApp'), { recursive: true });
    fs.writeFileSync(path.join(platformPath, 'MyApp', 'Bridging-Header.h'), '');

    const originalWarn = console.warn;
    const warnCalls = [];
    console.warn = (...args) => warnCalls.push(args.join(' '));

    try {
        // This is the guarantee cordova-plugin-add-swift-support lacked: a problem
        // configuring Swift must never take down the merchant's build. project.pbxproj
        // is deliberately not created, so this branch fails whether `xcode` fails to
        // resolve in this repo (today's case) or whether it resolves some day but
        // cannot find the pbxproj to parse. The strong assertion is "does not throw".
        assert.doesNotThrow(() => hook({ opts: { projectRoot: root } }));

        // If it actually failed, it has to have warned instead of failing silently.
        // This is only asserted when there was a warning: if some day `xcode` resolves
        // and also manages to finish configuring without error, there is no warning to
        // check and the test should still pass.
        if (warnCalls.length > 0) {
            assert.match(warnCalls[0], /could not configure Swift for iOS/);
        }
    } finally {
        console.warn = originalWarn;
    }
});
