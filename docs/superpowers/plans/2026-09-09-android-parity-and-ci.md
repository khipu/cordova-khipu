# Android Parity, Verification Layer and English-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Android half of `cordova-khipu` to the same standard as the iOS half — fixing five contract defects — and put a verification layer under both so they cannot drift apart again.

**Architecture:** Android's single 90-line method splits into two pure mappers (`KhipuOptionsMapper`, `KhipuResultMapper`) plus a thin `KhipuPlugin`, mirroring the boundaries that already work in Swift. A minimal Gradle project compiles and unit-tests the pure halves on the JVM; the example app's Android build compiles the plugin class. A ported key-drift guard ties five declaration surfaces together, and GitHub Actions runs all of it — this repo has no CI today.

**Tech Stack:** Java 11 (`src/android/`), Swift 5.9 (`src/ios/`), Node 20 (`scripts/`, `tests/scripts/`), Gradle + AGP (`tests/android/`), JUnit 4, XCTest, `node --test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-09-android-parity-and-ci-design.md`

## Global Constraints

- **Language: English only.** Code, comments, test names, identifiers, README, and new CHANGELOG entries. Translate every file you touch as part of the same edit. Preserve the *reasoning* in existing Spanish comments — this is a translation, not a rewrite; a comment that loses its "why" is a regression.
- **Commit messages: English**, Conventional Commits (a husky `commit-msg` hook runs commitlint and will reject anything else).
- **Target version: 2.11.0**, treated as a bug fix. Do not bump `package.json` by hand; the release does it (Task 18).
- **Android SDK pin: `com.khipu:khipu-client-android:2.28.3`** in `src/android/khipu.gradle`, already committed. Never lower it. Four releases got it here and three of them fixed something this plugin depends on: **2.28.0** carries khenshin protocol 1.0.60, and anything below it carries 1.0.59, whose `FailureReasonType` lacks `USER_DISCONNECTED` and kills the app process on that value; **2.28.1** guards all 23 socket listeners so no deserialization failure reaches the EventThread at all; **2.28.2** fixes `asJson()` to serialize nulls, which this plugin does not use; **2.28.3** adds `OPERATION_WARNING` to the guard's terminal types, without which an `OPERATION_WARNING` that failed to deserialize left the operation unfinished and its callback never fired (spec §16).
- **iOS SDK pin: `KhipuClientIOS` `2.16.5`**, and it must stay identical in `Package.swift` and in the `<pod>` of `plugin.xml`. `npm run verify:versions` enforces this.
- **`plugin.xml` invariants** that `check-native-versions.js` guards and you must not break: `nospm="true"` on the `<pod>`, `package="swift"` on `<platform name="ios">`, and one `<source-file>` per `.swift` file in `src/ios/`.
- **Absent is not false.** Everywhere an option is read, "the JavaScript did not send this key" must stay distinct from "it sent `false`". The native SDKs apply their own defaults and the plugin must let them.
- **Engine floors:** `cordova-ios >= 7.0.0`, `cordova-android >= 13.0.0`, iOS deployment target 13.
- **Node version:** `v20.19.4` (`.nvmrc`).
- **Network:** the Android SDK resolves from `https://dev.khipu.com/nexus/content/repositories/khenshin`. Any machine or runner that builds Android needs that host reachable.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `src/android/com/khipu/cordova/KhipuOptionsInput.java` | Typed carrier for options that arrived from JavaScript. Boxed fields so absent stays distinct from false. |
| `src/android/com/khipu/cordova/KhipuOptionsMapper.java` | The half that can fail: `JSONObject` → `KhipuOptionsInput`, then input → `KhipuOptions`. No Android imports. |
| `src/android/com/khipu/cordova/KhipuResultMapper.java` | `KhipuResult` → `JSONObject`, the same eight keys iOS emits. No Android imports. |
| `tests/android/settings.gradle` | Declares the test project and the Khipu Maven repository. |
| `tests/android/build.gradle` | Android library module that compiles the two mappers and runs JUnit on the JVM. |
| `tests/android/src/test/java/com/khipu/cordova/SdkContractTest.java` | Locks the SDK pin: the builders are usable on the JVM and the protocol enum knows `USER_DISCONNECTED`. |
| `tests/android/src/test/java/com/khipu/cordova/KhipuOptionsMapperTest.java` | Mirrors `KhipuOptionsMapperTests.swift` one-to-one. |
| `tests/android/src/test/java/com/khipu/cordova/KhipuResultMapperTest.java` | The eight result keys and the three nullable ones. |
| `.github/workflows/ci.yml` | Four jobs: `node`, `ios`, `android`, `example`. |
| `types/index.d.ts` | The contract of record for every option and result key. |
| `scripts/check-option-keys.js` | Fails when the five declaration surfaces diverge. |
| `tests/scripts/check-option-keys.test.js` | Tests for that guard, including its sanity floor. |
| `tests/scripts/update-plugin-version.test.js` | Tests the surgical version rewrite. |
| `tests/scripts/enable-gradle-kotlin-plugin.test.js` | First tests for the only untested script. |
| `tests/js/cordova-khipu.test.js` | Tests the JS surface with a stubbed `cordova/exec`. |

**Modified:**

| Path | Change |
| --- | --- |
| `src/android/com/khipu/cordova/KhipuPlugin.java` | Reduced to validate → map → claim → launch → answer. |
| `src/ios/KhipuOptionsMapper.swift` | Colour keys collapse into one table; identifiers and doc comments to English. |
| `src/ios/KhipuPlugin.swift` | Explicit `NSNull()`, `private` on internal helpers, comments to English. |
| `tests/ios/KhipuOptionsMapperTests.swift` | Test names to English, mirrored by the Java suite. |
| `scripts/update-plugin-version.js` | Surgical attribute replacement instead of a whole-file xml2js round trip. |
| `scripts/enable-gradle-kotlin-plugin.js` | `JSON.parse(readFileSync)`, early return, explained, tested. |
| `scripts/check-native-versions.js` | Also asserts the Android SDK pin; comments corrected. |
| `www/cordova-khipu.js` | JSDoc, local validation, optional promise. |
| `plugin.xml` | Empty `AndroidManifest.xml` `<config-file>` deleted. |
| `package.json` | `verify` script, `types` field, `types/` in `files`, release hook. |
| `README.md` | Contract-change note, injected permissions, the destroyed-activity limitation; English throughout. |
| `CHANGELOG.md` | The 2.11.0 note (written by the release, prepared in Task 16). |

---

## Task 1: The Android test bed

Nothing in `src/android/` compiles anywhere today. This task builds the place where it will, and proves the SDK pin from Task 0's commit resolves and is usable on a plain JVM.

**Files:**
- Create: `tests/android/settings.gradle`
- Create: `tests/android/build.gradle`
- Create: `tests/android/gradle.properties`
- Create: `tests/android/src/test/java/com/khipu/cordova/SdkContractTest.java`
- Create: `tests/android/.gitignore`
- Modify: `.gitignore` (allow `tests/android/gradle/wrapper/gradle-wrapper.jar`)

**Interfaces:**
- Consumes: nothing.
- Produces: a Gradle project whose `./gradlew test` compiles every `.java` in `src/android/com/khipu/cordova/` **except** `KhipuPlugin.java`, and runs JUnit 4 tests from `tests/android/src/test/java/`. Later tasks add test classes to that directory and mapper classes to `src/android/`.

- [ ] **Step 1: Write the settings file**

`tests/android/settings.gradle`:

```gradle
// The Khipu SDK lives in Khipu's own Nexus, so the repository has to be
// declared here as well as in src/android/khipu.gradle: this project resolves
// the SDK on its own, outside any Cordova app.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://dev.khipu.com/nexus/content/repositories/khenshin' }
    }
}

rootProject.name = 'cordova-khipu-android-tests'
```

- [ ] **Step 2: Write the build file**

`tests/android/build.gradle`:

```gradle
// A place to compile and unit-test the pure half of the Android plugin.
//
// src/android/ holds loose files that Cordova injects into the merchant's app,
// so there is no Gradle project there and never was — which is why none of that
// Java was ever compiled by a check. This module takes those sources as its own
// source set.
//
// KhipuPlugin.java is deliberately excluded: it is the only file that needs
// org.apache.cordova on the classpath, and keeping Cordova out of the unit-test
// classpath is most of what extracting the mappers buys. That file is compiled
// for real by the example app's Android build, in CI's `android` job.
plugins {
    id 'com.android.library' version '8.10.1'
}

android {
    namespace 'com.khipu.cordova.tests'
    compileSdk 36

    defaultConfig {
        minSdk 24
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }

    sourceSets {
        main {
            java.srcDirs = ['../../src/android']
            java.exclude 'com/khipu/cordova/KhipuPlugin.java'
        }
        test {
            java.srcDirs = ['src/test/java']
        }
    }
}

dependencies {
    implementation 'com.khipu:khipu-client-android:2.28.3'

    testImplementation 'junit:junit:4.13.2'
    // org.json inside android.jar is a set of stubs whose every method throws
    // `Stub!` in a JVM unit test. Depending on the real implementation makes it
    // shadow the stub, which is what lets the mappers be tested off-device.
    testImplementation 'org.json:json:20240303'
}
```

- [ ] **Step 3: Write the properties and ignore files**

`tests/android/gradle.properties`:

```properties
android.useAndroidX=true
org.gradle.jvmargs=-Xmx2g
```

`tests/android/.gitignore`:

```gitignore
.gradle
build
local.properties
```

- [ ] **Step 4: Un-ignore the wrapper JAR**

The repo's root `.gitignore` has a bare `build` and `.gradle` entry, which the file above already covers locally, but it does not exclude the wrapper. Confirm nothing hides it by appending to the root `.gitignore`:

```gitignore

# The Gradle wrapper of tests/android/ is checked in on purpose: CI validates
# its checksum with gradle/actions/wrapper-validation.
!tests/android/gradle/wrapper/gradle-wrapper.jar
```

- [ ] **Step 5: Generate the wrapper**

If a `gradle` is on your PATH:

```bash
cd tests/android && gradle wrapper --gradle-version 8.14.2
```

If it is not, take the wrapper from a Cordova Android platform, which pins the same Gradle line:

```bash
cd example && npm install && npm run plugin:add && npx cordova platform add android@15.1.0 --nosave
cp -R platforms/android/gradle ../tests/android/gradle
cp platforms/android/gradlew ../tests/android/gradlew
chmod +x ../tests/android/gradlew
```

Expected: `tests/android/gradlew`, `tests/android/gradle/wrapper/gradle-wrapper.jar` and `gradle-wrapper.properties` all exist.

- [ ] **Step 6: Write the failing test**

`tests/android/src/test/java/com/khipu/cordova/SdkContractTest.java`:

```java
package com.khipu.cordova;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.khipu.client.KhipuColors;
import com.khipu.client.KhipuOptions;

import org.junit.Test;

import java.util.Arrays;

/**
 * Locks two properties of the pinned SDK that the rest of the suite depends on.
 *
 * The first is that its builders run on a plain JVM. They do today — KhipuOptions.kt
 * imports only java.io.Serializable — and if a future release starts reaching into the
 * Android framework, every mapper test would fail at once with a confusing error. This
 * test fails first, with an obvious one.
 *
 * The second is the reason src/android/khipu.gradle says 2.28.3 and not 2.27.0. Protocol
 * 1.0.59 has fourteen FailureReasonType constants and no USER_DISCONNECTED; its
 * forValue() throws IOException on any value it does not know, and the SDK's
 * OPERATION_FAILURE listener calls the converter with no try/catch on socket.io's
 * EventThread, so that throw is uncaught and kills the app process. 1.0.60 has the
 * fifteenth constant. Anyone lowering the pin gets a failing test instead of a crash in
 * a merchant's app.
 */
public class SdkContractTest {

    @Test
    public void theSdkBuildersRunOnTheJvm() {
        KhipuOptions options = new KhipuOptions.Builder()
                .locale("es_CL")
                .colors(new KhipuColors.Builder().lightPrimary("#8347AD").build())
                .build();

        assertEquals("es_CL", options.getLocale());
        assertNotNull(options.getColors());
    }

    @Test
    public void theProtocolEnumKnowsUserDisconnected() throws Exception {
        // Reflection, not a direct reference: the protocol is a `runtime` scope
        // dependency of the SDK's POM, so it is on the test runtime classpath but not on
        // the compile classpath. Naming it as a compile dependency here would duplicate
        // a version pin that nothing guards.
        Class<?> failureReasonType = Class.forName("com.khipu.khenshin.protocol.FailureReasonType");
        Object[] constants = failureReasonType.getEnumConstants();

        assertNotNull("the protocol jar is not on the test classpath", constants);
        assertEquals(15, constants.length);
        assertTrue(
                "protocol 1.0.59 is on the classpath; the SDK pin must be 2.28.3 or newer",
                Arrays.stream(constants).anyMatch(c -> c.toString().equals("USER_DISCONNECTED"))
        );
    }
}
```

- [ ] **Step 7: Run the tests**

```bash
cd tests/android && ./gradlew test
```

Expected: both tests PASS. `theProtocolEnumKnowsUserDisconnected` is the executable form of the claim in the previous commit, so a pass here is the first real confirmation that 2.28.3 resolves from the Nexus.

If it fails with `Could not resolve com.khipu:khipu-client-android:2.28.3`, the Nexus host is unreachable from this machine — that is the risk in spec §14 and it blocks this task, not later ones. Report it rather than working around it.

- [ ] **Step 8: Prove the exclusion works**

`KhipuPlugin.java` must not be on this module's compile path. Confirm:

```bash
cd tests/android && ./gradlew compileDebugJavaWithJavac --info 2>&1 | grep -c 'KhipuPlugin.java'
```

Expected: `0`. If it is not zero, the `java.exclude` line is wrong and the build will fail asking for `org.apache.cordova`.

- [ ] **Step 9: Commit**

```bash
git add tests/android .gitignore
git commit -m "test(android): add a Gradle bed for the plugin's pure half

src/android/ is a set of loose files that Cordova injects into the merchant's
app, so none of that Java was ever compiled by any check in this repo. This
module takes those sources as its own source set, excluding KhipuPlugin.java —
the only file that needs Cordova on the classpath — and runs JUnit on the JVM.

SdkContractTest turns two claims into assertions: that the SDK's builders work
off-device, and that the pinned protocol knows USER_DISCONNECTED, which is why
the pin is 2.28.3."
```

---

## Task 2: Continuous integration

This repo has never had CI. `npm test` runs the Node script tests only, so the Swift tests never run in `prepublishOnly` and no Java is compiled by any check.

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (add `verify:android`, `verify:ios` and `verify`)

**Interfaces:**
- Consumes: `tests/android/gradlew` from Task 1.
- Produces: `npm run verify` — one command that reproduces the `node` job locally. Task 12 adds `verify:keys` to it.

- [ ] **Step 1: Add the verify scripts**

In `package.json`, replace the `scripts` block's `verify:versions` line with:

```json
    "verify": "npm test && npm run verify:versions && npm run verify:ios && npm run verify:android",
    "verify:versions": "node scripts/check-native-versions.js",
    "verify:ios": "xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16'",
    "verify:android": "cd tests/android && ./gradlew test",
```

- [ ] **Step 2: Write the workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run verify:versions

  ios:
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
      # The package declares platforms: [.iOS(.v13)] and CordovaLib is UIKit-only,
      # so `swift test` cannot work here: it would try to build for macOS. The tests
      # have to go through a simulator destination.
      - name: Cache the SPM resolution
        uses: actions/cache@v4
        with:
          path: .build
          key: spm-${{ runner.os }}-${{ hashFiles('Package.swift') }}
      - name: Build the package
        run: xcodebuild build -scheme cordova-khipu -destination generic/platform=iOS
      - name: Run the package tests
        run: xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16'

  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # gradle-wrapper.jar is a binary no diff can review. This action compares its
      # checksum against Gradle's published ones, and it is the only defence against
      # an altered wrapper.
      - name: Validate the Gradle wrapper
        uses: gradle/actions/wrapper-validation@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - uses: android-actions/setup-android@v3
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Unit-test the pure half
        run: ./gradlew test
        working-directory: tests/android
      # The only check that compiles KhipuPlugin.java, which needs Cordova on the
      # classpath. It runs on every pull request because Ubuntu makes it cheap; the
      # iOS half of the example is push-only, in the `example` job.
      - name: Build the example's Android platform
        run: |
          npm ci
          npm install
          npm run plugin:add
          npx cordova platform add android@15.1.0 --nosave
          npx cordova build android --debug
        working-directory: example

  example:
    if: github.event_name == 'push'
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      # The only thing that exercises the full install path: the after_prepare hooks,
      # the podspec and the SPM package. Both iOS majors, because the plugin supports
      # CocoaPods on cordova-ios 7 and SPM on 8, and the two paths differ.
      - name: Install the plugin into the example
        run: |
          npm install
          npm run plugin:add
        working-directory: example
      - name: Build with cordova-ios 8 (SPM)
        run: |
          npx cordova platform add ios@8.1.1 --nosave
          npx cordova build ios --emulator
        working-directory: example
      - name: Build with cordova-ios 7 (CocoaPods)
        run: |
          npm run reset
          npm run plugin:add
          npx cordova platform add ios@7.1.1 --nosave
          npx cordova build ios --emulator
        working-directory: example
```

- [ ] **Step 3: Check the workflow parses**

```bash
npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "valid YAML"
```

Expected: `valid YAML`.

- [ ] **Step 4: Run the node job's contents locally**

```bash
npm ci && npm test && npm run verify:versions
```

Expected: all pass against today's code. This job must be green before anything is fixed — that is the point of doing CI first.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci: add the workflow this repo never had

Four jobs. \`node\` runs the script tests and the version guard. \`ios\` goes
through xcodebuild rather than \`swift test\`, because the package is iOS-only
and CordovaLib is UIKit-only. \`android\` unit-tests the pure half and then
builds the example's Android platform, which is the only check that compiles
KhipuPlugin.java. \`example\` builds both iOS majors on push, which is the only
thing that exercises the hooks, the podspec and the SPM package.

Also adds \`npm run verify\` so one command reproduces the checks locally."
```

- [ ] **Step 6: Confirm CI is green on the branch**

Push and watch the four jobs. Two failures are expected to be *environmental*, not code, and must be resolved here rather than carried forward:

- `Unable to find a device matching the provided destination specifier` in the `ios` job. The runner image may not carry an "iPhone 16" for the default runtime. List what it has with `xcrun simctl list devices available` in a temporary step and pin the name that exists.
- `Could not resolve com.khipu:khipu-client-android` in the `android` job. That means GitHub's runners cannot reach Khipu's Nexus, which is spec §14's risk. Do not work around it silently: report it, and if it is real, degrade that job to the unit tests plus a documented manual step for the example build.

---

## Task 3: `KhipuOptionsInput` and strict parsing

The half that can fail: interpreting a dictionary a third party built. Two defects get fixed here — a wrong type silently coerced to `false`, and `colors` applied even when it was never sent.

**Files:**
- Create: `src/android/com/khipu/cordova/KhipuOptionsInput.java`
- Create: `src/android/com/khipu/cordova/KhipuOptionsMapper.java`
- Create: `tests/android/src/test/java/com/khipu/cordova/KhipuOptionsMapperTest.java`
- Modify: `plugin.xml` (add `<source-file>` entries for the two new Java files)

**Interfaces:**
- Consumes: the Gradle bed from Task 1.
- Produces:
  - `KhipuOptionsInput` — package-private value carrier with fields `topBarTitle`, `topBarImageUrl` (`String`), `skipExitPage`, `skipExitSuccessPage`, `showFooter`, `showMerchantLogo`, `showPaymentDetails` (`Boolean`), `locale` (`String`), `theme` (`KhipuOptions.Theme`), `colors` (`Map<String, String>`), plus `equals`/`hashCode`.
  - `static KhipuOptionsInput KhipuOptionsMapper.parse(JSONObject call)` — never throws.
  - `static final List<String> KhipuOptionsMapper.COLOR_KEYS` — the twelve keys, in the same order as the Swift table.

- [ ] **Step 1: Write the value carrier**

`src/android/com/khipu/cordova/KhipuOptionsInput.java`:

```java
package com.khipu.cordova;

import com.khipu.client.KhipuOptions;

import java.util.Map;
import java.util.Objects;

/**
 * Typed representation of the options that arrived from JavaScript.
 *
 * It exists apart from KhipuOptions for the same two reasons as its Swift counterpart.
 * The practical one: a test cannot read back what it put into the SDK's builder. The
 * design one: it separates what can fail — interpreting a dictionary a third party
 * built — from what cannot, which is applying already-validated values.
 *
 * A null field means "the JavaScript did not send this key", which is not the same as
 * sending it as false: the SDK applies its own defaults and the plugin has to let it.
 * That is why the booleans are boxed.
 */
final class KhipuOptionsInput {

    String topBarTitle;
    String topBarImageUrl;
    Boolean skipExitPage;
    Boolean skipExitSuccessPage;
    Boolean showFooter;
    Boolean showMerchantLogo;
    Boolean showPaymentDetails;
    String locale;
    KhipuOptions.Theme theme;
    /** Null means the `colors` key was absent; empty means it arrived with nothing usable. */
    Map<String, String> colors;

    // Value semantics, so a test can compare a whole input against an empty one the way
    // the Swift suite does with its Equatable struct.
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof KhipuOptionsInput)) {
            return false;
        }
        KhipuOptionsInput that = (KhipuOptionsInput) other;
        return Objects.equals(topBarTitle, that.topBarTitle)
                && Objects.equals(topBarImageUrl, that.topBarImageUrl)
                && Objects.equals(skipExitPage, that.skipExitPage)
                && Objects.equals(skipExitSuccessPage, that.skipExitSuccessPage)
                && Objects.equals(showFooter, that.showFooter)
                && Objects.equals(showMerchantLogo, that.showMerchantLogo)
                && Objects.equals(showPaymentDetails, that.showPaymentDetails)
                && Objects.equals(locale, that.locale)
                && Objects.equals(theme, that.theme)
                && Objects.equals(colors, that.colors);
    }

    @Override
    public int hashCode() {
        return Objects.hash(topBarTitle, topBarImageUrl, skipExitPage, skipExitSuccessPage,
                showFooter, showMerchantLogo, showPaymentDetails, locale, theme, colors);
    }
}
```

- [ ] **Step 2: Write the failing test**

`tests/android/src/test/java/com/khipu/cordova/KhipuOptionsMapperTest.java`:

```java
package com.khipu.cordova;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.khipu.client.KhipuOptions;

import org.json.JSONObject;
import org.junit.Test;

/**
 * Mirrors tests/ios/KhipuOptionsMapperTests.swift one-to-one, so a case that exists on
 * one platform and is missing on the other is visible at a glance. Keep the names in
 * step with that file.
 */
public class KhipuOptionsMapperTest {

    @Test
    public void withNoOptionsKeyEverythingIsNull() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject("{\"operationId\":\"abc\"}"));

        assertEquals(new KhipuOptionsInput(), input);
    }

    @Test
    public void mapsEveryScalarField() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject("{"
                + "\"operationId\":\"abc\","
                + "\"options\":{"
                + "  \"title\":\"Demo\","
                + "  \"titleImageUrl\":\"https://khipu.com/logo.png\","
                + "  \"skipExitPage\":true,"
                + "  \"skipExitSuccessPage\":false,"
                + "  \"showFooter\":false,"
                + "  \"showMerchantLogo\":true,"
                + "  \"showPaymentDetails\":false,"
                + "  \"locale\":\"es_CL\","
                + "  \"theme\":\"dark\""
                + "}}"));

        assertEquals("Demo", input.topBarTitle);
        assertEquals("https://khipu.com/logo.png", input.topBarImageUrl);
        assertEquals(Boolean.TRUE, input.skipExitPage);
        assertEquals(Boolean.FALSE, input.skipExitSuccessPage);
        assertEquals(Boolean.FALSE, input.showFooter);
        assertEquals(Boolean.TRUE, input.showMerchantLogo);
        assertEquals(Boolean.FALSE, input.showPaymentDetails);
        assertEquals("es_CL", input.locale);
        assertEquals(KhipuOptions.Theme.DARK, input.theme);
    }

    /**
     * The plugin has to tell "they did not send me the key" apart from "they sent me
     * false": the SDK applies its own defaults.
     */
    @Test
    public void anAbsentKeyIsNotConfusedWithFalse() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(
                new JSONObject("{\"options\":{\"title\":\"Demo\"}}"));

        assertNull(input.showFooter);
        assertNull(input.skipExitPage);
        assertNull(input.showMerchantLogo);
        assertNull(input.showPaymentDetails);
        assertNull(input.skipExitSuccessPage);
    }

    /**
     * This is the divergence that made Android and iOS disagree. optBoolean("showFooter")
     * on a string returns its false default and passes that to the SDK, while iOS's
     * `as? Bool` discards the key and lets the SDK default apply.
     */
    @Test
    public void aWrongTypeIsDiscardedRatherThanCoerced() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject("{"
                + "\"options\":{"
                + "  \"title\":123,"
                + "  \"showFooter\":\"yes\","
                + "  \"locale\":[\"es\",\"CL\"]"
                + "}}"));

        assertNull(input.topBarTitle);
        assertNull(input.showFooter);
        assertNull(input.locale);
    }

    @Test
    public void anUnknownThemeIsDiscarded() throws Exception {
        assertNull(KhipuOptionsMapper.parse(
                new JSONObject("{\"options\":{\"theme\":\"neon\"}}")).theme);
    }

    @Test
    public void mapsTheTwelveColourKeys() throws Exception {
        JSONObject colors = new JSONObject();
        for (int index = 0; index < KhipuOptionsMapper.COLOR_KEYS.size(); index++) {
            colors.put(KhipuOptionsMapper.COLOR_KEYS.get(index), String.format("#%06X", index));
        }
        JSONObject options = new JSONObject().put("colors", colors);

        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject().put("options", options));

        assertEquals(12, input.colors.size());
        assertEquals("#000002", input.colors.get("lightPrimary"));
    }

    @Test
    public void anUnknownColourKeyIsDiscarded() throws Exception {
        JSONObject colors = new JSONObject().put("lightPrimarry", "#8347AD");
        JSONObject options = new JSONObject().put("colors", colors);

        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject().put("options", options));

        assertEquals(0, input.colors.size());
    }

    /**
     * The phantom-colors defect: the old code called optionsBuilder.colors(...) outside
     * the `has("colors")` check, so every operation that sent any options injected an
     * empty KhipuColors into the SDK. Absent has to stay absent.
     */
    @Test
    public void anAbsentColorsKeyLeavesColoursNull() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(
                new JSONObject("{\"options\":{\"title\":\"Demo\"}}"));

        assertNull(input.colors);
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd tests/android && ./gradlew test --tests '*KhipuOptionsMapperTest*'
```

Expected: FAIL — compilation error, `cannot find symbol: class KhipuOptionsMapper`.

- [ ] **Step 4: Write the parser**

`src/android/com/khipu/cordova/KhipuOptionsMapper.java` (the `makeOptions` half arrives in Task 4):

```java
package com.khipu.cordova;

import com.khipu.client.KhipuOptions;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads the options a merchant's JavaScript sent, and applies them to the SDK's builder.
 *
 * The mirror of src/ios/KhipuOptionsMapper.swift, deliberately: the two platforms are
 * called through the same JavaScript, so any divergence between them is a bug the
 * merchant hits and we do not. Keep them in step.
 */
final class KhipuOptionsMapper {

    /**
     * The twelve keys KhipuColors accepts, in the same order as the Swift table. A key
     * that is not here is discarded rather than propagated, so a typo in a merchant's
     * JavaScript does not reach the SDK in silence.
     */
    static final List<String> COLOR_KEYS = Collections.unmodifiableList(Arrays.asList(
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
    ));

    private KhipuOptionsMapper() {
    }

    /**
     * Interprets the dictionary that arrived from JavaScript. It neither throws nor
     * fails: a value of the wrong type is discarded as though it had never been sent.
     */
    static KhipuOptionsInput parse(JSONObject call) {
        KhipuOptionsInput input = new KhipuOptionsInput();
        JSONObject options = objectOrNull(call, "options");

        if (options == null) {
            return input;
        }

        input.topBarTitle = stringOrNull(options, "title");
        input.topBarImageUrl = stringOrNull(options, "titleImageUrl");
        input.skipExitPage = booleanOrNull(options, "skipExitPage");
        input.skipExitSuccessPage = booleanOrNull(options, "skipExitSuccessPage");
        input.showFooter = booleanOrNull(options, "showFooter");
        input.showMerchantLogo = booleanOrNull(options, "showMerchantLogo");
        input.showPaymentDetails = booleanOrNull(options, "showPaymentDetails");
        input.locale = stringOrNull(options, "locale");
        input.theme = themeOrNull(stringOrNull(options, "theme"));

        JSONObject colors = objectOrNull(options, "colors");
        if (colors != null) {
            Map<String, String> valid = new LinkedHashMap<>();
            for (String key : COLOR_KEYS) {
                String value = stringOrNull(colors, key);
                if (value != null) {
                    valid.put(key, value);
                }
            }
            input.colors = valid;
        }

        return input;
    }

    private static KhipuOptions.Theme themeOrNull(String theme) {
        if (theme == null) {
            return null;
        }
        switch (theme) {
            case "light":
                return KhipuOptions.Theme.LIGHT;
            case "dark":
                return KhipuOptions.Theme.DARK;
            case "system":
                return KhipuOptions.Theme.SYSTEM;
            default:
                return null;
        }
    }

    // `opt` plus `instanceof`, not optString/optBoolean. The opt* helpers coerce: on the
    // string "yes", optBoolean returns its false default and that false reaches the SDK,
    // where iOS would have discarded the key. Checking the type makes the two platforms
    // agree by construction instead of by discipline.
    private static String stringOrNull(JSONObject source, String key) {
        Object value = source.opt(key);
        return value instanceof String ? (String) value : null;
    }

    private static Boolean booleanOrNull(JSONObject source, String key) {
        Object value = source.opt(key);
        return value instanceof Boolean ? (Boolean) value : null;
    }

    private static JSONObject objectOrNull(JSONObject source, String key) {
        Object value = source.opt(key);
        return value instanceof JSONObject ? (JSONObject) value : null;
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd tests/android && ./gradlew test --tests '*KhipuOptionsMapperTest*'
```

Expected: 8 tests PASS.

- [ ] **Step 6: Declare the new sources in `plugin.xml`**

Under `<platform name="android">`, beside the existing `<source-file>`, add:

```xml
    <source-file src="src/android/com/khipu/cordova/KhipuOptionsInput.java" target-dir="src/com/khipu/cordova"/>
    <source-file src="src/android/com/khipu/cordova/KhipuOptionsMapper.java" target-dir="src/com/khipu/cordova"/>
```

Unlike iOS, Android has no SPM path that would sweep the directory: a `.java` file with no `<source-file>` is simply never installed, and the build fails on the merchant's machine, not ours.

- [ ] **Step 7: Commit**

```bash
git add src/android/com/khipu/cordova/KhipuOptionsInput.java \
        src/android/com/khipu/cordova/KhipuOptionsMapper.java \
        tests/android/src/test/java/com/khipu/cordova/KhipuOptionsMapperTest.java \
        plugin.xml
git commit -m "fix(android): read options by type instead of coercing them

optBoolean on the string \"yes\" returns its false default and passes that to
the SDK; iOS discards the key and lets the SDK's own default apply. Same
payload, two behaviours. Reading with opt() plus instanceof makes the two
platforms agree by construction.

Also stops treating an absent \`colors\` key as an empty KhipuColors, which the
old code injected into every operation that sent any options at all.

The test names mirror KhipuOptionsMapperTests.swift one-to-one so a case
missing on one platform is visible at a glance."
```

---

## Task 4: Applying the input, with one colour table

**Files:**
- Modify: `src/android/com/khipu/cordova/KhipuOptionsMapper.java`
- Modify: `tests/android/src/test/java/com/khipu/cordova/KhipuOptionsMapperTest.java`

**Interfaces:**
- Consumes: `KhipuOptionsInput`, `KhipuOptionsMapper.parse`, `COLOR_KEYS` from Task 3.
- Produces: `static KhipuOptions KhipuOptionsMapper.makeOptions(KhipuOptionsInput input)` and `static KhipuColors makeColors(Map<String, String> colors)`.

- [ ] **Step 1: Write the failing tests**

Append to `KhipuOptionsMapperTest.java`:

```java
    @Test
    public void appliesOnlyTheFieldsThatArrived() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject(
                "{\"options\":{\"locale\":\"es_CL\",\"showFooter\":false}}"));

        KhipuOptions options = KhipuOptionsMapper.makeOptions(input);

        assertEquals("es_CL", options.getLocale());
        assertFalse(options.getShowFooter());
        // Never sent, so the SDK's own default has to survive.
        assertNull(options.getTopBarTitle());
        assertNull(options.getColors());
    }

    @Test
    public void appliesEveryColourKeyItWasGiven() throws Exception {
        JSONObject colors = new JSONObject();
        for (String key : KhipuOptionsMapper.COLOR_KEYS) {
            colors.put(key, "#8347AD");
        }

        KhipuColors applied = KhipuOptionsMapper.makeColors(
                KhipuOptionsMapper.parse(new JSONObject()
                        .put("options", new JSONObject().put("colors", colors))).colors);

        assertEquals("#8347AD", applied.getLightPrimary());
        assertEquals("#8347AD", applied.getDarkOnTopBarContainer());
    }

    /**
     * The table and the twelve setters are the same list. If a key is ever added to
     * COLOR_KEYS without a setter beside it, this fails instead of silently dropping it.
     */
    @Test
    public void everyColourKeyHasASetter() {
        assertEquals(KhipuOptionsMapper.COLOR_KEYS.size(), KhipuOptionsMapper.colourSetterCount());
    }
```

Add these imports at the top of the test file:

```java
import static org.junit.Assert.assertFalse;

import com.khipu.client.KhipuColors;
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd tests/android && ./gradlew test --tests '*KhipuOptionsMapperTest*'
```

Expected: FAIL — `cannot find symbol: method makeOptions`.

- [ ] **Step 3: Write the table and the two appliers**

Add to `KhipuOptionsMapper.java`. Note `BiConsumer` and not a function returning a builder: the SDK's setters are Kotlin `apply { }` bodies, so they mutate the receiver and hand back the same instance.

```java
    /**
     * The twelve colour setters, keyed by the name JavaScript uses. This is the same
     * list as COLOR_KEYS and is checked against it by a test: keeping the keys and the
     * setters in one structure is what stops the two from drifting.
     */
    private static final Map<String, BiConsumer<KhipuColors.Builder, String>> COLOR_SETTERS;

    static {
        Map<String, BiConsumer<KhipuColors.Builder, String>> setters = new LinkedHashMap<>();
        setters.put("lightBackground", KhipuColors.Builder::lightBackground);
        setters.put("lightOnBackground", KhipuColors.Builder::lightOnBackground);
        setters.put("lightPrimary", KhipuColors.Builder::lightPrimary);
        setters.put("lightOnPrimary", KhipuColors.Builder::lightOnPrimary);
        setters.put("lightTopBarContainer", KhipuColors.Builder::lightTopBarContainer);
        setters.put("lightOnTopBarContainer", KhipuColors.Builder::lightOnTopBarContainer);
        setters.put("darkBackground", KhipuColors.Builder::darkBackground);
        setters.put("darkOnBackground", KhipuColors.Builder::darkOnBackground);
        setters.put("darkPrimary", KhipuColors.Builder::darkPrimary);
        setters.put("darkOnPrimary", KhipuColors.Builder::darkOnPrimary);
        setters.put("darkTopBarContainer", KhipuColors.Builder::darkTopBarContainer);
        setters.put("darkOnTopBarContainer", KhipuColors.Builder::darkOnTopBarContainer);
        COLOR_SETTERS = Collections.unmodifiableMap(setters);
    }

    /** Applies an already-validated input to the SDK's builder. */
    static KhipuOptions makeOptions(KhipuOptionsInput input) {
        KhipuOptions.Builder builder = new KhipuOptions.Builder();

        if (input.topBarTitle != null) {
            builder.topBarTitle(input.topBarTitle);
        }
        if (input.topBarImageUrl != null) {
            builder.topBarImageUrl(input.topBarImageUrl);
        }
        if (input.skipExitPage != null) {
            builder.skipExitPage(input.skipExitPage);
        }
        if (input.skipExitSuccessPage != null) {
            builder.skipExitSuccessPage(input.skipExitSuccessPage);
        }
        if (input.showFooter != null) {
            builder.showFooter(input.showFooter);
        }
        if (input.showMerchantLogo != null) {
            builder.showMerchantLogo(input.showMerchantLogo);
        }
        if (input.showPaymentDetails != null) {
            builder.showPaymentDetails(input.showPaymentDetails);
        }
        if (input.locale != null) {
            builder.locale(input.locale);
        }
        if (input.theme != null) {
            builder.theme(input.theme);
        }
        // Only when the key actually arrived. Applying an empty KhipuColors would
        // override the SDK's own palette with nothing.
        if (input.colors != null) {
            builder.colors(makeColors(input.colors));
        }

        return builder.build();
    }

    static KhipuColors makeColors(Map<String, String> colors) {
        KhipuColors.Builder builder = new KhipuColors.Builder();

        for (Map.Entry<String, BiConsumer<KhipuColors.Builder, String>> setter : COLOR_SETTERS.entrySet()) {
            String value = colors.get(setter.getKey());
            if (value != null) {
                setter.getValue().accept(builder, value);
            }
        }

        return builder.build();
    }

    /** For the test that keeps COLOR_KEYS and COLOR_SETTERS the same length. */
    static int colourSetterCount() {
        return COLOR_SETTERS.size();
    }
```

Add these imports:

```java
import com.khipu.client.KhipuColors;

import java.util.function.BiConsumer;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd tests/android && ./gradlew test
```

Expected: every test in both classes PASSES.

- [ ] **Step 5: Commit**

```bash
git add src/android/com/khipu/cordova/KhipuOptionsMapper.java \
        tests/android/src/test/java/com/khipu/cordova/KhipuOptionsMapperTest.java
git commit -m "refactor(android): apply options from one colour table

The twelve colour keys were written out twice on this platform and are written
again in Swift and in the type declarations. Here they collapse into a single
keyed structure, and a test keeps that structure the same length as the key
list, so a key added without its setter fails a check instead of being dropped
in silence."
```

---

## Task 5: The result mapper

Two defects here. Android hands JavaScript a Gson **string** where iOS hands it an object, and because Gson omits nulls, the three nullable keys are not merely empty in that string — they are absent.

**Files:**
- Create: `src/android/com/khipu/cordova/KhipuResultMapper.java`
- Create: `tests/android/src/test/java/com/khipu/cordova/KhipuResultMapperTest.java`
- Modify: `plugin.xml`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `static JSONObject KhipuResultMapper.toJson(KhipuResult result) throws JSONException` and `static boolean KhipuResultMapper.isError(KhipuResult result)`.

- [ ] **Step 1: Write the failing test**

`tests/android/src/test/java/com/khipu/cordova/KhipuResultMapperTest.java`:

```java
package com.khipu.cordova;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.khipu.client.KhipuEvent;
import com.khipu.client.KhipuResult;

import org.json.JSONObject;
import org.junit.Test;

/**
 * The eight keys iOS emits, emitted the same way here.
 *
 * KhipuResult's constructor takes its arguments in this order: operationId, exitTitle,
 * exitMessage, exitUrl, continueUrl, result, events, failureReason. Kotlin default
 * arguments are not visible from Java, so every one has to be passed.
 */
public class KhipuResultMapperTest {

    private static KhipuResult cancelled() {
        return new KhipuResult(
                "op-123",
                "",
                "",
                "",
                null,
                "ERROR",
                new KhipuEvent[]{new KhipuEvent("form", "2026-09-09T12:00:00Z", "start")},
                "USER_CANCELED"
        );
    }

    @Test
    public void emitsTheEightKeys() throws Exception {
        JSONObject json = KhipuResultMapper.toJson(cancelled());

        assertEquals(8, json.length());
        assertEquals("op-123", json.getString("operationId"));
        assertEquals("ERROR", json.getString("result"));
        assertEquals("", json.getString("exitTitle"));
        assertEquals("", json.getString("exitMessage"));
        assertEquals("", json.getString("exitUrl"));
        assertEquals("USER_CANCELED", json.getString("failureReason"));
    }

    /**
     * The defect this replaces: asJson() is Gson().toJson(this) with serializeNulls off,
     * so a null field produced no key at all and a merchant reading result.continueUrl
     * got undefined on Android and null on iOS. JSONObject.NULL keeps the key present.
     */
    @Test
    public void aNullFieldKeepsItsKeyAndArrivesAsNull() throws Exception {
        JSONObject json = KhipuResultMapper.toJson(cancelled());

        assertTrue("the key must be present", json.has("continueUrl"));
        assertTrue("and it must be JSON null", json.isNull("continueUrl"));
    }

    @Test
    public void mapsEveryEventField() throws Exception {
        JSONObject event = KhipuResultMapper.toJson(cancelled()).getJSONArray("events").getJSONObject(0);

        assertEquals("form", event.getString("name"));
        assertEquals("start", event.getString("type"));
        assertEquals("2026-09-09T12:00:00Z", event.getString("timestamp"));
    }

    @Test
    public void anEmptyEventListIsAnEmptyArray() throws Exception {
        KhipuResult result = new KhipuResult("op", "", "", null, null, "OK", new KhipuEvent[0], null);

        assertEquals(0, KhipuResultMapper.toJson(result).getJSONArray("events").length());
    }

    @Test
    public void onlyTheErrorResultIsAnError() {
        assertTrue(KhipuResultMapper.isError(cancelled()));
        assertFalse(KhipuResultMapper.isError(
                new KhipuResult("op", "", "", null, null, "OK", new KhipuEvent[0], null)));
        assertFalse(KhipuResultMapper.isError(
                new KhipuResult("op", "", "", null, null, "WARNING", new KhipuEvent[0], null)));
        assertFalse(KhipuResultMapper.isError(
                new KhipuResult("op", "", "", null, null, "CONTINUE", new KhipuEvent[0], null)));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd tests/android && ./gradlew test --tests '*KhipuResultMapperTest*'
```

Expected: FAIL — `cannot find symbol: class KhipuResultMapper`.

- [ ] **Step 3: Write the mapper**

`src/android/com/khipu/cordova/KhipuResultMapper.java`:

```java
package com.khipu.cordova;

import com.khipu.client.KhipuEvent;
import com.khipu.client.KhipuResult;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Turns the SDK's result into the object a merchant's JavaScript receives.
 *
 * This used to be khipuResult.asJson(), which has two problems. It returns a String, so
 * Android handed JavaScript a string where iOS handed it an object. And it is
 * Gson().toJson(this) with serializeNulls off, so the three nullable fields produced no
 * key at all rather than a null one.
 *
 * The eight keys below are the same eight, in the same shape, that KhipuPlugin.swift
 * builds. scripts/check-option-keys.js reads both and fails if they stop matching.
 */
final class KhipuResultMapper {

    private KhipuResultMapper() {
    }

    static JSONObject toJson(KhipuResult result) throws JSONException {
        JSONObject json = new JSONObject();

        json.put("operationId", result.getOperationId());
        json.put("result", result.getResult());
        json.put("exitTitle", result.getExitTitle());
        json.put("exitMessage", result.getExitMessage());
        json.put("exitUrl", orJsonNull(result.getExitUrl()));
        json.put("failureReason", orJsonNull(result.getFailureReason()));
        json.put("continueUrl", orJsonNull(result.getContinueUrl()));

        JSONArray events = new JSONArray();
        for (KhipuEvent event : result.getEvents()) {
            events.put(new JSONObject()
                    .put("name", event.getName())
                    .put("type", event.getType())
                    .put("timestamp", event.getTimestamp()));
        }
        json.put("events", events);

        return json;
    }

    /** True when the operation failed, which is the only case the merchant gets as an error. */
    static boolean isError(KhipuResult result) {
        return "ERROR".equals(result.getResult());
    }

    // JSONObject.put with a plain Java null REMOVES the key. Passing JSONObject.NULL is
    // what keeps it present and makes it arrive in JavaScript as null, which is what iOS
    // sends and what the README documents.
    private static Object orJsonNull(String value) {
        return value == null ? JSONObject.NULL : value;
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd tests/android && ./gradlew test --tests '*KhipuResultMapperTest*'
```

Expected: 5 tests PASS.

- [ ] **Step 5: Declare it in `plugin.xml`**

```xml
    <source-file src="src/android/com/khipu/cordova/KhipuResultMapper.java" target-dir="src/com/khipu/cordova"/>
```

- [ ] **Step 6: Commit**

```bash
git add src/android/com/khipu/cordova/KhipuResultMapper.java \
        tests/android/src/test/java/com/khipu/cordova/KhipuResultMapperTest.java \
        plugin.xml
git commit -m "fix(android): build the result instead of delegating it to Gson

khipuResult.asJson() returns a String, so Android handed JavaScript a string
where iOS hands it an object. And it is Gson().toJson(this) with serializeNulls
off, so exitUrl, continueUrl and failureReason produced no key at all instead
of a null one — a merchant reading result.continueUrl got undefined on Android
and null on iOS.

Owning the shape also makes the return path checkable from source on both
platforms, which capacitor-khipu's key guard documents as impossible while the
SDK owns it."
```

---

## Task 6: The plugin class

The remaining three defects are all about *when* things happen: the callback is stored before anything is validated, the launch can throw where no `try` can catch it, and a cancellation is answered with a bare string that throws away a result the SDK built on purpose.

**Files:**
- Modify: `src/android/com/khipu/cordova/KhipuPlugin.java` (full rewrite)

**Interfaces:**
- Consumes: `KhipuOptionsMapper.parse`, `KhipuOptionsMapper.makeOptions`, `KhipuResultMapper.toJson`, `KhipuResultMapper.isError`.
- Produces: nothing later tasks call. Its correctness is covered by the mapper tests it delegates to, by the example's Android build compiling it, and by the manual check in Task 17.

- [ ] **Step 1: Replace the file**

`src/android/com/khipu/cordova/KhipuPlugin.java`:

```java
package com.khipu.cordova;

import static com.khipu.client.KhipuKt.KHIPU_RESULT_EXTRA;
import static com.khipu.client.KhipuKt.getKhipuLauncherIntent;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.khipu.client.KhipuOptions;
import com.khipu.client.KhipuResult;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicReference;

public class KhipuPlugin extends CordovaPlugin {

    private static final String TAG = "KhipuPlugin";

    private ActivityResultLauncher<Intent> launcher;

    /**
     * The call waiting for a result, or null when no operation is in flight.
     *
     * Atomic, and claimed on the calling thread, for a reason that is easy to miss: the
     * launch below happens inside runOnUiThread, so execute() returns before it runs. A
     * guard written as an assignment inside that block would let two calls in quick
     * succession both pass it, and the first callback would be lost. compareAndSet on
     * the caller's thread is what makes "one operation at a time" true.
     */
    private final AtomicReference<CallbackContext> pendingCall = new AtomicReference<>();

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
        if (!"startOperation".equals(action)) {
            return false;
        }
        startOperation(args, callbackContext);
        return true;
    }

    /**
     * Everything that can fail happens before the call is stored, and the store is the
     * last thing before the launch. The old order was the other way round — the callback
     * was kept first and the arguments read afterwards — which left a stored callback
     * that nobody would ever answer if anything in between went wrong. With a
     * one-at-a-time guard in place that is worse than a lost payment: it is a plugin
     * that rejects every operation from then on.
     */
    private void startOperation(JSONArray args, CallbackContext callbackContext) {
        Object first = args.opt(0);
        if (!(first instanceof JSONObject)) {
            callbackContext.error("startOperation expects an object as its first argument.");
            return;
        }

        JSONObject call = (JSONObject) first;
        Object operationId = call.opt("operationId");
        if (!(operationId instanceof String) || ((String) operationId).isEmpty()) {
            callbackContext.error("operationId must be provided and must be a string.");
            return;
        }

        final KhipuOptions options;
        try {
            options = KhipuOptionsMapper.makeOptions(KhipuOptionsMapper.parse(call));
        } catch (RuntimeException error) {
            callbackContext.error("Could not read the options: " + error);
            return;
        }

        // Checked before the slot is claimed, not after. A check that fails by doing
        // nothing is worse than one that throws: if the slot were already claimed and
        // the launch turned out to be impossible, nobody would answer.
        Activity activity = cordova.getActivity();
        if (activity == null || launcher == null) {
            callbackContext.error("No activity available to start the operation from.");
            return;
        }

        if (!pendingCall.compareAndSet(null, callbackContext)) {
            callbackContext.error("A Khipu operation is already in progress.");
            return;
        }

        final String id = (String) operationId;
        activity.runOnUiThread(() -> {
            // The try has to be here and not around execute(): this block runs later, on
            // the UI thread, so an exception raised in it would not pass through any
            // caller's catch — it would reach the thread's default handler and take the
            // app with it. The class of failure matters more than any particular
            // exception: if the activity never starts, no result will ever arrive, and
            // that is exactly the condition that hangs a callback forever.
            try {
                launcher.launch(getKhipuLauncherIntent(cordova.getContext(), id, options));
            } catch (RuntimeException error) {
                CallbackContext pending = pendingCall.getAndSet(null);
                if (pending != null) {
                    pending.error("Could not start the Khipu operation: " + error);
                }
            }
        });
    }

    @Override
    public void pluginInitialize() {
        super.pluginInitialize();
        launcher = cordova.getActivity().getActivityResultRegistry().register(
                "cordova_khipu_plugin",
                new ActivityResultContracts.StartActivityForResult(),
                this::deliver
        );
    }

    /**
     * Answers the pending call, and never throws.
     *
     * What decides the outcome is the payload, not the result code. The SDK has exactly
     * two exits and both carry a complete KhipuResult: the ordinary one, and an abort in
     * onCreate when the activity was destroyed for more than three minutes and the user
     * came back, which reports USER_CANCELED. Branching on the code would mean the same
     * outcome for the merchant — the user walked away — arrived in two different shapes
     * depending on whether Android killed the activity, which is an invisible timing
     * detail deciding the response format. Verified in KhipuActivity.kt:119 and :320 at
     * tag 2.28.3.
     */
    private void deliver(ActivityResult activityResult) {
        CallbackContext callbackContext = pendingCall.getAndSet(null);

        if (callbackContext == null) {
            // Reached when the host activity was destroyed during the operation: Cordova
            // rebuilt the plugin and the new instance has no callbackId, so there is
            // nobody to answer. Logging and dropping is all that is left — the previous
            // code raised an NPE here and took the app down. The README tells merchants
            // to confirm the operation's status server-side for this reason.
            Log.w(TAG, "A Khipu result arrived with no pending call; the host activity was "
                    + "probably recreated during the operation.");
            return;
        }

        try {
            KhipuResult result = extractResult(activityResult.getData());
            if (result == null) {
                callbackContext.error("The Khipu operation returned no result.");
                return;
            }

            JSONObject json = KhipuResultMapper.toJson(result);
            if (KhipuResultMapper.isError(result)) {
                callbackContext.error(json);
            } else {
                callbackContext.success(json);
            }
        } catch (Exception error) {
            callbackContext.error("Could not read the Khipu result: " + error);
        }
    }

    private static KhipuResult extractResult(Intent data) {
        if (data == null) {
            return null;
        }
        // The untyped getSerializableExtra is deprecated from API 33, but its typed
        // replacement does not exist below it and this plugin supports minSdk 24. The
        // instanceof is what the old code tried to get from `assert`, which ART ignores
        // unless assertions are explicitly enabled — so the NPE it pretended to guard
        // arrived one line later anyway.
        Object extra = data.getSerializableExtra(KHIPU_RESULT_EXTRA);
        return extra instanceof KhipuResult ? (KhipuResult) extra : null;
    }
}
```

- [ ] **Step 2: Verify it compiles**

The Gradle bed excludes this file on purpose, so the compiler that matters is the example app's:

```bash
cd example && npm install && npm run plugin:add && npx cordova platform add android@15.1.0 --nosave && npx cordova build android --debug
```

Expected: `BUILD SUCCESSFUL`. If `getKhipuLauncherIntent` or `KHIPU_RESULT_EXTRA` cannot be resolved, the SDK's Kotlin file-facade class name changed between 2.27.0 and 2.28.3 — check `com.khipu.client.KhipuKt` in the AAR before adjusting the import.

- [ ] **Step 3: Confirm the mapper tests still pass**

```bash
cd tests/android && ./gradlew test
```

Expected: PASS. This task changed no mapper, so a failure here means a source-set or exclusion mistake.

- [ ] **Step 4: Commit**

```bash
git add src/android/com/khipu/cordova/KhipuPlugin.java
git commit -m "fix(android): answer from the payload, and never lose the callback

Three defects, all about ordering.

The callback was stored before the arguments were read, so anything that threw
in between left a stored callback nobody would answer. Now everything that can
fail runs first and the store is the last step before the launch.

The launch runs inside runOnUiThread, so a try around the entry point catches
nothing: an exception there reaches the thread's default handler and takes the
app down. The try is now inside that block, and its catch clears the pending
slot — without which one failed launch would make the new one-at-a-time guard
reject every later operation.

And a non-OK result code was answered with the string \"Activity cancelled or
failed\", discarding a complete KhipuResult. The SDK's two exits both carry one;
the second fires when the activity was destroyed for over three minutes and the
user returned. The payload decides now, so the same outcome stops arriving in
two shapes depending on a timing detail."
```

---

## Task 7: One colour table on iOS too, and English identifiers

**Files:**
- Modify: `src/ios/KhipuOptionsMapper.swift`
- Modify: `tests/ios/KhipuOptionsMapperTests.swift`

**Interfaces:**
- Consumes: nothing.
- Produces: `KhipuOptionsMapper.colorSetters` — an array of `(key: String, apply: (KhipuColors.Builder, String) -> KhipuColors.Builder)` — and `colorKeys` as a computed `[String]` derived from it. `scripts/check-option-keys.js` (Task 14) parses `colorSetters`.

- [ ] **Step 1: Rewrite the mapper's colour handling and translate it**

In `src/ios/KhipuOptionsMapper.swift`, replace the `colorKeys` array and the whole `makeColors` function with:

```swift
    /// The twelve keys `KhipuColors` accepts, each paired with the setter it drives.
    ///
    /// One list rather than two. The keys and the setters used to be written out
    /// separately, which meant twelve names in one place and twelve calls in another with
    /// nothing tying them together. A key that is not here is discarded rather than
    /// propagated, so a typo in a merchant's JavaScript does not reach the SDK in silence.
    static let colorSetters: [(key: String, apply: (KhipuColors.Builder, String) -> KhipuColors.Builder)] = [
        ("lightBackground", { $0.lightBackground($1) }),
        ("lightOnBackground", { $0.lightOnBackground($1) }),
        ("lightPrimary", { $0.lightPrimary($1) }),
        ("lightOnPrimary", { $0.lightOnPrimary($1) }),
        ("lightTopBarContainer", { $0.lightTopBarContainer($1) }),
        ("lightOnTopBarContainer", { $0.lightOnTopBarContainer($1) }),
        ("darkBackground", { $0.darkBackground($1) }),
        ("darkOnBackground", { $0.darkOnBackground($1) }),
        ("darkPrimary", { $0.darkPrimary($1) }),
        ("darkOnPrimary", { $0.darkOnPrimary($1) }),
        ("darkTopBarContainer", { $0.darkTopBarContainer($1) }),
        ("darkOnTopBarContainer", { $0.darkOnTopBarContainer($1) })
    ]

    static var colorKeys: [String] {
        colorSetters.map(\.key)
    }

    static func makeColors(from colors: [String: String]) -> KhipuColors {
        var builder = KhipuColors.Builder()

        for setter in colorSetters {
            if let value = colors[setter.key] {
                builder = setter.apply(builder, value)
            }
        }

        return builder.build()
    }
```

- [ ] **Step 2: Translate the rest of the file**

Translate every doc comment and rename the Spanish locals. The reasoning must survive intact — these comments are the most valuable thing in the file. The mapping:

| Spanish | English |
| --- | --- |
| `valor` | `value` |
| `colores` | `colors` |
| `validos` | `valid` |
| `clave` | `key` |

The `KhipuOptionsInput` doc comment becomes:

```swift
/// Typed representation of the options that arrived from JavaScript.
///
/// It exists apart from `KhipuOptions` for two reasons. The practical one: that type's
/// properties are internal to `KhipuClientIOS`, so a test cannot read them back. The
/// design one: it separates what can fail — interpreting a dictionary a third party
/// built — from what cannot, which is applying already-validated values to the builder.
///
/// `nil` means "the JavaScript did not send this key", which is not the same as sending
/// it as `false`: the SDK applies its own defaults and the plugin has to let it.
```

And `parse`'s:

```swift
    /// Interprets the dictionary that arrived from JavaScript. It neither throws nor
    /// fails: a value of the wrong type is discarded as though it had never been sent.
```

- [ ] **Step 3: Translate the test names, mirroring the Java suite**

In `tests/ios/KhipuOptionsMapperTests.swift`, rename each test to the Java name with the XCTest prefix, so the two files can be read side by side:

| Now | Becomes |
| --- | --- |
| `testSinClaveOptionsDevuelveTodoNil` | `testWithNoOptionsKeyEverythingIsNil` |
| `testMapeaTodosLosCamposEscalares` | `testMapsEveryScalarField` |
| `testClaveAusenteNoSeConfundeConFalse` | `testAnAbsentKeyIsNotConfusedWithFalse` |
| `testTipoEquivocadoSeDescartaEnVezDeCrashear` | `testAWrongTypeIsDiscardedRatherThanCoerced` |
| `testThemeDesconocidoSeDescarta` | `testAnUnknownThemeIsDiscarded` |
| `testMapeaLasDoceClavesDeColor` | `testMapsTheTwelveColourKeys` |

Translate the doc comments above them too. `/// Este es el caso que hoy crashea la app.` becomes `/// This is the divergence that made Android and iOS disagree.` — the app no longer crashes here, and the comment should say what the test is actually for.

- [ ] **Step 4: Add the drift test that Java has**

Append to the Swift suite, so both platforms assert the same invariant:

```swift
    /// The keys and the setters are one list. If that ever splits again, this is the
    /// test that notices.
    func testEveryColourKeyHasASetter() {
        XCTAssertEqual(KhipuOptionsMapper.colorKeys.count, 12)
        XCTAssertEqual(KhipuOptionsMapper.colorSetters.count, KhipuOptionsMapper.colorKeys.count)
    }
```

- [ ] **Step 5: Run the tests**

```bash
xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: every test PASSES. If the simulator name is rejected, list what exists with `xcrun simctl list devices available` and use that — the 2026-09-04 spec recorded the same friction.

- [ ] **Step 6: Commit**

```bash
git add src/ios/KhipuOptionsMapper.swift tests/ios/KhipuOptionsMapperTests.swift
git commit -m "refactor(ios): pair each colour key with its setter, and move to English

The twelve keys were a list and the twelve setter calls were a function, with
nothing tying them together. They are now one array, and a test on each platform
keeps its length honest.

Test names now match the Java suite one-to-one so the two files can be read
side by side."
```

---

## Task 8: iOS symmetry

**Files:**
- Modify: `src/ios/KhipuPlugin.swift`

**Interfaces:**
- Consumes: nothing.
- Produces: the eight-key dictionary that `scripts/check-option-keys.js` (Task 14) parses out of `completion([...])`.

- [ ] **Step 1: Make the null bridging explicit**

Replace the `completion([...])` call with:

```swift
            KhipuLauncher.launch(presenter: presenter,
                                 operationId: operationId,
                                 options: options) { result in
                completion([
                    "operationId": result.operationId,
                    "result": result.result,
                    "exitTitle": result.exitTitle,
                    "exitMessage": result.exitMessage,
                    "exitUrl": Self.jsonValue(result.exitUrl),
                    "failureReason": Self.jsonValue(result.failureReason),
                    "continueUrl": Self.jsonValue(result.continueUrl),
                    "events": result.events.map { event in
                        return [
                            "name": event.name,
                            "type": event.type,
                            "timestamp": event.timestamp
                        ]
                    }
                ], nil)
            }
```

And add the helper:

```swift
    /// `NSNull` rather than a bridged `nil`.
    ///
    /// `result.exitUrl as Any` did reach JavaScript as `null`, because Swift bridges a
    /// nil optional in an `Any` to `NSNull`. Saying so explicitly costs one function and
    /// means the behaviour is a decision rather than a property of the bridge, and it
    /// reads the same as Android's `JSONObject.NULL`, which is the other half of the same
    /// contract.
    private static func jsonValue(_ value: String?) -> Any {
        if let value = value {
            return value
        }
        return NSNull()
    }
```

- [ ] **Step 2: Narrow the helpers to `private`**

`startKhipuOperation` and `handleError` are `internal`, while `presenter()` is `private` and says why: the plugin links statically inside the merchant's app, so its surface there should be as small as possible. That reasoning covers all three. Change both to `private func`.

- [ ] **Step 3: Translate the comments**

Translate the `presenter()` doc comment and the `canImport(Cordova)` note, keeping every reason. The `presenter()` comment becomes:

```swift
    /// The controller to present Khipu's view from.
    ///
    /// It starts at `self.viewController`, which is the one Cordova associates with the
    /// webview the call came from. That is a better starting point than
    /// `UIApplication.shared.windows`: that API has been deprecated since iOS 15 — with
    /// no compiler warning at an iOS 13 floor — and it returns windows from every
    /// connected scene, including ones that are not on screen.
    ///
    /// From there it walks down the chain of presented controllers. UIKit refuses to
    /// present on a controller that is already presenting something, so a merchant who
    /// calls the plugin with their own modal up would see nothing. This used to be
    /// handled by dismissing whatever was there — closing the merchant's own modal — and
    /// waiting a fixed second for it to finish; walking the chain destroys nothing and
    /// needs no wait.
    ///
    /// Kept private to the plugin rather than as a `UIViewController` extension: the
    /// plugin links statically inside the merchant's app, where an extension with a name
    /// like this could collide with theirs.
```

And rename the loop's `presentado` to `presented`.

- [ ] **Step 4: Run the tests**

```bash
xcodebuild test -scheme cordova-khipu -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: PASS. No test covers the result dictionary — `KhipuResult`'s initialiser may be internal to the SDK, which spec §10 anticipated. Check with a throwaway line in the test file; if it can be constructed, add a mirror of `KhipuResultMapperTest.emitsTheEightKeys` and delete the throwaway. If it cannot, leave the return path to the key guard and say so in the commit message.

- [ ] **Step 5: Commit**

```bash
git add src/ios/KhipuPlugin.swift
git commit -m "refactor(ios): make the null bridging explicit and narrow the helpers

\`result.exitUrl as Any\` did arrive in JavaScript as null, because Swift bridges
a nil optional inside an Any to NSNull. Saying NSNull outright makes that a
decision rather than a property of the bridge, and it now reads the same as
Android's JSONObject.NULL.

startKhipuOperation and handleError become private, which is already the stated
criterion for presenter(): the plugin links statically inside the merchant's app."
```

---

## Task 9: A surgical version rewrite

`update-plugin-version.js` round-trips the whole `plugin.xml` through the xml2js `Builder`, which reformats it. That is what forced the attribute-order-tolerant regexes in `check-native-versions.js`, which its own comments cite.

**Files:**
- Modify: `scripts/update-plugin-version.js`
- Create: `tests/scripts/update-plugin-version.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `module.exports = { withVersion }` — `withVersion(pluginXml: string, version: string) -> string`, pure, and a `main()` that reads and writes the files.

- [ ] **Step 1: Write the failing test**

`tests/scripts/update-plugin-version.test.js`:

```javascript
const assert = require('node:assert');
const { test } = require('node:test');

const { withVersion } = require('../../scripts/update-plugin-version.js');

test('replaces the version on the plugin tag', () => {
    const xml = '<plugin id="cordova-khipu" version="2.10.1" xmlns="http://apache.org/cordova/ns/plugins/1.0">\n</plugin>\n';

    assert.match(withVersion(xml, '2.11.0'), /<plugin id="cordova-khipu" version="2\.11\.0"/);
});

test('leaves the rest of the file byte for byte', () => {
    const xml = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<plugin id="cordova-khipu" version="2.10.1">',
        '  <!-- a comment the old script deleted -->',
        '  <engine name="cordova-ios" version=">=7.0.0"/>',
        '</plugin>',
        ''
    ].join('\n');

    const updated = withVersion(xml, '2.11.0');

    assert.strictEqual(updated, xml.replace('version="2.10.1"', 'version="2.11.0"'));
    assert.ok(updated.includes('a comment the old script deleted'));
});

test('does not touch the version of the xml declaration or of an engine', () => {
    const xml = '<?xml version="1.0"?>\n<plugin id="x" version="1.0.0">\n<engine name="cordova-ios" version=">=7.0.0"/>\n</plugin>';

    const updated = withVersion(xml, '2.11.0');

    assert.ok(updated.includes('<?xml version="1.0"?>'));
    assert.ok(updated.includes('name="cordova-ios" version=">=7.0.0"'));
    assert.ok(updated.includes('<plugin id="x" version="2.11.0">'));
});

test('refuses a file whose plugin tag has no version', () => {
    assert.throws(
        () => withVersion('<plugin id="cordova-khipu">\n</plugin>', '2.11.0'),
        /does not declare a version/
    );
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node --test tests/scripts/update-plugin-version.test.js
```

Expected: FAIL — `withVersion is not a function`.

- [ ] **Step 3: Rewrite the script**

`scripts/update-plugin-version.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

// Rewrites one attribute and nothing else.
//
// This used to parse plugin.xml with xml2js and write it back out through the Builder,
// which reformats the whole file: attribute order, self-closing tags, the declaration,
// and any comment. check-native-versions.js still carries attribute-order-tolerant
// regexes that were written for that reformatting. Replacing just the attribute keeps
// the file the author wrote.
function withVersion (pluginXml, version) {
    // The <plugin> tag is isolated first because `version` also appears in the XML
    // declaration and on every <engine>.
    const pluginTag = pluginXml.match(/<plugin\b[^>]*>/);

    if (!pluginTag) {
        throw new Error('plugin.xml has no <plugin> tag');
    }

    if (!/\bversion="[^"]*"/.test(pluginTag[0])) {
        throw new Error('the <plugin> tag of plugin.xml does not declare a version');
    }

    const updatedTag = pluginTag[0].replace(/\bversion="[^"]*"/, `version="${version}"`);

    return pluginXml.slice(0, pluginTag.index) +
        updatedTag +
        pluginXml.slice(pluginTag.index + pluginTag[0].length);
}

function main () {
    const root = path.resolve(__dirname, '..');
    const pluginXmlPath = path.join(root, 'plugin.xml');
    const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

    fs.writeFileSync(
        pluginXmlPath,
        withVersion(fs.readFileSync(pluginXmlPath, 'utf-8'), version),
        'utf-8'
    );

    console.log(`update-plugin-version: plugin.xml set to ${version}.`);
}

module.exports = { withVersion };

if (require.main === module) {
    main();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
node --test tests/scripts/
```

Expected: every test PASSES, the new file included.

- [ ] **Step 5: Verify it is a no-op right now**

```bash
node scripts/update-plugin-version.js && git diff --stat plugin.xml
```

Expected: the script prints `plugin.xml set to 2.10.1` and `git diff` shows **nothing** — `package.json` and `plugin.xml` already agree, so a correct surgical rewrite changes no bytes. The old script would have reformatted the file here.

- [ ] **Step 6: Drop the now-unused dependency**

`xml2js` was only used by this script. Confirm and remove:

```bash
grep -rn "xml2js" scripts/ tests/ *.js 2>/dev/null; npm uninstall xml2js
```

Expected: the grep finds nothing, and `package.json` loses the `xml2js` devDependency.

- [ ] **Step 7: Correct the stale comments in `check-native-versions.js`**

Two comments justify their regexes by saying `update-plugin-version.js` rewrites the file with xml2js on every release. That is no longer true. Keep the tolerant regexes — they cost nothing and a hand edit can still reorder attributes — but change both comments to say so:

```javascript
    // The <pod> tags are isolated first and the version extracted afterwards, so this
    // does not depend on attribute order: a hand edit can reorder them.
```

- [ ] **Step 8: Commit**

```bash
git add scripts/update-plugin-version.js scripts/check-native-versions.js \
        tests/scripts/update-plugin-version.test.js package.json package-lock.json
git commit -m "refactor(release): rewrite only the version attribute of plugin.xml

The script parsed the whole file with xml2js and wrote it back through the
Builder, which reformats everything and deletes comments. That reformatting is
why check-native-versions.js carries attribute-order-tolerant regexes. Replacing
just the attribute leaves the file as its author wrote it, and the release no
longer has an unrelated diff in it.

Drops the xml2js dependency, which nothing else used, and gives the script its
first tests."
```

---

## Task 10: Harden the Kotlin hook

`enable-gradle-kotlin-plugin.js` is the only script with no tests, reads JSON with `require` (which caches the module and then mutates it), and never says why it exists.

**Files:**
- Modify: `scripts/enable-gradle-kotlin-plugin.js`
- Create: `tests/scripts/enable-gradle-kotlin-plugin.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `module.exports` stays the Cordova hook `(context) => void`, plus `module.exports.enableKotlin = (configPath: string) => 'enabled' | 'already-enabled' | 'missing'` for the tests.

- [ ] **Step 1: Write the failing test**

`tests/scripts/enable-gradle-kotlin-plugin.test.js`:

```javascript
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { enableKotlin } = require('../../scripts/enable-gradle-kotlin-plugin.js');

function aConfigFile (contents) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'khipu-hook-'));
    const file = path.join(directory, 'cdv-gradle-config.json');
    fs.writeFileSync(file, JSON.stringify(contents, null, 4), 'utf-8');
    return file;
}

test('turns the flag on and keeps every other key', () => {
    const file = aConfigFile({ MIN_SDK_VERSION: 24, IS_GRADLE_PLUGIN_KOTLIN_ENABLED: false });

    assert.strictEqual(enableKotlin(file), 'enabled');

    const written = JSON.parse(fs.readFileSync(file, 'utf-8'));
    assert.strictEqual(written.IS_GRADLE_PLUGIN_KOTLIN_ENABLED, true);
    assert.strictEqual(written.MIN_SDK_VERSION, 24);
});

test('does not rewrite a file that is already enabled', () => {
    const file = aConfigFile({ IS_GRADLE_PLUGIN_KOTLIN_ENABLED: true });
    const before = fs.statSync(file).mtimeMs;

    assert.strictEqual(enableKotlin(file), 'already-enabled');
    assert.strictEqual(fs.statSync(file).mtimeMs, before);
});

test('reports a missing file instead of throwing', () => {
    assert.strictEqual(enableKotlin(path.join(os.tmpdir(), 'nope', 'cdv-gradle-config.json')), 'missing');
});

test('reads from disk rather than from the module cache', () => {
    const file = aConfigFile({ IS_GRADLE_PLUGIN_KOTLIN_ENABLED: false });

    enableKotlin(file);
    fs.writeFileSync(file, JSON.stringify({ IS_GRADLE_PLUGIN_KOTLIN_ENABLED: false }), 'utf-8');

    // With `require`, the second call would see the cached first read and report
    // already-enabled without touching the file.
    assert.strictEqual(enableKotlin(file), 'enabled');
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node --test tests/scripts/enable-gradle-kotlin-plugin.test.js
```

Expected: FAIL — `enableKotlin is not a function`.

- [ ] **Step 3: Rewrite the hook**

`scripts/enable-gradle-kotlin-plugin.js`:

```javascript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
node --test tests/scripts/
```

Expected: all PASS.

- [ ] **Step 5: Confirm the Android build still works**

The hook's real test is a build. Reuse Task 6's:

```bash
cd example && npm run reset && npm run plugin:add && npx cordova platform add android@15.1.0 --nosave && npx cordova build android --debug
```

Expected: `BUILD SUCCESSFUL`, and the log line `cordova-khipu: set IS_GRADLE_PLUGIN_KOTLIN_ENABLED = true` appears exactly once.

- [ ] **Step 6: Commit**

```bash
git add scripts/enable-gradle-kotlin-plugin.js tests/scripts/enable-gradle-kotlin-plugin.test.js
git commit -m "refactor(android): explain, harden and test the Kotlin hook

It read JSON with require, which caches the parsed module and then mutated it;
it warned about a missing config file on iOS-only prepares, where there is
nothing to do; it rewrote the file even when the flag was already on; and it
never said why the flag has to be set at all. It was also the only script with
no tests."
```

---

## Task 11: Guard the Android pin, and delete the dead XML

**Files:**
- Modify: `scripts/check-native-versions.js`
- Modify: `tests/scripts/check-native-versions.test.js`
- Modify: `plugin.xml`

**Interfaces:**
- Consumes: `compare` and `compararVersionDelPlugin` as they exist today.
- Produces: `module.exports = { compare, comparePluginVersion, compareAndroidPin }`. **Note the rename**: `compararVersionDelPlugin` becomes `comparePluginVersion` under the English-only constraint, and the existing test file has to be updated with it.

- [ ] **Step 1: Write the failing test**

Append to `tests/scripts/check-native-versions.test.js`:

```javascript
test('accepts a pinned Android SDK', () => {
    const gradle = "dependencies {\n    implementation 'com.khipu:khipu-client-android:2.28.3'\n}\n";

    const result = compareAndroidPin(gradle);

    assert.strictEqual(result.ok, true);
    assert.match(result.message, /2\.28\.0/);
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
    assert.match(result.message, /2\.28\.0/);
});
```

Add `compareAndroidPin` to that file's `require` destructuring, and rename `compararVersionDelPlugin` to `comparePluginVersion` in its existing tests.

- [ ] **Step 2: Run it to verify it fails**

```bash
node --test tests/scripts/check-native-versions.test.js
```

Expected: FAIL — `compareAndroidPin is not a function`.

- [ ] **Step 3: Add the check**

In `scripts/check-native-versions.js`, rename `compararVersionDelPlugin` to `comparePluginVersion` (and its internal Spanish identifiers to English), then add:

```javascript
// The floor is not arbitrary. khipu-client-android 2.27.0 pins khenshin protocol 1.0.59,
// whose FailureReasonType enum has fourteen constants and no USER_DISCONNECTED. Its
// forValue() throws IOException on an unknown value, and the SDK's OPERATION_FAILURE
// listener calls the converter with no try/catch on socket.io's EventThread — so that
// throw is uncaught and kills the merchant's app process. 2.28.0 pins 1.0.60, which has
// the fifteenth constant. 2.28.1 then guarded the listeners so no deserialization failure
// reaches the EventThread at all, and 2.28.3 added OPERATION_WARNING to the guard's
// terminal types — without which an OPERATION_WARNING that failed to parse left the
// operation unfinished and its callback never fired.
//
// This is a floor, not a mirror of the pin: khipu.gradle can move above it freely and this
// check does not care. Raise the floor only when a release fixes something the plugin
// depends on, which is what 2.28.0, 2.28.1 and 2.28.3 each did.
//
// tests/android/ asserts the same floor at runtime; this catches it at publish time,
// before anyone runs a test.
const ANDROID_SDK_FLOOR = '2.28.3';

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
```

Then add it to `main()`'s results array and to the exports:

```javascript
    const resultados = [
        compare(/* ... unchanged ... */),
        comparePluginVersion(packageJson.version, pluginXml),
        compareAndroidPin(fs.readFileSync(path.join(root, 'src', 'android', 'khipu.gradle'), 'utf-8'))
    ];
```

```javascript
module.exports = { compare, comparePluginVersion, compareAndroidPin };
```

- [ ] **Step 4: Run the tests and the guard**

```bash
node --test tests/scripts/ && npm run verify:versions
```

Expected: tests PASS, and the guard prints three green lines, the third naming `khipu-client-android 2.28.3`.

- [ ] **Step 5: Delete the dead config-file**

In `plugin.xml`, remove this line entirely — it declares no edit and does nothing:

```xml
    <config-file parent="/*" target="AndroidManifest.xml"/>
```

- [ ] **Step 6: Confirm nothing depended on it**

```bash
cd example && npm run reset && npm run plugin:add && npx cordova platform add android@15.1.0 --nosave && npx cordova build android --debug
```

Expected: `BUILD SUCCESSFUL`. The SDK's own manifest declares `KhipuActivity` and the manifest merger injects it, so nothing in the merchant's manifest was ever coming from us.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-native-versions.js tests/scripts/check-native-versions.test.js plugin.xml
git commit -m "fix(release): guard the Android SDK floor, and drop a dead config-file

The Android SDK version lives in one file, so there is no sync to break, but
nothing asserted the line even parsed — and there is now a floor worth
enforcing: below 2.28.3 the SDK carries khenshin protocol 1.0.59, which kills
the app process on a USER_DISCONNECTED failure reason. The Gradle suite asserts
that floor at test time; this catches it at publish time.

Also deletes an empty <config-file target=\"AndroidManifest.xml\"/> that declared
no edit, and renames the Spanish helper to English."
```

---

## Task 12: The contract of record

The README already has correct `KhipuResult` and `KhipuEvent` tables. Turning them into declarations costs little and gives merchants editor completion — and gives the key guard something to compare against.

**Files:**
- Create: `types/index.d.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the exported interfaces `KhipuOptions`, `KhipuColors`, `KhipuResult`, `KhipuEvent`, `KhipuCall` and the type aliases `KhipuTheme`, `KhipuResultStatus`. Task 14's guard parses this file; Task 13 documents against it.

- [ ] **Step 1: Write the declarations**

`types/index.d.ts`:

```typescript
// The contract of record for this plugin.
//
// Three surfaces read these key names — the Swift mapper, the Java mapper and the
// example harness — and none of them can detect a rename in the others: the contract
// between JavaScript and native is strings, so a renamed key leaves a flag with no
// effect and no error. scripts/check-option-keys.js compares all of them against this
// file, which is why the interfaces below are the source of truth rather than a
// convenience.

export type KhipuTheme = 'light' | 'dark' | 'system';

export type KhipuResultStatus = 'OK' | 'ERROR' | 'WARNING' | 'CONTINUE';

/** Hex colours, as `#rrggbb`. Every one is optional; the SDK has its own palette. */
export interface KhipuColors {
  lightBackground?: string;
  lightOnBackground?: string;
  lightPrimary?: string;
  lightOnPrimary?: string;
  lightTopBarContainer?: string;
  lightOnTopBarContainer?: string;
  darkBackground?: string;
  darkOnBackground?: string;
  darkPrimary?: string;
  darkOnPrimary?: string;
  darkTopBarContainer?: string;
  darkOnTopBarContainer?: string;
}

export interface KhipuOptions {
  /** Title for the top bar during the payment. */
  title?: string;
  /** URL of an image to show centred in the top bar. */
  titleImageUrl?: string;
  /**
   * Interface language, as an ISO 639-1 language and an ISO 3166 country, e.g. `es_CL`.
   *
   * Send it always. Left out, the language differs between platforms: KhipuClientIOS
   * defaults to `es_CL`, while khipu-client-android leaves it undefined and resolves it
   * from the device. Same payload, two languages.
   */
  locale?: string;
  theme?: KhipuTheme;
  /** Show a message with the Khipu logo at the bottom. */
  showFooter?: boolean;
  /** Show the merchant's logo in the top bar. */
  showMerchantLogo?: boolean;
  /** Show the payment code and a link to its details. */
  showPaymentDetails?: boolean;
  /** Skip the exit page at the end of the payment, successful or not. */
  skipExitPage?: boolean;
  /** Skip the exit page only when the payment succeeded. */
  skipExitSuccessPage?: boolean;
  colors?: KhipuColors;
}

export interface KhipuEvent {
  name: string;
  type: string;
  timestamp: string;
}

export interface KhipuResult {
  operationId: string;
  result: KhipuResultStatus;
  exitTitle: string;
  exitMessage: string;
  /**
   * Careful: this arrives as an empty string, not as null, on a real cancellation —
   * while `continueUrl` arrives as null. Check for falsiness, not for `=== null`.
   */
  exitUrl: string | null;
  failureReason: string | null;
  continueUrl: string | null;
  events: KhipuEvent[];
}

export interface KhipuCall {
  operationId: string;
  options?: KhipuOptions;
}

export interface KhipuPlugin {
  /**
   * Starts a payment. Called with callbacks, it returns nothing; called without them, it
   * returns a promise.
   *
   * The promise rejects, and the error callback fires, with a `KhipuResult` whose
   * `result` is `'ERROR'` — or with a string when the failure happened before the
   * operation started at all.
   */
  startOperation(
    call: KhipuCall,
    success: (result: KhipuResult) => void,
    error: (failure: KhipuResult | string) => void
  ): void;
  startOperation(call: KhipuCall): Promise<KhipuResult>;
}

declare global {
  interface Window {
    Khipu: KhipuPlugin;
  }
}

declare const Khipu: KhipuPlugin;

export default Khipu;
```

- [ ] **Step 2: Point `package.json` at it**

Add `"types": "types/index.d.ts"` beside `"description"`, and add `"types/"` to the `files` array so it ships.

- [ ] **Step 3: Verify it type-checks**

```bash
npx --yes typescript@5 --noEmit --strict types/index.d.ts && echo "declarations OK"
```

Expected: `declarations OK`.

- [ ] **Step 4: Verify it ships**

```bash
npm pack --dry-run 2>&1 | grep -c 'types/index.d.ts'
```

Expected: `1`.

- [ ] **Step 5: Commit**

```bash
git add types/index.d.ts package.json
git commit -m "feat: ship TypeScript declarations

The README already described every option and result key correctly. Declaring
them gives merchants completion and gives the key guard a contract of record to
compare the three reading surfaces against."
```

---

## Task 13: The JavaScript surface

Seven lines with no documentation, no validation and no promise, against two sibling plugins that are both async.

**Files:**
- Modify: `www/cordova-khipu.js`
- Create: `tests/js/cordova-khipu.test.js`
- Modify: `package.json` (widen the `test` script)

**Interfaces:**
- Consumes: the types from Task 12 (as documentation, not as a runtime import).
- Produces: `startOperation(call, success, error) -> void` and `startOperation(call) -> Promise<KhipuResult>`.

- [ ] **Step 1: Write the failing test**

`tests/js/cordova-khipu.test.js`:

```javascript
const assert = require('node:assert');
const Module = require('node:module');
const { test } = require('node:test');

// `cordova/exec` only exists inside a Cordova webview. Intercepting require is how the
// module under test can be loaded here at all, and it keeps www/cordova-khipu.js in the
// exact shape Cordova expects rather than bending it for testability.
const calls = [];
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
    if (id === 'cordova/exec') {
        return function (success, error, service, action, args) {
            calls.push({ success, error, service, action, args });
        };
    }
    return originalRequire.apply(this, arguments);
};

const Khipu = require('../../www/cordova-khipu.js');

test.afterEach(() => {
    calls.length = 0;
});

test('passes the call through to the native side', () => {
    const success = () => {};
    const error = () => {};

    Khipu.startOperation({ operationId: 'op-1', options: { title: 'Demo' } }, success, error);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].service, 'cordova-khipu');
    assert.strictEqual(calls[0].action, 'startOperation');
    assert.deepStrictEqual(calls[0].args, [{ operationId: 'op-1', options: { title: 'Demo' } }]);
    assert.strictEqual(calls[0].success, success);
});

test('rejects a missing operationId without crossing to native', () => {
    let failure = null;

    Khipu.startOperation({ options: {} }, () => {}, (error) => { failure = error; });

    assert.strictEqual(calls.length, 0, 'nothing should have reached the native side');
    assert.strictEqual(failure, 'operationId must be provided and must be a string.');
});

test('rejects a non-string operationId', () => {
    let failure = null;

    Khipu.startOperation({ operationId: 42 }, () => {}, (error) => { failure = error; });

    assert.strictEqual(calls.length, 0);
    assert.match(failure, /must be a string/);
});

test('rejects a call that is not an object', () => {
    let failure = null;

    Khipu.startOperation('op-1', () => {}, (error) => { failure = error; });

    assert.strictEqual(calls.length, 0);
    assert.match(failure, /expects an object/);
});

test('returns a promise when no callbacks are given', async () => {
    const pending = Khipu.startOperation({ operationId: 'op-1' });

    assert.ok(pending instanceof Promise);
    assert.strictEqual(calls.length, 1);

    calls[0].success({ operationId: 'op-1', result: 'OK' });

    assert.deepStrictEqual(await pending, { operationId: 'op-1', result: 'OK' });
});

test('the promise rejects with what native sent', async () => {
    const pending = Khipu.startOperation({ operationId: 'op-1' });

    calls[0].error({ operationId: 'op-1', result: 'ERROR', failureReason: 'USER_CANCELED' });

    await assert.rejects(pending, (thrown) => thrown.failureReason === 'USER_CANCELED');
});

test('the promise rejects on invalid input without crossing to native', async () => {
    await assert.rejects(Khipu.startOperation({}), /operationId must be provided/);
    assert.strictEqual(calls.length, 0);
});

test('returns undefined when callbacks are given', () => {
    assert.strictEqual(Khipu.startOperation({ operationId: 'op-1' }, () => {}, () => {}), undefined);
});
```

- [ ] **Step 2: Widen the test script and run it**

In `package.json`, change `test` to:

```json
    "test": "node --test tests/scripts/ tests/js/",
```

```bash
npm test
```

Expected: FAIL — the new file's assertions fail because there is no validation and no promise yet.

- [ ] **Step 3: Rewrite the module**

`www/cordova-khipu.js`:

```javascript
var exec = require('cordova/exec');

var SERVICE = 'cordova-khipu';
var ACTION = 'startOperation';

/**
 * Starts a Khipu payment.
 *
 * Called with callbacks it returns nothing; called without them it returns a promise.
 * Both forms reach the same native code — the promise is a wrapper, not a second path.
 *
 * Note that the option names here are not the SDK's: `title` becomes the SDK's
 * `topBarTitle` and `titleImageUrl` becomes `topBarImageUrl`. The mapping lives in the
 * native mappers and the full vocabulary is declared in types/index.d.ts.
 *
 * @param {{operationId: string, options?: object}} call The payment and its options.
 * @param {function(object):void} [success] Called with a KhipuResult when the operation
 *   finished, including when the payer cancelled.
 * @param {function(object|string):void} [error] Called with a KhipuResult whose `result`
 *   is 'ERROR', or with a string when the failure happened before the operation started.
 * @returns {Promise<object>|undefined} A promise when no callbacks were given.
 */
function startOperation (call, success, error) {
    // Validated here rather than in native, so a mistake in a merchant's own code is
    // reported the same way on both platforms and without a round trip.
    var invalid = whyInvalid(call);
    var wantsPromise = typeof success !== 'function' && typeof error !== 'function';

    if (wantsPromise) {
        return new Promise(function (resolve, reject) {
            if (invalid) {
                reject(new Error(invalid));
                return;
            }
            exec(resolve, reject, SERVICE, ACTION, [call]);
        });
    }

    if (invalid) {
        if (typeof error === 'function') {
            error(invalid);
        }
        return undefined;
    }

    exec(success, error, SERVICE, ACTION, [call]);

    return undefined;
}

// The wording matches the native checks on purpose: the same mistake should read the
// same whether it was caught here or on the other side of the bridge.
function whyInvalid (call) {
    if (call === null || typeof call !== 'object') {
        return 'startOperation expects an object as its first argument.';
    }

    if (typeof call.operationId !== 'string' || call.operationId.length === 0) {
        return 'operationId must be provided and must be a string.';
    }

    return null;
}

module.exports = {
    startOperation: startOperation
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: every test PASSES, in `tests/scripts/` and `tests/js/`.

- [ ] **Step 5: Confirm the native messages still match**

```bash
grep -rn "must be provided and must be a string" www/ src/
```

Expected: three hits — the JS, `KhipuPlugin.java`, `KhipuPlugin.swift`. If Swift's differs, align it; the promise of one wording across platforms is only as good as this grep.

- [ ] **Step 6: Commit**

```bash
git add www/cordova-khipu.js tests/js/cordova-khipu.test.js package.json
git commit -m "feat: document the JS surface, validate locally, return a promise

Seven lines with no documentation, no validation and no promise, against two
sibling plugins that are both async. The promise is additive: existing callback
code is untouched, and it appears only when the callbacks are omitted.

Invalid input is now rejected in JavaScript with the same wording the native
side uses, so the same mistake reads the same on both platforms and costs no
round trip."
```

---

## Task 14: The key-drift guard

**Files:**
- Create: `scripts/check-option-keys.js`
- Create: `tests/scripts/check-option-keys.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `types/index.d.ts` (Task 12), `colorSetters` in the Swift mapper (Task 7), `COLOR_KEYS` in the Java mapper (Task 3), the `completion([...])` dictionary in `KhipuPlugin.swift` (Task 8), the `json.put` keys in `KhipuResultMapper.java` (Task 5), and the harness constants renamed in Task 15.
- Produces: `module.exports = { compareSurfaces }` — `compareSurfaces(sources: object) -> {ok, message}` — plus `npm run verify:keys`.

- [ ] **Step 1: Write the guard**

`scripts/check-option-keys.js`:

```javascript
#!/usr/bin/env node
/**
 * Fails when the surfaces that declare the option and result vocabulary stop agreeing.
 *
 * The contract between JavaScript and native is strings: types/index.d.ts declares it,
 * the Swift and Java mappers read it, and the example harness offers it. Renaming a key
 * in one surface leaves the flag with no effect **and no error** — no test on either
 * side can detect a drift in the other.
 *
 * It also covers the way back, native to JavaScript: the keys KhipuPlugin.swift builds
 * its dictionary from and the ones KhipuResultMapper.java puts, against the KhipuResult
 * interface. capacitor-khipu's version of this guard could not check that half, because
 * its Android plugin delegated the whole shape of the result to the SDK's asJson(). This
 * plugin builds it, so both halves are checkable here.
 *
 * The harness is compared on options only, not on results: it renders a chosen subset of
 * the result fields, and coupling it to all eight would be a false constraint.
 *
 * On fragility: this parses source with regular expressions. The failure direction is
 * the right one — the check breaks and somebody looks, rather than passing while the
 * protocol drifted — but a broken parser could report "everything matches" with zero
 * keys everywhere. Hence the sanity floor below.
 */
const fs = require('node:fs');
const path = require('node:path');

const FLOOR = { options: 10, colors: 12, result: 8 };

function keysMatching (source, pattern) {
    return new Set([...source.matchAll(pattern)].map(match => match[1]));
}

function interfaceKeys (declarations, name) {
    const block = declarations.match(new RegExp(`export interface ${name} \\{(.*?)\\n\\}`, 's'));

    if (!block) {
        return null;
    }

    return keysMatching(block[1], /^\s{2}(\w+)\??:/gm);
}

function difference (left, right) {
    return [...left].filter(key => !right.has(key));
}

function compareSurfaces (sources) {
    const contract = {
        options: interfaceKeys(sources.declarations, 'KhipuOptions'),
        colors: interfaceKeys(sources.declarations, 'KhipuColors'),
        result: interfaceKeys(sources.declarations, 'KhipuResult')
    };

    for (const [name, keys] of Object.entries(contract)) {
        if (!keys) {
            return { ok: false, message: `could not read the ${name} interface from types/index.d.ts; this guard's parser is out of date` };
        }
    }

    contract.options.delete('colors');

    // The floor: if the contract reads nearly empty, what broke is the parser.
    for (const [name, floor] of Object.entries(FLOOR)) {
        if (contract[name].size < floor) {
            return { ok: false, message: `read only ${contract[name].size} ${name} keys from types/index.d.ts, expected at least ${floor}; this guard's parser is out of date` };
        }
    }

    const surfaces = [
        {
            what: 'options',
            expected: contract.options,
            found: {
                'the Swift mapper': keysMatching(sources.swiftMapper, /options\["(\w+)"\]/g),
                'the Java mapper': keysMatching(sources.javaMapper, /(?:stringOrNull|booleanOrNull|objectOrNull)\(options, "(\w+)"\)/g),
                'the example harness': new Set([
                    ...keysMatching(sources.harness, /\{ key: '(\w+)'/g),
                    ...keysMatching(sources.harness, /^\s{2}'(\w+)',?$/gm)
                ])
            }
        },
        {
            what: 'colors',
            expected: contract.colors,
            found: {
                'the Swift colour table': keysMatching(sources.swiftMapper, /\("(\w+)", \{ \$0\./g),
                'the Java colour table': keysMatching(sources.javaMapper, /setters\.put\("(\w+)"/g),
                'the example harness': keysMatching(sources.harnessColors, /'(\w+)'/g)
            }
        },
        {
            what: 'result',
            expected: contract.result,
            found: {
                'the Swift result dictionary': keysMatching(sources.swiftPlugin, /"(\w+)":/g),
                'the Java result mapper': keysMatching(sources.javaResultMapper, /json\.put\("(\w+)"/g)
            }
        }
    ];

    for (const surface of surfaces) {
        for (const [name, found] of Object.entries(surface.found)) {
            const missing = difference(surface.expected, found);
            const extra = difference(found, surface.expected);

            if (missing.length > 0 || extra.length > 0) {
                return {
                    ok: false,
                    message: `${name} disagrees with types/index.d.ts on ${surface.what}` +
                        (missing.length > 0 ? `; missing: ${missing.join(', ')}` : '') +
                        (extra.length > 0 ? `; unexpected: ${extra.join(', ')}` : '')
                };
            }
        }
    }

    return {
        ok: true,
        message: `${contract.options.size} option keys, ${contract.colors.size} colour keys and ${contract.result.size} result keys agree across every surface`
    };
}

function read (root, ...parts) {
    return fs.readFileSync(path.join(root, ...parts), 'utf-8');
}

function main () {
    const root = path.resolve(__dirname, '..');
    const harness = read(root, 'example', 'www', 'js', 'harness.js');
    // The colour list is isolated so the option patterns cannot pick colour keys up out
    // of the same file, and vice versa.
    const [beforeColors, afterColors] = harness.split('var COLOR_KEYS');

    if (afterColors === undefined) {
        console.error('check-option-keys: could not find COLOR_KEYS in the example harness; this guard\'s parser is out of date');
        process.exit(1);
    }

    const result = compareSurfaces({
        declarations: read(root, 'types', 'index.d.ts'),
        swiftMapper: read(root, 'src', 'ios', 'KhipuOptionsMapper.swift'),
        swiftPlugin: read(root, 'src', 'ios', 'KhipuPlugin.swift'),
        javaMapper: read(root, 'src', 'android', 'com', 'khipu', 'cordova', 'KhipuOptionsMapper.java'),
        javaResultMapper: read(root, 'src', 'android', 'com', 'khipu', 'cordova', 'KhipuResultMapper.java'),
        harness: beforeColors,
        harnessColors: afterColors.split('];')[0]
    });

    console.log(`check-option-keys: ${result.message}.`);

    if (!result.ok) {
        process.exit(1);
    }
}

module.exports = { compareSurfaces };

if (require.main === module) {
    main();
}
```

- [ ] **Step 2: Write its tests**

`tests/scripts/check-option-keys.test.js`:

```javascript
const assert = require('node:assert');
const { test } = require('node:test');

const { compareSurfaces } = require('../../scripts/check-option-keys.js');

const OPTION_KEYS = ['title', 'titleImageUrl', 'locale', 'theme', 'showFooter',
    'showMerchantLogo', 'showPaymentDetails', 'skipExitPage', 'skipExitSuccessPage'];
const COLOR_KEYS = ['lightBackground', 'lightOnBackground', 'lightPrimary', 'lightOnPrimary',
    'lightTopBarContainer', 'lightOnTopBarContainer', 'darkBackground', 'darkOnBackground',
    'darkPrimary', 'darkOnPrimary', 'darkTopBarContainer', 'darkOnTopBarContainer'];
const RESULT_KEYS = ['operationId', 'result', 'exitTitle', 'exitMessage', 'exitUrl',
    'failureReason', 'continueUrl', 'events'];

function sources (overrides = {}) {
    return Object.assign({
        declarations: [
            'export interface KhipuOptions {',
            ...OPTION_KEYS.map(key => `  ${key}?: string;`),
            '  colors?: KhipuColors;',
            '}',
            '',
            'export interface KhipuColors {',
            ...COLOR_KEYS.map(key => `  ${key}?: string;`),
            '}',
            '',
            'export interface KhipuResult {',
            ...RESULT_KEYS.map(key => `  ${key}: string;`),
            '}'
        ].join('\n'),
        swiftMapper: OPTION_KEYS.map(key => `options["${key}"]`).join('\n') + '\n' +
            COLOR_KEYS.map(key => `("${key}", { $0.${key}($1) }),`).join('\n'),
        swiftPlugin: RESULT_KEYS.map(key => `"${key}": something,`).join('\n'),
        javaMapper: OPTION_KEYS.map(key => `stringOrNull(options, "${key}")`).join('\n') + '\n' +
            COLOR_KEYS.map(key => `setters.put("${key}", x);`).join('\n'),
        javaResultMapper: RESULT_KEYS.map(key => `json.put("${key}", x);`).join('\n'),
        harness: OPTION_KEYS.map(key => `{ key: '${key}' }`).join('\n'),
        harnessColors: COLOR_KEYS.map(key => `  '${key}',`).join('\n')
    }, overrides);
}

test('passes when every surface agrees', () => {
    const result = compareSurfaces(sources());

    assert.strictEqual(result.ok, true, result.message);
    assert.match(result.message, /10 option keys, 12 colour keys and 8 result keys/);
});

test('catches a key renamed in the Java mapper only', () => {
    const broken = sources().javaMapper.replace('"showFooter"', '"showFoter"');

    const result = compareSurfaces(sources({ javaMapper: broken }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /the Java mapper/);
    assert.match(result.message, /showFooter/);
});

test('catches a result key missing from the Swift dictionary', () => {
    const broken = sources().swiftPlugin.replace('"continueUrl": something,', '');

    const result = compareSurfaces(sources({ swiftPlugin: broken }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /continueUrl/);
});

test('catches a colour key missing from the harness', () => {
    const broken = sources().harnessColors.replace("  'darkPrimary',", '');

    assert.strictEqual(compareSurfaces(sources({ harnessColors: broken })).ok, false);
});

test('reports a broken parser instead of a match when the contract reads empty', () => {
    const result = compareSurfaces(sources({ declarations: 'export interface KhipuOptions {\n}\n' }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /parser is out of date/);
});

test('reports a broken parser when an interface is not found at all', () => {
    const result = compareSurfaces(sources({ declarations: 'nothing here' }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /could not read the options interface/);
});
```

- [ ] **Step 3: Run the tests**

```bash
node --test tests/scripts/check-option-keys.test.js
```

Expected: 6 tests PASS.

- [ ] **Step 4: Wire it up and run it against the real files**

Add to `package.json`:

```json
    "verify:keys": "node scripts/check-option-keys.js",
```

and put it in the `verify` chain, after `verify:versions`. Add `- run: npm run verify:keys` to the `node` job in `.github/workflows/ci.yml`, after `verify:versions`.

```bash
npm run verify:keys
```

Expected: `check-option-keys: 10 option keys, 12 colour keys and 8 result keys agree across every surface.` This will fail until Task 15 renames the harness constants — that ordering is expected, and it is why this task comes after Task 13 and its real-file run may have to be finished alongside Task 15.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-option-keys.js tests/scripts/check-option-keys.test.js \
        package.json .github/workflows/ci.yml
git commit -m "ci: fail when the option and result vocabularies drift apart

Five surfaces declare these key names and none can detect a rename in another:
the contract is strings, so a renamed key leaves a flag with no effect and no
error. This compares all of them against types/index.d.ts, in both directions,
and refuses to report a match when its own parser comes up empty.

Both directions are checkable here because this plugin now builds the result
itself. capacitor-khipu's version of this guard documents that half as
impossible while the SDK owns the shape."
```

---

## Task 15: Documentation, and the English sweep

**Files:**
- Modify: `README.md`
- Modify: `example/www/js/harness.js`
- Modify: `example/README.md`
- Modify: `example/scripts/install-plugin.mjs`
- Modify: `scripts/check-native-versions.js`, `scripts/configure-swift-ios.js` (remaining Spanish comments)
- Modify: `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md`, `docs/superpowers/plans/2026-09-04-spm-cordova-khipu.md`

**Interfaces:**
- Consumes: everything.
- Produces: the harness constants `TEXT_FIELDS`, `SWITCH_FIELDS`, `COLOR_KEYS` and the field shape `{ key, example }`, which Task 14's guard parses.

- [ ] **Step 1: Translate the harness and rename its constants**

In `example/www/js/harness.js`:

| Now | Becomes |
| --- | --- |
| `CLAVE_ALMACENAMIENTO` | `STORAGE_KEY` |
| `CAMPOS_TEXTO` | `TEXT_FIELDS` |
| `CAMPOS_SWITCH` | `SWITCH_FIELDS` |
| `CLAVES_COLOR` | `COLOR_KEYS` |
| `{ clave: 'title', ejemplo: '...' }` | `{ key: 'title', example: '...' }` |

Translate every other local, function name, comment and user-facing string in the file. The guard in Task 14 depends on `var COLOR_KEYS` and on the `{ key: '...'` shape, so those two are not free choices.

- [ ] **Step 2: Run the key guard**

```bash
npm run verify:keys
```

Expected: PASS now, with the count line. If it reports the harness disagreeing, a field was missed in the rename.

- [ ] **Step 3: Write the README's contract-change note**

At the top of `README.md`, immediately after the title and before `## Requisitos` (which becomes `## Requirements`), add:

```markdown
> ### Upgrading to 2.11.0 from 2.10.x — read this if you support Android
>
> Four things changed in what Android hands your callbacks. All four bring it in line
> with iOS and with what this README always documented, but if your code depended on the
> old behaviour it needs a one-line change.
>
> | Before, on Android | Now | What to do |
> | --- | --- | --- |
> | The result arrived as a **JSON string** | An object, as on iOS | Delete your `JSON.parse(...)`. If you support both platforms you were probably already doing `typeof x === 'string' ? JSON.parse(x) : x` — that keeps working. |
> | `exitUrl`, `continueUrl` and `failureReason` were **absent** when null | Present, as `null` | Nothing, unless you tested with `'continueUrl' in result` |
> | A cancellation after the app was backgrounded for over three minutes arrived as the string `"Activity cancelled or failed"` | A normal result with `failureReason: 'USER_CANCELED'` | Handle it like any other cancellation |
> | An option of the wrong type was silently coerced to `false` | Discarded, so the SDK's own default applies | Send the right type. `showFooter: 'true'` was never doing what it looked like |
```

- [ ] **Step 4: Write the permissions section**

Add a section under the Android setup, titled `### Permissions this plugin adds to your app`:

```markdown
Installing this plugin adds three permissions to your app. The Khipu Android SDK declares
them in its own manifest and Android's manifest merger pulls them in, so you do not have
to declare anything — but you do have to know they are there, because your privacy notice
has to account for what your app can collect.

| Permission | What it is for |
| --- | --- |
| `android.permission.INTERNET` | Talking to Khipu |
| `android.permission.ACCESS_COARSE_LOCATION` | Banks that ask to geolocate the payer during the payment |
| `android.permission.ACCESS_FINE_LOCATION` | The same |

**Declared is not the same as used.** Location is not requested when the payment starts,
and for most payments it is never requested at all:

- Nothing is asked for at startup. The location screen appears only if Khipu's server asks
  for it during the payment, which happens when the payer's bank requires it.
- When it does appear, the payer grants or denies it themselves, through Android's own
  dialog.
- **If the payer denies it, the payment continues.** It is not a requirement.
- Until it is granted, the only thing reported is whether the device has a location
  provider at all — not where it is. That check needs no permission.

Precise location is personal data, so under Chile's Ley 21.719 this belongs in your privacy
notice even though it is conditional and consented. If you need the authoritative version
of any of this, ask us rather than inferring it from here.

If your integration definitely does not need location, you can drop those two permissions
with the manifest merger. In a Cordova app you do not edit `AndroidManifest.xml` by hand —
Cordova generates it — so it goes through `config.xml`.
```

Two things to fold in when writing this: link to docs.khipu.com's Android light-client page
once the canonical explanation is published there — the SDK team is having it documented,
and a second copy here will drift — and keep the wording conditional. An earlier draft of
this plan said "your app will ask for them", which would have alarmed merchants about
something that does not happen by default.

**Then verify the recipe before writing it.** The spec deliberately does not assert it. Try this in `example/config.xml`, inside `<platform name="android">`:

```xml
    <config-file target="AndroidManifest.xml" parent="/manifest" xmlns:tools="http://schemas.android.com/tools">
        <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove" />
        <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove" />
    </config-file>
```

```bash
cd example && npm run reset && npm run plugin:add && npx cordova platform add android@15.1.0 --nosave && npx cordova build android --debug
grep -A2 'ACCESS_FINE_LOCATION' platforms/android/app/src/main/AndroidManifest.xml
aapt2 dump permissions platforms/android/app/build/outputs/apk/debug/app-debug.apk 2>/dev/null | grep -i location || echo "no location permission in the APK"
```

Expected: the merged manifest keeps the `tools:node="remove"` marker and the built APK has **no** location permission. Write into the README only the form you actually observed working. If it does not work, say so in the README — "we could not find a way to remove it from a Cordova app" is useful and honest; a recipe that does not work is worse than none.

- [ ] **Step 5: Document the lost-callback limitation**

Add to the same Android section:

```markdown
### If Android destroys your app during a payment

The payment runs in the SDK's own activity, and Android can destroy your app's process
while it is on top. When the payer comes back, Cordova rebuilds the plugin, and the
rebuilt instance has no callback to answer: **your success and error callbacks will not
fire.** The SDK does report the outcome — when it was destroyed for more than three
minutes it deliberately ends the operation as `USER_CANCELED` — but the bridge no longer
has anywhere to deliver it.

So do not treat a missing callback as a missing outcome. Confirm the operation's status
against the Khipu API from your backend before deciding a payment did not happen. That
holds on iOS too, for a different reason: an event the SDK cannot decode is logged and
leaves the operation unfinished.
```

- [ ] **Step 6: Translate the rest of the README**

The whole file goes to English, including the sections that are already partly there. Preserve every hard-won note: the `locale` divergence between SDKs with its evidence, the `exitUrl: ""` versus `null` warning, the CI network note, the deployment-target section, the Swift-version section.

- [ ] **Step 7: Translate the remaining Spanish**

```bash
grep -rniE '\b(que|para|porque|cuando|desde|entonces|hace|hacer|comercio|clave|version del|se usa)\b' \
    --include='*.js' --include='*.mjs' --include='*.swift' --include='*.java' --include='*.gradle' \
    --include='*.md' --include='*.json' --include='*.xml' --include='*.yml' \
    src/ scripts/ tests/ www/ types/ example/README.md example/config.xml example/www/ README.md \
    | grep -v node_modules
```

Expected at the end of this step: no hits outside `CHANGELOG.md` (past entries stay) and the `docs/superpowers/` directory (Step 8 covers it). This grep is a helper, not a gate — read the files.

- [ ] **Step 8: Translate the 2026-09-04 spec and plan**

Both files in `docs/superpowers/` go to English. They are the record of why the iOS half looks the way it does, and half the comments in `src/ios/` cite them.

- [ ] **Step 9: Run everything**

```bash
npm run verify
```

Expected: tests, version guard, key guard, iOS tests and Android tests all pass.

- [ ] **Step 10: Commit**

Two commits, because they are two different kinds of change and one is far easier to review than the other:

```bash
git add README.md
git commit -m "docs: document the 2.11.0 contract change, the permissions and the callback limit

Three things a merchant cannot find out from us today: that four things about
the Android result changed and what to do about each; that the SDK's manifest
injects INTERNET and both location permissions into their app, which their
privacy notice has to account for under Ley 21.719; and that a payment
interrupted by Android destroying the app leaves their callbacks unfired, so a
missing callback is not a missing outcome."

git add example/ scripts/ docs/superpowers/2026-09-04* src/ tests/ types/ www/
git commit -m "docs: move the repository to English

Code, comments, identifiers, test names, the README, the example harness and the
2026-09-04 spec and plan. The reasoning in the existing comments is carried over
rather than summarised — it is the most valuable thing in this repo.

The harness constants are renamed as part of this, which the key guard parses:
TEXT_FIELDS, SWITCH_FIELDS, COLOR_KEYS, and { key, example } fields."
```

---

## Task 16: Gate publication on the whole suite

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `npm run verify` from Tasks 2 and 14.
- Produces: a release that cannot publish with a failing Swift or Android suite.

- [ ] **Step 1: Point the release hooks at `verify`**

In `package.json`, `release-it.hooks.before:init` is `npm run verify:versions && npm test`, and `prepublishOnly` is the same pair. Both become:

```json
    "prepublishOnly": "npm run verify",
```

```json
      "before:init": "npm run verify",
```

- [ ] **Step 2: Confirm it runs everything**

```bash
npm run verify
```

Expected: five stages — `test`, `verify:versions`, `verify:keys`, `verify:ios`, `verify:android`. On a machine without Xcode, `verify:ios` fails; that is correct, and it is why CI has a macOS job. Note it and move on.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(release): gate publication on the full suite

before:init and prepublishOnly ran the script tests and the version guard only.
The Swift tests have never run in either, and no Java was ever compiled. Both
now go through \`npm run verify\`."
```

---

## Task 17: Raise the SDK to the release that carries the crash guard

**The pin itself is done.** The crash guard shipped in 2.28.1, the `asJson()` fix in 2.28.2, and the `OPERATION_WARNING` fix in 2.28.3; `src/android/khipu.gradle` points at 2.28.3, each step verified against the published artifact. What is left in this task is the floor inside the version guard, which cannot move until Task 11 creates it. Steps 1 and 2 stay as the record of how those artifacts were verified, and as the recipe for the next time the SDK moves.

**Files:**
- Modify: `src/android/khipu.gradle`
- Modify: `scripts/check-native-versions.js` (raise `ANDROID_SDK_FLOOR`)
- Modify: `tests/scripts/check-native-versions.test.js`
- Modify: `docs/superpowers/specs/2026-09-09-android-parity-and-ci-design.md` (§16)

**Interfaces:**
- Consumes: `compareAndroidPin` from Task 11.
- Produces: nothing.

- [ ] **Step 1: Find the version that exists**

```bash
curl -s https://dev.khipu.com/nexus/content/repositories/khenshin/com/khipu/khipu-client-android/maven-metadata.xml | grep -o '<version>[^<]*</version>' | tail -5
```

Expected: the newest version listed is 2.28.3 or higher. **Do not guess the number** — a `fix:` implies a patch, but the release number depends on what else entered the same merge. This is why the pin moved four times in two days: 2.28.0, 2.28.1, 2.28.2, 2.28.3.

- [ ] **Step 2: Verify the artifact actually carries the guard**

This matters because the obvious bytecode check is misleading. The `Exception table` count in `KhipuSocketIOClient` was 1 in both 2.27.0 and 2.28.0 and **stays 1** with the fix, because the new `try/catch` is not in the lambdas — it is in a top-level function that compiles to a separate class. The markers the SDK session verified against the branch's compiled classes:

```bash
VERSION=<the version from step 1>
cd "$(mktemp -d)" && curl -sO "https://dev.khipu.com/nexus/content/repositories/khenshin/com/khipu/khipu-client-android/$VERSION/khipu-client-android-$VERSION.aar"
unzip -q "khipu-client-android-$VERSION.aar" && mkdir classes && cd classes && unzip -q ../classes.jar

# 1. The guard's own class must exist. It does not exist in 2.28.0 or earlier.
javap -p com/khipu/client/socket/SocketMessageGuardKt.class

# 2. The wrapping registrar must exist on the client.
javap -p com/khipu/client/socket/KhipuSocketIOClient.class | grep onMessage
```

Expected: the first prints a `runGuarded` method, the second prints a private `onMessage`. If both appear, all 23 listeners go through the guard. If either is missing, the artifact does not carry the fix — stop and ask the SDK session which version does.

- [ ] **Step 3: Raise the pin and the floor**

Set the version in `src/android/khipu.gradle`, then raise `ANDROID_SDK_FLOOR` in `scripts/check-native-versions.js` to the same value and update the two floor tests in `tests/scripts/check-native-versions.test.js` (the one that rejects 2.27.0 keeps working; the message assertion needs the new number).

- [ ] **Step 4: Run everything**

```bash
node --test tests/scripts/ && npm run verify:versions && cd tests/android && ./gradlew test
```

Expected: PASS, `SdkContractTest` included — the protocol still has fifteen constants.

- [ ] **Step 5: Rewrite §16 of the spec**

The section currently says the residue stays with the SDK team. Half of it no longer does: the listeners are guarded. Record what remains — the protocol generator (frente 2 in the SDK session's terms, still open) — and add the behavioural contract the guard introduces:

> A terminal message that cannot be deserialized now ends the operation rather than
> killing the process, so the launcher's callback does fire — but the `KhipuResult` may
> arrive with no `failureReason`, because the reason is exactly what failed to parse.
> `KhipuResultMapper` already handles that: a null `failureReason` becomes
> `JSONObject.NULL` and reaches JavaScript as `null`, which is what the declarations
> promise. A non-terminal message that fails is logged and ignored and the operation
> continues, which means a `FORM_REQUEST` that fails to parse leaves the payer waiting
> for a form that will never render — no crash, no way forward. That is a deliberate
> trade the SDK team made, and it is another reason the README tells merchants to confirm
> status server-side.

Reference the ticket, **IKW-1232**, which is the single ticket all four bridge sessions use.

- [ ] **Step 6: Commit**

```bash
git add src/android/khipu.gradle scripts/check-native-versions.js \
        tests/scripts/check-native-versions.test.js \
        docs/superpowers/specs/2026-09-09-android-parity-and-ci-design.md
git commit -m "fix(android): take the SDK release that guards the socket listeners

Before this, an enum value the protocol did not know threw inside a socket.io
listener on the EventThread, uncaught, and killed the merchant's app process.
The SDK now runs all 23 listeners through a guard that catches Throwable, logs
and does not propagate (IKW-1232).

Verified on the published AAR rather than by version number: the guard's class
exists and the wrapping registrar is on the client. The Exception table count
that looks like the obvious check does not move with this fix, because the new
try/catch compiles into a separate class."
```

---

## Task 18: Release 2.11.0

**Files:**
- Modify: `CHANGELOG.md`, `package.json`, `plugin.xml` (all written by the release)

- [ ] **Step 1: Confirm the branch is green**

```bash
git status --porcelain && npm run verify
```

Expected: a clean tree and every stage green. CI's four jobs must also be green on the branch — the `example` job only runs on push, so check it on `main` after merge and be ready to fix forward.

- [ ] **Step 2: Merge to `main`**

Open the pull request, get it reviewed, merge. `release-it` requires `main` and a clean tree.

- [ ] **Step 3: Release**

```bash
git checkout main && git pull && npm run release
```

`before:init` runs `npm run verify`. `after:bump` runs `update-plugin-version.js` and commits `plugin.xml`. Expected: 2.11.0 tagged, published to npm, GitHub release created.

- [ ] **Step 4: Lead the changelog with the crash**

`@release-it/conventional-changelog` generates entries from commit subjects, which will not convey the migration. Edit `CHANGELOG.md`'s 2.11.0 section so it opens with the process-killing crash and the four Android contract changes, each with its one-line migration, matching the README's table from Task 15. Commit as `docs: expand the 2.11.0 changelog entry`.

- [ ] **Step 5: Verify what a merchant actually receives**

```bash
cd "$(mktemp -d)" && npm pack cordova-khipu@2.11.0 && tar tzf cordova-khipu-2.11.0.tgz | sort
```

Expected: `plugin.xml`, `Package.swift`, `www/`, `src/` with all four Java files, `tests/`, `scripts/`, `types/index.d.ts`, `README.md`, `LICENSE`. A missing Java file here means a `<source-file>` was never added and merchant builds will break — that is the failure this ordering is designed to catch before anyone else does.

- [ ] **Step 6: Smoke-test the released plugin on both platforms**

Install 2.11.0 from npm into a scratch app and run one real operation per platform, cancelling it. Compare the two payloads field by field. Expected: identical key sets, `exitUrl` an empty string, `continueUrl` and `failureReason` present, `failureReason` `USER_CANCELED`. This is the manual half of spec §10, and the last thing that can catch a divergence the guard cannot see.

---

## Self-Review

**Spec coverage.** Every section maps to a task: §4.1 → Tasks 3 and 4; §4.2 → Task 5; §4.3 and §4.4 → Task 6; §4.5 → Task 15 Step 5; §4.6 → Task 15 Step 4; §5 → Tasks 7 and 8; §6 → Tasks 3, 4, 7, 12, 14; §7.1 → Task 2; §7.2 → Task 1; §7.3 → Tasks 9, 10, 11; §8 → Tasks 12 and 13; §9 → Tasks 6 and 13; §10 → Tasks 3, 5, 7, 18; §11 → Task 15; §12 → the task order; §13 → Tasks 16 and 18; §16 → Task 17.

**Ordering constraints, restated because they bite.**

1. `npm run verify:keys` cannot pass until Task 15 renames the harness constants. Task 14 writes and unit-tests the guard; its real-file run finishes in Task 15 Step 2.
2. Task 1 must reach a green `SdkContractTest` before Task 3 depends on the bed.
3. Task 6 cannot be verified without the example's Android build, which needs the Khipu Nexus.
4. Task 17 is gated on an artifact that does not exist yet and can land after the release.

**Two things this plan cannot verify, stated so nobody assumes otherwise.**

- `KhipuPlugin.java`'s runtime behaviour has no unit test. The pending-call ordering, the UI-thread `try` and the payload-decides rule are all reviewed by reading and exercised only by Task 18 Step 6. Making them testable would need Robolectric, which spec §3 considered and rejected.
- Whether GitHub's runners can reach Khipu's Nexus is unknown. Task 2 Step 6 is where that is found out.
