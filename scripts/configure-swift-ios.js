const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// cordova-ios 8 defines SWIFT_VERSION and SWIFT_OBJC_BRIDGING_HEADER in its
// template; cordova-ios 7 defines neither, so a plugin written in Swift will
// not compile without this. This hook covers just that gap.
//
// Replaces cordova-plugin-add-swift-support, which builds the project path
// as `<config.name()>.xcodeproj` and so blows up with ENOENT on cordova-ios
// 8, where the project is always named App.xcodeproj.

const DEFAULT_SWIFT_VERSION = '5.0';

module.exports = function (context) {
    try {
        const projectRoot = context.opts.projectRoot;
        const platformPath = path.join(projectRoot, 'platforms', 'ios');

        if (!fs.existsSync(platformPath)) {
            return;
        }

        if (getCordovaIosMajor(platformPath) >= 8) {
            return;
        }
        configureLegacyProject(projectRoot, platformPath);
    } catch (error) {
        // A problem configuring Swift must not take down the whole build: warn
        // and leave the manual fix to the merchant.
        console.warn(
            `cordova-khipu: could not configure Swift for iOS (${error.message}). ` +
            'If the build fails with "Cannot determine Swift version", add ' +
            '<preference name="SwiftVersion" value="5.0" /> inside the ios ' +
            'section of your config.xml.'
        );
    }
};

function getCordovaIosMajor (platformPath) {
    try {
        const output = execFileSync(path.join(platformPath, 'cordova', 'version'), {
            encoding: 'utf-8'
        });
        const match = output.trim().match(/(\d+)\./);
        if (match) {
            return Number(match[1]);
        }
    } catch (_) {
        // Without the version script, fall back to the heuristic below.
    }

    // cordova-ios 8 renamed the project to a fixed App.xcodeproj: its presence is a
    // positive signal for 8.
    if (fs.existsSync(path.join(platformPath, 'App.xcodeproj'))) {
        return 8;
    }

    // A .xcodeproj with a DIFFERENT name is a positive signal for cordova-ios 7 (only
    // cordova-ios 8 forces App.xcodeproj), but none existing at all proves nothing:
    // this case used to fall back to 7, the path that writes into the pbxproj. It now
    // falls back to 8, the one that does nothing. Fail toward the inert side.
    const hasOtherXcodeproj = fs.existsSync(platformPath) &&
        fs.readdirSync(platformPath).some(entry => entry.endsWith('.xcodeproj'));

    return hasOtherXcodeproj ? 7 : 8;
}

function configureLegacyProject (projectRoot, platformPath) {
    // `xcode` is a dependency of cordova-ios, so it resolves from the
    // project's node_modules. This is the same mechanism
    // cordova-plugin-add-swift-support used.
    const xcode = require('xcode');

    const projectName = findXcodeProjectName(platformPath);
    const pbxprojPath = path.join(platformPath, `${projectName}.xcodeproj`, 'project.pbxproj');
    const bridgingHeader = path.join(platformPath, projectName, 'Bridging-Header.h');

    if (!fs.existsSync(bridgingHeader)) {
        throw new Error(`${bridgingHeader} does not exist`);
    }

    const swiftVersion = readSwiftVersionPreference(projectRoot) || DEFAULT_SWIFT_VERSION;

    const project = xcode.project(pbxprojPath);
    project.parseSync();

    project.updateBuildProperty('SWIFT_VERSION', swiftVersion);
    project.updateBuildProperty(
        'SWIFT_OBJC_BRIDGING_HEADER',
        '"$(PROJECT_DIR)/$(PROJECT_NAME)/Bridging-Header.h"'
    );
    project.updateBuildProperty('ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES', 'YES');

    fs.writeFileSync(pbxprojPath, project.writeSync(), 'utf-8');

    console.log(`cordova-khipu: SWIFT_VERSION=${swiftVersion} configured for cordova-ios < 8.`);
}

// The .xcodeproj is looked up on disk instead of derived from the name in config.xml:
// it is the same piece of information, and this avoids depending on cordova-common
// resolving from the project's node_modules.
function findXcodeProjectName (platformPath) {
    const found = fs.readdirSync(platformPath).filter(entry => entry.endsWith('.xcodeproj'));

    if (found.length !== 1) {
        throw new Error(`expected one .xcodeproj in ${platformPath}, found ${found.length}`);
    }

    return path.basename(found[0], '.xcodeproj');
}

// Deliberately simple read: it is enough for the one preference we care about, and it
// does not drag cordova-common into a hook.
function readSwiftVersionPreference (projectRoot) {
    const configPath = path.join(projectRoot, 'config.xml');

    if (!fs.existsSync(configPath)) {
        return null;
    }

    const match = fs
        .readFileSync(configPath, 'utf-8')
        .match(/<preference\s+name="SwiftVersion"\s+value="([^"]+)"/);

    return match ? match[1] : null;
}

// Exported for the tests.
module.exports.getCordovaIosMajor = getCordovaIosMajor;
module.exports.findXcodeProjectName = findXcodeProjectName;
module.exports.readSwiftVersionPreference = readSwiftVersionPreference;
