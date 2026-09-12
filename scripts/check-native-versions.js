const fs = require('node:fs');
const path = require('node:path');

// iOS's dual support (CocoaPods on cordova-ios 7, SPM on cordova-ios 8) depends on several
// things in plugin.xml and Package.swift staying in sync. This guard runs in the node job of
// .github/workflows/ci.yml as well as in prepublishOnly, and it is the only thing that stops
// a release from breaking that sync: the KhipuClientIOS version matching between
// the two manifests, `nospm="true"` staying on the <pod> (if it falls off, cordova-ios 8
// installs the pod again in addition to SPM), `package="swift"` staying on
// <platform name="ios"> (without it, cordova-ios 8 stops using SPM), and every .swift file in
// src/ios/ having its own <source-file>: SPM takes the whole directory, but CocoaPods takes the
// explicit list, so a new file compiles under cordova-ios 8 and silently goes missing under 7.

function escapeRegExp (value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `iosSourceFiles` is received as a parameter instead of being read from disk in here, so this
// function stays pure and testable without touching the filesystem. `main()` fills it by
// listing src/ios/.
function compare (packageSwift, pluginXml, iosSourceFiles = []) {
    const spm = packageSwift.match(/KhipuClientIOS\.git"\s*,\s*exact:\s*"([^"]+)"/);

    if (!spm) {
        return {
            ok: false,
            message: 'could not find the KhipuClientIOS version in Package.swift'
        };
    }

    // The <pod> tags are isolated first and the version extracted afterwards, so this
    // does not depend on attribute order: a hand edit can reorder them.
    const podTags = [...pluginXml.matchAll(/<pod\b[^>]*name="KhipuClientIOS"[^>]*>/g)];

    if (podTags.length === 0) {
        return {
            ok: false,
            message: 'found no <pod name="KhipuClientIOS"> tag in plugin.xml'
        };
    }

    // Two <pod> tags with the same name would install different CocoaPods versions
    // depending on which one wins, and that is already a problem on its own (a merge
    // or a copy-paste that left a duplicate). This fails on cardinality before looking
    // at `spec`, so it neither approves a partial match nor gives a false pass when the
    // duplicate missing `spec` is not the first one.
    if (podTags.length > 1) {
        return {
            ok: false,
            message: `found ${podTags.length} <pod name="KhipuClientIOS"> tags in plugin.xml; there should be exactly one`
        };
    }

    // `spec`, not `version`: cordova-ios's Podfile.js only emits the version constraint if it
    // finds `spec`. A `version=` is silently ignored and the pod ends up unpinned, which is
    // exactly the bug the published plugin had.
    const pod = podTags[0][0].match(/spec="([^"]+)"/);

    if (!pod) {
        return {
            ok: false,
            message: 'plugin.xml\'s <pod name="KhipuClientIOS"> has no `spec` (did it end up as `version=`, which cordova-ios ignores?)'
        };
    }

    if (spm[1] !== pod[1]) {
        return {
            ok: false,
            message: `KhipuClientIOS differs: Package.swift says ${spm[1]} and plugin.xml says ${pod[1]}`
        };
    }

    // Without `nospm="true"`, cordova-ios 8 installs the pod again in addition to SPM: the SPM
    // path starts requiring CocoaPods and the SDK ends up linked twice.
    if (!/\bnospm\s*=\s*"true"/.test(podTags[0][0])) {
        return {
            ok: false,
            message: 'plugin.xml\'s <pod name="KhipuClientIOS"> lost `nospm="true"`: cordova-ios 8 would install the pod again in addition to SPM'
        };
    }

    // The <platform name="ios"> tag is isolated the same way <pod> was, tolerant of
    // attribute order for the same reason: a hand edit can reorder them.
    const iosPlatformTags = [...pluginXml.matchAll(/<platform\b[^>]*\bname="ios"[^>]*>/g)];

    if (iosPlatformTags.length === 0 || !/\bpackage\s*=\s*"swift"/.test(iosPlatformTags[0][0])) {
        return {
            ok: false,
            message: 'could not find `package="swift"` in plugin.xml\'s <platform name="ios">: without it, cordova-ios 8 stops using Swift Package Manager'
        };
    }

    // SPM takes the whole src/ios/ directory (`path: "src/ios"` in Package.swift), but
    // CocoaPods (cordova-ios 7) only installs what an explicit <source-file> declares: a new
    // .swift file compiles under cordova-ios 8 and silently goes missing under 7.
    for (const file of iosSourceFiles) {
        const regex = new RegExp(`<source-file\\b[^>]*\\bsrc="src/ios/${escapeRegExp(file)}"`);

        if (!regex.test(pluginXml)) {
            return {
                ok: false,
                message: `src/ios/${file} has no <source-file> in plugin.xml: SPM compiles it anyway (it takes the whole directory), but cordova-ios 7 via CocoaPods will silently ignore it`
            };
        }
    }

    return {
        ok: true,
        message: `KhipuClientIOS ${spm[1]} synced between Package.swift and plugin.xml`
    };
}

// The plugin version also lives in two files, and the release syncs it with a hook. If that
// hook fails or the release is interrupted between the bump and the sync, the two end up out of
// step: it happened to 2.10.0, which aborted with plugin.xml at 2.10.0 and package.json at
// 2.9.1. Nothing caught it, because `compare()` looks at the KhipuClientIOS version, not the
// plugin's own. This runs separately, deliberately not as one more parameter of `compare()`: an
// optional parameter is a check that can stop being passed without anyone noticing.
function comparePluginVersion (packageJsonVersion, pluginXml) {
    if (!packageJsonVersion) {
        return {
            ok: false,
            message: 'could not read the plugin version from package.json'
        };
    }

    // The <plugin> tag is isolated before looking for `version`, because that attribute also
    // shows up in the XML declaration (`<?xml version="1.0"?>`) and in every <engine>.
    const pluginTag = pluginXml.match(/<plugin\b[^>]*>/);
    const pluginXmlVersion = pluginTag && pluginTag[0].match(/\bversion="([^"]+)"/);

    if (!pluginXmlVersion) {
        return {
            ok: false,
            message: 'plugin.xml\'s <plugin> does not declare `version`'
        };
    }

    if (pluginXmlVersion[1] !== packageJsonVersion) {
        return {
            ok: false,
            message: `the plugin version differs: package.json says ${packageJsonVersion} and plugin.xml says ${pluginXmlVersion[1]}`
        };
    }

    return {
        ok: true,
        message: `plugin version ${packageJsonVersion} synced between package.json and plugin.xml`
    };
}

// The floor is not arbitrary. khipu-client-android 2.27.0 pins khenshin protocol 1.0.59,
// whose FailureReasonType enum has fourteen constants and no USER_DISCONNECTED. Its
// forValue() throws IOException on an unknown value, and the SDK's OPERATION_FAILURE
// listener calls the converter with no try/catch on socket.io's EventThread — so that
// throw is uncaught and kills the merchant's app process. 2.28.0 pins 1.0.60, which has
// the fifteenth constant. 2.28.1 then guarded the listeners so no deserialization failure
// reaches the EventThread at all, and 2.28.3 added OPERATION_WARNING to the guard's
// terminal types — without which an OPERATION_WARNING that failed to parse left the
// operation unfinished and its callback never fired. 2.28.5 is the actual floor: it synchronises
// KhipuCookieJar, whose unsynchronised HashSet was iterated from OkHttp's dispatcher threads while
// another mutated it. The ConcurrentModificationException ran on a background thread, uncaught, and
// killed the merchant's app process — with no callback and no exception, so the merchant could not
// tell from the client whether the payment went through. 2.28.4 makes
// an undecipherable terminal message resolve the merchant's callback (result "ERROR",
// failureReason null) instead of stranding the payer with the socket closed and nobody
// answering.
//
// This is a floor, not a mirror of the pin: khipu.gradle can move above it freely and this
// check does not care. Raise the floor only when a release fixes something the plugin
// depends on, which is what 2.28.0, 2.28.1, 2.28.3, 2.28.4 and 2.28.5 each did.
//
// tests/android/ asserts the same floor at runtime; this catches it at publish time,
// before anyone runs a test.
const ANDROID_SDK_FLOOR = '2.28.5';

function compareAndroidPin (khipuGradle) {
    const pin = khipuGradle.match(/com\.khipu:khipu-client-android:([^'"\s]+)/);

    if (!pin) {
        return {
            ok: false,
            message: 'no `com.khipu:khipu-client-android` dependency found in src/android/khipu.gradle'
        };
    }

    if (!/^\d+\.\d+\.\d+$/.test(pin[1])) {
        return {
            ok: false,
            message: `the Android SDK version must be exact, and src/android/khipu.gradle says ${pin[1]}`
        };
    }

    if (isOlderThan(pin[1], ANDROID_SDK_FLOOR)) {
        return {
            ok: false,
            message: `src/android/khipu.gradle pins khipu-client-android ${pin[1]}, below the ${ANDROID_SDK_FLOOR} floor: anything older carries khenshin protocol 1.0.59, which kills the app process on a USER_DISCONNECTED failure reason`
        };
    }

    return {
        ok: true,
        message: `khipu-client-android ${pin[1]} pinned in src/android/khipu.gradle`
    };
}

function isOlderThan (version, floor) {
    const asNumbers = value => value.split('.').map(Number);
    const [left, right] = [asNumbers(version), asNumbers(floor)];

    for (let index = 0; index < 3; index++) {
        if (left[index] !== right[index]) {
            return left[index] < right[index];
        }
    }

    return false;
}

// The Android SDK version is declared twice: once in src/android/khipu.gradle, which is what
// a merchant's app resolves, and once in tests/android/build.gradle, which is what our unit
// tests resolve. Nothing else ties them together, so without this a bump to one of them alone
// would leave us validating a different SDK than we ship — the same drift this file already
// prevents for the iOS pin across Package.swift and plugin.xml.
function compareAndroidPinsAgree (khipuGradle, testsGradle) {
    const shipped = khipuGradle.match(/com\.khipu:khipu-client-android:([^'"\s]+)/);
    const tested = testsGradle.match(/com\.khipu:khipu-client-android:([^'"\s]+)/);

    if (!tested) {
        return {
            ok: false,
            message: 'no `com.khipu:khipu-client-android` dependency found in tests/android/build.gradle'
        };
    }

    // A missing dependency in khipu.gradle is compareAndroidPin's to report, not this check's.
    if (shipped && shipped[1] !== tested[1]) {
        return {
            ok: false,
            message: `the Android SDK version differs: src/android/khipu.gradle says ${shipped[1]} and tests/android/build.gradle says ${tested[1]}`
        };
    }

    return {
        ok: true,
        message: `khipu-client-android ${tested[1]} matches between src/android/khipu.gradle and tests/android/build.gradle`
    };
}

function main () {
    const root = path.resolve(__dirname, '..');
    const iosSourceFiles = fs
        .readdirSync(path.join(root, 'src', 'ios'))
        .filter(entry => entry.endsWith('.swift'));
    const pluginXml = fs.readFileSync(path.join(root, 'plugin.xml'), 'utf-8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

    const results = [
        compare(
            fs.readFileSync(path.join(root, 'Package.swift'), 'utf-8'),
            pluginXml,
            iosSourceFiles
        ),
        comparePluginVersion(packageJson.version, pluginXml),
        compareAndroidPin(fs.readFileSync(path.join(root, 'src', 'android', 'khipu.gradle'), 'utf-8')),
        compareAndroidPinsAgree(
            fs.readFileSync(path.join(root, 'src', 'android', 'khipu.gradle'), 'utf-8'),
            fs.readFileSync(path.join(root, 'tests', 'android', 'build.gradle'), 'utf-8')
        )
    ];

    const failure = results.find(result => !result.ok);

    if (failure) {
        console.error(`check-native-versions: ${failure.message}`);
        process.exit(1);
    }

    for (const result of results) {
        console.log(`check-native-versions: ${result.message}.`);
    }
}

module.exports = { compare, comparePluginVersion, compareAndroidPin, compareAndroidPinsAgree };

if (require.main === module) {
    main();
}
