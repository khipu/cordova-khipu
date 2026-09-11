const test = require('node:test');
const assert = require('node:assert');

const { compare, comparePluginVersion, compareAndroidPin, compareAndroidPinsAgree } = require('../../scripts/check-native-versions.js');

const PACKAGE_SWIFT = version =>
    `.package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "${version}")`;

// The attribute cordova-ios reads is `spec`, not `version`: Podfile.js only emits the
// constraint if it finds `spec`. A `version=` is silently ignored and the pod ends up unpinned.
// Wrapped in <platform name="ios" package="swift">, which `compare()` now also checks.
const PLUGIN_XML = version =>
    `<platform name="ios" package="swift"><podspec><pods><pod name="KhipuClientIOS" spec="${version}" swift-version="5.1" nospm="true"/></pods></podspec></platform>`;

test('accepts matching versions', () => {
    const result = compare(PACKAGE_SWIFT('2.16.5'), PLUGIN_XML('2.16.5'));

    assert.strictEqual(result.ok, true);
    assert.match(result.message, /2\.16\.5/);
});

test('rejects differing versions', () => {
    const result = compare(PACKAGE_SWIFT('2.16.5'), PLUGIN_XML('2.16.2'));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /2\.16\.5/);
    assert.match(result.message, /2\.16\.2/);
});

test('rejects when the version is missing from Package.swift', () => {
    const result = compare('let package = Package(name: "cordova-khipu")', PLUGIN_XML('2.16.5'));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /Package\.swift/);
});

test('rejects when the pod is missing from plugin.xml', () => {
    const result = compare(PACKAGE_SWIFT('2.16.5'), '<plugin id="cordova-khipu"></plugin>');

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /plugin\.xml/);
});

test('tolerates the pod attributes coming in a different order', () => {
    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<platform name="ios" package="swift"><pod spec="2.16.5" name="KhipuClientIOS" nospm="true"/></platform>');

    assert.strictEqual(result.ok, true);
});

// Regression for the bug Task 3 found: with `version=` the pod ends up unpinned and every
// merchant gets whatever version CocoaPods resolves. The check has to shout, not pass.
test('rejects version= instead of spec=, which cordova-ios ignores', () => {
    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" version="2.16.5" nospm="true"/>');

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /plugin\.xml/);
});

test('rejects when the <pod> has neither spec nor version', () => {
    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" nospm="true"/>');

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /plugin\.xml/);
});

// Regression for the review's fix: two <pod name="KhipuClientIOS"> tags would install
// different CocoaPods versions depending on which one wins. The check has to fail on
// cardinality, not approve a partial match against whichever it finds first.
test('rejects more than one <pod name="KhipuClientIOS">, even if the versions match', () => {
    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        PLUGIN_XML('2.16.5') + PLUGIN_XML('2.16.5'));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /found 2/);
});

// Symmetric case: if the <pod> without `spec` comes first, the check must not give a false
// pass just to tacitly approve the second one. It fails on cardinality before looking at
// `spec`, so the message has to talk about the duplication, not about `spec`.
test('rejects two <pod> tags even when the first has no spec and the second does', () => {
    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" nospm="true"/>' + PLUGIN_XML('2.16.5'));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /found 2/);
});

// I2: `nospm="true"` is what makes cordova-ios 8 discard the pod. If it falls off, the SPM
// path starts requiring CocoaPods too and the SDK ends up linked twice.
test('rejects when the <pod> lost `nospm="true"`', () => {
    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<platform name="ios"><pod name="KhipuClientIOS" spec="2.16.5"/></platform>');

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /nospm/);
});

// I2: `package="swift"` on <platform name="ios"> is what makes cordova-ios 8 recognise
// the plugin as an SPM package. Without it, cordova-ios 8 stops using SPM.
test('rejects when <platform name="ios"> lost `package="swift"`', () => {
    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<platform name="ios"><pod name="KhipuClientIOS" spec="2.16.5" nospm="true"/></platform>');

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /package="swift"/);
});

// I2: SPM takes the whole src/ios/ directory, but CocoaPods (cordova-ios 7) only installs
// what an explicit <source-file> declares. A new file would compile under cordova-ios 8 and
// silently go missing under 7 if nobody adds its <source-file>.
test('accepts when every .swift file in src/ios/ has its <source-file>', () => {
    const pluginXml =
        '<platform name="ios" package="swift">' +
        '<podspec><pods><pod name="KhipuClientIOS" spec="2.16.5" nospm="true"/></pods></podspec>' +
        '<source-file src="src/ios/KhipuPlugin.swift"/>' +
        '<source-file src="src/ios/KhipuOptionsMapper.swift"/>' +
        '</platform>';

    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        pluginXml,
        ['KhipuPlugin.swift', 'KhipuOptionsMapper.swift']);

    assert.strictEqual(result.ok, true);
});

test('rejects a .swift file in src/ios/ with no <source-file> in plugin.xml', () => {
    const pluginXml =
        '<platform name="ios" package="swift">' +
        '<podspec><pods><pod name="KhipuClientIOS" spec="2.16.5" nospm="true"/></pods></podspec>' +
        '<source-file src="src/ios/KhipuPlugin.swift"/>' +
        '</platform>';

    const result = compare(
        PACKAGE_SWIFT('2.16.5'),
        pluginXml,
        ['KhipuPlugin.swift', 'KhipuNewFile.swift']);

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /KhipuNewFile\.swift/);
});

// The plugin version lives in two files, just like KhipuClientIOS's. A release interrupted
// halfway can leave them out of step — it happened to 2.10.0, which aborted with plugin.xml
// at 2.10.0 and package.json at 2.9.1 — and nothing detected it.

const PLUGIN_TAG = version =>
    `<plugin id="cordova-khipu" version="${version}" xmlns="http://apache.org/cordova/ns/plugins/1.0">`;

test('accepts a matching plugin version between package.json and plugin.xml', () => {
    const result = comparePluginVersion('2.10.1', PLUGIN_TAG('2.10.1'));

    assert.strictEqual(result.ok, true);
    assert.match(result.message, /2\.10\.1/);
});

test('rejects a plugin version that differs between the two files', () => {
    const result = comparePluginVersion('2.9.1', PLUGIN_TAG('2.10.0'));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /2\.9\.1/);
    assert.match(result.message, /2\.10\.0/);
});

test('rejects when plugin.xml\'s <plugin> does not declare version', () => {
    const result = comparePluginVersion(
        '2.10.1',
        '<plugin id="cordova-khipu" xmlns="http://apache.org/cordova/ns/plugins/1.0">');

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /plugin\.xml/);
});

test('rejects when no version was received from package.json', () => {
    const result = comparePluginVersion(undefined, PLUGIN_TAG('2.10.1'));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /package\.json/);
});

// The `version` attribute also shows up in the XML declaration and on <engine> tags, so the
// check has to read the one on <plugin>, not the first one it finds.
test('is not confused by the version on the XML declaration or on <engine> tags', () => {
    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        PLUGIN_TAG('2.10.1'),
        '  <engine name="cordova-ios" version=">=7.0.0"/>',
        '</plugin>'
    ].join('\n');

    assert.strictEqual(comparePluginVersion('2.10.1', xml).ok, true);
    assert.strictEqual(comparePluginVersion('1.0', xml).ok, false);
});

test('accepts a pinned Android SDK', () => {
    const gradle = "dependencies {\n    implementation 'com.khipu:khipu-client-android:2.28.4'\n}\n";

    const result = compareAndroidPin(gradle);

    assert.strictEqual(result.ok, true);
    assert.match(result.message, /2\.28\.4/);
});

test('rejects a floating Android SDK version', () => {
    const gradle = "dependencies {\n    implementation 'com.khipu:khipu-client-android:2.28.+'\n}\n";

    assert.strictEqual(compareAndroidPin(gradle).ok, false);
});

test('rejects a missing Android SDK dependency', () => {
    assert.strictEqual(compareAndroidPin('dependencies {\n}\n').ok, false);
});

test('rejects an Android SDK older than the one that fixes the process crash', () => {
    const gradle = "implementation 'com.khipu:khipu-client-android:2.27.0'\n";

    const result = compareAndroidPin(gradle);

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /2\.28\.4/);
});

test('accepts two Android Gradle files pinning the same version', () => {
    const gradle = "implementation 'com.khipu:khipu-client-android:2.28.4'\n";

    const result = compareAndroidPinsAgree(gradle, gradle);

    assert.strictEqual(result.ok, true);
    assert.match(result.message, /2\.28\.4/);
});

test('rejects two Android Gradle files pinning different versions', () => {
    const shipped = "implementation 'com.khipu:khipu-client-android:2.28.4'\n";
    const tested = "implementation 'com.khipu:khipu-client-android:2.28.3'\n";

    const result = compareAndroidPinsAgree(shipped, tested);

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /2\.28\.4/);
    assert.match(result.message, /2\.28\.3/);
});

test('rejects a tests Gradle file with no Android SDK dependency', () => {
    assert.strictEqual(
        compareAndroidPinsAgree("implementation 'com.khipu:khipu-client-android:2.28.4'\n", 'dependencies {\n}\n').ok,
        false
    );
});
