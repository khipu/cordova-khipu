# Android parity, a verification layer, and an English-only codebase for `cordova-khipu`

**Date:** 2026-09-09
**Status:** design approved, pending implementation plan
**Repo:** `khipu/cordova-khipu`
**Starting version:** `2.10.1`
**Target version:** `2.11.0`

## 1. Problem and goal

The 2026-09-04 work (`2026-09-04-spm-cordova-khipu-design.md`) rebuilt the iOS half of
this plugin: a pure, testable options mapper, a release guard for the dual
SPM/CocoaPods setup, and comments that explain why each decision is what it is. Android
was not in that scope and never got the same treatment. It is still the 2022 plugin: one
90-line method, no tests, no place to even compile it, and a result callback that can
crash the merchant's app.

That asymmetry is the actual defect. Both halves wrap the same product and are called
through the same JavaScript, so any divergence between them is a bug the merchant hits
and we do not. This work closes it.

Scope:

1. Five Android defects, four of which change what the merchant receives, plus the
   `khipu-client-android` bump to 2.28.3 that closes a process-killing crash (§16).
2. A verification layer that makes the two halves provably agree: a key-drift guard, a
   Gradle test bed for Android, and CI — which this repo has never had.
3. The published JavaScript surface: TypeScript declarations and an optional promise.
4. Structural deduplication of the option vocabulary.
5. English across the whole published repo.

Siblings for reference: `capacitor-khipu` and `flutter_khipu` wrap the same two SDKs.
Where one of them already solved a problem, this spec ports the solution instead of
inventing a second one, and says so.

## 2. Facts verified on 2026-09-09

Everything in this table was checked by reading source, not from memory or
documentation. The Android SDK was read at tag `2.27.0` — what the plugin pinned when
this work started — and at `2.28.3`, which is what it pins now.

| Fact | Value | How it was verified |
| --- | --- | --- |
| `KhipuResult.asJson()` return type | `String` — it is `Gson().toJson(this)` | `khipu-client-android` `KhipuResult.kt:30-32` |
| What Gson does with the nullable fields | Omits them. Its default `serializeNulls` is off, so a cancelled operation produces a JSON string with **no** `failureReason`, `exitUrl` or `continueUrl` key at all | Gson default plus the field declarations below |
| `KhipuResult` shape | `operationId`, `exitTitle`, `exitMessage`, `result` non-null with `""` defaults; `exitUrl`, `continueUrl`, `failureReason` are `String?`; `events: Array<KhipuEvent>` | `KhipuResult.kt:6-15` |
| Which fields are nullable | Exactly the same three as iOS, so the README's `KhipuResult` table already describes both platforms correctly | `KhipuResult.kt:10,11,14` vs the iOS table in `README.md` |
| Exits from `KhipuActivity` | Exactly two `setResult` calls | `grep 'setResult('` over `khipuClient/src/main/java/com/khipu/client/*.kt` returns `KhipuActivity.kt:119` and `KhipuActivity.kt:320`, and nothing else |
| The `RESULT_CANCELED` exit | Carries a **complete** `KhipuResult`: real `operationId`, `result = "ERROR"`, `failureReason = USER_CANCELED`, `exitUrl = ""` | `KhipuActivity.kt:108-119` |
| When that exit fires | In `onCreate`, when the activity was destroyed for longer than `DESTROYED_TOLERANCE_MS = 3 * 60_000` and the user comes back; the SDK aborts rather than resume a stale operation | `KhipuActivity.kt:94,102-121` |
| The ordinary cancel | Goes out through `RESULT_OK`: `BackHandler` opens a dialog, and confirming reports `USER_CANCELED` to the server and returns through `buildResult()` | `KhipuActivity.kt:249` and `:320` |
| `KhipuOptions` framework dependencies | None. The file imports only `java.io.Serializable`; `KhipuOptions`, its `Builder`, `Theme` and `KhipuColors` are plain Kotlin | `KhipuOptions.kt:1-30`, `KhipuColors.kt:52-85` |
| `KhipuOptions.Theme` values | `DARK`, `LIGHT`, `SYSTEM` | `KhipuOptions.kt` enum declaration |
| `KhipuColors.Builder` setters | Twelve, each taking a `String` | `KhipuColors.kt:52-85` |
| How the sibling plugins deliver the Android result | `capacitor-khipu` wraps the string: `new JSObject(khipuResult.asJson())` inside a `try` that catches `JSONException`. `flutter_khipu` builds the map field by field and never calls `asJson()` | `capacitor-khipu/android/.../KhipuPlugin.java:126-130`, `flutter_khipu/android/.../FlutterKhipuPlugin.kt:158-174` |
| How `flutter_khipu` handles a missing pending callback | Logs and returns `false`; it does not throw | `FlutterKhipuPlugin.kt:150-153` |
| Existing key-drift guard to port | `capacitor-khipu/scripts/check-option-keys.mjs`, 117 lines, with a sanity floor so a broken parser cannot report "all surfaces match" with zero keys | that file's header comment and body |
| What that guard says it cannot check | The Android return path, "because `KhipuPlugin.java` delegates the whole shape of the result to the SDK (`khipuResult.asJson()`), so its keys are not in our source and cannot be extracted" | same file, header comment |
| Existing CI to port | `capacitor-khipu/.github/workflows/ci.yml`: jobs `web` (ubuntu), `ios` (macos-15), `android` (ubuntu), `example` (macos, push only) | that file |
| What this repo has | No `.github/` at all. `npm test` runs `node --test tests/scripts/` only, so the Swift tests never run in `prepublishOnly`, and no Java is ever compiled by any check | `package.json` scripts, `ls -a` of the repo root |
| Protocol library on each platform | `khipu-client-android` **2.27.0** — what the plugin pinned before this work — pulls `com.khipu.khenshin:protocol` **1.0.59**; **2.28.0** pulls **1.0.60**; iOS resolves `KhenshinProtocolSwift` **1.0.60** | the published `khipu-client-android-2.27.0.pom` and `-2.28.0.pom` from the Khipu Nexus; `Package.resolved` |
| `FailureReasonType` constants | **14 in Java 1.0.59** (no `USER_DISCONNECTED`), **15 in Java 1.0.60**, **15 in Swift 1.0.60** | `javap -p` on `FailureReasonType.class` from `protocol-1.0.59.jar` and `protocol-1.0.60.jar`; `KhenshinProtocol.swift:1553-1569` |
| The guard release | **2.28.1**, published, and it carries the guard: `SocketMessageGuardKt.runGuarded(String, KhipuViewModel, Function0<Unit>)` exists and `KhipuSocketIOClient` has a private `onMessage`. That class also holds a `terminalMessageTypes` set | `maven-metadata.xml` from the Khipu Nexus, then `javap -p` on both classes from `classes.jar` inside the published `.aar` |
| When the SDK asks for location | Only when the server sends a `GEOLOCATION_REQUEST`; the request is made by the person, from `GeolocationWarningView`, for `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` | `KhipuSocketIOClient.kt:200-210`, `GeolocationWarningView.kt:63-66` |
| What happens if the person denies it | The payment continues: the production call site passes `geolocationMandatory = false` | `KhipuActivity.kt:388` |
| What is reported without the permission | Only whether the device has a gps or network location provider, from `LocationManager.allProviders`, which needs no permission and obtains no location | `KhipuSocketIOClient.kt:407-411` |
| Whether 2.28.0 is published | Yes: its `.pom` and `.aar` both return HTTP 200 from the Khipu Nexus, and so does 2.27.0's as a control | `curl -o /dev/null -w '%{http_code}'` against each artifact URL |
| What Java does with an unknown value | `forValue` is a chain of `String.equals` whose fallthrough is `throw new IOException("Cannot deserialize FailureReasonType")` | `javap -c -p` on the same class |
| Where that lands on Android | `socket.on(OPERATION_FAILURE)` calls `Converter.OperationFailureFromJsonString` with **no** `try/catch`, on socket.io's EventThread | `KhipuSocketIOClient.kt:211-223`, identical at tags 2.27.0 and 2.28.0 |
| How widespread that pattern is | Of the roughly twenty listeners in that file, **one** has a `try/catch`: `OPERATION_REQUEST` (`try` at :109, `catch` at :114). Twelve others call a `Converter.*FromJsonString` unprotected | `grep -nE 'socket\.on\(\|Converter\.\|try \{\|catch'` over the file at tag 2.28.0 |
| What iOS does with a value **its** enum does not know | Decodes inside `do { } catch { print(...) }`, so it logs and stalls rather than crashing. `USER_DISCONNECTED` is not such a value on iOS — its enum has it | `KhipuClientIOS/.../KhipuSocketIOClient.swift:276-291` |
| Whether the merchant must declare `KhipuActivity` | **No.** The SDK's own manifest declares it, and the manifest merger injects it into the merchant's app | `git show 2.27.0:khipuClient/src/main/AndroidManifest.xml` in `khipu-client-android` |
| What else that manifest injects | `INTERNET`, **`ACCESS_FINE_LOCATION`** and **`ACCESS_COARSE_LOCATION`** | same file |
| Whether the example can build Android in CI | Yes. `example/package.json` already has an `android` script that installs the plugin from a tarball and runs `cordova platform add android@15.1.0` | `example/package.json`, `example/scripts/install-plugin.mjs` |

### A tooling note for anyone auditing the published AAR

Reported by the `flutter_khipu` session and worth keeping: BSD `grep` on macOS does not
match inside `.class` files without `-a`, and returns zero matches **silently** rather
than reporting that it skipped binary files. It is possible to conclude a symbol does not
exist when it does. Always pass `-a`, and validate the search with a control pattern you
know is present. This spec avoided the problem by reading the SDK's Kotlin sources at the
tag instead of the AAR.

## 3. Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| How to ship the contract change | **Bug fix in 2.11.0**, with a prominent note in `CHANGELOG.md` and `README.md` | The README has always documented `KhipuResult` as an object with eight properties. Android returning a Gson string with the null keys missing never matched the published contract, so this is a defect, not a redefinition. The known cost: a merchant doing an unconditional `JSON.parse(success)` on Android breaks, and the note has to say so plainly. |
| Where Android unit tests live | A pure mapper plus a **minimal Gradle project** under `tests/android/` | Verified above: `KhipuOptions`, its `Builder` and `KhipuColors` have no Android framework dependencies, so a JVM unit test can exercise the real SDK types. This buys exact symmetry with the iOS mapper and fast tests on an Ubuntu runner. |
| JavaScript surface | TypeScript declarations plus an **optional** promise: `startOperation` returns one when the callbacks are omitted | Purely additive — existing merchant code keeps working unchanged — and it aligns with `capacitor-khipu` and `flutter_khipu`, which are both async. |
| Language | **English across the whole published repo**: code, comments, test names, identifiers, README, new CHANGELOG entries, and the `docs/superpowers/` specs and plans | Consistency for an open-source plugin. Out of bounds: the already-published commit history (rewriting it would change published hashes) and past CHANGELOG entries generated from it. |
| Sequencing | Verification bed first, then fixes, then structure, then surface — all in one release | The five Android defects are all *contract* defects. The only way to know a fix is right is to assert it against the iOS behaviour, which needs the bed to exist first. |

### Why not fix Android first and ship it immediately

Considered and rejected. The `callbackContext`-is-null crash needs the host activity to
die mid-payment, so it is real but not an hours-matter fire; and fixing five contract
defects in the one file that has no tests, in order to ship sooner, is how the same class
of problem comes back. The bed is one phase and every later phase lands verified.

## 4. Android

`KhipuPlugin.java` splits into three files with the same boundaries that already work in
Swift: what can fail (interpreting a dictionary a third party built) separated from what
cannot (applying validated values to a builder).

### 4.1 `KhipuOptionsMapper.java`

Pure, no Android imports: `org.json` and the SDK's builders only.

- `parse(JSONObject) -> KhipuOptionsInput`, where `KhipuOptionsInput` is a POJO whose
  fields are boxed (`Boolean`, `String`) so that "the JavaScript did not send this key"
  stays distinct from "it sent `false`". This is the same reasoning already written down
  in `KhipuOptionsInput`'s doc comment on the Swift side, and the SDK depends on it: its
  builder applies its own defaults for absent values.
- Reads with `opt(key)` plus `instanceof`, **not** with `optString`/`optBoolean`. This is
  the fix for the type-coercion divergence: `optBoolean("showFooter")` on the string
  `"sí"` returns the `false` default and passes it to the SDK, while iOS's `as? Bool`
  discards the key and lets the SDK default apply. Same payload, two behaviours. With
  `instanceof` the two platforms agree by construction rather than by discipline.
- `makeOptions(KhipuOptionsInput) -> KhipuOptions` and
  `makeColors(Map<String,String>) -> KhipuColors` apply the validated input. `colors` is
  applied **only when the key was present**, which is the fix for the phantom-colors
  defect: today `KhipuPlugin.java:132` calls `optionsBuilder.colors(colorsBuilder.build())`
  outside the `if (options.has("colors"))` block, so every operation that sends any
  `options` injects an empty `KhipuColors` into the SDK. iOS applies it only when present
  (`KhipuOptionsMapper.swift:98`).

### 4.2 `KhipuResultMapper.java`

`KhipuResult -> JSONObject` with the same eight keys iOS emits, and `JSONObject.NULL` for
the three nullable ones. This replaces `asJson()`, and it fixes two things at once: the
merchant stops receiving a string where iOS sends an object, and the nullable keys stop
disappearing entirely (§2: Gson omits nulls).

It also unlocks something the ported guard could not do before. `capacitor-khipu`'s
`check-option-keys.mjs` documents that it cannot verify the Android return path because
the SDK owns the shape. Once the shape is ours, both directions of both platforms become
checkable from source.

### 4.3 `KhipuPlugin.java` and the lifecycle of the pending call

The plugin becomes thin: validate, map, launch, answer. The ordering rules below are the
substance of this section, and they come from three separate holes.

**Store the callback as late as possible.** Today `execute` assigns
`this.callbackContext = callbackContext` at line 34, *before* `args.getJSONObject(0)`
(which can throw) and before the ~90 lines of mapping. The rule, reported by the
`react-native-khipu` session and confirmed against this file: everything that can throw
goes first, and the callback is stored last.

**The guard against a second concurrent operation must be synchronous.** A second
`startOperation` arriving while one is in flight must be rejected with a clear error
rather than overwriting the first — otherwise the first promise never settles. But
`launcher.launch` runs inside `cordova.getActivity().runOnUiThread(...)`
(`KhipuPlugin.java:134`), so `execute` returns before the UI block runs, and two calls in
quick succession would both pass a check made inside that block. The pending call is
therefore held in an `AtomicReference<CallbackContext>` and claimed with
`compareAndSet(null, ctx)` on the calling thread, after validation and mapping. Failing
the CAS is the "operation already in progress" error.

**Validate the launch context before claiming the slot.** A check that fails by doing
nothing is worse than one that throws: if the pending slot is already claimed and the
launch turns out to be impossible, nobody answers and the in-flight guard jams. So the
activity has to be available *before* the `compareAndSet`, not inside the UI block.

**The launch itself must not escape.** Because the launch is inside `runOnUiThread`, a
`try/catch` around `execute` would catch nothing: an exception there is thrown on the UI
thread and takes the app down. The `try` goes *inside* the lambda, and its `catch` clears
the `AtomicReference` and answers the callback. The reason to wrap it is not a specific
exception — the SDK's activity is declared by its own manifest (§2), so a missing-activity
failure would take a merchant actively suppressing it — but the class of failure: if the
activity never starts, no result will ever arrive, and that is exactly the condition that
hangs a callback forever. Without the clear, a single failed launch
would leave the reference set and the in-flight guard would reject every subsequent
operation — the guard would turn a lost payment into a permanently dead plugin. The
`react-native-khipu` session hit exactly that.

**The result callback answers, it never throws.** The registration in `pluginInitialize`
stays, but the body changes: read the pending reference defensively and, if it is null,
log and drop (`flutter_khipu`'s precedent) instead of raising an NPE; take the payload
with a checked cast; and wrap the whole body so that any failure becomes
`callbackContext.error(...)`. The current `Objects.requireNonNull(...getExtras())` and
`assert khipuResult != null` both go: the first throws inside a UI callback, and the
second is a no-op, because ART ignores assertions unless they are explicitly enabled — so
the NPE it pretends to guard arrives one line later anyway.

### 4.4 The payload decides, not the `resultCode`

`KhipuPlugin.java:157-158` currently answers `callbackContext.error("Activity cancelled or
failed")` — a bare string — for any non-`RESULT_OK` code. Per §2 that discards a complete
`KhipuResult` that the SDK built on purpose.

New rule: if the extras carry a `KhipuResult`, map it and deliver it — success unless
`result == "ERROR"`, exactly as iOS does. Reject **only** when no payload arrived. The
`resultCode` is not branched on.

The reason this matters is that both exits are the same outcome for the merchant — the
user walked away — and today the shape of the response depends on whether Android killed
the activity and more than three minutes passed. An invisible timing detail was deciding
the response format. It also restores symmetry with iOS, where `KhipuLauncher.launch` has
a single callback and always delivers a result, never a cancellation error.

### 4.5 The limit we document instead of fixing

If the host activity is destroyed during payment, Cordova rebuilds the plugin and the new
instance has no `callbackId`, so there is nobody to answer. Today that is an NPE; after
this work it is a logged, silent drop.

Worth stating precisely in the README, because the obvious phrasing is wrong: the SDK does
*not* fail to report. It deliberately builds a full `USER_CANCELED` result for this case
(§2). The bridge is what lost the callback. So the README's guidance is to confirm the
operation's status server-side rather than to treat a missing callback as a missing
outcome. §16 is a second, unrelated path to the same place, which makes that guidance the
right thing to write regardless of either cause.

### 4.6 What the plugin adds to the merchant's app, and why the README must say it

Per §2, the SDK's manifest requests `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`
in addition to `INTERNET`, and the manifest merger injects all three into any app that
installs this plugin. A merchant currently has no way to learn that from us, and nothing
in our README mentions it.

**What the permissions actually do**, which changes how this has to be written. The
purpose is banks that ask to geolocate the payer during the payment — product intent,
confirmed by this repository's owner. The behaviour, verified in the SDK's source and
recorded in §2:

| | |
| --- | --- |
| At start | Nothing is requested. The screen renders only when the server sends a `GEOLOCATION_REQUEST`, so if no bank asks, nobody is asked |
| When it is requested | By the person, from `GeolocationWarningView`, for both coarse and fine |
| If the person denies | The payment continues — the production call site passes `geolocationMandatory = false` |
| With no permission granted | The only thing reported is whether the device has a gps or network provider, read from `LocationManager.allProviders`; no permission needed and no location obtained |

So the honest sentence is not "your app starts asking for location". It is: the permissions
are declared in your app, and they are exercised only inside a payment, only when a bank
asks, only with the payer's consent, and denying them does not block the payment. The
first version would have alarmed merchants about something that does not happen by
default; writing nothing leaves them unable to declare what their app can collect.

Phase 3 adds a README section stating which permissions arrive through the plugin, that
they come from the SDK's manifest rather than from anything the merchant has to declare,
and what actually triggers them. The canonical version of that explanation is going to
live on docs.khipu.com, on the Android light-client page, so the README should link there
rather than keep a second copy that drifts — but that page is not published yet, so the
plan writes the summary now and adds the link when it exists. It should also tell a merchant who does not need location how to drop it. The
mechanism is the manifest merger's `tools:node="remove"`, but the recipe is **not** the
one a React Native or native merchant would use: a Cordova merchant does not hand-edit
`AndroidManifest.xml`, since Cordova generates it, so it has to go through `<edit-config>`
or `<config-file>` in `config.xml` plus the `tools` namespace. That recipe must be
verified against a real build before the README publishes it — it is a task for the plan,
not a claim of this spec.

Precise location is personal data, and under Ley 21.719 a merchant needs to know what
their app collects in order to declare it in their own privacy notice. This is
documentation only: the spec does not change, remove or gate any permission, and whether
the SDK should request location at all is a question for the SDK team, not for this
plugin. The `react-native-khipu` session reports the same injection with an empty plugin
manifest and no mention in its README, and is raising it there.

## 5. iOS

Symmetry work only; no behaviour change.

- The three nullable fields become an explicit `NSNull()` rather than `as Any`
  (`KhipuPlugin.swift:55-57`), so the bridging is intentional and visibly matches
  Android's `JSONObject.NULL`.
- `startKhipuOperation` and `handleError` become `private`, which is already the stated
  criterion for `presenter()`: the plugin links statically inside the merchant's app, so
  its surface there should be as small as possible.
- Spanish identifiers (`valor`, `colores`, `validos`, `clave`) and test names go to
  English (§10).

## 6. One key list per language, tied together

The twelve colour keys exist in four places today. Three languages means three copies are
unavoidable; four are not, and nothing detects drift between any of them.

- Swift: `colorKeys` and `makeColors` collapse into one table of
  `(String, (KhipuColors.Builder, String) -> KhipuColors.Builder)` pairs.
- Java: the same, as a `Map<String, BiConsumer<KhipuColors.Builder, String>>`.
- `types/index.d.ts` (new, §8) becomes the contract of record.
- `scripts/check-option-keys.js`, ported from `capacitor-khipu`, fails when the surfaces
  diverge. Five surfaces here: the `.d.ts`, the two option mappers, the example harness,
  and — new relative to capacitor, per §4.2 — the two result mappers.

The port keeps the original's sanity floor: if extraction returns fewer keys than the
contract must have, the parser is what broke, and it says so instead of reporting a match.
That guard exists because the script parses source with regular expressions; the failure
direction is the right one (the check breaks and somebody looks), but a silently empty
match would be the one way it could pass while the protocol drifted.

## 7. The verification layer

### 7.1 CI

`.github/workflows/ci.yml`, shaped after the sibling's, on push and pull request to
`main`:

| Job | Runner | Steps |
| --- | --- | --- |
| `node` | ubuntu | `npm ci`, `npm test`, `npm run verify:versions`, `npm run verify:keys` (from phase 3) |
| `ios` | macos-15 | `swift build` and `swift test`, with `.build` cached on `hashFiles('Package.swift')` |
| `android` | ubuntu | `tests/android` unit tests, then the example's Android build (§7.2) |
| `example` | macos-15, push only | The example's **iOS** build, the only thing that exercises the full install path: hooks, podspec, SPM. Its Android build is not here — it runs on every pull request inside the `android` job, because Ubuntu makes it cheap |

The `android` job needs `https://dev.khipu.com/nexus/content/repositories/khenshin`
reachable from the runner. The README already documents that requirement for merchant CI;
it now applies to ours.

`tests/android/` ships a Gradle wrapper, so the job runs
`gradle/actions/wrapper-validation` first — the wrapper JAR is a binary no diff can
review, and the checksum comparison is the only defence against an altered one. Same
reasoning `capacitor-khipu` writes down for its own.

### 7.2 What compiles what

`tests/android/` deliberately compiles **only the two mappers**, not `KhipuPlugin.java`.
The mappers depend on `org.json` and the SDK; only the plugin class needs
`org.apache.cordova`, and keeping Cordova off the unit-test classpath is a large part of
what extracting the mapper buys.

`KhipuPlugin.java` is compiled for real by building the example's Android platform, which
runs on Ubuntu and which `example/package.json` already scripts. So the `android` job
covers both halves: logic in the unit tests, compilation in the app build.

One known trap: `org.json` in the Android unit-test classpath comes from `android.jar`
stubs that throw `Stub!`. The fix is `testImplementation` on the real `org.json:json` so
it shadows the stub. If it turns out that some SDK builder does reach Android internals
and cannot run on the JVM, the documented fallback is to test `parse` only — the half that
can fail, which is precisely the argument the iOS design already makes.

### 7.3 The release scripts

- `update-plugin-version.js` becomes a surgical replacement of the `version` attribute on
  the `<plugin>` tag, synchronous, with a test. Today it round-trips the whole file through
  the xml2js `Builder`, which reformats it; that is what forced the attribute-order-tolerant
  regexes in `check-native-versions.js`. The regexes stay — they are cheap insurance — but
  their comments stop citing a rewrite that no longer happens.
- `check-native-versions.js` gains two Android checks. The first asserts `khipu.gradle`
  declares a pinned `com.khipu:khipu-client-android` version at or above a floor — nothing
  currently asserts that line even parses. The second asserts that pin matches the one in
  `tests/android/build.gradle`. **Corrected after §7.2 landed:** this section originally said
  the Android version "lives in one file, so there is no sync to break". That stopped being
  true the moment the Gradle test bed was created, since the bed resolves its own copy of the
  SDK. A merchant shipping one version while our unit tests validate another is the same drift
  this file already prevents for iOS across `Package.swift` and `plugin.xml`.
- `enable-gradle-kotlin-plugin.js` moves from `require(path)` to
  `JSON.parse(readFileSync(path))` — `require` caches the module and the script then mutates
  it — returns early when the flag is already `true`, gets a comment explaining *why*
  Kotlin has to be enabled, and gets its first test. It is the only script with none.
- The empty `<config-file parent="/*" target="AndroidManifest.xml"/>` at `plugin.xml:19` is
  deleted. It does nothing.
- `package.json` gains a `verify` script chaining the checks, so one command reproduces CI
  locally, and `prepublishOnly` runs it.

## 8. The JavaScript surface

`www/cordova-khipu.js`:

- JSDoc on `startOperation`, including the JS-to-native name mapping (`title` becomes
  `topBarTitle`), which is invisible today.
- Local validation: a missing or non-string `operationId` fails in JS with the same message
  on both platforms, without a round trip to native.
- A promise when both callbacks are omitted. Existing callback code is untouched.

`types/index.d.ts` declares `KhipuOptions`, `KhipuColors`, `KhipuResult`, `KhipuEvent` and
the two `startOperation` overloads, derived from the README tables — which, per §2, already
describe both platforms correctly. `package.json` gains `"types"` and adds `types/` to
`files`.

## 9. Errors

Three classes, one exit each:

| Class | Behaviour |
| --- | --- |
| Invalid input (`operationId` absent or not a string) | Rejected in JavaScript, before crossing to native, same message on both platforms |
| Invalid option (wrong type inside `options`) | Discarded silently; the SDK applies its default. Already the iOS policy; Android aligns. Deliberate: a merchant's typo must not knock over a payment |
| Native failure (no payload, mapping threw, launch threw, operation already in flight) | `callbackContext.error` / `CDVPluginResult(.error)` with an actionable message, and the pending reference cleared |

No `requireNonNull`, no `assert`, no unchecked casts anywhere in the result path.

## 10. Testing

- **iOS**: the existing XCTest cases, renamed to English, plus the return path if
  `KhipuResult` can be constructed from a test. Whether its initialiser is accessible has
  not been verified; the plan must check, and if it is internal, the return path is covered
  by the key guard alone and the spec's claim is limited to that.
- **Android**: JUnit over the pure mapper, with test names mapped **one-to-one** against
  the iOS ones, so a case that exists on one side and is missing on the other is visible at
  a glance. Cases: absent keys stay absent, wrong types are discarded, an unknown theme is
  discarded, all twelve colour keys map, `colors` absent means `colors` not applied, and the
  result mapper emits the eight keys with `JSONObject.NULL` for the three nullable ones.
- **Node**: tests for the two modified scripts and the two new ones.
- **Manual, once**: the same operation on both platforms through the example harness,
  comparing payloads side by side. With our own result mapper this stops being the only
  possible verification and becomes confirmation of something already asserted in CI.

## 11. English-only

Every file this work touches is translated as part of the same edit rather than in a
separate mechanical pass, so no file gets rewritten twice. A final task sweeps the files
nobody touched — `README.md`, the 2026-09-04 spec and plan, and this document's own
neighbours.

No automated language check. A "no Spanish words" linter over source would be noisy and
would fire on domain vocabulary; this is enforced by one explicit review task instead. The
translation must preserve the *reasoning* in the existing comments, which is the most
valuable thing in the repo — this is a translation, not a rewrite, and a comment that
loses its "why" in the process is a regression.

Commit messages from here on are English too, which makes the generated CHANGELOG English
from 2.11.0 onward. Past entries stay as they are.

## 12. Work order

| Phase | Contents | Expected state |
| --- | --- | --- |
| 0 | CI (`node`, `ios`, `android`, `example`), `tests/android/` with its wrapper, and the example's Android build wired into CI | Green against today's code, with nothing fixed yet |
| 1 | The five Android defects, test-first: phantom `colors`, type coercion, result shape, callback ordering plus the in-flight guard, and `resultCode` branching. Plus the SDK bump to 2.28.3 (§16), verified by resolving it in the example's Android build | New tests fail before, pass after |
| 2 | One key list per language, iOS symmetry (`private`, `NSNull`), surgical `update-plugin-version`, `enable-gradle-kotlin-plugin` plus its test, `check-native-versions` extension, dead XML deleted | No behaviour change |
| 3 | `types/index.d.ts`, optional promise, `verify:keys` (its five surfaces exist only now), README and CHANGELOG contract note, the injected-permissions section (§4.6), final English sweep | Contract documented and tied together |
| 4 | Release 2.11.0 | `npm run verify` green |

The position of `verify:keys` in phase 3 is not cosmetic: three of its five surfaces — the
`.d.ts` and the two Java mappers — do not exist until phases 1 and 3 create them, so it
cannot join the rest of CI in phase 0.

## 13. Version and release

2.11.0, per §3. The release already runs `verify:versions` and the tests through
`before:init`; that hook changes to `npm run verify` so the Swift and Android checks gate
publication too, which today they do not.

`CHANGELOG.md` gets a prominent note, not a bullet, covering: Android now delivers an
object rather than a JSON string; the three nullable keys are now always present, as
`null`, instead of being absent; a cancellation after a long destruction now arrives as a
result instead of an `"Activity cancelled or failed"` string; and a wrong-typed option is
now discarded rather than coerced to `false`. Each with the one-line migration for a
merchant who depended on the old behaviour.

It also gets a plain entry for the `khipu-client-android` bump from 2.27.0 to 2.28.3,
stating what it fixes: a `failureReason` of `USER_DISCONNECTED` used to kill the app
process on Android (§16). That one needs no migration — merchants only have to update —
but it is the most consequential line in the release, so it goes first.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| A merchant does `JSON.parse(success)` unconditionally on Android and 2.11.0 breaks them | The CHANGELOG note leads with it and the README documents the shape. It is the accepted cost of the decision in §3 |
| An SDK builder turns out not to run on the JVM, so the Gradle bed cannot exercise `makeOptions` | Fallback in §7.2: test `parse` only, the half that can fail. Phase 0 finds this out before phase 1 depends on it |
| The Khipu Nexus is unreachable from GitHub's runners | Discovered in phase 0, before anything depends on the `android` job. If it cannot be reached, that job degrades to the unit tests and the example's Android build moves to a self-hosted runner or to a documented manual step |
| `KhipuResult`'s initialiser is internal on iOS, so the return path cannot be unit-tested there | §10 already limits the claim; the key guard covers drift either way |
| The translation flattens the reasoning in the current comments | §11 states the rule and the final sweep is a review task, not a mechanical pass |

## 15. Out of scope

- `KhipuOptions` fields the plugin has never exposed (`serverUrl`, `serverPublicKey`,
  `header`, `topBarImageResourceId`, `topBarImageScale`). Exposing them is a feature, not a
  fix.
- Redelivering a result after the host activity was destroyed (§4.5). Documented, not
  fixed.
- Rewriting the published commit history to English (§3).
- Aligning the sibling plugins. `capacitor-khipu` shares the phantom-colors defect and the
  `resultCode` branching; that belongs in its own repo, and the `react-native-khipu` session
  has been told about both.
- Linters (`eslint`, `prettier`, `swiftlint`) that the sibling runs and this repo does not.
  Worth having, unrelated to the findings in this spec.

## 16. The process-killing SDK crash: fixed here by a version bump, with a residue

Reported by the `react-native-khipu` session, which hit it once by accident, and verified
here against the artifacts (§2). It matters because it defeats every callback-lifecycle
guarantee this spec makes: the process dies, so nothing downstream of it runs.

**This work fixes it** by moving `src/android/khipu.gradle` from `khipu-client-android`
2.27.0 to **2.28.3**, reached in four steps because each one turned out to be necessary and not sufficient. 2.28.0 already carried
protocol 1.0.60 — the release whose Java enum has all fifteen constants,
`USER_DISCONNECTED` included — which ends the skew against iOS. 2.28.1 adds the guard that
keeps any *other* unknown value from reaching the EventThread at all, 2.28.2 adds the
`asJson()` fix described at the end of this section, and 2.28.3 closes a hole in the guard
itself.

That last one matters here more than its patch number suggests. The guard declared three
terminal message types, but the SDK's `OPERATION_WARNING` handler also ends the operation,
so an `OPERATION_WARNING` that failed to deserialize was logged and ignored: the operation
never finished and **its callback never fired** — precisely the failure the guard existed
to close, left open on one of the four terminals. It is the same class of defect as §4.3's,
arriving from underneath. Tracked as IKW-1237, found by the iOS session noticing that its
own platform has four terminals. Verified on the published AAR: the guard's terminal set
names `OPERATION_FAILURE`, `OPERATION_MUST_CONTINUE`, `OPERATION_SUCCESS` and
`OPERATION_WARNING`, with a positive control on the class first and a check that
`serializeNulls` did not regress.

When an `OPERATION_FAILURE` event carries a `failureReason` the client's enum does not
know, `FailureReasonType.forValue` throws `IOException("Cannot deserialize
FailureReasonType")`. On Android that throw happens inside a `socket.on` listener with no
`try/catch`, on socket.io's `EventThread`, so it is an uncaught exception that **kills the
app process**. The stack the other session captured on React Native 0.75.5:

```
FATAL EXCEPTION: EventThread     Process: com.a755
com.fasterxml.jackson.databind.JsonMappingException: Unexpected IOException
  (of type java.io.IOException): Cannot deserialize FailureReasonType
  at com.khipu.khenshin.protocol.Converter.OperationFailureFromJsonString(Converter.java:173)
  at com.khipu.client.socket.KhipuSocketIOClient.addListeners$lambda$13(KhipuSocketIOClient.kt:213)
  at io.socket.emitter.Emitter.emit(Emitter.java:117)
ActivityManager: Process com.a755 (pid 15630) has died: fg TOP
```

Why no bridge can defend: the process dies, so `onActivityResult` never runs and the
merchant's callback can be neither resolved nor rejected. This is not a missing `try` on
our side.

**What the artifacts added to their report.** It was not a speculative forward
incompatibility; it was a live version skew, which is what made it worth fixing now rather
than filing. `khipu-client-android` 2.27.0 pinned protocol 1.0.59, whose enum has fourteen
constants; iOS resolves 1.0.60, whose enum has fifteen. The one value they disagreed on
was `USER_DISCONNECTED`. So that is the prime candidate for the trigger,
and a plausible one — a dropped user connection is an ordinary outcome, which fits a crash
somebody hit without trying to. Two limits on that claim: it has not been verified that
the backend emits `USER_DISCONNECTED`, and a value neither library knows cannot be ruled
out. Both need the SDK or backend team.

**Two separate problems, and only the first is live.** An earlier draft of this section
said iOS was exposed to the same event, which contradicts the constant counts above and is
wrong: iOS's enum has `USER_DISCONNECTED`, so iOS decodes that value correctly. The
`react-native-khipu` session caught it after its human asked the obvious question.

| Value that arrives | Android (14 constants) | iOS (15 constants) |
| --- | --- | --- |
| `USER_DISCONNECTED` | Crashes, kills the process | Decodes correctly |
| A value neither library knows | Crashes, kills the process | Swallowed; the operation stalls (the decode path — see the note below on a second, separate iOS crash path) |

1. **The live defect was Android-only.** Its cause was the 1.0.59-against-1.0.60 skew,
   and its symptom was that an ordinary outcome killed the merchant's app. Fixed here by
   the bump to 2.28.1.
2. **The iOS fragility was latent, and is now fixed.** The `do { } catch { print(...) }`
   degrades badly for a future value its own enum does not know either: no crash, but the
   operation never finishes and the callback never fires. `KhipuClientIOS` **2.16.6**
   closes it (IKW-1234), and `Package.swift` and `plugin.xml` now pin it.

   That release also names something this spec had not found. The characterisation above —
   "swallowed, the operation stalls" — described the *decode* path, which is what was
   verified here. There was a second path upstream of it: an unreadable socket frame killed
   the merchant's app on iOS too. So the row above is accurate for the case it describes and
   incomplete as a description of the platform; iOS had a crash path of its own, by a
   different mechanism, and 2.16.6 fixes both it and the stall.

§4.5's README guidance — confirm status server-side — still applies to both platforms,
because the iOS path to a lost callback exists even though nothing triggers it today.

**Why the pin had to go past 2.28.0.** A protocol bump alone removes the value known to
trigger the crash; it does not make the crash impossible. At tag 2.28.0 the
`OPERATION_FAILURE` listener still called the converter with no `try/catch`
(`KhipuSocketIOClient.kt:211-223`, unchanged from 2.27.0), so any *other* unknown value
would still throw on socket.io's `EventThread` and still kill the process. And it was not
one listener's oversight: of roughly twenty listeners in that file exactly one,
`OPERATION_REQUEST`, had a `try/catch`, while twelve others called a converter
unprotected. 2.28.1 is what fixes that class of failure rather than one instance of it.

So there are two asks for the SDK team, with different sizes: wrap the listeners so an
unknown value degrades instead of killing the process, and decide how the generated
clients should handle unknown enum values in general. Neither is a change to this plugin.
Reproducing the crash on purpose would cost real failed operations and is not part of this
work.

**Both are tracked as IKW-1232**, which is the single ticket the four bridge repositories
reference rather than one each: https://khipucom.atlassian.net/browse/IKW-1232

**And the first ask is done and shipped.** All 23 listeners now run through a guard that
catches `Throwable`, logs it, and does not propagate, so nothing reaches the EventThread.
It published as **2.28.1**, and `src/android/khipu.gradle` pins it.

Verified here on the published artifact rather than taken from the version number, because
the obvious check lies: the `Exception table` count in `KhipuSocketIOClient` is 1 in
2.27.0, 1 in 2.28.0, and **still 1** with the fix, since the new `try/catch` compiles into
a separate class. The markers that do move are the existence of
`SocketMessageGuardKt.runGuarded` and of a private `onMessage` on the client; both are
present in 2.28.1's `classes.jar` and neither exists in 2.28.0.

**Superseded by 2.28.4 — read this paragraph and the next together.** As of
`khipu-client-android` **2.28.4** (IKW-1240) an undecipherable terminal message DOES resolve
the merchant's call: the guard now calls `returnToApp()` and `buildResult` has a branch for
the case. The merchant receives `result = "ERROR"` with `failureReason = null`, empty strings
for the exit fields, `continueUrl = null` and no events. §4.2's mapper already handles that
shape — a null `failureReason` becomes `JSONObject.NULL` and reaches JavaScript as `null` —
so there is no work to do. Verified on the published AAR with a positive control: the guard's
calls into `KhipuViewModel` are `disconnectClient`, `returnToApp`, `setOperationFinished` and
`setUnprocessableMessage` in 2.28.4, against only `disconnectClient` and `setOperationFinished`
in 2.28.3, out of 292 classes extracted.

The paragraph below describes 2.28.1 through 2.28.3 and is kept because it is the reason the
pin had to keep moving, and because it records a correction worth remembering: the behaviour
was described wrongly twice — first by us, then again after the SDK session corrected its own
account of its own code.

The guard did **not**, in those versions, introduce a contract this plugin must honour, and an
earlier draft of this section said it did. The claim was that a terminal message which fails to
deserialize ends the operation so the launcher's callback fires, possibly with no
`failureReason`. That is false, and the `khipu-client-android` session corrected it after
checking its own code. Verified here at tag 2.28.3: `operationFinished` is read in exactly
two places, `KhipuActivity.kt:307` and `:588`, and neither delivers a result; `buildResult`
is invoked once, at `:318`, inside `if (khipuUiState.returnToApp)`, and `returnToApp` is
raised only by payer actions or by `operationXXX?.let` blocks that do not run when the
parse failed before the setter. There is no inactivity timer.

What actually happens is worse for the payer and simpler for us: no crash, but the payer is
left on the previous screen with the socket closed, and **the merchant's callback never
fires**. The only way out is the back button, whose cancellation dialog produces a normal
`result = "ERROR"` with `failureReason = "USER_CANCELED"` — which this plugin already
handles. So there is nothing to build for it. A non-terminal message that fails is logged
and ignored and the operation continues, which means a `FORM_REQUEST` that fails to parse
leaves the payer waiting for a form that will never render. Either way — terminal or not —
the ending is a payer with no way forward and a merchant with no callback, so §4.5's README
guidance to confirm the operation's status server-side is the load-bearing mitigation for
this whole class, not a footnote. The stranded-terminal case is reported and tracked as
IKW-1240.

One consequence for the `asJson()` finding recorded in that ticket: after §4.2 this plugin
no longer calls it, so Cordova leaves that finding's blast radius. As checked on
2026-09-09, `capacitor-khipu` still calls it — `KhipuPlugin.java:126`, clean working tree
— but its session reportedly intends to move off it too, so treat that as a snapshot and
not a durable fact about another repository.

Which points at something worth more than the list of affected repositories. If all four
bridges route around `asJson()`, the method stays in the SDK returning a JSON object that
drops `exitUrl`, `continueUrl` and `failureReason` when they are null, diverging from iOS,
with nobody left to notice. It stops being a bug with a symptom and becomes a trap waiting
for the next consumer. That is an argument for fixing it in the SDK rather than treating it
as resolved because its callers stepped around it — the `khipu-client-android` session is
making that case, and the decision sits with the repository owner, not with this spec.

**Update:** that argument became **IKW-1233**, and it shipped in **2.28.2**. `asJson()`
now uses `GsonBuilder().serializeNulls()`, so `exitUrl`, `continueUrl` and `failureReason`
arrive present-and-null instead of absent, matching iOS. Verified on the published AAR:
`javap -c -p` on `KhipuResult.class` shows `GsonBuilder` and `serializeNulls`, with a
positive control on the class first — without one, an empty grep cannot tell "the fix is
missing" from "I am not looking at the right class" — and `runGuarded` is still there, so
2.28.1's guard did not regress.

It changes nothing here, because §4.2 builds the object itself. It was taken anyway: it is
a strict superset of 2.28.1, and the whole point of the argument was that the two layers
should agree rather than compensate for each other.

**A note on the pace.** This pin moved four times in two days, and three of those moves
fixed something this plugin depends on. That is an argument for two things the plan already
does. The version guard holds a *floor* rather than mirroring the pin, so an SDK release
the plugin does not need costs nothing and only a fix it does need raises the floor. And
the 2.11.0 release is not blocked on SDK churn: each of these was one line, verified
against the published artifact rather than trusted from a version number.

`capacitor-khipu` has since completed its own migration off `asJson()`, so the dated
snapshot above is now history rather than a live disagreement: both readings were accurate
at their own moment, and IKW-1233 records it that way.
