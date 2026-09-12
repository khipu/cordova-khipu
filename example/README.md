# `cordova-khipu` example app

Exercises the plugin against the three scenarios it supports, and is the way
to verify it by hand. `.github/workflows/ci.yml` also runs a four-job CI workflow (node,
iOS, Android and this example, the last push-only) on pushes and pull requests, but this
guide is still what you need to reproduce a scenario locally or debug one that fails in CI.

## Requirements

- Node `^20.17.0` or `>=22.9.0` (the actual `engines` range in `example/package.json`; it
  excludes 20.0–20.16 and the whole 21.x series)
- Xcode 15 or later, with an iOS simulator installed
- CocoaPods, **only** for the cordova-ios 7 scenario
- Android SDK with an emulator or a connected device
- `npm install` run **at the repo root and in `example/`**, in that order, before the first
  command in this guide: `scripts/install-plugin.mjs` packages the plugin with `npm pack` at
  the root, which triggers its `prepare: husky`, and the `cordova` binary the
  `npm run ios:pods` / `ios:spm` / `android` scripts use comes from `example/node_modules`.

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
| cordova-ios 8 + SPM | `npm run ios:spm` | `Package.swift`; no pod gets linked (empty Podfile) — from this example the command still invokes `pod install`, see below |
| cordova-android 15 | `npm run android` | `khipu.gradle` and the `enable-gradle-kotlin-plugin.js` hook |

Each script deletes `platforms/` and `plugins/` before starting: which iOS
package manager gets used is decided by the platform's major version and
cannot be switched on the fly.

### The run that actually proves SPM

This scenario **cannot be run from this example app**. The `config.xml` here
declares `<preference name="deployment-target" value="13.0" />` so the
cordova-ios 7 path works (which does need it), but that same preference makes
cordova-ios, on the SPM path, sync the empty `Podfile` it creates when the
plugin is installed with `pod install` anyway (the full reason is in the main
README, "iOS setup" section). With that preference set, `npm run ios:spm`
will ask for CocoaPods even though it will not use any pod.

The real verification is done separately, against a clean Cordova project
that **does not** declare `deployment-target` (leaving cordova-ios 8 to use
its 13.0 default):

```bash
cordova create khipu-spm-check com.example.khipuspmcheck "Khipu SPM check"
cd khipu-spm-check
cordova plugin add file:/absolute/path/to/cordova-khipu-*.tgz --nosave
cordova platform add ios@8.1.1 --nosave
PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -x -F "$(dirname "$(command -v pod)")" | paste -sd: -) cordova run ios
```

There is no fixed `pod` path to exclude: CocoaPods installs in different
places depending on the method (Homebrew, system RubyGems, rbenv, rvm), so the
command locates the real directory with `command -v` and only then strips it
from `PATH`. Before launching the build, confirm the trim worked with
`PATH=<the same trimmed PATH> which pod`: it should find nothing.

This is how it was verified in practice: `BUILD SUCCEEDED`, the app running,
and zero mentions of CocoaPods anywhere in the log.

## What to check in the harness

- **Tri-state.** With everything unchecked, the preview shows only
  `operationId`, with no `options` key. This is the case of a merchant who
  configures nothing, and it is the one that breaks most easily by accident.
- **Explicit `false`.** Checking `showFooter`'s include box with the switch
  off sends `"showFooter": false`, which is not the same as not sending the
  key at all.
- **Presets.** *Khipu brand* uses purple `#8347AD` and cyan `#3CB4E5`.
- **Resources on the CocoaPods path.** The plugin no longer declares `use_frameworks!`, so
  pods link statically. This is verified at the build level — `KhipuClientIOS.bundle` shows up
  copied inside the `.app` — but not at runtime. Running `npm run ios:pods`, check that Khipu's
  view shows real images and fonts, not empty boxes. A resource that fails to resolve breaks at
  display time, not at compile time, so a green build is not enough.
- **Persistence.** The `operationId` survives a reload.
- **Result — not verified with a real `operationId`.** The only thing tested so far was a
  made-up id (which triggers the SDK's native error screen) and a synthetic injection straight
  into `showResult()`, without going through the SDK. Still missing: running the happy path with
  an `operationId` from a Khipu test environment and confirming that, once the operation
  finishes, the `KhipuResult` fields show up; the events table only appears if the operation
  returned events (`harness.js` does not draw it when `events` comes back empty).

## Why the plugin is installed before adding the platform

All three scripts do `reset` → `plugin:add` → `platform add` → `run`, and
that order is not incidental: the other way around, the `npm install` that
the plugin install triggers **prunes `node_modules/cordova-android`** as
unrelated to the declared tree, and `platforms/android/cordova/Api.js`
—which is literally `module.exports = require('cordova-android')`— fails
with `Cannot find module`.

**This is specific to this example, not something that happens to a
merchant.** It happens because the scripts use `--nosave` so they can switch
between `cordova-ios` majors without dirtying `package.json`; since it is
never declared, npm treats it as foreign and removes it. A normal app, which
adds the platform without `--nosave`, keeps it recorded in its `package.json`
and npm leaves it alone.

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
