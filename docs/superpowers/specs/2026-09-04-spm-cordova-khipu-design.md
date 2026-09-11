# Migrating `cordova-khipu` to Swift Package Manager, compatibility with current Cordova, and an example app

**Date:** 2026-09-04
**Status:** design approved, pending implementation plan
**Repo:** `khipu/cordova-khipu`
**Starting version:** `2.9.1`

## 1. Problem and goal

`cordova-khipu` consumes `KhipuClientIOS` only through CocoaPods. `cordova-ios` 8 brings
native Swift Package Manager support, and `KhipuClientIOS` has published `Package.swift`
since tag 2.16.3. Today a merchant who wants a CocoaPods-free app is blocked by us.

The plugin also declares a dependency on `cordova-plugin-add-swift-support`, which
**breaks cordova-ios 8** (§5), and the repository has no example app, unlike
`flutter_khipu` and `capacitor-khipu`.

Scope of this work:

1. SPM support on iOS, **dual with CocoaPods**.
2. Compatibility with the current Cordova stack: `cordova` 13, `cordova-ios` 8.1.1,
   `cordova-android` 15.1.0.
3. Example app with a full harness, able to exercise **both** package managers.
4. The robustness and packaging fixes this work touches anyway.

This work is the third link in a series: `KhipuClientIOS` already migrated
(`docs/superpowers/specs/2026-06-28-spm-khipuclientios-design.md` in its repo), and there
are sibling specs from the same day for
[`flutter_khipu`](../../../../flutter_khipu/docs/superpowers/specs/2026-09-04-spm-flutter-khipu-design.md)
and
[`capacitor-khipu`](../../../../capacitor-khipu/docs/superpowers/specs/2026-09-04-migracion-spm-capacitor-8-design.md).
Where a decision was already made in those specs, it is kept here.

## 2. Facts verified on 2026-09-04

Everything in this table was checked by reading the code of the published packages, not
from memory or documentation.

| Fact | Value | How it was verified |
| --- | --- | --- |
| Latest Cordova versions | `cordova` 13.0.0 · `cordova-ios` 8.1.1 · `cordova-android` 15.1.0 | `npm view` |
| SPM in Cordova iOS | since **`cordova-ios` 8.0.0** (PR GH-1515, "feat(spm): Support plugins as Swift packages") | `RELEASENOTES.md:137` of the `cordova-ios@8.1.1` tarball |
| How an SPM plugin is declared | `package="swift"` attribute on `<platform name="ios">` + `Package.swift` at the plugin root | `lib/SwiftPackage.js` → `isSwiftPackagePlugin()` evaluates `!!platform.package`; `cordova-common`'s `getPlatforms()` returns every attribute of the `<platform>` |
| Mandatory package names | the package and product must both be named **`cordova-khipu`** (the plugin's id) | `SwiftPackage._pluginReference()` generates `.product(name: "${plugin.id}", package: "${plugin.id}")` |
| What cordova-ios 8 does when installing an SPM plugin | copies the whole plugin to `platforms/ios/packages/<id>/` and **rewrites the copied `Package.swift`** to point at the local CordovaLib | `SwiftPackage.addPlugin()`, regex `package\(.+cordova-ios.+\)` |
| What cordova-ios 8 ignores in an SPM plugin | `<source-file>`, `<header-file>`, `<resource-file>`, `<framework>`, `<asset>` | `lib/plugman/pluginHandlers.js`, ten `if (isSwiftPackagePlugin(plugin)) return;` guards (install/uninstall for each of the five tags). `<lib-file>` is **not** among them: it is an unconditional no-op for iOS, with or without SPM. |
| Podspec + SPM coexistence | the `<pod>` accepts `nospm="true"` so cordova-ios 8 discards it | `lib/Api.js:397` (`!isSPM \|\| (isSPM && !_isTrue(podJson.nospm))`) + `cordova-common`'s `getPodSpecs()`, which exposes every attribute of the `<pod>` |
| The `Cordova` module under SPM | exists in cordova-ios 8: `CordovaLib/include/Cordova/CDV.h` generates the module | tree of the `cordova-ios@8.1.1` tarball |
| The `Cordova` module in cordova-ios 7 | **does not exist**: no `.modulemap` in the package; `CDVPlugin` arrives via the bridging header | `find` over the `cordova-ios@7.1.1` tarball |
| Plugin class resolution | `NSClassFromString(className)`, falling back to `"<CFBundleExecutable>.<className>"` | `CordovaLib/Classes/Public/CDVViewController.m:826-831` |
| Dead-stripping protection | the cordova-ios 8 template ships `-ObjC` in `OTHER_LDFLAGS` | `templates/project/App.xcodeproj/project.pbxproj:451-453, 489-491` |
| `SWIFT_VERSION` in the template | **absent** on cordova-ios 7 · `5.0` on cordova-ios 8 | each template's `project.pbxproj` |
| `SWIFT_OBJC_BRIDGING_HEADER` in the template | **absent** on cordova-ios 7 · `"$(TARGET_NAME)/Bridging-Header.h"` on cordova-ios 8 | same |
| Xcode project name | cordova-ios 7: `<config.name()>.xcodeproj` · cordova-ios 8: **always `App.xcodeproj`** | `lib/create.js:140` (ios 7) vs. `lib/create.js:128` (ios 8) |
| `<pod>`'s `swift-version` | only applies to the `Pods` project's targets, **never** to the app target | `lib/PodsJson.js` → `setSwiftVersionForCocoaPodsLibraries()` |
| `<preference name="SwiftVersion">` | supported on both versions | `lib/prepare.js:306` (ios 7), `lib/prepare.js:329` (ios 8) |
| Default deployment target | cordova-ios 7: 11.0 · cordova-ios 8: 13.0 | each template's `project.pbxproj` |
| `cordova-android` 15.1.0 defaults | minSdk 24, SDK 36, Gradle 8.14.2, AGP 8.10.1, Kotlin 2.1.21, Java 11 | `framework/cdv-gradle-config-defaults.json` |
| `IS_GRADLE_PLUGIN_KOTLIN_ENABLED` | **still exists** in cordova-android 15 | same file + `lib/prepare.js:113` |
| SPM in `KhipuClientIOS` | since tag **2.16.3**; latest **2.16.5**; `platforms: [.iOS(.v13)]` | repo tags + its `Package.swift` |
| Latest `khipu-client-android` | **2.27.0**, which is what the plugin already pins | `capacitor-khipu`'s spec, verified against Khipu's Nexus |
| Apache plugins with SPM support | **none published**: `cordova-plugin-device@3.0.0`, `-camera@8.0.0`, `-statusbar@4.0.0` ship no `Package.swift` | `tar tzf` of each tarball |
| Files missing from the repo | `LICENSE`, `CHANGELOG.md`, `.npmignore`, `.github/`, a `files` field in `package.json` | repo inspection |

### Age of each pin (npm publish dates)

| Version | Published | Age as of 2026-09-04 |
| --- | --- | --- |
| `cordova-ios` 6.0.0 | 2020-06-01 | 6 years 3 months |
| `cordova-ios` 6.3.0 (last of the 6 line) | 2023-04-17 | 3 years 5 months |
| `cordova-ios` 7.0.0 | 2023-07-10 | 3 years 2 months |
| `cordova-ios` 7.1.1 (last of the 7 line) | 2024-07-24 | 2 years 1 month |
| `cordova-ios` 8.0.0 | 2025-11-23 | 9 months |
| `cordova-ios` 8.1.1 | 2026-07-07 | 2 months |
| `cordova-android` 13.0.0 | 2024-05-23 | 2 years 3 months |
| `cordova-android` 15.1.0 | 2026-07-22 | 1 month |
| `cordova` (CLI) 13.0.0 | 2025-11-25 | 9 months |

Requirements declared by each iOS line, from its `check_reqs.js` and `package.json`:

| | Minimum Xcode | Node | `cordova-common` |
| --- | --- | --- | --- |
| `cordova-ios` 6.3.0 | not declared | `>=10` | `^4.0.2` |
| `cordova-ios` 7.1.1 | 11.0.0 | `>=16.13.0` | `^5.0.0` |
| `cordova-ios` 8.1.1 | 15.0.0 | `^20.17.0 \|\| >=22.9.0` | `^6.0.0` |

### The plugin's state today

| Item | Value |
| --- | --- |
| `plugin.xml` | `<pod name="KhipuClientIOS" version="2.16.2" swift-version="5.1"/>`, `use-frameworks="true"` |
| iOS source | a single file, `src/ios/KhipuPlugin.swift` (~170 lines) |
| Android source | `src/android/com/khipu/cordova/KhipuPlugin.java` + `src/android/khipu.gradle` |
| JS | `www/cordova-khipu.js`, 7 lines, exposes `window.Khipu.startOperation` |
| Dependencies | `cordova-plugin-add-swift-support@2.0.2` |
| Hooks | `after_prepare` → `scripts/enable-gradle-kotlin-plugin.js` |
| README | talks about "cordova 11", Kotlin 1.9.10, Gradle 8.7, SDK 34, deployment target 12.0 |

## 3. Decisions

| Decision | Value |
| --- | --- |
| iOS scope | **Dual** cordova-ios 7 (CocoaPods) + 8 (SPM), in a single branch |
| Example app | **Full harness** with tri-state, presets and a JSON preview |
| Android | **Complete**: repositories, AGP 8 DSL, Kotlin hook, README |
| `cordova-plugin-add-swift-support` | **Replace** with our own version-aware hook |
| `KhipuPlugin.swift` robustness | **Yes**, with tests |
| npm packaging hygiene | **Yes** |
| CI | **Out of scope** (explicitly ruled out) |
| Version to publish | `2.10.0` |

### Why dual and not one branch per major

`capacitor-khipu` chose branch-per-major because in Capacitor the two managers **cannot
coexist in the same iOS project** and every major raises the iOS floor. In Cordova the
situation is different: a single `plugin.xml` describes both paths and every cordova-ios
version only reads what it understands (§4). The cost of dual here is a three-line
`import` shim and a `KhipuClientIOS` version duplicated across two files, covered by a
release-time check. That does not justify two branches.

## 4. iOS — how the two managers coexist

### 4.1 `plugin.xml`

```xml
<platform name="ios" package="swift">
  <config-file parent="/*" target="config.xml">
    <feature name="cordova-khipu">
      <param name="ios-package" value="KhipuPlugin"/>
    </feature>
  </config-file>
  <podspec>
    <pods>
      <pod name="KhipuClientIOS" spec="2.16.5" swift-version="5.1" nospm="true"/>
    </pods>
  </podspec>
  <source-file src="src/ios/KhipuPlugin.swift"/>
  <source-file src="src/ios/KhipuOptionsMapper.swift"/>
</platform>
```

- **cordova-ios 7** does not know the `package` attribute, ignores it, and uses
  `<podspec>` + `<source-file>` exactly as it does today.
- **cordova-ios 8** sees `package="swift"` → `isSwiftPackagePlugin()` is true →
  `pluginHandlers.js` discards the `<source-file>` tags, and `nospm="true"` makes
  `Api.js` discard the pod. What is left is pure SPM, **with no need for CocoaPods to be
  installed as long as the app does not declare
  `<preference name="deployment-target">`** — see the condition in §4.7, which is a late
  finding, not a footnote.

An `<engines>` block is also added. **It does not make `cordova plugin add` fail** when
the installed platform does not meet the minimum: `checkEngines()` emits a `warn` and
rejects with `Object.assign(new Error(), { skip: true })`; the `catch` wrapping the
install sees that `skip`, emits `Skipping 'cordova-khipu' for <platform>` and does not
rethrow, so the promise resolves and the command still exits with code 0
(`cordova-lib/src/plugman/install.js`, lines 100-113 and 345-352). What the `<engines>`
block earns is an explicit message in the output — the `warn` above, followed by the
`Skipping` — for the platform that gets left out, not an install that stops:

```xml
<engines>
  <engine name="cordova-ios" version=">=7.0.0"/>
  <engine name="cordova-android" version=">=13.0.0"/>
</engines>
```

The iOS floor lands on 7 and **deliberately leaves out cordova-ios 6**. Line 6 has gone
3 years and 5 months without a release, declares `node >=10` and `cordova-common ^4`
while the `cordova` 13 CLI ships `cordova-common` 6, and since April 24, 2025 App Store
Connect rejects any build that does not use Xcode 16 with the iOS 18 SDK: a merchant on
cordova-ios 6 cannot publish updates today. The plugin never declared `<engines>`, so
this does not withdraw a promise, it writes one.


### 4.2 `Package.swift` (plugin root)

```swift
// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "cordova-khipu",
    platforms: [.iOS(.v13)],
    products: [
        .library(name: "cordova-khipu", targets: ["cordova-khipu"])
    ],
    dependencies: [
        .package(url: "https://github.com/apache/cordova-ios.git", from: "8.0.0"),
        .package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "2.16.5")
    ],
    targets: [
        .target(
            name: "cordova-khipu",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "KhipuClientIOS", package: "KhipuClientIOS")
            ],
            path: "src/ios"
        ),
        .testTarget(
            name: "cordova-khipuTests",
            dependencies: ["cordova-khipu"],
            path: "tests/ios"
        )
    ]
)
```

**The names are not decorative.** `SwiftPackage._pluginReference()` literally generates
`.product(name: "cordova-khipu", package: "cordova-khipu")` from the plugin's id, so the
package's `name:` and the product's have to be exactly `cordova-khipu` or resolution
fails. The target can be named differently, but it is kept the same for symmetry; its
Swift module name comes out as `cordova_khipu`.

The dependency on `apache/cordova-ios` gets rewritten by Cordova itself when installing
the plugin, pointing it at the project's local CordovaLib. The `from: "8.0.0"` is only
used when we compile the standalone package, i.e. when running the tests.

### 4.3 The `import` shim

In `KhipuPlugin.swift` and `KhipuOptionsMapper.swift`:

```swift
#if canImport(Cordova)
import Cordova   // cordova-ios 8: SPM generates the module from CordovaLib/include/Cordova/
#endif
import KhipuClientIOS
```

On cordova-ios 7 there is no `Cordova` module and `CDVPlugin` arrives via the bridging
header, so `canImport` is false and the file compiles all the same.

### 4.4 Two things that must not break

- **`@objc(KhipuPlugin)` becomes load-bearing.** `CDVViewController` resolves the class
  with `NSClassFromString(@"KhipuPlugin")`; its fallback builds
  `"<CFBundleExecutable>.<className>"`, which under SPM never matches our module. The
  attribute is already in the code; it just must not be removed.
- **The `-ObjC` in `OTHER_LDFLAGS`** in the cordova-ios 8 template is what keeps the
  linker from stripping the class out of the static lib SPM produces. We do not add it
  ourselves, but it is the reason this works.

### 4.5 Pinning `KhipuClientIOS`

`exact: "2.16.5"` in SPM and `spec="2.16.5"` on the pod, not ranges, to bring the native
graph a merchant resolves via CocoaPods as close as possible to the one another resolves
via SPM **for the same plugin version**. It is the same decision `KhipuClientIOS` made in
its own `Package.swift`, and that `flutter_khipu` and `capacitor-khipu` made.

**The exact pin does not make the two graphs identical, and it is worth not promising
that.** It guarantees the `KhipuClientIOS` version itself, and since 2.16.5 also that of
its three direct production dependencies, which its `Package.swift` pins with `.exact`
just like its podspec does: `socket.io-client-swift` 16.1.1, `KhenshinProtocolSwift`
1.0.60 and `KhenshinSecureMessage` 1.4.1. What is left open is **Starscream**: the
podspec declares it direct and pinned at `4.0.8`, but `Package.swift` does not declare it
at all — under SPM it arrives transitively through `socket.io-client-swift`, whose own
manifest allows it within a range (as `flutter_khipu`'s spec verified,
`.upToNextMajor(from: "4.0.8")`, i.e. any `4.x`). Closing that would require
`KhipuClientIOS` to declare `Starscream` as a direct dependency in its `Package.swift`,
which is a decision for that repository, not this one. It is a known, bounded limitation,
not something left over from this migration.

The bump from `2.16.2` is mandatory: that version has no `Package.swift` and therefore
cannot be consumed via SPM.

**The attribute is `spec`, not `version`.** Discovered while building (plan Task 3):
cordova-ios's `Podfile.js` only reads `json.spec` to emit the version constraint
(`if ('spec' in json && json.spec.length)`, line 300); a `version` attribute is silently
ignored. The `plugin.xml` published in `cordova-khipu` 2.9.1 says `version="2.16.2"`, so
**the plugin never actually pinned the pod's version**: it generates
`pod 'KhipuClientIOS'` with no constraint, and every merchant on the CocoaPods path gets
whatever CocoaPods resolves. It is a pre-existing defect this migration uncovers and
fixes.

**The `<config><source>` block is removed.** `Api.js`'s `// sources` is **not** guarded by
`isSwiftPackagePlugin`, unlike the `// libraries` block right below it. With a `<source>`
declared, cordova-ios 8 marks the Podfile as dirty and runs `pod install` anyway, even
though `nospm="true"` already discarded the pod — which breaks the "pure SPM, no
CocoaPods" premise. Declaring the CocoaPods trunk was also redundant: it is the default
source when none is declared.

**And `use-frameworks="true"` is removed too.** `getPodSpecs()` turns `<pods>`'s
attributes into Podfile *declarations* (`use_frameworks!`), and `Api.js`'s
`// declarations` block also has no `isSwiftPackagePlugin` guard: that single declaration
is enough on its own to trigger `pod install`. Leaving it in place is not an option
either, because on macOS `check_cocoapods` **rejects** the install if the `pod` binary is
missing (it only returns `ignore` off macOS), so a merchant on cordova-ios 8 without
CocoaPods would see `cordova plugin add` fail.

One artifact remains unavoidable: **cordova-ios 8 still writes an empty `Podfile`**. Its
`Podfile` class's constructor writes the file as soon as it is instantiated, before any
content is evaluated, and it gets instantiated simply because the plugin declares a
`<podspec>`. Since nothing gets added to it, `isDirty()` stays `false` and `pod install`
never runs. The design's promise is that **CocoaPods does not need to be installed**, not
that the file does not exist, and that is verified by compiling with the `pod` binary
removed from `PATH`.

Without `use_frameworks!` the pods link statically. This is safe for `KhipuClientIOS`:
its podspec uses `s.resource_bundles` — the mechanism meant for static linking — and its
`BundleHelper` resolves via `Bundle(for:).path(forResource:ofType:"bundle")`, which works
under both models. It remains a **risk to confirm at runtime** with the example app on
the CocoaPods path: a resource that fails to resolve breaks at display time, not at
compile time.

Accepted trade-off: if the merchant's app also declares `KhipuClientIOS` at a different
version, SPM fails with a hard conflict instead of negotiating.

### 4.6 iOS floor

**13.0 on both paths.** cordova-ios 8 already ships
`IPHONEOS_DEPLOYMENT_TARGET = 13.0` by default and `KhipuClientIOS`'s `Package.swift`
declares `.iOS(.v13)`. The README says 12.0 today; it gets updated to 13.0, a single
number to document.

For cordova-ios 7, whose template starts at 11.0, the README keeps the instruction to set
`<preference name="deployment-target" value="13.0"/>` in the app's `config.xml`.

### 4.7 The condition behind "no CocoaPods", and why it cannot be removed

Discovered during the final verification (plan Task 13) and confirmed by reading
cordova-ios 8.1.1's `lib/prepare.js`, lines 346-357:

```js
const podPath = path.join(locations.root, Podfile.FILENAME);
if (deploymentTarget && fs.existsSync(podPath)) {
    const podfileFile = new Podfile(podPath, project_name, deploymentTarget);
    podfileFile.write();
    return podfileFile.install(check_reqs.check_cocoapods);
}
```

The chain, step by step:

1. The plugin declares a `<podspec>` because cordova-ios 7 needs it.
2. The `Podfile` class's constructor writes an empty file as soon as it is instantiated,
   before evaluating any content — unavoidable with any `<podspec>` (§4.5).
3. If the app declares `<preference name="deployment-target">`, `prepare.js` sees that
   Podfile exists and runs `pod install` **to sync its deployment target into it**, even
   though it has no dependency at all.
4. `check_cocoapods` rejects on macOS if the `pod` binary is missing, so the build fails.

**Precise statement:** on cordova-ios 8, the SPM path does not need CocoaPods **as long
as the app does not declare `deployment-target`**. Since cordova-ios 8's default is
already 13.0, which is what Khipu requires, a merchant on that version has no reason to
declare it — and the README tells them so.

**Why this is not fixed from the plugin.** Both exits were evaluated and neither works.
Deleting the Podfile from our own hook would arrive too late: the hook runs on
`after_prepare` and `pod install` happens *during* prepare. And dropping the `<podspec>`
would break cordova-ios 7, which is half of the dual support. It is the cost of
sustaining both managers from a single `plugin.xml`, and it deserves precise
documentation, not hiding.

**Consequence for the example app:** its `config.xml` declares `deployment-target`
because the cordova-ios 7 path needs it, whose default is 11.0. That is why the
"no CocoaPods" scenario cannot be run from `example/` and is verified separately, with a
clean Cordova project without that preference.

## 5. Replacing `cordova-plugin-add-swift-support`

### Why it goes

That plugin's hook builds the Xcode project path like this:

```js
projectName = config.name();
pbxprojPath = path.join(platformPath, projectName + '.xcodeproj', 'project.pbxproj');
xcodeProject = xcode.project(pbxprojPath);
xcodeProject.parseSync();
```

On cordova-ios 8 the project is **always named `App.xcodeproj`**, regardless of the app's
name, so that file does not exist and `parseSync()` throws ENOENT inside a `.then()` with
no `.catch` — an unhandled rejection. The hook runs on `platform add`, `plugin add` and
`prepare`, which are exactly the commands everyone uses.

On top of that, it uses `glob` with a callback, an API removed in glob v9, and its last
release is `2.0.2`, unmaintained.

Our `<pod>`'s `swift-version="5.1"` does not cover the gap:
`PodsJson.setSwiftVersionForCocoaPodsLibraries()` only applies it to the `Pods` project's
targets, never to the app target.

### What replaces it

`scripts/configure-swift-ios.js`, registered as `<hook type="after_prepare">` inside
`<platform name="ios">`:

1. Detects the cordova-ios version by running `platforms/ios/cordova/version`, which
   exists on both majors. If that fails, it falls back to a heuristic: the presence of
   `platforms/ios/App.xcodeproj` implies cordova-ios 8+.
2. If it is **≥ 8** → does nothing and exits. The template already ships
   `SWIFT_VERSION` and `SWIFT_OBJC_BRIDGING_HEADER`.
3. If it is **< 8** → opens the real pbxproj and sets, only if not already defined:
   `SWIFT_VERSION` (honouring `<preference name="SwiftVersion">` if the merchant set it,
   `5.0` by default), `SWIFT_OBJC_BRIDGING_HEADER` and
   `ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES`.
4. On any error, **emits a warning and continues** instead of aborting the build. This is
   precisely what the plugin it replaces gets wrong.

The hook uses `require('xcode')`, which resolves from the project's `node_modules`
because `cordova-ios` declares it as a dependency. It is the same mechanism
`cordova-plugin-add-swift-support` used, with the `try/catch` that one lacks.

## 6. Android

| | today | becomes |
| --- | --- | --- |
| Repositories | `google()`, `jcenter()`, Khipu's Nexus | `google()`, **`mavenCentral()`**, Khipu's Nexus |
| Excludes | `packagingOptions { exclude ... }` | `packaging { resources { excludes += [...] } }` (AGP 8 DSL) |
| `khipu-client-android` | 2.27.0 | 2.27.0, already the latest |
| Kotlin hook | `enable-gradle-kotlin-plugin.js` | same, verified against cordova-android 15 |

`jcenter()` has been dead since 2022: today it only adds latency and a silent failure.
The plugin works because the cordova-android template already declares `mavenCentral()`
in the root, not because `jcenter()` serves anything. Declaring it ourselves stops
depending on that accident.

The `packaging { resources { excludes } }` DSL requires AGP 8, which is cordova-android
12 onward; the `<engines>` from §4.1 already declares a floor of 13. During
implementation it is worth checking whether those excludes are still needed at all:
modern AGP excludes several `META-INF/*` entries by default, and if the conflict no
longer happens, the block gets deleted instead of migrated.

The Android README talks about "cordova 11", Kotlin 1.9.10, Gradle 8.7, AGP 8.3.0 and
SDK 34. It gets rewritten against cordova-android 15.1.0's actual defaults (Kotlin
2.1.21, Gradle 8.14.2, AGP 8.10.1, minSdk 24, SDK 36). The `kotlin-android-extensions`
and `namespace` workarounds **are removed**: they were specific to cordova-android 11,
and the `<engines>` from §4.1 sets the floor at 13.

## 7. Example app

```
example/
├── package.json      ios:pods / ios:spm / android scripts
├── config.xml
├── www/
│   ├── index.html
│   ├── css/harness.css
│   └── js/harness.js
└── README.md         manual verification matrix
```

`platforms/`, `plugins/` and `node_modules/` are **not committed**: they are generated.

### 7.1 Exercising both managers

The manager is decided by the platform's major version, not a flag:

| Script | What it does | Path exercised |
| --- | --- | --- |
| `npm run ios:pods` | `platform rm ios` → `platform add ios@7` → `run ios` | `<podspec>` + `<source-file>` |
| `npm run ios:spm` | `platform rm ios` → `platform add ios@8` → `run ios` | `Package.swift`, no CocoaPods |
| `npm run android` | `platform add android@15` → `run android` | `khipu.gradle` |

A single `www/` and a single `config.xml` serve all three. `config.xml` declares
`deployment-target` 13.0, which satisfies both iOS majors.

### 7.2 How the plugin gets installed — pending the spike

When `example/` lives **inside** the plugin's own repo, `cordova-lib`'s `copyPlugin()`
(`src/plugman/fetch.js:257`) has a branch that forces symlink mode if the destination is
a child of the source, and npm leaves a symlink in `node_modules` for local-path
dependencies. If the result is that `plugins/cordova-khipu` points at the repo,
`SwiftPackage.addPlugin()` **would rewrite the plugin's real `Package.swift`** when it
replaces the cordova-ios dependency with the local path.

The exact behaviour could not be determined without running it. Plan phase 2 (§10) is a
spike that tries all three alternatives and picks one:

1. `cordova plugin add ../`
2. `cordova plugin add ../ --link`
3. `npm pack` at the root and `cordova plugin add ./cordova-khipu-2.10.0.tgz`

Option 3 is the preferred fallback if the others corrupt something, because it also
validates exactly the artifact a merchant gets from npm. Whichever gets chosen ends up
documented in `example/README.md` and encapsulated in `package.json`'s scripts.

### 7.3 The harness

Plain HTML + JS, no framework. Exposes **every** `KhipuOptions` field with **a tri-state
per field**: each row has an "include" checkbox in addition to its own control, and left
unchecked, the key does not get added to the payload.

This is the central requirement, not a nicety. The plugin distinguishes "key absent"
from `false` — see `options!["showFooter"] != nil` in `KhipuPlugin.swift` and
`options.has(...)` in `KhipuPlugin.java` — and the native SDK applies its own defaults.
If the harness always sent all five booleans, it would be impossible to test the default
behaviour, which is exactly what a merchant who configures nothing sees.

Fields:

- `operationId`: text, required.
- `title`, `titleImageUrl`, `locale`: text.
- `theme`: `light` / `dark` / `system` selector.
- `skipExitPage`, `skipExitSuccessPage`, `showFooter`, `showMerchantLogo`,
  `showPaymentDetails`: switches.
- `colors`: the 12 fields (`light`/`dark` × `Background`, `OnBackground`, `Primary`,
  `OnPrimary`, `TopBarContainer`, `OnTopBarContainer`) as colour pickers. The whole
  `colors` object can also be omitted.

Other features:

- **Preview of the exact JSON** that is about to be sent, visible before launching the
  operation.
- **`localStorage` persistence**: testing on device reloads a lot and retyping the
  `operationId` every time is real friction.
- **Presets**: *all defaults* (`operationId` only), *Khipu brand* (purple `#8347AD`,
  cyan `#3CB4E5`), *everything on*, *dark mode*.
- **Formatted result**: `KhipuResult`'s fields plus an events table.
- **`deviceready` guard.** Unlike Flutter and Capacitor, Cordova has no web fallback:
  `window.Khipu` only exists after `deviceready`. The button starts disabled and the
  harness says explicitly why, instead of failing silently if someone opens
  `index.html` in a browser.

## 8. `KhipuPlugin.swift` robustness

- **`as!` → safe casts.** The options mapping forces the cast in around twenty places;
  today a `title: 123` **crashes the app** instead of returning an error to JS. It gets
  extracted into `src/ios/KhipuOptionsMapper.swift`, with a pure
  `[String: Any] -> KhipuOptions` function and `as?` everywhere.
- **The presenter lookup has two defects, and a single fix.** It starts from
  `CDVPlugin`'s `self.viewController` — the controller Cordova associates with the
  webview that made the call — and walks down the `presentedViewController` chain.

  The first defect is that `UIApplication.shared.windows` has been deprecated since iOS
  15 and returns windows from every connected scene. **The compiler does not warn about
  it**: at an iOS 13 deployment target the API is not yet deprecated, so the build log is
  no help detecting it (verified with `swiftc -typecheck` against iOS 13, 15 and 18).

  The second is that UIKit refuses to present over a controller that is already
  presenting something. The code dodges it with
  `presentedViewController?.dismiss(animated: false)` followed by a fixed one-second
  `asyncAfter`: in other words, **it dismisses the merchant's modal for them** and
  guesses how long that takes. Walking down the chain destroys nothing and needs no
  wait, so the `dismiss` and the fixed second disappear together.

  `CDVPlugin.viewController` exists on cordova-ios 7 (`UIViewController *`) and on 8
  (`CDVViewController *`), and is not deprecated on either, unlike other properties in
  the same header. The function is kept private to the plugin rather than as an
  extension on `UIViewController`, because the plugin links statically inside the
  merchant's app.

  Both defects were first spotted by the session that migrated `flutter_khipu`, on the
  same pattern; they were verified again here against cordova-ios's code.
- **Tests** in `tests/ios/`: all twenty fields map correctly, a field with the wrong
  type does not crash, and absent keys do not get added. The test target can only exist
  once `Package.swift` exists, so this phase comes after the SPM one.

The analogous pattern in `KhipuPlugin.java` (`Objects.requireNonNull` and `assert`) is
out of scope and noted as pending, same as in `capacitor-khipu`'s spec.

## 9. npm packaging

- **`files`** in `package.json`: `plugin.xml`, `Package.swift`, `www/`, `src/`,
  `tests/`, `scripts/`, `README.md`, `LICENSE`. Today there is no `files` or
  `.npmignore`, so everything gets published — and with `example/` inside, that would
  grow a lot.

  `tests/` **has to ship in the package**: `Package.swift` declares that target and SPM
  fails if the declared path does not exist. It is a few KB.

- **`LICENSE`**: the file is missing, even though `package.json` declares MIT.
- **`CHANGELOG.md`**: `release-it` already uses `@release-it/conventional-changelog` but
  without `infile`, so it writes nothing. The file and the option get added.
- **Version-sync check.** `KhipuClientIOS`'s version lives in two files
  (`Package.swift` and `plugin.xml`). With no CI, it hangs off `release-it`'s existing
  `after:bump` hook: if the two differ, the release fails. It is cheap and hits exactly
  what breaks only when there are two manifests.

## 10. Order of work

Each phase leaves the repository compiling and is independently verifiable.

1. **Dual iOS.** `Package.swift`, `plugin.xml` with `package="swift"` + `nospm`,
   `import` shim, `scripts/configure-swift-ios.js`, dropping the
   `cordova-plugin-add-swift-support` dependency, bumping `KhipuClientIOS` to 2.16.5.
   Verified with a throwaway Cordova project, one per iOS major. **This phase resolves
   risk 5**: if cordova-ios 7 does not compile with the current Xcode, it stops and dual
   support gets reassessed before investing in the rest.
2. **Local install spike** (§7.2). Needs phase 1's `Package.swift`. Its output is a
   documented decision, not production code.
3. **Example app.** Full harness and the three scripts. From here on, everything else
   gets verified by running the example.
4. **iOS robustness.** `KhipuOptionsMapper`, `connectedScenes`, the deterministic
   `dismiss` and the tests.
5. **Android.** Repositories, AGP 8 DSL, verifying the Kotlin hook against
   cordova-android 15.
6. **Packaging and documentation.** `files`, `LICENSE`, `CHANGELOG.md`, the sync check,
   the rewritten README (iOS and Android), bump to `2.10.0`.

## 11. Version

**`2.10.0`.** Nobody on cordova-ios 7 breaks, the `KhipuClientIOS` bump from 2.16.2 to
2.16.5 is an upstream patch, and dropping the third-party dependency does not change the
plugin's public API. The new `<engines>` is the closest thing to a breaking change, but
it only formalises a floor that already existed in practice.

## 12. Verification

With no CI, verification is a manual matrix documented in `example/README.md`:

| Scenario | Command |
| --- | --- |
| cordova-ios 7 + CocoaPods | `cd example && npm run ios:pods` |
| cordova-ios 8 + SPM | `cd example && npm run ios:spm` |
| cordova-ios 8 + SPM, without CocoaPods installed | **cannot** be run from `example/`: its `config.xml` declares `deployment-target` for the cordova-ios 7 path, and that same preference makes cordova-ios 8 sync the Podfile with `pod install` (§4.7). Verified separately, against a clean Cordova project without that preference — the full procedure is in `example/README.md`. |
| cordova-android 15 | `cd example && npm run android` |
| iOS tests | `xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.5'` |

The "without CocoaPods installed" scenario has to be run with CocoaPods off `PATH` at
least once: that is the only thing that really proves the path does not need it.

## 13. Risks

1. **Installing the plugin locally in the example.** This is phase 2's spike. If
   `cordova plugin add ../` leaves a symlink to the repo, `SwiftPackage.addPlugin()`
   would rewrite our real `Package.swift`. Mitigation: install from an `npm pack`
   tarball.
2. **We are early adopters.** No published Apache plugin uses SPM yet, so the path is
   considerably less proven than Flutter's or Capacitor's. Undocumented friction is to
   be expected.
3. **`KhipuClientIOS` resources under SPM in a Cordova app.** Its `Package.swift` uses
   `.process("Assets")`, which generates a resource bundle resolved via
   `Bundle.module`. `flutter_khipu`'s spec validated it in a Flutter app (fonts, PNGs
   and HTML loading fine), but in Cordova it is only checked by running the app on a
   simulator or device.
4. ~~**`khipu-client-android` 2.27.0 with Kotlin 2.1.21**~~ — **RESOLVED on 2026-09-04.**
   Plan Task 11 actually exercised it: the example app compiled (`BUILD SUCCESSFUL`) and
   ran on the emulator with Kotlin 2.1.21, Gradle 8.14.2, AGP 8.10.1, SDK 36 and minSdk
   24, with no Compose compiler error or version clash. Nothing needs to be escalated to
   the Android SDK team. The risk's original text, for reference:

   **`khipu-client-android` 2.27.0 with Kotlin 2.1.21**, cordova-android 15's default.
   `khipu-client-android` uses Jetpack Compose, whose compiler is tied to the Kotlin
   version. This is the same open risk `capacitor-khipu`'s spec noted, and **there is no
   evidence it works**: `flutter_khipu` consumes that same 2.27.0 but pins
   `ext.kotlin_version = "1.9.0"` in its `android/build.gradle` and its README asks
   merchants for Kotlin 1.9.0 or newer. So "it works in Flutter" is evidence for 1.9.0,
   two majors below, and nothing more. Plan Task 11 is the first real exercise of that
   combination; if it fails, it has to be escalated to the Android SDK team before
   publishing.
5. **Real viability of cordova-ios 7 with the current Xcode.** `check_reqs.js`
   declares floors, not ceilings: cordova-ios 7 asks for Xcode >= 11 and cordova-ios 8
   asks for >= 15. But 7.1.1 is from July 2024, before Xcode 16, and Apache has not
   touched it since. If the CocoaPods path does not compile clean with the Xcode
   currently needed to publish to the App Store, dual support would be covering a
   configuration no merchant can actually ship, and dual should be reconsidered in
   favour of SPM-only. **Verified in phase 1**, where it is cheap to find out.
6. **Exact `KhipuClientIOS` pin**: a hard resolution conflict if the merchant's app
   declares the same dependency at a different version. Accepted consequence of keeping
   both managers aligned.
7. **With no CI, dual support depends on discipline.** The `after:bump` sync check
   covers the `KhipuClientIOS` version, but nothing stops a release from shipping
   without having run §12's matrix.

## 14. Out of scope

- **CI on GitHub Actions.** Explicitly ruled out.
- Publishing the podspec on the CocoaPods trunk: the plugin is consumed from npm.
- Cordova's `browser` platform.
- Cleaning up the `Objects.requireNonNull` / `assert` pattern in `KhipuPlugin.java`.
- Bumping `khipu-client-android`: it is already at 2.27.0, the latest.
- Cordova support for macOS/Catalyst.

## 15. Verification results

### cordova-android 13 and 14 (verified 2026-09-05)

The `<engines>` declared `cordova-android >=13.0.0` with evidence only from 15.1.0. The
session that migrated `capacitor-khipu` reported two reasons for doubt, and neither
materialises here:

| cordova-android | AGP | Kotlin | Gradle | Result |
| --- | --- | --- | --- | --- |
| 13.0.0 | 8.3.0 | 1.9.24 | 8.7 | `BUILD SUCCESSFUL` |
| 14.0.0 | 8.7.3 | 1.9.24 | 8.13 | `BUILD SUCCESSFUL` |
| 15.1.0 | 8.10.1 | 2.1.21 | 8.14.2 | `BUILD SUCCESSFUL` |

**Reason 1 — Compose's `jvmstubs` variant.** `khipu-client-android` pulls in
`androidx.compose.ui:ui`, which is multiplatform; someone has to ask for the
`org.jetbrains.kotlin.platform.type` attribute or Gradle resolves the wrong variant and
fails with hundreds of `Duplicate class` errors. AGP asks for it on its own since 8.7,
and cordova-android 13 ships 8.3.0. **This does not hit us because our own hook forces
`IS_GRADLE_PLUGIN_KOTLIN_ENABLED = true`, and it is the Kotlin plugin that ends up asking
for the attribute.** Verified with `gradle :app:dependencies`: the resolved variant is
`ui-android` on all three versions, never `jvmstubs`, and
`checkDebugDuplicateClasses` passes.

**Reason 2 — the SDK's Kotlin 2.0 metadata against a 1.9 compiler.** There is a
methodological trap worth writing down here: **a green build of a normal Cordova project
proves nothing about this**, because `KhipuPlugin.java` is plain Java and
`compileDebugKotlin` runs as `NO-SOURCE`, reading nobody's metadata. To actually measure
it, a temporary `.kt` file had to be added that reproduced the plugin's same calls
(`KhipuOptions.Builder()` and `getKhipuLauncherIntent(...)`), forcing the Kotlin
compiler to read the SDK's metadata. With Kotlin 1.9.24 it compiled with no errors or
warnings on 13 and 14.

The underlying reason: the plugin touches a narrow API — it launches `KhipuActivity` via
an `Intent` and deserialises `KhipuResult` — never the SDK's internal composables. The
incompatibility `capacitor-khipu` reported is real for the SDK in general, but does not
show up with this integration pattern. **This is a representative test of real usage,
not an exhaustive scan of every symbol.**

**Fallback path, in case it is ever needed:** adding
`<preference name="GradlePluginKotlinVersion" value="2.0.21" />` to the app's
`config.xml` updates `KOTLIN_VERSION` in `cdv-gradle-config.json` and the build keeps
passing. Verified that the mechanism works; not needed today.


### Phase 1 — the two iOS majors (plan Task 3)

Run on 2026-09-04 with:

```
Xcode 26.6
Build version 17F113
```

| Scenario | Result |
| --- | --- |
| `cordova-ios@7.1.1` + CocoaPods, `cordova build ios --emulator` | OK — `** BUILD SUCCEEDED **`. Two environment adjustments, neither attributable to the plugin or to cordova-ios 7: (1) `cordova plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave` (the brief's literal command) always fails on this cordova-lib/npm, on both cordova-ios 7 and 8 — see detail below; it was installed from the `.tgz` already extracted to a directory. (2) the "iPhone 16" simulator only existed on iOS 18.1/18.5 runtimes, not on the newest installed runtime (26.5), which is what `xcodebuild -destination` asks for by default when no OS is pinned; `cordova build ios --emulator --target=iPhone-16` failed with `Unable to find a device matching the provided destination specifier: { OS:latest, name:iPhone 16 }` until an instance was created with `xcrun simctl create "iPhone 16" com.apple.CoreSimulator.SimDeviceType.iPhone-16 com.apple.CoreSimulator.SimRuntime.iOS-26-5`. |
| `cordova-ios@7.1.1`: Podfile present with `KhipuClientIOS 2.16.5` | Partial. The Podfile exists and contains `pod 'KhipuClientIOS'`, but **without** the expected version pin (`pod 'KhipuClientIOS', '2.16.5'`). Root cause: `plugin.xml` declares `<pod name="KhipuClientIOS" version="2.16.5" .../>`, but cordova-ios (`PluginInfo.getPodSpecs` + `Podfile.write` in `cordova-ios/lib/Podfile.js:311`) only recognises the `spec` attribute to emit the version into the Podfile (`<pod name="..." spec="2.16.5" />`, per `PluginInfo.js`'s own documented example); `version` is silently ignored. `Podfile.lock` confirms CocoaPods still resolved `KhipuClientIOS (2.16.5)`, but because it is the latest version published in the spec repo, not because the Podfile pins it — a future `KhipuClientIOS` release would flow through this path unchecked. This is a `plugin.xml` bug (Task 1/2), not a build or cordova-ios 7 issue; it needs the attribute fixed to `spec=` in a separate task. |
| `cordova-ios@7.1.1`: the hook set `SWIFT_VERSION` and the bridging header | Yes. `project.pbxproj` contains `SWIFT_VERSION = 5.0;` and `SWIFT_OBJC_BRIDGING_HEADER = "$(PROJECT_DIR)/$(PROJECT_NAME)/Bridging-Header.h";`, and the build log shows `cordova-khipu: SWIFT_VERSION=5.0 configured for cordova-ios < 8.` |
| `cordova-ios@8.1.1` + SPM, `cordova build ios --emulator` | OK — `** BUILD SUCCEEDED **`. Same two environment adjustments as the cordova-ios 7 scenario (install from an extracted tarball; iPhone 16 simulator created on the 26.5 runtime). |
| `cordova-ios@8.1.1`: no Podfile, with `packages/cordova-khipu` | Partial. `packages/cordova-khipu/` exists and is correct (Package.swift copied over, with its `cordova-ios` dependency rewritten to `path: "../cordova-ios"`, and `cordova-ios-plugins/Package.swift` carrying the two `package.dependencies.append(...)` / `package.targets.first?.dependencies.append(...)` lines). But **a Podfile does get created** (empty: `[!] The Podfile does not contain any dependencies.`, with `Pods/`, `Podfile.lock` and a `pods.json` whose `libraries` ends up `{}`). Root cause: in `cordova-ios/lib/Api.js#addPodSpecs`, the `<pod>`'s `nospm` flag only filters `obj.libraries` (the actual pod); the same `<podspec>`'s `obj.declarations` (`use_frameworks!`, coming from `<pods use-frameworks="true">`) and `obj.sources` (`<config><source .../></config>`) get added to the Podfile without looking at `nospm`, and that is enough to mark the Podfile "dirty" and trigger an empty `pod install`. It does not break the build, but it contradicts the "cordova-ios 8 does not touch CocoaPods" design and would leave traces (`Podfile`, `Pods/`) in every project that uses the SPM path. |
| `cordova-ios@8.1.1`: the hook produced no output | Yes — `cordova prepare ios` printed no line mentioning `cordova-khipu` (`no hook output: OK`). |

**Risk 5 (viability of cordova-ios 7 with the current Xcode):** resolved.
`cordova-ios@7.1.1` compiles clean (`BUILD SUCCEEDED`) under Xcode 26.6 via the CocoaPods
path, with no SDK, toolchain or CocoaPods error of the kind the feared incompatibility
would produce; the only real obstacle to getting there was environmental (simulator
selection and how to install a local `.tgz`), not Xcode 26 / cordova-ios 7
compatibility. Dual support remains viable as far as compilation goes. Two new findings
from this verification remain open, though, that were not covered by risks 1-7 and are
worth resolving before closing the plan: (a) the `KhipuClientIOS` pin in the Podfile does
not take effect because of the `version` vs. `spec` attribute in `plugin.xml`, and (b)
`cordova-ios@8.1.1` still generates an empty Podfile and runs `pod install` because of
the `<podspec>`'s `declarations`/`sources`, which do not honour `nospm`.

### Fixing the pod pin and the phantom Podfile (plan Task 3b)

Run on 2026-09-04, on the same environment (Xcode 26.6, Build version 17F113).
`plugin.xml`'s `<podspec>` block went from:

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

to:

```xml
<podspec>
  <pods>
    <pod name="KhipuClientIOS" spec="2.16.5" swift-version="5.1" nospm="true"/>
  </pods>
</podspec>
```

Three changes: `version=` becomes `spec=` (the only attribute `cordova-common`/
`cordova-ios` read to pin a pod's version); `<config><source>` is removed (redundant —
the CocoaPods trunk is the default source when none is declared); and
`use-frameworks="true"` is removed from `<pods>`.

That last change is not cosmetic. `cordova-ios/lib/Api.js#addPodSpecs` processes a
`<podspec>`'s `declarations` block (the one `use-frameworks="true"` feeds) with no
`isSwiftPackagePlugin` guard at all, just like the `sources` block already identified —
unlike `libraries` (the actual `<pod>`), which does honour `nospm`. With
`use-frameworks="true"` present, `use_frameworks!` counts as a Podfile declaration and is
enough on its own to mark it "dirty" and trigger `pod install`, even though the real pod
ends up excluded. Without that attribute, `declarations`, `sources` and `libraries` all
three end up empty (`pods.json: {"declarations": {}, "sources": {}, "libraries": {}}`)
and `pod install` does not run on cordova-ios 8.

One nuance remains against the original acceptance criterion ("no Podfile should exist
at all"): cordova-ios's `Podfile` class constructor (`lib/Podfile.js`) writes a
placeholder Podfile to disk as soon as it is instantiated, if the file does not exist yet
— a side effect of the plugin declaring even an empty `<podspec>`, unrelated to
`nospm`/`isSwiftPackagePlugin`/`use-frameworks`. That is why an empty Podfile
(`target 'App' do ... end`, with no `pod` at all) still shows up in `platforms/ios/`
under cordova-ios 8. The criterion was adjusted: the property the design actually
promises is "CocoaPods does not need to be installed", not "a file named Podfile never
exists" — and that property does hold, because with no `pod install` the `pod` binary is
never needed. Verified by compiling a cordova-ios 8 project with `pod` removed entirely
from `PATH` (see table).

| Check | Before | After |
| --- | --- | --- |
| Pod line in cordova-ios 7's Podfile | `pod 'KhipuClientIOS'` (no version) | `pod 'KhipuClientIOS', '2.16.5'` |
| Does `Pods/` exist on cordova-ios 8? | Yes | No |
| Did `pod install` run on cordova-ios 8? | Yes (`[!] The Podfile does not contain any dependencies.`) | No — `pods.json` with `declarations`, `sources` and `libraries` all three empty |
| cordova-ios 7 build | OK — `** BUILD SUCCEEDED **` | OK — `** BUILD SUCCEEDED **` |
| cordova-ios 8 build | OK — `** BUILD SUCCEEDED **` | OK — `** BUILD SUCCEEDED **` |
| cordova-ios 8 build with the `pod` binary off `PATH` | Had not been tried this way before | OK — `** BUILD SUCCEEDED **`, with `which pod` finding nothing through the whole flow (`create`, `platform add`, `plugin add` and `build`) |

Additional verification of static linking: with `use_frameworks!` removed,
`KhipuClientIOS` switches to linking as a static library instead of a dynamic framework
on cordova-ios 7. The `KhipuClientIOS.bundle` resource shows up in the build product
(`platforms/ios/build/Debug-iphonesimulator/CdvPin7.app/KhipuClientIOS.bundle`, with
`logo-khipu-color.png` and `khipuClient.html` inside), alongside `libKhipuClientIOS.a` —
consistent with static linking and with `BundleHelper` (which resolves via
`Bundle(for: KhipuClientBundleHelper.self).path(forResource: "KhipuClientIOS", ofType: "bundle")`)
still finding the bundle with no code changes.

### Phase 2 — installing the plugin locally in the example (plan Task 4)

Run on 2026-09-04 on a throwaway clone at `/tmp/spike-khipu` (never on the working repo),
commit `761e528`, with `npx cordova@13` (cordova-lib 13.0.0) and `cordova-ios@8.1.1`.

| Method | `plugins/cordova-khipu` | Did it modify the repo's `Package.swift`? | Did it compile? |
| --- | --- | --- | --- |
| `cordova plugin add ../` | never created — the command fails first with `Invalid src or dest: cp returned EINVAL (cannot copy .../node_modules/cordova-khipu to a subdirectory of self .../example)` | no | no — fails before reaching `SwiftPackage.addPlugin()` |
| `cordova plugin add ../ --link` | symlink | no (keeps the git URL to `apache/cordova-ios`) | yes, but SwiftPM emits `Conflicting identity for cordova-ios: ... both point to the same package identity 'cordova-ios'. This will be escalated to an error in future versions of SwiftPM`, and silently dedupes to the local copy |
| `npm pack` + `cordova plugin add file:` followed by the absolute path to the `.tgz` | real directory | no (the copy at `platforms/ios/packages/cordova-khipu/Package.swift` ends up rewritten to `path: "../cordova-ios"`) | yes, clean, no SwiftPM warnings |

Notes on each row:

- **Method 1** does not corrupt the repo, but it does not complete the install either:
  it fails during npm's own local-dependency resolution, before `cordova-lib` or
  `SwiftPackage.addPlugin()` get involved, precisely because the destination
  (`example/plugins/`) ends up nested inside the source (`../`, the repo root) — the
  same topology that motivates this spike, just showing up here as a hard failure
  instead of silent corruption.
- **Method 2** does not corrupt the plugin's `Package.swift` (it is left with
  `.package(url: "https://github.com/apache/cordova-ios.git", from: "8.0.0")` intact,
  because `--link` neither copies nor rewrites), but for that same reason the plugin's
  `Package.swift` keeps depending on `apache/cordova-ios` via git instead of the
  project's local `CordovaLib`. Today's build compiles because SwiftPM dedupes both
  identities into one (the local copy wins), but it explicitly announces that this
  behaviour will become an error in a future SwiftPM version.
- **Method 3**, run literally as in the brief (`cordova plugin add ./cordova-khipu-*.tgz`),
  fails with an npm 404 (`npm view ./cordova-khipu-2.9.1.tgz --json`): cordova-lib
  13.0.0 only skips querying the registry if the target is a URL, a directory, or
  carries an explicit version; a relative `.tgz` with no `@version` meets none of those
  conditions and ends up treated as an npm package name. Using the `file:` prefix
  followed by the absolute path to the `.tgz` instead (which is recognised as a URL),
  the install works: `plugins/cordova-khipu` ends up as a real directory (copied from
  the tarball, not a symlink to the repo) and
  `platforms/ios/packages/cordova-khipu/Package.swift` ends up with its `cordova-ios`
  dependency rewritten to the project's local path, with no identity conflict and no
  build warnings.

**Decision:** `npm pack` + `cordova plugin add` with the `file:` prefix and the absolute
path to the `.tgz`, because it is the only method that does not corrupt the repo, leaves
a single `cordova-ios` package identity with no conflict (unlike `--link`, whose build
passes today only thanks to a SwiftPM behaviour already marked deprecated), and compiles
clean with no warnings. Task 5 must invoke `cordova plugin add` with the `file:` prefix
and the absolute path to the `.tgz` — the bare relative path fails on a cordova-lib
13.0.0 parsing limitation unrelated to SPM.

This resolves risk 1 from §13.
