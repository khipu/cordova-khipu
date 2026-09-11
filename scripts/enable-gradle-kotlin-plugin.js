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
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

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
