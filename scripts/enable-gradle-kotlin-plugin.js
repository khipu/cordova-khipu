const fs = require('node:fs');
const path = require('node:path');

// The Khipu Android SDK is Kotlin, and its Gradle plugin has to be applied for the AAR's
// Kotlin metadata to be processed. cordova-android ships that switched off — it is
// IS_GRADLE_PLUGIN_KOTLIN_ENABLED in cdv-gradle-config.json, still present in
// cordova-android 15 — so a merchant who installs this plugin and builds gets a Kotlin
// compilation failure until it is turned on. This hook turns it on.

const FLAG = 'IS_GRADLE_PLUGIN_KOTLIN_ENABLED';

// Returns what it did, so the hook can report it and a test can assert it.
function enableKotlin (configPath) {
    if (!fs.existsSync(configPath)) {
        return 'missing';
    }

    // Read with fs, not `require`: `require` caches the parsed module, so a second call
    // in the same process would mutate and re-inspect the first read rather than the
    // file. Cordova runs hooks in-process across platforms.
    const raw = fs.readFileSync(configPath, 'utf-8');

    let config;
    try {
        config = JSON.parse(raw);
    } catch (error) {
        // Branded and re-thrown, unlike configure-swift-ios.js's catch-and-warn: a
        // broken Swift configuration leaves a merchant with a manual workaround, but a
        // Kotlin plugin that stays off means the Android build fails later anyway, on
        // an error that never mentions this plugin. Failing loudly here, at the point
        // that already knows the cause, is strictly better than that.
        throw new Error(
            `cordova-khipu: could not parse ${configPath} (${error.message}). ` +
            'Kotlin support for the Khipu Android SDK could not be enabled, and the ' +
            'build will fail later with a Kotlin compilation error. Regenerate this ' +
            'file (e.g. by removing and re-adding the android platform) and try again.'
        );
    }

    if (config[FLAG] === true) {
        return 'already-enabled';
    }

    config[FLAG] = true;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');

    return 'enabled';
}

module.exports = function (context) {
    const configPath = path.join(
        context.opts.projectRoot,
        'platforms',
        'android',
        'cdv-gradle-config.json'
    );

    switch (enableKotlin(configPath)) {
        case 'enabled':
            console.log(`cordova-khipu: set ${FLAG} = true in cdv-gradle-config.json.`);
            break;
        case 'already-enabled':
            break;
        case 'missing':
            // Not a warning: this hook is registered for every platform, so it runs on an
            // iOS-only prepare too, where there is no Android config and nothing to do.
            break;
    }
};

module.exports.enableKotlin = enableKotlin;
