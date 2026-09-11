# Migrating `cordova-khipu` to SPM, compatibility with current Cordova, and an example app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `cordova-khipu` installable via Swift Package Manager on cordova-ios 8 without breaking CocoaPods on cordova-ios 7, bring it up to date with cordova-android 15, and ship an example app that exercises both managers.

**Architecture:** A single `plugin.xml` describes both paths: cordova-ios 7 ignores the `package="swift"` attribute and uses `<podspec>` + `<source-file>`; cordova-ios 8 recognises it, discards the `<source-file>` tags and, thanks to `nospm="true"` on the `<pod>`, also discards CocoaPods, left with the root `Package.swift`. The Swift code uses `#if canImport(Cordova)` to compile in both worlds. The example app lives in `example/` and picks its manager by pinning the platform's major version.

**Tech Stack:** Cordova 13 · cordova-ios 7.1.1 and 8.1.1 · cordova-android 15.1.0 · Swift 5.9 / SPM · CocoaPods · `KhipuClientIOS` 2.16.5 · `khipu-client-android` 2.27.0 · Node 20+ (`node --test`, no new test frameworks)

**Spec:** `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md`

## Global Constraints

These values apply to **every** task. They are copied verbatim from the spec.

- The **SPM package and product must both be named exactly `cordova-khipu`** (the plugin's id). cordova-ios's `SwiftPackage._pluginReference()` generates `.product(name: "cordova-khipu", package: "cordova-khipu")`; any other name breaks resolution. The **target**'s name is free, and is `CordovaKhipu`.
- **`KhipuClientIOS` pinned at exactly `2.16.5`** in both manifests: `exact: "2.16.5"` in `Package.swift` and **`spec="2.16.5"`** on the `<pod>` in `plugin.xml`. Never ranges, and never the `version` attribute: cordova-ios's `Podfile.js` only reads `spec` and silently discards `version`, leaving the pod unpinned.
- **iOS floor of 13.0** on both paths.
- **`khipu-client-android` stays at `2.27.0`**, already the latest.
- **`@objc(KhipuPlugin)` is not touched.** `CDVViewController` resolves the class with `NSClassFromString("KhipuPlugin")` and its fallback uses `CFBundleExecutable`, which under SPM never matches the module. Without that attribute the plugin cannot be found at runtime.
- **`<engines>`:** `cordova-ios >=7.0.0`, `cordova-android >=13.0.0`.
- **Version to publish at the end: `2.10.0`.** Until Task 13, `package.json`'s and `plugin.xml`'s `version` stay at `2.9.1`.
- **Khipu brand colours:** purple `#8347AD`, cyan `#3CB4E5`.
- **Node 20.19.4** for everything that invokes cordova. `cordova-ios` 8.1.1 declares
  `engines.node: "^20.17.0 || >=22.9.0"`, and the v20.12.2 this machine's shell picks up by
  default does not meet it. Use this PATH prefix:
  `export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"`.
- **No CI gets added.** Out of scope by explicit decision.
- **Nothing gets published to npm within this plan.** Task 13 leaves everything ready; publishing needs a separate confirmation.
- Every comment and user-facing string goes in Spanish, with correct accents.

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `Package.swift` | The plugin's SPM manifest. The only place the `KhipuClientIOS` version lives for the SPM path. |
| `src/ios/KhipuOptionsMapper.swift` | Translates the dictionary that arrives from JS into our own type and from there into the SDK's Builder. The only piece of iOS that can be tested in isolation. |
| `tests/ios/KhipuOptionsMapperTests.swift` | Tests for the mapper. |
| `scripts/configure-swift-ios.js` | `after_prepare` hook that configures Swift only on cordova-ios < 8. Replaces `cordova-plugin-add-swift-support`. |
| `scripts/check-native-versions.js` | Fails if the `KhipuClientIOS` version differs between `Package.swift` and `plugin.xml`. |
| `tests/scripts/configure-swift-ios.test.js` | Tests for the hook's helpers (`node --test`). |
| `tests/scripts/check-native-versions.test.js` | Tests for the version comparator. |
| `example/package.json` | `ios:pods` / `ios:spm` / `android` scripts. |
| `example/scripts/install-plugin.mjs` | Packages the plugin and installs it in the example from the tarball, with the two detours `cordova-lib` 13 requires. |
| `.nvmrc` | Pins Node 20.19.4. Today the repo inherits the parent directory's `.nvmrc`, which points at a version `cordova-ios` 8 does not accept. |
| `example/config.xml` | The example app's config. iOS floor of 13. |
| `example/.gitignore` | Ignores `platforms/`, `plugins/`, `node_modules/` and the tarballs. |
| `example/www/index.html` | The harness shell. |
| `example/www/css/harness.css` | The harness styles. |
| `example/www/js/harness.js` | All of the harness's logic: fields, tri-state, presets, preview, result. |
| `example/README.md` | Manual verification matrix. |
| `CHANGELOG.md` | Generated by `@release-it/conventional-changelog`. |
| `LICENSE` | Missing today even though `package.json` declares MIT. **Blocked** until the license is confirmed (see Task 12). |

**Modified:**

| File | Change |
| --- | --- |
| `plugin.xml` | `package="swift"`, `nospm="true"`, `KhipuClientIOS` 2.16.5, `<engines>`, new hook, dropping `cordova-plugin-add-swift-support`, `<source-file>` for the mapper |
| `src/ios/KhipuPlugin.swift` | `import` shim, using the mapper, presenter from `self.viewController` |
| `src/android/khipu.gradle` | `mavenCentral()` instead of `jcenter()`, AGP 8 packaging DSL |
| `package.json` | `files`, `scripts.test`, `scripts.verify:versions`, `release-it` hooks, changelog `infile` |
| `README.md` | iOS and Android sections rewritten |
| `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` | Verification results section (Tasks 3 and 4) |

---

### Task 1: Dual `Package.swift` and `plugin.xml`

**Files:**
- Create: `Package.swift`
- Modify: `plugin.xml`
- Modify: `src/ios/KhipuPlugin.swift:1`

**Interfaces:**
- Consumes: nothing.
- Produces: the SPM package `cordova-khipu`, product `cordova-khipu`, target `CordovaKhipu` (Swift module `CordovaKhipu`) with its sources under `src/ios`. Tasks 9 and 10 add files to that same target and to `<source-file>`.

- [ ] **Step 1: Confirm there is no SPM package today**

Run: `swift package describe`
Expected: FAIL with `error: Could not find Package.swift in this directory`

- [ ] **Step 2: Create `Package.swift`**

```swift
// swift-tools-version:5.9

import PackageDescription

// The package name and the product name have to be exactly the plugin's id:
// cordova-ios generates `.product(name: "cordova-khipu", package:
// "cordova-khipu")` from it (SwiftPackage._pluginReference). The target's
// name is free.
//
// The dependency on apache/cordova-ios gets rewritten by cordova itself when
// installing the plugin, pointing it at the project's local CordovaLib; here
// it is only used to compile and test the standalone package. In practice it
// resolves to exact 8.0.0, because Apache tags later releases as `rel/8.1.1`
// and SPM does not read those tags as semver.
let package = Package(
    name: "cordova-khipu",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(name: "cordova-khipu", targets: ["CordovaKhipu"])
    ],
    dependencies: [
        .package(url: "https://github.com/apache/cordova-ios.git", from: "8.0.0"),
        .package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "2.16.5")
    ],
    targets: [
        .target(
            name: "CordovaKhipu",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "KhipuClientIOS", package: "KhipuClientIOS")
            ],
            path: "src/ios"
        )
    ]
)
```

- [ ] **Step 3: Resolve dependencies**

Run: `swift package resolve`
Expected: PASS. Resolves `khipuclientios 2.16.5`, `cordova-ios 8.0.0`, `khenshinprotocolswift`, `khenshinsecuremessage`, `socket.io-client-swift`, `starscream`, `tweetnacl-swiftwrap`.

If it fails with `the package ... does not contain a Package.swift`, check the URL. If it fails with `Dependencies could not be resolved`, check that tag `2.16.5` exists on `khipu/KhipuClientIOS`.

- [ ] **Step 4: See the schemes Xcode generates**

Run: `xcodebuild -list`
Expected: the `cordova-khipu` scheme shows up. Write down the exact name; the next steps use it.

- [ ] **Step 5: Compile and see it fail on the missing `import`**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: FAIL with `cannot find type 'CDVPlugin' in scope` and `cannot find type 'CDVInvokedUrlCommand' in scope`.

This is expected: today `KhipuPlugin.swift` gets `CDVPlugin` from the project's bridging header, which does not exist under SPM.

- [ ] **Step 6: Add the `import` shim**

In `src/ios/KhipuPlugin.swift`, replace the first line (`import KhipuClientIOS`) with:

```swift
import UIKit
#if canImport(Cordova)
// cordova-ios 8 exposes CordovaLib as the `Cordova` module (it comes from
// CordovaLib/include/Cordova/). On cordova-ios 7 there is no module:
// CDVPlugin arrives via the project's bridging header and this import does
// not apply.
import Cordova
#endif
import KhipuClientIOS
```

- [ ] **Step 7: Compile and verify it passes**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: PASS, `BUILD SUCCEEDED`.

- [ ] **Step 8: Replace `plugin.xml`**

Full content of the file:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<plugin id="cordova-khipu" version="2.9.1" xmlns="http://apache.org/cordova/ns/plugins/1.0" xmlns:android="http://schemas.android.com/apk/res/android">
  <name>Cordova Khipu</name>
  <engines>
    <engine name="cordova-ios" version=">=7.0.0"/>
    <engine name="cordova-android" version=">=13.0.0"/>
  </engines>
  <js-module name="Khipu" src="www/cordova-khipu.js">
    <clobbers target="window.Khipu"/>
  </js-module>
  <platform name="android">
    <framework src="src/android/khipu.gradle" custom="true" type="gradleReference"/>
    <config-file parent="/*" target="res/xml/config.xml">
      <feature name="cordova-khipu">
        <param name="android-package" value="com.khipu.cordova.KhipuPlugin"/>
      </feature>
    </config-file>
    <config-file parent="/*" target="AndroidManifest.xml"/>
    <source-file src="src/android/com/khipu/cordova/KhipuPlugin.java" target-dir="src/com/khipu/cordova"/>
  </platform>
  <platform name="ios" package="swift">
    <config-file parent="/*" target="config.xml">
      <feature name="cordova-khipu">
        <param name="ios-package" value="KhipuPlugin"/>
      </feature>
    </config-file>
    <podspec>
      <config>
        <source url="https://github.com/CocoaPods/Specs.git"/>
      </config>
      <pods use-frameworks="true">
        <pod name="KhipuClientIOS" version="2.16.5" swift-version="5.1" nospm="true"/>
      </pods>
    </podspec>
    <source-file src="src/ios/KhipuPlugin.swift"/>
  </platform>
  <dependency id="cordova-plugin-add-swift-support" version="2.0.2"/>
  <hook type="after_prepare" src="scripts/enable-gradle-kotlin-plugin.js"/>
</plugin>
```

Changes from the previous file: `<engines>` was added, `package="swift"` on the iOS `<platform>`, `nospm="true"` on the `<pod>`, and the pod's version went from `2.16.2` to `2.16.5`. The `<dependency>` on `cordova-plugin-add-swift-support` is still there on purpose: it goes away in Task 2.

- [ ] **Step 9: Verify `plugin.xml` is still valid XML**

Run: `grep -c 'platform name="ios" package="swift"' plugin.xml && grep -c 'nospm="true"' plugin.xml`
Expected: `1` and `1`.

> **Superseded by Task 3b.** The `<podspec>` this task writes still uses `version=`,
> `<config><source>` and `use-frameworks="true"`. All three turned out to be wrong and Task 3b
> fixes them; they are left here exactly as they were run, so the history makes sense.

- [ ] **Step 10: Commit**

```bash
git add Package.swift plugin.xml src/ios/KhipuPlugin.swift
git commit -m "feat(ios): add SPM support, dual with CocoaPods

Package.swift for cordova-ios 8, with the podspec kept intact and
marked nospm for cordova-ios 7. KhipuClientIOS bumps to 2.16.5, the
first version consumable via SPM."
```

---

### Task 2: A Swift hook of our own, replacing `cordova-plugin-add-swift-support`

**Files:**
- Create: `scripts/configure-swift-ios.js`
- Create: `tests/scripts/configure-swift-ios.test.js`
- Modify: `plugin.xml`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1's `plugin.xml`.
- Produces: `scripts/configure-swift-ios.js` exports the hook function as its default export and, for tests, `getCordovaIosMajor(platformPath) -> number`, `findXcodeProjectName(platformPath) -> string` and `readSwiftVersionPreference(projectRoot) -> string | null`. `package.json` gains the `npm test` script, which runs `node --test tests/scripts/`.

- [ ] **Step 1: Write the failing tests**

Create `tests/scripts/configure-swift-ios.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/scripts/`
Expected: FAIL with `Cannot find module '../../scripts/configure-swift-ios.js'`

- [ ] **Step 3: Write the hook**

Create `scripts/configure-swift-ios.js`:

```js
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
    const projectRoot = context.opts.projectRoot;
    const platformPath = path.join(projectRoot, 'platforms', 'ios');

    if (!fs.existsSync(platformPath)) {
        return;
    }

    try {
        if (getCordovaIosMajor(platformPath) >= 8) {
            return;
        }
        configureLegacyProject(projectRoot, platformPath);
    } catch (error) {
        // A problem configuring Swift must not take down the whole build:
        // warn and leave the manual fix to the merchant.
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

    // cordova-ios 8 renamed the project to a fixed App.xcodeproj.
    return fs.existsSync(path.join(platformPath, 'App.xcodeproj')) ? 8 : 7;
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

// The .xcodeproj is looked up on disk instead of derived from the name in
// config.xml: it is the same piece of information, and this avoids depending
// on cordova-common resolving from the project's node_modules.
function findXcodeProjectName (platformPath) {
    const found = fs.readdirSync(platformPath).filter(entry => entry.endsWith('.xcodeproj'));

    if (found.length !== 1) {
        throw new Error(`expected one .xcodeproj in ${platformPath}, found ${found.length}`);
    }

    return path.basename(found[0], '.xcodeproj');
}

// Deliberately simple read: it is enough for the one preference we care
// about, and it does not drag cordova-common into a hook.
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
```

- [ ] **Step 4: Add the `test` script to `package.json`**

In `package.json`'s `scripts` object, add as the first entry:

```json
    "test": "node --test tests/scripts/",
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npm test`
Expected: PASS, 8 tests, 0 failures.

- [ ] **Step 6: Register the hook and drop the dependency in `plugin.xml`**

Inside `<platform name="ios" package="swift">`, after the `<source-file>`, add:

```xml
    <hook type="after_prepare" src="scripts/configure-swift-ios.js"/>
```

And delete this whole line:

```xml
  <dependency id="cordova-plugin-add-swift-support" version="2.0.2"/>
```

- [ ] **Step 7: Verify the dependency is gone**

Run: `grep -c "add-swift-support" plugin.xml || echo "0 occurrences, correct"`
Expected: `0 occurrences, correct`

- [ ] **Step 8: Commit**

```bash
git add scripts/configure-swift-ios.js tests/scripts/configure-swift-ios.test.js plugin.xml package.json
git commit -m "fix(ios): replace cordova-plugin-add-swift-support with our own hook

That plugin builds the project path as <config.name()>.xcodeproj and
blows up with ENOENT on cordova-ios 8, where the project is always
named App.xcodeproj. The new hook does nothing on cordova-ios 8 and
only configures Swift on versions that do not already bring it."
```

---

### Task 3: Verify both iOS majors in throwaway projects

This task is a **gate**: it resolves risk 5 from the spec. If cordova-ios 7 does not compile with the installed Xcode, stop and reassess dual support before investing in the rest of the plan.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` (add a results section)

**Interfaces:**
- Consumes: the plugin as it stands after Task 2.
- Produces: a `## 15. Verification results` section in the spec, with the Xcode version used and each scenario's result.

- [ ] **Step 1: Note the Xcode version**

Run: `xcodebuild -version`
Save the output; it goes in the spec at the end of the task.

- [ ] **Step 2: Package the plugin**

```bash
cd /Users/edavis/git/cordova-khipu
npm pack --pack-destination /tmp
ls /tmp/cordova-khipu-2.9.1.tgz
```
Expected: the file exists.

- [ ] **Step 3: Create the cordova-ios 7 project and verify it fails without the plugin**

```bash
cd /tmp && rm -rf cdvtest7
npx cordova@13 create cdvtest7 com.khipu.test7 CdvTest7
cd /tmp/cdvtest7
```

Edit `/tmp/cdvtest7/config.xml` and add before `</widget>`:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

Run: `npx cordova@13 plugin list`
Expected: `No plugins added. Use 'cordova plugin add <plugin>'.`

- [ ] **Step 4: Install the platform and plugin, and compile**

```bash
cd /tmp/cdvtest7
npx cordova@13 platform add ios@7.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
npx cordova@13 build ios --emulator 2>&1 | tail -40
```
Expected: `BUILD SUCCEEDED`.

If it fails, read the full error. The two expected failure modes:
- `Cannot determine Swift version` → Task 2's hook did not run or could not find the pbxproj.
- iOS SDK or Xcode errors → this is exactly risk 5. **Stop and report** before continuing.

- [ ] **Step 5: Verify cordova-ios 7 took the CocoaPods path**

```bash
cd /tmp/cdvtest7
test -f platforms/ios/Podfile && echo "Podfile present: OK"
grep KhipuClientIOS platforms/ios/Podfile
test ! -d platforms/ios/packages && echo "no packages/: OK"
```
Expected: `Podfile present: OK`, a line with `pod 'KhipuClientIOS', '2.16.5'`, and `no packages/: OK`.

- [ ] **Step 6: Verify the hook configured Swift**

```bash
cd /tmp/cdvtest7
grep -m2 "SWIFT_VERSION\|SWIFT_OBJC_BRIDGING_HEADER" platforms/ios/CdvTest7.xcodeproj/project.pbxproj
```
Expected: `SWIFT_VERSION = 5.0;` and `SWIFT_OBJC_BRIDGING_HEADER = "$(PROJECT_DIR)/$(PROJECT_NAME)/Bridging-Header.h";` show up.

- [ ] **Step 7: Create the cordova-ios 8 project and compile**

```bash
cd /tmp && rm -rf cdvtest8
npx cordova@13 create cdvtest8 com.khipu.test8 CdvTest8
cd /tmp/cdvtest8
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
npx cordova@13 build ios --emulator 2>&1 | tail -40
```
Expected: `BUILD SUCCEEDED`.

- [ ] **Step 8: Verify cordova-ios 8 took the SPM path, not CocoaPods**

```bash
cd /tmp/cdvtest8
test ! -f platforms/ios/Podfile && echo "no Podfile: OK"
test -d platforms/ios/packages/cordova-khipu && echo "package copied: OK"
grep cordova-khipu platforms/ios/packages/cordova-ios-plugins/Package.swift
grep -n "cordova-ios" platforms/ios/packages/cordova-khipu/Package.swift
```
Expected:
- `no Podfile: OK`
- `package copied: OK`
- two lines: `package.dependencies.append(.package(name: "cordova-khipu", path: "../cordova-khipu"))` and `package.targets.first?.dependencies.append(.product(name: "cordova-khipu", package: "cordova-khipu"))`
- the dependency rewritten to `package(name: "cordova-ios", path: "../cordova-ios")`

- [ ] **Step 9: Verify the hook did nothing on cordova-ios 8**

Run: `cd /tmp/cdvtest8 && npx cordova@13 prepare ios 2>&1 | grep -i "cordova-khipu" || echo "no hook output: OK"`
Expected: `no hook output: OK`

- [ ] **Step 10: Write the results into the spec**

Add to the end of `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md`:

```markdown
## 15. Verification results

### Phase 1 — the two iOS majors (plan Task 3)

Run on <DATE> with <xcodebuild -version OUTPUT>.

| Scenario | Result |
| --- | --- |
| `cordova-ios@7.1.1` + CocoaPods, `cordova build ios --emulator` | <OK / failure detail> |
| `cordova-ios@7.1.1`: Podfile present with `KhipuClientIOS 2.16.5` | <yes / no> |
| `cordova-ios@7.1.1`: the hook set `SWIFT_VERSION` and the bridging header | <yes / no> |
| `cordova-ios@8.1.1` + SPM, `cordova build ios --emulator` | <OK / failure detail> |
| `cordova-ios@8.1.1`: no Podfile, with `packages/cordova-khipu` | <yes / no> |
| `cordova-ios@8.1.1`: the hook produced no output | <yes / no> |

**Risk 5 (viability of cordova-ios 7 with the current Xcode):** <resolved / open,
with the detail>.
```

Replace each `<...>` with the value actually observed. Do not leave any `<...>` in the file.

- [ ] **Step 11: Clean up and commit**

```bash
rm -rf /tmp/cdvtest7 /tmp/cdvtest8 /tmp/cordova-khipu-2.9.1.tgz
cd /Users/edavis/git/cordova-khipu
git add docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md
git commit -m "docs: record the cordova-ios 7 and 8 verification"
```

---

### Task 3b: Fix the pod pin and the phantom Podfile

Two defects Task 3 found by actually compiling. Both invalidate claims made in the spec, so
they get fixed before continuing.

**a) The pod's version pin never took effect.** cordova-ios's `Podfile.js` only emits the
version constraint if the pod's JSON carries the `spec` key (`if ('spec' in json &&
json.spec.length)`, line 300). The `version` attribute is silently ignored. The `plugin.xml`
published in `cordova-khipu` 2.9.1 uses `version="2.16.2"`, meaning **the plugin never
actually pinned the pod's version**: it generates `pod 'KhipuClientIOS'` with no constraint.
This is a pre-existing defect.

**b) A Podfile gets created even though the pod is discarded.** `Api.js`'s `// sources` block
is not guarded by `isSwiftPackagePlugin`, unlike the `// libraries` block right after it. With
a `<config><source>` declared, cordova-ios 8 marks the Podfile as dirty and runs `pod install`
anyway, breaking the "pure SPM, no CocoaPods installed" premise. Declaring the CocoaPods trunk
was redundant: it is the default source when none is declared.

**Files:**
- Modify: `plugin.xml`
- Modify: `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` (§15 section)

**Interfaces:**
- Consumes: Tasks 1 and 2's `plugin.xml`.
- Produces: a `<podspec>` with no `<config>` and with `spec="2.16.5"`. Task 12 verifies it with
  `check-native-versions.js`, which looks for `spec=` and fails on `version=`.

- [ ] **Step 1: Confirm the current state**

Run: `grep -n "podspec\|<config>\|<source url\|<pod " plugin.xml`
Expected: the `<config>`, the `<source url=...>` and a `<pod ... version="2.16.5" ...>` show up.

- [ ] **Step 2: Fix the `<podspec>` block**

Replace the whole block:

```xml
    <podspec>
      <config>
        <source url="https://github.com/CocoaPods/Specs.git"/>
      </config>
      <pods use-frameworks="true">
        <pod name="KhipuClientIOS" version="2.16.5" swift-version="5.1" nospm="true"/>
      </pods>
    </podspec>
```

with:

```xml
    <podspec>
      <pods>
        <pod name="KhipuClientIOS" spec="2.16.5" swift-version="5.1" nospm="true"/>
      </pods>
    </podspec>
```

Three changes:

1. `version=` becomes **`spec=`**, the attribute cordova-ios actually reads.
2. The whole `<config>` is removed, whose `<source>` was marking the Podfile dirty.
3. **`use-frameworks="true"`** is removed from `<pods>`. `PluginInfo.getPodSpecs()` turns
   `<pods>`'s attributes into Podfile *declarations* (`use_frameworks!`), and `Api.js`'s
   `// declarations` block has no `isSwiftPackagePlugin` guard either — so that single
   declaration alone is enough to mark the Podfile dirty and trigger `pod install`.

On point 3, the one that changes behaviour on the old path: without `use_frameworks!` the pods
link as static libraries instead of dynamic frameworks. This is safe for `KhipuClientIOS`
because its podspec declares `s.resource_bundles` — precisely the mechanism meant for static
linking — and its `BundleHelper` resolves with
`Bundle(for: KhipuClientBundleHelper.self).path(forResource: "KhipuClientIOS", ofType: "bundle")`,
which works under both models: with a dynamic framework it points at the framework's bundle,
and with a static library the class ends up in the app's binary, where CocoaPods copies the
resource bundle. **It still has to be confirmed at runtime**, not just that it compiles:
resources that fail do so when displayed, not when linked.

And it cannot simply be left in place: on macOS, cordova-ios's `check_cocoapods` calls
`checkTool('pod', ...)`, which **rejects** if the binary is missing (it only returns `ignore`
when the OS is not macOS). With the Podfile dirty, a merchant on cordova-ios 8 with no
CocoaPods installed sees `cordova plugin add` fail, exactly what this migration promises to
avoid.

- [ ] **Step 3: Verify the text**

Run: `grep -c 'spec="2.16.5"' plugin.xml && grep -c "<config>" plugin.xml`
Expected: `1` then `0`.

- [ ] **Step 4: Re-verify cordova-ios 7 — the pod is now actually pinned**

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"
node -v   # should say v20.19.4
npm pack --pack-destination /tmp
cd /tmp && rm -rf cdvpin7 && npx cordova@13 create cdvpin7 com.khipu.pin7 CdvPin7
cd /tmp/cdvpin7
```

Edit `/tmp/cdvpin7/config.xml` and add before `</widget>`:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

```bash
cd /tmp/cdvpin7
npx cordova@13 platform add ios@7.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
grep -n "KhipuClientIOS" platforms/ios/Podfile
```
Expected: the line says **`pod 'KhipuClientIOS', '2.16.5'`**, with the version. Before this
fix it said just `pod 'KhipuClientIOS'`. If it is still unversioned, the fix did not work:
stop and report the Podfile's full content.

- [ ] **Step 5: Re-verify cordova-ios 8 — no `Pods/` and no `pod install`**

```bash
cd /tmp && rm -rf cdvpin8 && npx cordova@13 create cdvpin8 com.khipu.pin8 CdvPin8
cd /tmp/cdvpin8
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
test ! -d platforms/ios/Pods && echo "no Pods/: OK" || echo "Pods/ STILL THERE"
test -d platforms/ios/packages/cordova-khipu && echo "SPM package copied: OK"
grep -c "pod '" platforms/ios/Podfile 2>/dev/null || echo "Podfile has no pods: OK"
cat platforms/ios/pods.json 2>/dev/null
```
Expected: `no Pods/: OK`, `SPM package copied: OK`, `Podfile has no pods: OK`, and a
`pods.json` with `declarations`, `sources` and `libraries` all empty.

**An empty `platforms/ios/Podfile` will exist, and that is fine.** It is unavoidable:
cordova-ios's `Podfile` class constructor writes the file as soon as it is instantiated,
before any content is evaluated (`if (!fs.existsSync(this.path)) { this.clear(); this.write(); }`),
and it gets instantiated simply because the plugin declares a `<podspec>`. Since nothing gets
added, `isDirty()` stays `false` and **`pod install` never runs**. What the design promises is
that CocoaPods does not need to be installed, not that the file does not exist. That promise
gets verified in the next step.

- [ ] **Step 6: The test that actually matters — cordova-ios 8 with no CocoaPods on the PATH**

An empty `Podfile` costs nothing; what would cost something is the SPM path invoking the
`pod` binary. This checks that directly:

```bash
cd /tmp && rm -rf cdvnopod && npx cordova@13 create cdvnopod com.khipu.nopod CdvNoPod
cd /tmp/cdvnopod
export PATH_WITHOUT_POD=$(dirname $(which pod))
env PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -F "$PATH_WITHOUT_POD" | paste -sd: -) sh -c '
  which pod && echo "ERROR: pod is still on PATH" && exit 1
  npx cordova@13 platform add ios@8.1.1
  npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
  npx cordova@13 build ios --emulator 2>&1 | tail -20
'
```
Expected: `which pod` finds nothing, and it is still `BUILD SUCCEEDED`.

If this fails with something like `CocoaPods was not found`, the fix did not go far enough
and it needs to be reported: this is the work's central promise.

- [ ] **Step 6b: Build both normal paths to confirm nothing broke**

```bash
cd /tmp/cdvpin7 && npx cordova@13 build ios --emulator 2>&1 | tail -20
cd /tmp/cdvpin8 && npx cordova@13 build ios --emulator 2>&1 | tail -20
```
Expected: `BUILD SUCCEEDED` on both.

And as an early signal about static linking, on the cordova-ios 7 project:

```bash
cd /tmp/cdvpin7
find platforms/ios/Pods -name "*.bundle" -maxdepth 3 2>/dev/null
```
Expected: `KhipuClientIOS.bundle` shows up. If it shows up nowhere, that is a sign that
removing `use_frameworks!` broke the resources, and it needs to be reported before continuing.

- [ ] **Step 7: Record the results in the spec**

Add a subsection to `## 15. Verification results`:

```markdown
### Fixing the pod pin and the phantom Podfile (plan Task 3b)

| Check | Before | After |
| --- | --- | --- |
| Pod line in cordova-ios 7's Podfile | `<what it said>` | `<what it says now>` |
| Does `Pods/` exist on cordova-ios 8? | `<yes / no>` | `<yes / no>` |
| Did `pod install` run on cordova-ios 8? | `<yes / no>` | `<yes / no>` |
| cordova-ios 8 build **with `pod` off PATH** | `<not tried>` | `<OK / detail>` |
| cordova-ios 7 build | `<OK / detail>` | `<OK / detail>` |
| cordova-ios 8 build | `<OK / detail>` | `<OK / detail>` |
```

Replace each `<...>` with the actual value. The "Before" column comes from Task 3's report.

- [ ] **Step 8: Clean up and commit**

```bash
rm -rf /tmp/cdvpin7 /tmp/cdvpin8 /tmp/cordova-khipu-2.9.1.tgz
cd /Users/edavis/git/cordova-khipu
git add plugin.xml docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md
git commit -m "fix(ios): actually pin the pod version and stop generating a Podfile under SPM

cordova-ios only reads the <pod>'s spec attribute; version is silently
ignored, so the published plugin never pinned KhipuClientIOS's version
and every merchant got whatever CocoaPods resolved.

And Api.js's // sources block is not guarded by isSwiftPackagePlugin,
so declaring a <source> forced a Podfile and a pod install on
cordova-ios 8, breaking the pure-SPM premise. The CocoaPods trunk is
the default source: declaring it was redundant."
```

---

### Task 4: Spike — how the example installs the local plugin

The risk is concrete: if `cordova plugin add ../` leaves a symlink to the repo, `SwiftPackage.addPlugin()` would rewrite the plugin's real `Package.swift`. That is why the spike runs on a **throwaway clone**, never on the working repo.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` (results section)

**Interfaces:**
- Consumes: Task 2's plugin.
- Produces: a documented decision on how `example/package.json` installs the plugin. Task 5 implements it.

- [ ] **Step 1: Clone the repo to a throwaway directory**

```bash
rm -rf /tmp/spike-khipu
git clone /Users/edavis/git/cordova-khipu /tmp/spike-khipu
cd /tmp/spike-khipu
git rev-parse --short HEAD
```

- [ ] **Step 2: Build a minimal example inside the clone**

```bash
cd /tmp/spike-khipu
npx cordova@13 create example com.khipu.spike Spike
cd /tmp/spike-khipu/example
npx cordova@13 platform add ios@8.1.1
```

- [ ] **Step 3: Try method 1 — relative path**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 plugin add ../ --nosave 2>&1 | tail -20
ls -la plugins/cordova-khipu | head -3
ls -la platforms/ios/packages/ 2>/dev/null
cd /tmp/spike-khipu && git status --porcelain
```

Note three things: whether the command finished cleanly, whether `plugins/cordova-khipu` is a
symlink or a real directory, and whether `git status` shows `Package.swift` modified. **A
modified `Package.swift` means this method corrupts the repo and is ruled out.**

- [ ] **Step 4: Try method 2 — `--link`**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 plugin rm cordova-khipu --nosave 2>/dev/null
rm -rf platforms plugins
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add ../ --link --nosave 2>&1 | tail -20
ls -la platforms/ios/packages/ 2>/dev/null
grep -n "cordova-ios" platforms/ios/packages/cordova-ios-plugins/Package.swift
cd /tmp/spike-khipu && git status --porcelain
```

With `--link`, `SwiftPackage.addPlugin` neither copies nor rewrites: it references the
plugin's directory from `packages/cordova-ios-plugins/Package.swift`. Note whether the
plugin's `Package.swift` stayed intact and whether the build resolves. Watch for the expected
side effect: the plugin would keep depending on `apache/cordova-ios` from git instead of the
local CordovaLib, which can produce two different `Cordova` modules.

- [ ] **Step 5: Try method 3 — tarball**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 plugin rm cordova-khipu --nosave 2>/dev/null
rm -rf platforms plugins
cd /tmp/spike-khipu && npm pack --pack-destination ./example
cd /tmp/spike-khipu/example
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add ./cordova-khipu-*.tgz --nosave 2>&1 | tail -20
ls -la platforms/ios/packages/
grep -n "cordova-ios" platforms/ios/packages/cordova-khipu/Package.swift
cd /tmp/spike-khipu && git status --porcelain
```

- [ ] **Step 6: Compile with whichever method survived**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 build ios --emulator 2>&1 | tail -30
```
Expected: `BUILD SUCCEEDED`.

If method 3 is the only one that compiles clean, that is the decision.

- [ ] **Step 7: Write the decision into the spec**

Add to `## 15. Verification results`:

```markdown
### Phase 2 — installing the plugin locally in the example (plan Task 4)

| Method | `plugins/cordova-khipu` | Did it modify the repo's `Package.swift`? | Did it compile? |
| --- | --- | --- | --- |
| `cordova plugin add ../` | <symlink / directory> | <yes / no> | <yes / no> |
| `cordova plugin add ../ --link` | <symlink / directory> | <yes / no> | <yes / no> |
| `npm pack` + `cordova plugin add ./*.tgz` | <symlink / directory> | <yes / no> | <yes / no> |

**Decision:** <method chosen>, because <reason observed>.

This resolves risk 1 from §13.
```

Replace each `<...>` with the actual value. Do not leave any `<...>`.

- [ ] **Step 8: Clean up and commit**

```bash
rm -rf /tmp/spike-khipu
cd /Users/edavis/git/cordova-khipu
git add docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md
git commit -m "docs: record the local plugin install spike"
```

---

### Task 5: Example app skeleton

**Files:**
- Create: `example/package.json`
- Create: `example/config.xml`
- Create: `example/.gitignore`
- Create: `example/www/index.html`

**Interfaces:**
- Consumes: Task 4's decision on how to install the plugin.
- Produces: the `npm run ios:pods`, `npm run ios:spm`, `npm run android` and `npm run reset` scripts in `example/`. Tasks 6 and 7 replace the content of `example/www/`.

> **Resolved by Task 4.** The spike tried all three methods: `cordova plugin add ../` fails with `EINVAL: cp ... subdirectory of self`; `--link` compiles but leaves two `cordova-ios` identities and SwiftPM warns that will become an error; the tarball compiles clean. The tarball is used, with the `file:` prefix and an absolute path.

- [ ] **Step 1: Create `example/package.json`**

```json
{
  "name": "cordova-khipu-example",
  "displayName": "Khipu Example",
  "version": "1.0.0",
  "private": true,
  "description": "Example app for the cordova-khipu plugin",
  "license": "MIT",
  "scripts": {
    "reset": "rm -rf platforms plugins cordova-khipu-*.tgz",
    "plugin:add": "node scripts/install-plugin.mjs",
    "ios:pods": "npm run reset && npm run plugin:add && cordova platform add ios@7.1.1 --nosave && cordova run ios",
    "ios:spm": "npm run reset && npm run plugin:add && cordova platform add ios@8.1.1 --nosave && cordova run ios",
    "android": "npm run reset && npm run plugin:add && cordova platform add android@15.1.0 --nosave && cordova run android"
  },
  "engines": {
    "node": "^20.17.0 || >=22.9.0"
  },
  "devDependencies": {
    "cordova": "^13.0.0"
  },
  "cordova": {
    "platforms": []
  }
}
```

Notes on the scripts' design:
- `reset` deletes `platforms/` and `plugins/` because the iOS package manager is decided by
  the platform's major version, and cannot be switched on the fly.
- `cordova.platforms` is left empty on purpose: each script adds whichever it needs.
- **The plugin gets installed BEFORE the platform is added, and that order is not incidental.**
  Installing the plugin internally triggers an `npm install` of the tarball, and that
  `npm install` reconciles the whole `node_modules` tree. If the platform is already added,
  `node_modules/cordova-ios` is something npm finds undeclared anywhere, and it **prunes** it;
  then `platforms/ios/cordova/Api.js` — which is literally
  `module.exports = require('cordova-ios')` — fails with `Cannot find module 'cordova-ios'`.
  Doing it the other way, the `npm install` happens while there is still nothing to prune, and
  `cordova platform add` afterward installs the plugin that is already sitting in `plugins/`.
  That it gets installed is guaranteed by `cordova-lib`'s `installPluginsForNewPlatform()`,
  which takes its plugins from the **content of the `plugins/` directory**
  (`cordova_util.findPlugins`) and only uses `package.json` to order them.
- **The platforms do not go in `devDependencies`.** Only the CLI does. The script decides the
  major, with `platform add ios@7.1.1` or `ios@8.1.1`; also declaring `cordova-ios` as a
  dependency creates a contradiction npm resolves against us. Any later `npm install` inside
  `example/` — including the one `cordova plugin add` triggers internally — reconciles the tree
  against `package.json` and reverts `node_modules/cordova-ios` to the declared major, even if
  `platform add` had installed the other one a step earlier. The symptom is
  `CordovaError: ... not an up-to-date Cordova iOS project` when installing the plugin, on the
  CocoaPods path.
- **`--nosave` on all three `cordova platform add` calls, not just on `plugin add`.** Without
  it, cordova rewrites this `package.json` on every run: `cordova.platforms` fills up and
  `devDependencies.cordova-ios` ends up with the last run's major. Since the scripts run in
  sequence to verify all three scenarios, the file would end up declaring whichever path was
  tested last, which is exactly the thing that should stay fixed. Without this, `reset` is not
  a real reset: it deletes `platforms/` and `plugins/` but leaves `package.json` dirty.
- `engines` declares the floor `cordova-ios` 8.1.1 requires; it serves as a warning, not a
  barrier.
- Installing the plugin lives in a separate script because it has two detours that need
  explaining: see the next step.

- [ ] **Step 1b: Create `example/scripts/install-plugin.mjs`**

```js
// Installs the plugin in the example app from an `npm pack` tarball.
//
// The two detours here look unnecessary and are not. They came out of trying
// all three possible methods against a throwaway clone (design spec §15):
//
// 1. Tarball instead of `cordova plugin add ../`. That form fails with
//    `EINVAL: cp ... subdirectory of self`, because the destination
//    (example/plugins/) is a child of the source (the repo). And `--link`,
//    which does work today, leaves the plugin depending on apache/cordova-ios
//    via git instead of the project's local CordovaLib: SwiftPM tolerates it
//    by deduping, but warns "Conflicting identity for cordova-ios ... will be
//    escalated to an error in future versions of SwiftPM". Installing from
//    the tarball also has the advantage of exercising exactly the artifact a
//    merchant gets from npm.
//
// 2. `file:` prefix with an absolute path. `cordova plugin add ./thing.tgz`
//    fails on a parsing bug in cordova-lib 13.0.0.

import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const example = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(example, '..');

const isTarball = (name) => name.startsWith('cordova-khipu-') && name.endsWith('.tgz');

// A tarball from an earlier version would make the wrong one get picked below.
for (const old of readdirSync(example).filter(isTarball)) {
    rmSync(join(example, old));
}

execFileSync('npm', ['pack', '--pack-destination', example], { cwd: repo, stdio: 'inherit' });

const tarball = readdirSync(example).find(isTarball);

if (!tarball) {
    throw new Error('npm pack left no cordova-khipu-*.tgz in example/');
}

execFileSync('npx', ['cordova', 'plugin', 'add', `file:${join(example, tarball)}`, '--nosave'], {
    cwd: example,
    stdio: 'inherit'
});
```

- [ ] **Step 1c: Add the `files` field to the repository ROOT's `package.json`**

This is not cosmetic, which is why it goes here and not later: the example gets installed from
an `npm pack` tarball, and today `package.json` has no `files` and there is no `.npmignore`,
so that tarball carries the whole repository. The spike already showed it: `.husky/` showed up
inside `plugins/cordova-khipu`. Once `example/` exists, the tarball that installs the example
would also contain a copy of the example itself and the 3,000-odd lines under `docs/`.

In `/Users/edavis/git/cordova-khipu/package.json`, after `"homepage"`, add:

```json
  "files": [
    "plugin.xml",
    "Package.swift",
    "www/",
    "src/",
    "tests/",
    "scripts/",
    "README.md",
    "LICENSE"
  ],
```

`tests/` **has to be there**: `Package.swift` declares a target at `tests/ios` and SPM fails
if that path does not exist in the installed package. It is a few KB. `LICENSE` does not exist
yet; npm warns and continues, and Task 12 creates the file.

Run: `npm pack --dry-run 2>&1 | grep -cE "docs/|\.husky/|example/" || echo "docs/, .husky/ and example/ are not published: OK"`
Expected: `docs/, .husky/ and example/ are not published: OK`

- [ ] **Step 2: Create `example/config.xml`**

```xml
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.khipu.cordova.example" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>Khipu Example</name>
    <description>Example app for the cordova-khipu plugin</description>
    <author email="developers@khipu.com" href="https://khipu.com">Khipu</author>
    <content src="index.html" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <preference name="DisallowOverscroll" value="true" />
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
</widget>
```

`GradlePluginKotlinEnabled` is not declared: the idea is that the example exercises the
plugin's hook, not that it papers over it.

- [ ] **Step 3: Create `example/.gitignore`**

```
platforms/
plugins/
node_modules/
cordova-khipu-*.tgz
```

- [ ] **Step 4: Create a minimal `example/www/index.html`**

This file is provisional: it serves to test the plumbing before investing in the interface.
Task 6 replaces it.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Khipu Example</title>
  </head>
  <body>
    <h1>cordova-khipu</h1>
    <p id="status">Waiting for <code>deviceready</code>…</p>
    <script src="cordova.js"></script>
    <script>
      document.addEventListener('deviceready', function () {
        document.getElementById('status').textContent =
          'deviceready OK · window.Khipu is ' + typeof window.Khipu;
      });
    </script>
  </body>
</html>
```

- [ ] **Step 5: Verify the SPM path**

Run: `cd example && npm install && npm run ios:spm`
Expected: the app launches in the simulator and shows `deviceready OK · window.Khipu is object`.

- [ ] **Step 6: Verify the CocoaPods path**

Run: `cd example && npm run ios:pods`
Expected: same result on screen.

- [ ] **Step 7: Verify Android**

Run: `cd example && npm run android`
Expected: same result on screen.

If the Gradle build fails, **do not fix it here**: note the error and move on. Task 11 deals with Android.

- [ ] **Step 8: Commit**

```bash
git add package.json example/package.json example/config.xml example/.gitignore \
  example/www/index.html example/scripts/install-plugin.mjs example/package-lock.json
git commit -m "feat(example): example app skeleton

ios:pods, ios:spm and android scripts, which pin the platform's
major version because the major is what decides the package manager."
```

---

### Task 6: Harness — HTML structure and styles

**Files:**
- Modify: `example/www/index.html`
- Create: `example/www/css/harness.css`

**Interfaces:**
- Consumes: Task 5's skeleton.
- Produces: the DOM ids Task 7's `harness.js` consumes: `#status`, `#operationId`, `#text-fields`, `#switch-fields`, `#color-fields`, `#include-colors`, `#presets`, `#preview`, `#launch`, `#result`.

The fields get generated from JavaScript instead of written by hand: there are 12 colours, 5
switches, 3 text fields and a theme selector, i.e. 21 controls that in HTML would be that many
near-identical blocks. Those 21 cover exactly the 10 keys the plugin exposes (`title`,
`titleImageUrl`, `locale`, `theme`, the five booleans, and `colors` with its 12 fields),
verified against `KhipuPlugin.swift` and `KhipuPlugin.java`.

- [ ] **Step 1: Replace `example/www/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="format-detection" content="telephone=no" />
    <title>Khipu Example</title>
    <link rel="stylesheet" href="css/harness.css" />
  </head>
  <body>
    <header>
      <h1>cordova-khipu</h1>
      <p id="status" class="status status--waiting">Waiting for <code>deviceready</code>…</p>
    </header>

    <main>
      <section class="card">
        <h2>Operation</h2>
        <label class="field field--required">
          <span class="field__name">operationId</span>
          <input id="operationId" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="9sy0aufujsgq" />
        </label>
      </section>

      <section class="card">
        <h2>Presets</h2>
        <div id="presets" class="presets"></div>
      </section>

      <section class="card">
        <h2>Text options</h2>
        <p class="note">
          The <strong>include</strong> checkbox decides whether the key travels
          in the payload. Left unchecked, the SDK applies its own default,
          which is not the same as sending an empty value.
        </p>
        <div id="text-fields"></div>
      </section>

      <section class="card">
        <h2>Switches</h2>
        <div id="switch-fields"></div>
      </section>

      <section class="card">
        <h2>Colors</h2>
        <label class="field field--master">
          <input id="include-colors" type="checkbox" />
          <span class="field__name">include the <code>colors</code> object</span>
        </label>
        <div id="color-fields"></div>
      </section>

      <section class="card">
        <h2>Payload</h2>
        <pre id="preview" class="preview"></pre>
        <button id="launch" type="button" class="button" disabled>
          Start operation
        </button>
      </section>

      <section class="card">
        <h2>Result</h2>
        <div id="result" class="result">Nothing has run yet.</div>
      </section>
    </main>

    <script src="cordova.js"></script>
    <script src="js/harness.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `example/www/css/harness.css`**

```css
/* Khipu brand palette: purple #8347AD and cyan #3CB4E5. */
:root {
  --purple: #8347ad;
  --cyan: #3cb4e5;
  --background: #f6f4f9;
  --surface: #ffffff;
  --text: #1a1a1a;
  --text-muted: #5f5f6b;
  --border: #ded8e6;
  --ok: #1f8a4c;
  --error: #c0392b;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #101014;
    --surface: #1b1b22;
    --text: #e8e8ee;
    --text-muted: #a0a0ae;
    --border: #33333f;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0 0 3rem;
  background: var(--background);
  color: var(--text);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding-top: env(safe-area-inset-top);
}

header {
  background: var(--purple);
  color: #fff;
  padding: 1.25rem 1rem;
  padding-top: calc(1.25rem + env(safe-area-inset-top));
}

header h1 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}

.status {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.9;
}

.status--ready::before {
  content: "● ";
  color: var(--cyan);
}

.status--waiting::before {
  content: "○ ";
}

main {
  padding: 1rem;
  display: grid;
  gap: 1rem;
  max-width: 46rem;
  margin: 0 auto;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
}

.card h2 {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.note {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.field {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border);
}

.field:last-child {
  border-bottom: none;
}

.field__name {
  flex: 1 1 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}

.field--required {
  flex-direction: column;
  align-items: stretch;
  border-bottom: none;
}

.field--master {
  border-bottom: 2px solid var(--border);
  margin-bottom: 0.5rem;
}

.field input[type="text"] {
  flex: 1 1 8rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--text);
  font-size: 16px; /* less than 16px makes iOS zoom in on focus */
}

.field input[type="color"] {
  width: 3rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
}

.field select {
  padding: 0.45rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--text);
  font-size: 16px;
}

.field--off .field__name,
.field--off input,
.field--off select {
  opacity: 0.45;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.presets button {
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--purple);
  border-radius: 999px;
  background: none;
  color: var(--purple);
  font-size: 0.82rem;
}

.preview {
  margin: 0 0 0.9rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--background);
  border: 1px solid var(--border);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 16rem;
  overflow: auto;
}

.button {
  width: 100%;
  padding: 0.85rem;
  border: none;
  border-radius: 10px;
  background: var(--purple);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
}

.button:disabled {
  background: var(--border);
  color: var(--text-muted);
}

.result {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.result table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
  font-size: 0.78rem;
}

.result th,
.result td {
  text-align: left;
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.result__field {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.result__field dt {
  flex: 0 0 9rem;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.result__field dd {
  margin: 0;
  color: var(--text);
  word-break: break-word;
}

.result--ok {
  border-left: 3px solid var(--ok);
  padding-left: 0.6rem;
}

.result--error {
  border-left: 3px solid var(--error);
  padding-left: 0.6rem;
}
```

- [ ] **Step 3: Verify the page loads**

Run: `cd example && npm run ios:spm`
Expected: the app shows the purple header, the six cards, and the disabled button. The field
sections are empty: Task 7 fills them in.

- [ ] **Step 4: Commit**

```bash
git add example/www/index.html example/www/css/harness.css
git commit -m "feat(example): harness structure and styles"
```

---

### Task 7: Harness — logic

**Files:**
- Create: `example/www/js/harness.js`

**Interfaces:**
- Consumes: Task 6's DOM ids and `window.Khipu.startOperation(call, success, error)` from `www/cordova-khipu.js`.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Create `example/www/js/harness.js`**

```js
/*
 * Test harness for cordova-khipu.
 *
 * The central point is the per-field tri-state: every option has an
 * "include" checkbox in addition to its own control. The plugin
 * distinguishes "key absent" from `false` — see
 * `options!["showFooter"] != nil` in KhipuPlugin.swift and
 * `options.has("showFooter")` in KhipuPlugin.java — and the native SDK
 * applies its own defaults. If the harness always sent the booleans, it
 * would be impossible to test the behaviour a merchant who configures
 * nothing actually sees.
 */

var STORAGE_KEY = 'cordova-khipu-harness';

var TEXT_FIELDS = [
  { key: 'title', example: 'Demo Cordova' },
  { key: 'titleImageUrl', example: 'https://s3.amazonaws.com/static.khipu.com/logo-khipu-color.png' },
  { key: 'locale', example: 'es_CL' }
];

var SWITCH_FIELDS = [
  'skipExitPage',
  'skipExitSuccessPage',
  'showFooter',
  'showMerchantLogo',
  'showPaymentDetails'
];

var COLOR_KEYS = [
  'lightBackground',
  'lightOnBackground',
  'lightPrimary',
  'lightOnPrimary',
  'lightTopBarContainer',
  'lightOnTopBarContainer',
  'darkBackground',
  'darkOnBackground',
  'darkPrimary',
  'darkOnPrimary',
  'darkTopBarContainer',
  'darkOnTopBarContainer'
];

var THEMES = ['light', 'dark', 'system'];

var PRESETS = {
  'All defaults': {
    text: {},
    switches: {},
    theme: null,
    colors: null
  },
  'Khipu brand': {
    text: { title: 'Demo Cordova', locale: 'es_CL' },
    switches: { showFooter: true, showMerchantLogo: true, showPaymentDetails: true },
    theme: 'light',
    colors: {
      lightBackground: '#ffffff',
      lightOnBackground: '#1a1a1a',
      lightPrimary: '#8347ad',
      lightOnPrimary: '#ffffff',
      lightTopBarContainer: '#8347ad',
      lightOnTopBarContainer: '#ffffff',
      darkBackground: '#101418',
      darkOnBackground: '#e8eaed',
      darkPrimary: '#3cb4e5',
      darkOnPrimary: '#06283a',
      darkTopBarContainer: '#1a1f26',
      darkOnTopBarContainer: '#e8eaed'
    }
  },
  'Everything on': {
    text: { title: 'Demo Cordova', locale: 'es_CL' },
    switches: {
      skipExitPage: true,
      skipExitSuccessPage: true,
      showFooter: true,
      showMerchantLogo: true,
      showPaymentDetails: true
    },
    theme: 'system',
    colors: null
  },
  'Dark mode': {
    text: {},
    switches: {},
    theme: 'dark',
    colors: {
      darkBackground: '#101418',
      darkOnBackground: '#e8eaed',
      darkPrimary: '#3cb4e5',
      darkOnPrimary: '#06283a',
      darkTopBarContainer: '#1a1f26',
      darkOnTopBarContainer: '#e8eaed'
    }
  }
};

var controls = {
  text: {},
  switches: {},
  colors: {},
  theme: null
};

document.addEventListener('DOMContentLoaded', function () {
  buildFields();
  buildPresets();
  restore();
  listen();
  refreshPreview();
});

document.addEventListener('deviceready', function () {
  var status = document.getElementById('status');
  var available = typeof window.Khipu !== 'undefined';

  status.className = 'status ' + (available ? 'status--ready' : 'status--waiting');
  status.textContent = available
    ? 'Ready · window.Khipu available'
    : 'deviceready fired but window.Khipu is missing: check the plugin installation.';

  document.getElementById('launch').disabled = !available;
});

/* ---------- interface construction ---------- */

function buildFields () {
  var textContainer = document.getElementById('text-fields');

  TEXT_FIELDS.forEach(function (field) {
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = field.example;
    input.autocapitalize = 'off';
    input.autocorrect = 'off';
    input.spellcheck = false;

    controls.text[field.key] = addRow(textContainer, field.key, input);
  });

  // `theme` is a text field but with a closed set of values, so it goes as a
  // <select>.
  var themeSelect = document.createElement('select');
  THEMES.forEach(function (theme) {
    var option = document.createElement('option');
    option.value = theme;
    option.textContent = theme;
    themeSelect.appendChild(option);
  });
  controls.theme = addRow(textContainer, 'theme', themeSelect);

  var switchContainer = document.getElementById('switch-fields');
  SWITCH_FIELDS.forEach(function (key) {
    var toggle = document.createElement('input');
    toggle.type = 'checkbox';
    controls.switches[key] = addRow(switchContainer, key, toggle);
  });

  var colorContainer = document.getElementById('color-fields');
  COLOR_KEYS.forEach(function (key) {
    var colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = key.indexOf('dark') === 0 ? '#101418' : '#ffffff';
    controls.colors[key] = addRow(colorContainer, key, colorPicker);
  });
}

// Each row is a control plus an "include" checkbox. The control's value only
// reaches the payload if the checkbox is checked.
function addRow (container, key, control) {
  var row = document.createElement('label');
  row.className = 'field field--off';

  var include = document.createElement('input');
  include.type = 'checkbox';

  var name = document.createElement('span');
  name.className = 'field__name';
  name.textContent = key;

  row.appendChild(include);
  row.appendChild(name);
  row.appendChild(control);
  container.appendChild(row);

  return { row: row, include: include, control: control };
}

function buildPresets () {
  var container = document.getElementById('presets');

  Object.keys(PRESETS).forEach(function (name) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', function () {
      applyPreset(PRESETS[name]);
    });
    container.appendChild(button);
  });
}

/* ---------- state ---------- */

function listen () {
  document.addEventListener('input', onChange);
  document.addEventListener('change', onChange);
  document.getElementById('launch').addEventListener('click', launch);
}

function onChange () {
  syncOpacity();
  refreshPreview();
  save();
}

function syncOpacity () {
  var all = []
    .concat(Object.keys(controls.text).map(function (k) { return controls.text[k]; }))
    .concat(Object.keys(controls.switches).map(function (k) { return controls.switches[k]; }))
    .concat(Object.keys(controls.colors).map(function (k) { return controls.colors[k]; }))
    .concat([controls.theme]);

  all.forEach(function (entry) {
    entry.row.className = 'field' + (entry.include.checked ? '' : ' field--off');
  });

  var includeColors = document.getElementById('include-colors').checked;
  document.getElementById('color-fields').style.display = includeColors ? '' : 'none';
}

function buildPayload () {
  var options = {};

  Object.keys(controls.text).forEach(function (key) {
    var entry = controls.text[key];
    if (entry.include.checked) {
      options[key] = entry.control.value;
    }
  });

  if (controls.theme.include.checked) {
    options.theme = controls.theme.control.value;
  }

  Object.keys(controls.switches).forEach(function (key) {
    var entry = controls.switches[key];
    if (entry.include.checked) {
      options[key] = entry.control.checked;
    }
  });

  if (document.getElementById('include-colors').checked) {
    var colors = {};
    Object.keys(controls.colors).forEach(function (key) {
      var entry = controls.colors[key];
      if (entry.include.checked) {
        colors[key] = entry.control.value;
      }
    });
    options.colors = colors;
  }

  var payload = { operationId: document.getElementById('operationId').value.trim() };

  // `options` only travels if it has something inside: sending it empty is
  // not the same as not sending it, and here we want to be able to test both.
  if (Object.keys(options).length > 0) {
    payload.options = options;
  }

  return payload;
}

function refreshPreview () {
  document.getElementById('preview').textContent =
    JSON.stringify(buildPayload(), null, 2);
}

function applyPreset (preset) {
  Object.keys(controls.text).forEach(function (key) {
    var entry = controls.text[key];
    var value = preset.text[key];
    entry.include.checked = value !== undefined;
    if (value !== undefined) {
      entry.control.value = value;
    }
  });

  controls.theme.include.checked = preset.theme !== null;
  if (preset.theme !== null) {
    controls.theme.control.value = preset.theme;
  }

  Object.keys(controls.switches).forEach(function (key) {
    var entry = controls.switches[key];
    var value = preset.switches[key];
    entry.include.checked = value !== undefined;
    entry.control.checked = value === true;
  });

  document.getElementById('include-colors').checked = preset.colors !== null;
  Object.keys(controls.colors).forEach(function (key) {
    var entry = controls.colors[key];
    var value = preset.colors ? preset.colors[key] : undefined;
    entry.include.checked = value !== undefined;
    if (value !== undefined) {
      entry.control.value = value;
    }
  });

  onChange();
}

/* ---------- persistence ---------- */

// Testing on device reloads a lot, and retyping the operationId every time is
// real friction.
function save () {
  var state = {
    operationId: document.getElementById('operationId').value,
    includeColors: document.getElementById('include-colors').checked,
    text: {},
    theme: { include: controls.theme.include.checked, value: controls.theme.control.value },
    switches: {},
    colors: {}
  };

  Object.keys(controls.text).forEach(function (key) {
    state.text[key] = {
      include: controls.text[key].include.checked,
      value: controls.text[key].control.value
    };
  });

  Object.keys(controls.switches).forEach(function (key) {
    state.switches[key] = {
      include: controls.switches[key].include.checked,
      value: controls.switches[key].control.checked
    };
  });

  Object.keys(controls.colors).forEach(function (key) {
    state.colors[key] = {
      include: controls.colors[key].include.checked,
      value: controls.colors[key].control.value
    };
  });

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Without storage the harness still works; it just loses its memory.
  }
}

function restore () {
  var raw;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return;
  }

  if (!raw) {
    return;
  }

  var state;
  try {
    state = JSON.parse(raw);
  } catch (error) {
    return;
  }

  document.getElementById('operationId').value = state.operationId || '';
  document.getElementById('include-colors').checked = state.includeColors === true;

  if (state.theme) {
    controls.theme.include.checked = state.theme.include === true;
    controls.theme.control.value = state.theme.value || 'system';
  }

  applySaved(controls.text, state.text, 'value');
  applySaved(controls.switches, state.switches, 'checked');
  applySaved(controls.colors, state.colors, 'value');

  syncOpacity();
}

function applySaved (group, saved, property) {
  if (!saved) {
    return;
  }

  Object.keys(group).forEach(function (key) {
    var entry = saved[key];
    if (!entry) {
      return;
    }
    group[key].include.checked = entry.include === true;
    group[key].control[property] = entry.value;
  });
}

/* ---------- execution ---------- */

function launch () {
  var payload = buildPayload();

  if (!payload.operationId) {
    showError('Missing operationId.');
    return;
  }

  var button = document.getElementById('launch');
  button.disabled = true;
  document.getElementById('result').textContent = 'Running…';

  window.Khipu.startOperation(
    payload,
    function (result) {
      button.disabled = false;
      showResult(result, 'ok');
    },
    function (error) {
      button.disabled = false;
      // The error callback receives a KhipuResult when the SDK finished in
      // ERROR, and a string when the plugin rejected before starting.
      if (typeof error === 'string') {
        showError(error);
      } else {
        showResult(error, 'error');
      }
    }
  );
}

function showError (message) {
  var container = document.getElementById('result');
  container.className = 'result result--error';
  container.textContent = message;
}

function showResult (result, kind) {
  var container = document.getElementById('result');
  container.className = 'result result--' + kind;
  container.textContent = '';

  var list = document.createElement('dl');
  ['operationId', 'result', 'exitTitle', 'exitMessage', 'exitUrl', 'failureReason', 'continueUrl']
    .forEach(function (key) {
      var row = document.createElement('div');
      row.className = 'result__field';

      var name = document.createElement('dt');
      name.textContent = key;

      var value = document.createElement('dd');
      value.textContent = result[key] === null || result[key] === undefined
        ? '—'
        : String(result[key]);

      row.appendChild(name);
      row.appendChild(value);
      list.appendChild(row);
    });
  container.appendChild(list);

  var events = result.events || [];
  if (events.length === 0) {
    return;
  }

  var table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>name</th><th>type</th><th>timestamp</th></tr></thead>';

  var body = document.createElement('tbody');
  events.forEach(function (event) {
    var row = document.createElement('tr');
    [event.name, event.type, event.timestamp].forEach(function (cell) {
      var td = document.createElement('td');
      td.textContent = cell === null || cell === undefined ? '—' : String(cell);
      row.appendChild(td);
    });
    body.appendChild(row);
  });

  table.appendChild(body);
  container.appendChild(table);
}
```

- [ ] **Step 2: Verify the tri-state**

Run: `cd example && npm run ios:spm`

Check in the simulator:
1. With everything unchecked and an `operationId` typed in, the preview shows exactly
   `{ "operationId": "..." }`, with **no** `options` key.
2. Checking `showFooter`'s include box without turning the switch on, the preview shows
   `"showFooter": false`. Checking the box and leaving the switch off is **not** the same as
   not checking it.
3. Checking "include the colors object" with no color checked, the preview shows
   `"colors": {}`.

- [ ] **Step 3: Verify the presets and persistence**

1. Tap *Khipu brand*: all 12 colours get checked with the purple/cyan palette and the preview
   reflects them.
2. Tap *All defaults*: the preview goes back to only `operationId`.
3. Type an `operationId`, reload the app (`Cmd+R` in the simulator) and verify the value is
   still there.

- [ ] **Step 4: Verify a real operation**

With a valid `operationId`, tap *Start operation*: Khipu's view opens and when it finishes the
result shows up formatted, with its events table.

- [ ] **Step 5: Commit**

```bash
git add example/www/js/harness.js
git commit -m "feat(example): harness logic with a tri-state per field

Every option has an include checkbox in addition to its own control,
because the plugin distinguishes an absent key from false and the SDK
applies its own defaults."
```

---

### Task 8: `example/README.md` with the verification matrix

**Files:**
- Create: `example/README.md`

**Interfaces:**
- Consumes: Task 5's scripts and Task 4's decision.
- Produces: the manual verification documentation, which replaces the CI that was ruled out of scope.

- [ ] **Step 1: Create `example/README.md`**

```markdown
# `cordova-khipu` example app

Exercises the plugin against the three scenarios it supports, and is the way
to verify it: the repository has no CI by design.

## Requirements

- Node 20 or later
- Xcode 15 or later, with an iOS simulator installed
- CocoaPods, **only** for the cordova-ios 7 scenario
- Android SDK with an emulator or a connected device

## How the plugin gets installed

The plugin is packaged with `npm pack` and installed from the tarball, via
`scripts/install-plugin.mjs`. All three possible methods were tried against a
throwaway clone of the repository, and the other two were ruled out with
evidence:

| Method | What happens |
| --- | --- |
| `cordova plugin add ../` | Fails with `EINVAL: cp ... subdirectory of self`. The destination (`example/plugins/`) is a child of the source (the repo). |
| `cordova plugin add ../ --link` | Compiles, but leaves the plugin depending on `apache/cordova-ios` via git instead of the local CordovaLib. SwiftPM tolerates it by deduping and warns: *"Conflicting identity for cordova-ios … will be escalated to an error in future versions of SwiftPM"*. |
| **Tarball** | Compiles clean, with no identity warnings. |

Two details of the script are not cosmetic: it uses the `file:` prefix with an
**absolute path**, because `cordova plugin add ./thing.tgz` fails on a parsing
bug in `cordova-lib` 13.0.0; and it deletes old tarballs before packaging, so
it does not end up picking an earlier version's.

The side effect is a good one: it installs exactly the same artifact a
merchant gets from npm, so `package.json`'s `files` field gets verified along
the way.

## Verification matrix

Run all three before publishing a version.

| Scenario | Command | What it tests |
| --- | --- | --- |
| cordova-ios 7 + CocoaPods | `npm run ios:pods` | `<podspec>` + `<source-file>` and the `configure-swift-ios.js` hook |
| cordova-ios 8 + SPM | `npm run ios:spm` | `Package.swift`, no CocoaPods |
| cordova-android 15 | `npm run android` | `khipu.gradle` and the `enable-gradle-kotlin-plugin.js` hook |

Each script deletes `platforms/` and `plugins/` before starting: which iOS
package manager gets used is decided by the platform's major version and
cannot be switched on the fly.

### The run that actually proves SPM

At least once, run `npm run ios:spm` with CocoaPods off `PATH`:

```bash
PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -x -F "$(dirname "$(command -v pod)")" | paste -sd: -) npm run ios:spm
```

It is the only thing that proves the cordova-ios 8 path does not need CocoaPods.

## What to check in the harness

- **Tri-state.** With everything unchecked, the preview shows only
  `operationId`, with no `options` key. This is the case of a merchant who
  configures nothing, and it is the one that breaks most easily by accident.
- **Explicit `false`.** Checking `showFooter`'s include box with the switch
  off sends `"showFooter": false`, which is not the same as not sending the
  key at all.
- **Presets.** *Khipu brand* uses purple `#8347AD` and cyan `#3CB4E5`.
- **Resources on the CocoaPods path.** The plugin no longer declares `use_frameworks!`, so
  pods link statically. Running `npm run ios:pods`, confirm that Khipu's view shows **real
  images and fonts**, not empty boxes or system-font text. A resource that fails to resolve
  breaks at display time, not at compile time, so a green build is not enough.
- **Persistence.** The `operationId` survives a reload.
- **Result.** When the operation finishes, `KhipuResult`'s fields and the
  events table show up.

## Known environment friction

None of this is the plugin's fault, but it costs time if you do not know
about it:

- **`cordova run ios` on the CocoaPods path** can fail looking for a runtime the default
  simulator does not have. Fixed with `cordova run ios --target=<simIdentifier>`. Watch out:
  `cordova-ios` 7 expects an identifier like `iPhone-17`, **not** a UDID.
- **`adb install` can fail from lack of space** on the emulator's `/data` partition, with
  nothing to do with the Gradle build. Fixed by starting the AVD with
  `-wipe-data -partition-size 8192`.
- **`[ios-sim] Simulator already running`** if a simulator was left open from an earlier run.
  Fixed with `xcrun simctl shutdown all` before retrying.

## Limitations

Cordova has no web fallback: `window.Khipu` only exists after `deviceready`.
Opening `www/index.html` in a browser shows the interface but the button
stays disabled.
```

- [ ] **Step 2: Adjust if Task 4 decided otherwise**

If the spike concluded that `cordova plugin add ../` or `--link` are safe, rewrite the *How
the plugin gets installed* section with what was actually done and why. The text above assumes
the tarball method.

- [ ] **Step 3: Commit**

```bash
git add example/README.md
git commit -m "docs(example): manual verification matrix"
```

---

### Task 9: `KhipuOptionsMapper` with tests

Today the options mapping forces the cast with `as!` in about twenty places: a merchant who
sends `title: 123` **crashes the app** instead of getting an error back.

**Files:**
- Create: `src/ios/KhipuOptionsMapper.swift`
- Create: `tests/ios/KhipuOptionsMapperTests.swift`
- Modify: `Package.swift`
- Modify: `plugin.xml`
- Modify: `src/ios/KhipuPlugin.swift`

**Interfaces:**
- Consumes: Task 1's `CordovaKhipu` target.
- Produces: `struct KhipuOptionsInput: Equatable` and `enum KhipuOptionsMapper` with
  `parse(_ call: [String: Any]) -> KhipuOptionsInput`,
  `makeOptions(from input: KhipuOptionsInput) -> KhipuOptions`,
  `makeColors(from colors: [String: String]) -> KhipuColors` and
  `static let colorKeys: [String]`. No other task consumes them.

> **Why `KhipuOptionsInput` exists and `KhipuOptions` is not tested directly:** `KhipuOptions`'s
> properties are declared `let` **without `public`**, so they are internal to the
> `KhipuClientIOS` module and a test of ours cannot read them. Separating the parsing (ours,
> testable) from applying it onto the Builder (trivial) solves that and also isolates the only
> part that can genuinely fail.

- [ ] **Step 1: Add the test target to `Package.swift`**

Add the `.testTarget` to the `targets` array. **Replace the whole array** with this, instead
of inserting loose lines:

```swift
    targets: [
        .target(
            name: "CordovaKhipu",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "KhipuClientIOS", package: "KhipuClientIOS")
            ],
            path: "src/ios"
        ),
        .testTarget(
            name: "CordovaKhipuTests",
            dependencies: ["CordovaKhipu"],
            path: "tests/ios"
        )
    ]
```

- [ ] **Step 2: Write the failing tests**

Create `tests/ios/KhipuOptionsMapperTests.swift`:

```swift
import XCTest
import KhipuClientIOS
@testable import CordovaKhipu

final class KhipuOptionsMapperTests: XCTestCase {

    func testMissingOptionsKeyReturnsAllNil() {
        let input = KhipuOptionsMapper.parse(["operationId": "abc"])

        XCTAssertEqual(input, KhipuOptionsInput())
    }

    func testMapsAllScalarFields() {
        let input = KhipuOptionsMapper.parse([
            "operationId": "abc",
            "options": [
                "title": "Demo",
                "titleImageUrl": "https://khipu.com/logo.png",
                "skipExitPage": true,
                "skipExitSuccessPage": false,
                "showFooter": false,
                "showMerchantLogo": true,
                "showPaymentDetails": false,
                "locale": "es_CL",
                "theme": "dark"
            ]
        ])

        XCTAssertEqual(input.topBarTitle, "Demo")
        XCTAssertEqual(input.topBarImageUrl, "https://khipu.com/logo.png")
        XCTAssertEqual(input.skipExitPage, true)
        XCTAssertEqual(input.skipExitSuccessPage, false)
        XCTAssertEqual(input.showFooter, false)
        XCTAssertEqual(input.showMerchantLogo, true)
        XCTAssertEqual(input.showPaymentDetails, false)
        XCTAssertEqual(input.locale, "es_CL")
        XCTAssertEqual(input.theme, .dark)
    }

    /// The plugin has to be able to distinguish "the key was not sent" from
    /// "false was sent": the SDK applies its own defaults.
    func testAbsentKeyIsNotConfusedWithFalse() {
        let input = KhipuOptionsMapper.parse(["options": ["title": "Demo"]])

        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.skipExitPage)
        XCTAssertNil(input.showMerchantLogo)
        XCTAssertNil(input.showPaymentDetails)
        XCTAssertNil(input.skipExitSuccessPage)
    }

    /// This is the case that crashes the app today.
    func testWrongTypeIsDiscardedInsteadOfCrashing() {
        let input = KhipuOptionsMapper.parse([
            "options": [
                "title": 123,
                "showFooter": "yes",
                "locale": ["es", "CL"]
            ]
        ])

        XCTAssertNil(input.topBarTitle)
        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.locale)
    }

    func testUnknownThemeIsDiscarded() {
        XCTAssertNil(KhipuOptionsMapper.parse(["options": ["theme": "neon"]]).theme)
    }

    func testMapsAllTwelveColorKeys() {
        var colors: [String: Any] = [:]
        for (index, key) in KhipuOptionsMapper.colorKeys.enumerated() {
            colors[key] = String(format: "#%06X", index)
        }

        let input = KhipuOptionsMapper.parse(["options": ["colors": colors]])

        XCTAssertEqual(input.colors?.count, 12)
        XCTAssertEqual(input.colors?["lightPrimary"], "#000002")
    }

    func testDiscardsUnknownColorKeys() {
        let input = KhipuOptionsMapper.parse([
            "options": ["colors": ["lightPrimary": "#8347AD", "purple": "#8347AD"]]
        ])

        XCTAssertEqual(input.colors, ["lightPrimary": "#8347AD"])
    }

    func testEmptyColorsStaysDifferentFromAbsent() {
        XCTAssertEqual(KhipuOptionsMapper.parse(["options": ["colors": [String: Any]()]]).colors, [:])
        XCTAssertNil(KhipuOptionsMapper.parse(["options": [String: Any]()]).colors)
    }

    /// `KhipuColors` has internal properties but is `Codable`, so the object
    /// the SDK actually receives can be checked.
    func testColorsReachTheSdkObject() throws {
        let colors = KhipuOptionsMapper.makeColors(from: [
            "lightPrimary": "#8347AD",
            "darkPrimary": "#3CB4E5"
        ])

        let data = try JSONEncoder().encode(colors)
        let decoded = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(decoded["lightPrimary"] as? String, "#8347AD")
        XCTAssertEqual(decoded["darkPrimary"] as? String, "#3CB4E5")
        XCTAssertNil(decoded["lightBackground"])
    }
}
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `xcodebuild -list`
Expected: the `cordova-khipu` and `KhipuClientIOS` schemes show up. The tests' scheme is
**`cordova-khipu`**, not `cordova-khipu-Package`: Xcode only generates that suffix under some
configurations, and it does not apply here. Note whatever it reports and use that.

Run: `xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.5'`
Expected: FAIL with `cannot find 'KhipuOptionsMapper' in scope`.

The `OS=18.5` is not decorative: without it, `xcodebuild` picks the newest installed runtime
(26.5), where no device named "iPhone 16" exists and the run fails on the destination, not on
the tests. List the available ones with `xcrun simctl list devices available` and use a
name/OS pair that actually exists on the machine.

- [ ] **Step 4: Write the mapper**

Create `src/ios/KhipuOptionsMapper.swift`:

```swift
#if canImport(Cordova)
import Cordova
#endif
import KhipuClientIOS

/// Typed representation of the options that arrive from JavaScript.
///
/// It exists separately from `KhipuOptions` for two reasons. The first is
/// practical: `KhipuOptions`'s properties are internal to `KhipuClientIOS`,
/// so a test cannot read them. The second is a design one: it separates what
/// can fail — interpreting a dictionary a third party built — from what
/// cannot, which is applying already-validated values onto the Builder.
///
/// `nil` means "JavaScript did not send this key", which is not the same as
/// sending it as `false`: the SDK applies its own defaults and the plugin
/// has to let it.
struct KhipuOptionsInput: Equatable {
    var topBarTitle: String?
    var topBarImageUrl: String?
    var skipExitPage: Bool?
    var skipExitSuccessPage: Bool?
    var showFooter: Bool?
    var showMerchantLogo: Bool?
    var showPaymentDetails: Bool?
    var locale: String?
    var theme: KhipuOptions.Theme?
    var colors: [String: String]?
}

enum KhipuOptionsMapper {

    /// The twelve keys `KhipuColors` accepts. A key not in here gets
    /// discarded instead of propagated, so a typo in the merchant's
    /// JavaScript does not silently reach the SDK.
    static let colorKeys: [String] = [
        "lightBackground",
        "lightOnBackground",
        "lightPrimary",
        "lightOnPrimary",
        "lightTopBarContainer",
        "lightOnTopBarContainer",
        "darkBackground",
        "darkOnBackground",
        "darkPrimary",
        "darkOnPrimary",
        "darkTopBarContainer",
        "darkOnTopBarContainer"
    ]

    /// Interprets the dictionary that arrives from JavaScript. It neither
    /// throws nor traps: a value of the wrong type is discarded as if it had
    /// never arrived.
    static func parse(_ call: [String: Any]) -> KhipuOptionsInput {
        guard let options = call["options"] as? [String: Any] else {
            return KhipuOptionsInput()
        }

        var input = KhipuOptionsInput()
        input.topBarTitle = options["title"] as? String
        input.topBarImageUrl = options["titleImageUrl"] as? String
        input.skipExitPage = options["skipExitPage"] as? Bool
        input.skipExitSuccessPage = options["skipExitSuccessPage"] as? Bool
        input.showFooter = options["showFooter"] as? Bool
        input.showMerchantLogo = options["showMerchantLogo"] as? Bool
        input.showPaymentDetails = options["showPaymentDetails"] as? Bool
        input.locale = options["locale"] as? String

        if let theme = options["theme"] as? String {
            input.theme = KhipuOptions.Theme(rawValue: theme)
        }

        if let colors = options["colors"] as? [String: Any] {
            var valid: [String: String] = [:]
            for key in colorKeys {
                if let value = colors[key] as? String {
                    valid[key] = value
                }
            }
            input.colors = valid
        }

        return input
    }

    /// Applies an already-validated input onto the SDK's Builder.
    static func makeOptions(from input: KhipuOptionsInput) -> KhipuOptions {
        var builder = KhipuOptions.Builder()

        if let value = input.topBarTitle { builder = builder.topBarTitle(value) }
        if let value = input.topBarImageUrl { builder = builder.topBarImageUrl(value) }
        if let value = input.skipExitPage { builder = builder.skipExitPage(value) }
        if let value = input.skipExitSuccessPage { builder = builder.skipExitSuccessPage(value) }
        if let value = input.showFooter { builder = builder.showFooter(value) }
        if let value = input.showMerchantLogo { builder = builder.showMerchantLogo(value) }
        if let value = input.showPaymentDetails { builder = builder.showPaymentDetails(value) }
        if let value = input.locale { builder = builder.locale(value) }
        if let value = input.theme { builder = builder.theme(value) }

        if let colors = input.colors {
            builder = builder.colors(makeColors(from: colors))
        }

        return builder.build()
    }

    static func makeColors(from colors: [String: String]) -> KhipuColors {
        var builder = KhipuColors.Builder()

        if let value = colors["lightBackground"] { builder = builder.lightBackground(value) }
        if let value = colors["lightOnBackground"] { builder = builder.lightOnBackground(value) }
        if let value = colors["lightPrimary"] { builder = builder.lightPrimary(value) }
        if let value = colors["lightOnPrimary"] { builder = builder.lightOnPrimary(value) }
        if let value = colors["lightTopBarContainer"] { builder = builder.lightTopBarContainer(value) }
        if let value = colors["lightOnTopBarContainer"] { builder = builder.lightOnTopBarContainer(value) }
        if let value = colors["darkBackground"] { builder = builder.darkBackground(value) }
        if let value = colors["darkOnBackground"] { builder = builder.darkOnBackground(value) }
        if let value = colors["darkPrimary"] { builder = builder.darkPrimary(value) }
        if let value = colors["darkOnPrimary"] { builder = builder.darkOnPrimary(value) }
        if let value = colors["darkTopBarContainer"] { builder = builder.darkTopBarContainer(value) }
        if let value = colors["darkOnTopBarContainer"] { builder = builder.darkOnTopBarContainer(value) }

        return builder.build()
    }
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.5'`
Expected: PASS, 9 tests, 0 failures.

- [ ] **Step 6: Use the mapper from `KhipuPlugin.swift`**

Delete the whole `getOptions(call:)` method (from
`func getOptions(call: [String: Any]) -> KhipuOptions {` to its closing brace, about 100
lines).

And in `startOperation`, replace:

```swift
        let options = getOptions(call: call)
```

with:

```swift
        let options = KhipuOptionsMapper.makeOptions(from: KhipuOptionsMapper.parse(call))
```

- [ ] **Step 7: Declare the new file in `plugin.xml`**

Inside `<platform name="ios" package="swift">`, after the existing `<source-file>`:

```xml
    <source-file src="src/ios/KhipuOptionsMapper.swift"/>
```

This is needed for cordova-ios 7, which compiles file by file. cordova-ios 8 ignores it
because it takes the whole target from `Package.swift`.

- [ ] **Step 8: Verify everything still compiles and passes**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: PASS

Run: `xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.5'`
Expected: PASS, 9 tests.

- [ ] **Step 9: Verify in the example app that a wrong type no longer crashes**

Run: `cd example && npm run ios:spm`

In the simulator, open the Safari console (Develop → Simulator → index.html) and run:

```js
window.Khipu.startOperation(
  { operationId: 'does-not-exist', options: { title: 123 } },
  function (ok) { console.log('ok', ok); },
  function (err) { console.log('error', err); }
);
```

Expected: the app does **not** crash. Before this change, the `as!` killed it.

- [ ] **Step 10: Commit**

```bash
git add src/ios/KhipuOptionsMapper.swift tests/ios/KhipuOptionsMapperTests.swift Package.swift plugin.xml src/ios/KhipuPlugin.swift
git commit -m "fix(ios): map options with safe casts instead of as!

A merchant sending title: 123 crashed the app. The mapping moves to a
pure function over our own type, with tests: KhipuOptions's properties
are internal to the SDK and cannot be checked directly."
```

---

### Task 10: Correct presenter and non-destructive `dismiss`

**Files:**
- Modify: `src/ios/KhipuPlugin.swift`

**Interfaces:**
- Consumes: Task 9's `KhipuPlugin.swift`.
- Produces: `private func presenter() -> UIViewController?` in `KhipuPlugin`. No other task consumes it.

There are two defects here, both verified, and the fix is the same for both.

**a) `UIApplication.shared.windows` has been deprecated since iOS 15, and the compiler does
not say so.** At an iOS 13 deployment target it emits no warning at all, because at that floor
the API was not yet deprecated. Measured with `swiftc -typecheck`:

```
iOS 13.0 → (no warning)
iOS 15.0 → warning: 'windows' was deprecated in iOS 15.0: Use UIWindowScene.windows on a relevant window scene instead
iOS 18.0 → same
```

Since `Package.swift` declares `.iOS(.v13)`, **`grep "was deprecated"` over the build is
useless as a test**: it finds nothing either before or after the change. Besides the warning,
`windows` returns windows from every connected scene, so in an app with several scenes it can
hand back one that is not on screen.

**b) Presenting over a controller that is already presenting does nothing.** UIKit silently
rejects it. The current code dodges that with
`presenter.presentedViewController?.dismiss(animated: false)`, i.e. **dismissing the
merchant's modal without asking**, then waiting a fixed second for the dismissal to finish. A
merchant who calls the plugin with their own modal on screen sees their interface disappear.

The fix: Cordova already hands over the right controller in `CDVPlugin`'s
`self.viewController`. It exists on cordova-ios 7
(`@property (nonatomic, weak) UIViewController* viewController;`) and on cordova-ios 8
(`@property (nonatomic, weak) CDVViewController *viewController;`), and **is not deprecated**
on either — unlike `scrollView` and others in the same header, which do carry
`CDV_DEPRECATED(8.0.0, ...)`. From there it walks down the presented-controller chain instead
of destroying it.

- [ ] **Step 1: Confirm the deprecation exists but is hidden at the current floor**

```bash
cd /tmp && cat > dep.swift <<'EOF'
import UIKit
func f() -> UIViewController? {
    return UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController
}
EOF
SDK=$(xcrun --sdk iphoneos --show-sdk-path)
for t in 13.0 15.0; do
  echo "--- iOS $t"
  xcrun swiftc -typecheck -sdk "$SDK" -target arm64-apple-ios$t dep.swift 2>&1 | grep -c "was deprecated"
done
rm /tmp/dep.swift
```
Expected: `0` for iOS 13.0 and a number greater than zero for iOS 15.0.

This is what justifies not using the build log as verification.

- [ ] **Step 2: Confirm the code's current state**

Run: `grep -n "UIApplication.shared.windows\|presentedViewController?.dismiss\|asyncAfter" src/ios/KhipuPlugin.swift`
Expected: all three lines show up.

- [ ] **Step 3: Replace `startKhipuOperation` and add `presenter()`**

Replace the whole `startKhipuOperation(operationId:options:completion:)` method with:

```swift
    func startKhipuOperation(operationId: String, options: KhipuOptions, completion: @escaping ([String: Any]?, String?) -> Void) {
        DispatchQueue.main.async {
            guard let presenter = self.presenter() else {
                completion(nil, "No view controller available to present from")
                return
            }

            KhipuLauncher.launch(presenter: presenter,
                                 operationId: operationId,
                                 options: options) { result in
                completion([
                    "operationId": result.operationId,
                    "result": result.result,
                    "exitTitle": result.exitTitle,
                    "exitMessage": result.exitMessage,
                    "exitUrl": result.exitUrl as Any,
                    "failureReason": result.failureReason as Any,
                    "continueUrl": result.continueUrl as Any,
                    "events": result.events.map { event in
                        return [
                            "name": event.name,
                            "type": event.type,
                            "timestamp": event.timestamp
                        ]
                    }
                ], nil)
            }
        }
    }

    /// The controller to present Khipu's view over.
    ///
    /// It starts from `self.viewController`, which is the one Cordova
    /// associates with the webview the call came from. It is a better
    /// starting point than `UIApplication.shared.windows`: that API has been
    /// deprecated since iOS 15 — with no compiler warning at an iOS 13 floor
    /// — and returns windows from every connected scene, including one that
    /// might not be on screen.
    ///
    /// It then walks down the presented-controller chain. UIKit refuses to
    /// present over a controller that is already presenting something, so a
    /// merchant calling the plugin with their own modal on top would see
    /// nothing. This used to be solved by dismissing whatever was there,
    /// i.e. dismissing the merchant's modal for them, and waiting a fixed
    /// second for it to finish; walking down the chain destroys nothing and
    /// needs no wait.
    ///
    /// Kept private to the plugin rather than as an extension on
    /// `UIViewController`: the plugin links statically inside the
    /// merchant's app, where an extension with this name could collide with
    /// theirs.
    private func presenter() -> UIViewController? {
        var controller: UIViewController? = self.viewController

        while let presented = controller?.presentedViewController {
            controller = presented
        }

        return controller
    }
```

Note that the `dismiss`, the `asyncAfter(deadline: .now() + 1)` and the `UIApplication` lookup
all disappear.

- [ ] **Step 4: Verify none of the three remain**

Run: `grep -n "UIApplication.shared.windows\|presentedViewController?.dismiss\|asyncAfter" src/ios/KhipuPlugin.swift || echo "all three removed: OK"`
Expected: `all three removed: OK`

- [ ] **Step 5: Compile and run the tests**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: PASS

Run: `xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.5'`
Expected: PASS, 9 tests.

- [ ] **Step 6: Temporary probe to see which controller gets resolved**

Temporarily add to the end of `presenter()`, right before `return controller`:

```swift
        // TEMPORARY PROBE — delete in Step 8
        NSLog("cordova-khipu probe: viewController=%@ presenter=%@ wasAlreadyPresenting=%@",
              String(describing: type(of: self.viewController)),
              String(describing: controller.map { type(of: $0) }),
              String(describing: self.viewController?.presentedViewController != nil))
```

Run: `cd example && npm run ios:spm`

Launch an operation and read Xcode's console or
`xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "cordova-khipu probe"'`.

Expected on the happy path: `viewController` and `presenter` are the same type and
`wasAlreadyPresenting=false`. That confirms the change does not alter the normal case — exactly
what the old code was solving for.

- [ ] **Step 7: Verify the case that used to fail**

With the probe still in place, launch an operation, let it finish, and launch a second one
without closing the app.

Expected: Khipu's view opens both times, with no blank screen and no second-long delay between
the close and the reopen that there used to be.

The merchant's-own-modal case cannot be reproduced from the harness, because Cordova exposes
no way to present a `UIViewController` from JavaScript. It is covered by UIKit's rule and by
the measurement the `flutter_khipu` session made on the same pattern
(`oldCodeWouldReturn = FlutterViewController, alreadyPresenting=true`). To check it here would
need a native probe that presents an empty controller before launching, which is out of scope
for this task.

- [ ] **Step 8: Remove the probe**

Delete the whole `// TEMPORARY PROBE` block.

Run: `grep -c "TEMPORARY PROBE" src/ios/KhipuPlugin.swift || echo "probe removed: OK"`
Expected: `probe removed: OK`

- [ ] **Step 9: Verify the CocoaPods path**

Run: `cd example && npm run ios:pods`
Expected: same behaviour as under SPM. This step matters because `self.viewController` is
typed differently on cordova-ios 7 (`UIViewController*`) and on 8 (`CDVViewController*`); the
code uses nothing specific to `CDVViewController`, but it still needs to be seen compiling on
both.

- [ ] **Step 10: Commit**

```bash
git add src/ios/KhipuPlugin.swift
git commit -m "fix(ios): present over the correct controller without dismissing the merchant's

Starts from self.viewController, which Cordova associates with the
webview that made the call, and walks down the presented-controller
chain. UIKit refuses to present over a controller that is already
presenting something: this used to be dodged by dismissing the
merchant's modal and waiting a fixed second. This also removes
UIApplication.shared.windows, deprecated since iOS 15 even though the
compiler stays silent at an iOS 13 floor."
```

---

### Task 11: Android up to date with cordova-android 15

**Files:**
- Modify: `src/android/khipu.gradle`

**Interfaces:**
- Consumes: the example app from Tasks 5-7.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Confirm the current state**

Run: `grep -n "jcenter\|packagingOptions\|mavenCentral" src/android/khipu.gradle`
Expected: `jcenter()` and `packagingOptions` show up, `mavenCentral()` does not.

- [ ] **Step 2: Rewrite `src/android/khipu.gradle` without the excludes**

First check whether the excludes are still needed at all. Modern AGP already excludes several
`META-INF/*` entries on its own.

```groovy
repositories {
    google()
    // jcenter() has been dead since 2022. The plugin worked because the
    // cordova-android template declares mavenCentral() in the root, not
    // because jcenter actually served anything.
    mavenCentral()
    maven { url 'https://dev.khipu.com/nexus/content/repositories/khenshin' }
}

dependencies {
    implementation 'com.khipu:khipu-client-android:2.27.0'
}
```

- [ ] **Step 3: Compile the example on Android**

This step also doubles as the first real exercise of `khipu-client-android` 2.27.0 with Kotlin
2.1.21, cordova-android 15's default — the spec's risk 4. There is no precedent: `flutter_khipu`
uses that same 2.27.0 but pins `ext.kotlin_version = "1.9.0"`, two majors below.
`khipu-client-android` uses Jetpack Compose, whose compiler is tied to the Kotlin version.

Run: `cd example && npm run android`
Expected: the app launches on the emulator and shows `deviceready OK · window.Khipu is object`.

If it fails with a Compose compiler error or a Kotlin version clash, **stop and report**: this
is not something to fix from this plugin, it needs escalating to the Android SDK team. For
that report, note the effective Kotlin version with
`grep KOTLIN_VERSION example/platforms/android/cdv-gradle-config.json`.

- [ ] **Step 4: If the build fails on duplicate resources, bring back the excludes with the AGP 8 syntax**

Only if step 3 failed with an error like `2 files found with path 'META-INF/NOTICE'`, add to
the end of `src/android/khipu.gradle`:

```groovy
android {
    // `packagingOptions { exclude ... }` was deprecated in AGP 8; this is the
    // equivalent form. Requires AGP 8, which is cordova-android 12 onward,
    // and the plugin's <engines> already asks for 13.
    packaging {
        resources {
            excludes += ['META-INF/NOTICE', 'META-INF/LICENSE']
        }
    }
}
```

Run `npm run android` again and verify it passes.

If step 3 passed without this, **do not add it**: the block gets permanently dropped.

- [ ] **Step 5: Verify the Kotlin hook still does its job**

Run: `grep IS_GRADLE_PLUGIN_KOTLIN_ENABLED example/platforms/android/cdv-gradle-config.json`
Expected: `"IS_GRADLE_PLUGIN_KOTLIN_ENABLED": true`

That `true` is set by `scripts/enable-gradle-kotlin-plugin.js`; cordova-android 15's default is
`false`.

- [ ] **Step 6: Note the effective versions for the README**

```bash
grep -E "KOTLIN_VERSION|GRADLE_VERSION|AGP_VERSION|SDK_VERSION|MIN_SDK_VERSION" example/platforms/android/cdv-gradle-config.json
```

Save the output: Task 13 uses it to write the README's Android section with real numbers
instead of remembered ones.

- [ ] **Step 7: Commit**

```bash
git add src/android/khipu.gradle
git commit -m "fix(android): replace jcenter with mavenCentral

JCenter has been dead since 2022; declaring mavenCentral explicitly
stops depending on the cordova-android template bringing it in."
```

---

### Task 12: npm packaging and the version-sync check

**Files:**
- Create: `scripts/check-native-versions.js`
- Create: `tests/scripts/check-native-versions.test.js`
- Create: `CHANGELOG.md`
- Create: `LICENSE` (**blocked**, see Step 7)
- Modify: `package.json`

**Interfaces:**
- Consumes: `Package.swift` and `plugin.xml`.
- Produces: `scripts/check-native-versions.js` exports
  `compare(packageSwift, pluginXml) -> { ok: boolean, message: string }` for the tests, and
  runs the comparison when executed directly. `package.json` gains the `verify:versions`
  script.

- [ ] **Step 1: Write the failing tests**

Create `tests/scripts/check-native-versions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');

const { compare } = require('../../scripts/check-native-versions.js');

const PACKAGE_SWIFT = version =>
    `.package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "${version}")`;

// The attribute cordova-ios reads is `spec`, not `version`: Podfile.js only emits the
// constraint if it finds `spec`. A `version=` is silently ignored and the pod ends up unpinned.
const PLUGIN_XML = version =>
    `<pod name="KhipuClientIOS" spec="${version}" swift-version="5.1" nospm="true"/>`;

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
        '<pod spec="2.16.5" name="KhipuClientIOS" nospm="true"/>');

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
```

The last test matters: `scripts/update-plugin-version.js` rewrites `plugin.xml` with
`xml2js`'s Builder on every release, and there is no guarantee it preserves attribute order.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module '../../scripts/check-native-versions.js'`

- [ ] **Step 3: Write the script**

Create `scripts/check-native-versions.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

// The KhipuClientIOS version lives in two manifests because the plugin
// supports CocoaPods (cordova-ios 7) and SPM (cordova-ios 8) at the same
// time. With no CI, this is the only thing that stops a release from
// shipping where the two paths install different SDKs.

function compare (packageSwift, pluginXml) {
    const spm = packageSwift.match(/KhipuClientIOS\.git"\s*,\s*exact:\s*"([^"]+)"/);

    if (!spm) {
        return {
            ok: false,
            message: 'could not find the KhipuClientIOS version in Package.swift'
        };
    }

    // The <pod> tag is isolated first and the version extracted afterward, so
    // this does not depend on attribute order: update-plugin-version.js
    // rewrites plugin.xml with xml2js's Builder on every release.
    const podTag = pluginXml.match(/<pod\b[^>]*name="KhipuClientIOS"[^>]*>/);
    // `spec`, not `version`: cordova-ios's Podfile.js only emits the version constraint if it
    // finds `spec`. A `version=` is silently ignored and the pod ends up unpinned, which is
    // exactly the bug the published plugin had.
    const pod = podTag && podTag[0].match(/spec="([^"]+)"/);

    if (!pod) {
        return {
            ok: false,
            message: 'could not find KhipuClientIOS\'s `spec` in plugin.xml (did it end up as `version=`, which cordova-ios ignores?)'
        };
    }

    if (spm[1] !== pod[1]) {
        return {
            ok: false,
            message: `KhipuClientIOS differs: Package.swift says ${spm[1]} and plugin.xml says ${pod[1]}`
        };
    }

    return {
        ok: true,
        message: `KhipuClientIOS ${spm[1]} synced between Package.swift and plugin.xml`
    };
}

function main () {
    const root = path.resolve(__dirname, '..');
    const result = compare(
        fs.readFileSync(path.join(root, 'Package.swift'), 'utf-8'),
        fs.readFileSync(path.join(root, 'plugin.xml'), 'utf-8')
    );

    if (!result.ok) {
        console.error(`check-native-versions: ${result.message}`);
        process.exit(1);
    }

    console.log(`check-native-versions: ${result.message}.`);
}

module.exports = { compare };

if (require.main === module) {
    main();
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`
Expected: PASS, 15 tests (9 from the hook + 6 from this script), 0 failures.

- [ ] **Step 5: Verify the script against the real files**

Run: `node scripts/check-native-versions.js`
Expected: `check-native-versions: KhipuClientIOS 2.16.5 synced between Package.swift and plugin.xml.`

- [ ] **Step 6: Update `package.json`**

The `files` field was already added by Task 5, because without it the tarball that installs
the example carried the whole repository. Verify it is still there and did not lose `tests/`,
which is the one most likely to fall off because it looks dispensable and is not:

Run: `node -e "const f=require('./package.json').files; if(!f) throw new Error('missing files'); if(!f.includes('tests/')) throw new Error('missing tests/ in files'); console.log('files OK:', f.join(', '))"`
Expected: `files OK: plugin.xml, Package.swift, www/, src/, tests/, scripts/, README.md, LICENSE`

Leave `scripts` like this:

```json
  "scripts": {
    "test": "node --test tests/scripts/",
    "verify:versions": "node scripts/check-native-versions.js",
    "release": "release-it",
    "prepare": "husky"
  },
```

In the `release-it` block, replace `hooks` with:

```json
    "hooks": {
      "before:init": "npm run verify:versions && npm test",
      "after:bump": "node scripts/update-plugin-version.js && git add plugin.xml && git commit -m 'chore: sync version to plugin.xml'"
    }
```

And in `plugins`, add the `infile`:

```json
    "plugins": {
      "@release-it/conventional-changelog": {
        "preset": "angular",
        "infile": "CHANGELOG.md"
      }
    },
```

- [ ] **Step 7: Create `LICENSE` — BLOCKED, needs confirmation**

There is an inconsistency that cannot be resolved without asking:

| Repo | Declared `license` | `LICENSE` file |
| --- | --- | --- |
| `cordova-khipu` | MIT | does not exist |
| `capacitor-khipu` | MIT | does not exist |
| `flutter_khipu` | — | **LGPL-3.0** |

**Do not invent the file.** Ask which one applies and under what legal entity name. If MIT is
confirmed, this is the content, replacing `<LEGAL ENTITY NAME>`:

```
MIT License

Copyright (c) 2026 <LEGAL ENTITY NAME>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

If there is no answer by the time this is reached: **drop `"LICENSE"` from the `files`
field**, continue with the rest of the task, and report the pending item when closing the
plan. Do not block the other tasks over this.

- [ ] **Step 7b: Create `.nvmrc`**

Content, a single line:

```
v20.19.4
```

Today the repository has no `.nvmrc` and inherits the parent directory's, which on the
development machine points at `v20.12.2`. That **does not meet** `cordova-ios` 8.1.1's engine
(`^20.17.0 || >=22.9.0`), so `cordova platform add ios@8` runs with a Node version cordova
itself declares insufficient. Pinning it in the repo makes it explicit and reproducible for
anyone.

Run: `cat .nvmrc`
Expected: `v20.19.4`

- [ ] **Step 8: Create `CHANGELOG.md`**

```markdown
# Changelog

This file is maintained by `@release-it/conventional-changelog` from commit
messages. Entries before 2.10.0 are not here: the changelog only started
being generated at that version, and the earlier releases are at
https://github.com/khipu/cordova-khipu/releases
```

- [ ] **Step 9: Verify what would get published**

Run: `npm pack --dry-run 2>&1 | grep -E "example/|node_modules|docs/" || echo "neither example/ nor docs/ get published: OK"`
Expected: `neither example/ nor docs/ get published: OK`

Run: `npm pack --dry-run 2>&1 | grep -E "tests/ios|Package.swift"`
Expected: `tests/ios/KhipuOptionsMapperTests.swift` and `Package.swift` show up.

- [ ] **Step 10: Commit**

```bash
git add package.json scripts/check-native-versions.js tests/scripts/check-native-versions.test.js CHANGELOG.md
git commit -m "chore: narrow what gets published and check version sync

The files field keeps example/ and docs/ out of the tarball.
check-native-versions fails the release if KhipuClientIOS differs
between Package.swift and plugin.xml, which is exactly what breaks
only by maintaining two managers."
```

If the license got confirmed, add `LICENSE` to that `git add`.

---

### Task 13: README and preparing version 2.10.0

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `plugin.xml`

**Interfaces:**
- Consumes: the effective versions noted in Task 11's Step 6.
- Produces: the repository ready for `npm run release`. **This plan does not publish.**

- [ ] **Step 1: Replace the README's setup sections**

Replace everything from `## iOS pre setup` to `## Android setup` (inclusive, up to just before
`## Usage`) with:

```markdown
## Requirements

| | Minimum | Tested with |
| --- | --- | --- |
| `cordova` (CLI) | 13.0.0 | 13.0.0 |
| `cordova-ios` | 7.0.0 | 7.1.1 and 8.1.1 |
| `cordova-android` | 13.0.0 | 15.1.0 |
| iOS | 13.0 | |
| Node | `^20.17.0 \|\| >=22.9.0` | 20.19.4 |

These minimums are declared in `<engines>`, so `cordova plugin add` fails
with a clear message instead of breaking further down the line.

## Installation

```bash
cordova plugin add cordova-khipu
```

## iOS setup

The plugin supports both package managers, and **which one gets used is
decided by the `cordova-ios` version**, not an option:

| Version | Manager | What you need installed |
| --- | --- | --- |
| `cordova-ios` 8 and above | Swift Package Manager | nothing extra |
| `cordova-ios` 7 | CocoaPods | CocoaPods |

The only thing to configure is the deployment target, because
`cordova-ios` 7's default is 11.0 and Khipu needs 13.0. In `config.xml`:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

`cordova-ios` 8 already uses 13.0 by default, so there it is optional.

### Swift version

The plugin configures `SWIFT_VERSION` on its own when needed. If you need a
different one, declare it and the plugin honours it:

```xml
    <platform name="ios">
        <preference name="SwiftVersion" value="5.9" />
    </platform>
```

## Android setup

No extra steps needed: the plugin enables Gradle's Kotlin plugin on its own.

These are the versions `cordova-android` 15.1.0 ships by default, which the
plugin is tested against:

| | Value |
| --- | --- |
| Kotlin | 2.1.21 |
| Gradle | 8.14.2 |
| Android Gradle Plugin | 8.10.1 |
| `compileSdk` / `targetSdk` | 36 |
| `minSdk` | 24 |

If your app overrides them, keep them at those values or higher.

## Example app

[`example/`](example/) has an app that exercises every plugin option with a
test harness, and runs on all three supported scenarios. See
[`example/README.md`](example/README.md).
```

- [ ] **Step 2: Replace the values with the real ones**

The numbers in the Android table are `cordova-android` 15.1.0's defaults. Cross-check them
against the output saved in Task 11's Step 6 and fix any difference. If they differ, the
observed ones win.

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -n -i "cordova 11\|kotlin-android-extensions\|jcenter\|deployment-target.*12\|1\.9\.10\|SDK 34" README.md || echo "no stale references: OK"`
Expected: `no stale references: OK`

- [ ] **Step 4: Verify the README's links point at files that exist**

Run: `test -f example/README.md && test -d example && echo "links OK"`
Expected: `links OK`

- [ ] **Step 5: Run the full verification one last time**

```bash
npm test
npm run verify:versions
xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build
xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.5'
```
Expected: all four pass.

```bash
cd example
npm run ios:spm    # verify the full harness in the simulator
npm run ios:pods   # verify the full harness in the simulator
npm run android    # verify the full harness in the emulator
```
Expected: all three launch and the harness works.

And the run that actually proves SPM does not need CocoaPods, which spec §12 asks to do at
least once. **Do not filter by the word "cocoapods"**: the `pod` binary can live in
`~/.rbenv/shims`, in the system's RubyGems, or wherever Homebrew put it, and none of those
paths contain that word — the filter would strip nothing and the test would pass without
having removed anything. The real directory gets located with `command -v`:

```bash
cd example
PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -x -F "$(dirname "$(command -v pod)")" | paste -sd: -) npm run ios:spm
```
Expected: `BUILD SUCCEEDED` and the app running. If it fails with `pod: command not
found`, something on the cordova-ios 8 path is still calling CocoaPods: check that the
`<pod>` has `nospm="true"`.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: rewrite iOS and Android setup

iOS documents both managers and that the cordova-ios major decides
which one is used. Android moves from cordova 11's values to
cordova-android 15.1.0's real defaults."
```

- [ ] **Step 7: Leave the release prepared, without running it**

`release-it` handles the bump, the tag, the changelog and the publish. The command is:

```bash
npm run release -- --increment minor
```

That leads to `2.10.0`, runs `verify:versions` and `npm test` before starting, syncs
`plugin.xml`, and publishes to npm.

**Do not run it within this plan.** Publishing to npm is an outward-facing, irreversible
action: it needs explicit confirmation. Report that the repository is ready and wait for the
go-ahead.

---

## Closing notes for whoever executes this

- **Tasks 3 and 4 are gates.** If Task 3 shows that cordova-ios 7 does not compile with the
  current Xcode, stop and report: dual support loses its point and the decision needs
  reopening. If Task 4 shows that all three local-install methods corrupt the repo, stop just
  the same.
- **Known pending items this plan does not touch**, which need repeating when closing it out:
  - The repository's license (Task 12, Step 7).
  - `khipu-client-android` 2.27.0's compatibility with Kotlin 2.1.21, which needs confirming
    with the Android SDK team.
  - The `Objects.requireNonNull` / `assert` pattern in `KhipuPlugin.java`, which has the same
    problem that got fixed in Swift.
