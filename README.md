# cordova-khipu

Cordova plugin for Khipu

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
> | A cancellation after the app was backgrounded for over three minutes arrived as the string `"Activity cancelled or failed"` | Your **error** callback, with a full result object whose `result` is `'ERROR'` and `failureReason` is `'USER_CANCELED'` | Handle it like any other cancellation — an ordinary cancellation from the exit page arrives the same way |
> | An option of the wrong type was silently coerced to `false` | Discarded, so the SDK's own default applies | Send the right type. `showFooter: 'true'` was never doing what it looked like |

## Requirements

| | Minimum | Tested with |
| --- | --- | --- |
| `cordova` (CLI) | 13.0.0 | 13.0.0 |
| `cordova-ios` | 7.0.0 | 7.1.1 and 8.1.1 |
| `cordova-android` | 13.0.0 | 13.0.0, 14.0.0 and 15.1.0 |
| iOS | 13.0 | |
| Node | `^20.17.0 \|\| >=22.9.0` | 20.19.4 |

Of this table, only `cordova-ios` and `cordova-android` are declared in `plugin.xml`'s
`<engines>`. Mind what that does: if the installed platform does not meet the minimum,
`cordova plugin add` **does not fail**. Cordova warns and skips the plugin for that
platform — a `warn` reading `Plugin doesn't support this project's cordova-ios version`
followed by `Skipping 'cordova-khipu' for ios` — and the install still finishes clean,
with exit code 0 (verified in `checkEngines()` and the `catch` around it,
`cordova-lib/src/plugman/install.js`). A merchant on a `cordova-ios` version below the
minimum sees a green install, the plugin gets listed in their `package.json`, nothing
native gets installed, and they only discover the problem at runtime with
`window.Khipu === undefined`. What protects the merchant is reading that warning, not an
error Cordova never throws. The other three rows (`cordova` CLI, iOS, Node) are tested
and recommended compatibility, not an automatic barrier — Cordova's engine check does not
even recognize a `node` type, and the plugin's `package.json` does not declare `engines`.

## Installation

```bash
cordova platform add ios       # or android
cordova plugin add cordova-khipu
```

**On iOS the order matters, and if you reverse it the error will not tell you why.**
Declare the `deployment-target` in `config.xml` **before** adding the platform — see
[iOS Setup](#ios-setup). If you add the platform first and edit `config.xml` afterwards,
on `cordova-ios` 7 `cordova plugin add` fails with this:

```
[!] CocoaPods could not find compatible versions for pod "KhipuClientIOS":
    ... required a higher minimum deployment target
```

The cause is not what the message suggests: the `Podfile` cordova generates still has
`cordova-ios` 7's default (11.0) and was never resynced with your `config.xml`. If this
already happened to you, a `cordova prepare ios` before retrying `plugin add` fixes it.

## iOS Setup

The plugin supports both package managers, and **which one is used is decided by your
`cordova-ios` version**, not by a choice you make:

| Version | Manager | What you need installed |
| --- | --- | --- |
| `cordova-ios` 8 and above | Swift Package Manager | nothing extra |
| `cordova-ios` 7 | CocoaPods | CocoaPods 1.7 or above |

The CocoaPods 1.7 floor is not arbitrary: the plugin's `<podspec>` no longer declares a
`<config><source>`, so it depends on CocoaPods defaulting to the trunk CDN instead of the
classic spec repo — the behaviour since that version.

### The deployment target, and when to declare it

Khipu needs **iOS 13.0**. What to do depends on your `cordova-ios` version, and there are
four cases:

**On `cordova-ios` 7 there is no decision to make.** SPM does not exist: the plugin
always uses CocoaPods, whether or not you declare the preference. And you do have to
declare it, because `cordova-ios` 7's default is 11.0, below what Khipu requires. Put it
in `config.xml` **before** adding the platform:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

The other three cases are for `cordova-ios` 8:

1. **If iOS 13 is enough for you, do not declare it.** The default is already 13.0 and
   the plugin stays on SPM, without touching CocoaPods.
2. **If you declare it with any value, including 13.0, you will need CocoaPods.** The
   plugin still ships a `<podspec>` — the `cordova-ios` 7 path needs it — so cordova
   creates an empty `Podfile` when installing the plugin regardless. When `config.xml`
   carries a `deployment-target`, cordova syncs that Podfile by running `pod install` on
   every `prepare`, even though it has no dependency inside.
3. **If you need a floor higher than 13.0, the preference is the only way**, and having
   CocoaPods is the cost. This is not a mistake on your part, nor something you can
   avoid: it is the consequence of the plugin supporting both managers from a single
   `plugin.xml`.

### Swift version

The plugin configures `SWIFT_VERSION` on its own when needed. If you need a different
one, declare it and the plugin respects it:

```xml
    <platform name="ios">
        <preference name="SwiftVersion" value="5.9" />
    </platform>
```

### Authorizing Khipu to open bank apps

Khipu opens the payer's bank app directly when a payment needs stronger authorization
(2FA). For iOS to allow that, your app has to declare which bank apps it may query, via
`LSApplicationQueriesSchemes` in your `Info.plist`. Add it through `config.xml`, inside
`<platform name="ios">`:

```xml
    <config-file target="*-Info.plist" parent="LSApplicationQueriesSchemes">
      <array>
        <string>bancochilemipass2</string>
        <string>BciPassApp</string>
        <string>BICEPassApp</string>
        <string>scotiabankgo</string>
        <string>SantanderPassApp</string>
        <string>tupass</string>
        <string>bancoestado</string>
        <string>itau.cl</string>
        <string>SecurityPass</string>
      </array>
    </config-file>
```

These nine are Khipu's own published list for Chile, from Khipu's integration
documentation. Copy them from there, not from another app's `config.xml` or `Info.plist`
— stale copies are exactly how other example apps have ended up with the wrong list.
Missing one does not fail your build: `canOpenURL` just silently reports that bank app as
not installed, and the payer is never offered the shortcut into it.

## Android Setup

No extra steps required: the plugin enables Gradle's Kotlin plugin on its own.

**You do not need to pin Kotlin, Gradle or AGP versions.** Each `cordova-android`'s
defaults work as they are, and they differ quite a bit from each other. These are what
each version ships, and all three were verified to compile the plugin and run a real
operation:

| | cordova-android 13.0.0 | 14.0.0 | 15.1.0 |
| --- | --- | --- | --- |
| Kotlin | 1.9.24 | 1.9.24 | 2.1.21 |
| Gradle | 8.7 | 8.13 | 8.14.2 |
| Android Gradle Plugin | 8.3.0 | 8.7.3 | 8.10.1 |
| `compileSdk` / `targetSdk` | 34 | 35 | 36 |
| Java | 21 | 21 | 21 |

If you are going to override one, do not take it below the column for **your**
`cordova-android` version. Pinning values from a different version is worse than pinning
nothing: for example, forcing Kotlin 1.9 in a `cordova-android` 15 project takes it two
majors below its default.

### Network access in CI

The plugin adds a Maven repository of its own, in addition to Google and Maven Central:

```
https://dev.khipu.com/nexus/content/repositories/khenshin
```

On a development machine you will not notice it, but if your CI runs behind a proxy or
with an allow-list of hosts, that domain has to be enabled or the build fails resolving
dependencies.

### Permissions this plugin adds to your app

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

Precise location is personal data, so under Chile's Ley 21.719 this belongs in your
privacy notice even though it is conditional and consented. If you need the authoritative
version of any of this, ask us rather than inferring it from here.

If your integration definitely does not need location, you can drop those two permissions
with the manifest merger. In a Cordova app you do not edit `AndroidManifest.xml` by hand —
Cordova generates it — so it goes through `config.xml`.

**Verify this before you rely on it — Cordova's own XML merging has a gap here.**
Declaring `tools:node="remove"` on a `<uses-permission>` inside a plain `<config-file>` is
not enough by itself; we built a debug APK against `cordova-android` 15.1.0 to confirm it.
Cordova copies that node into `AndroidManifest.xml` without ever binding the `tools:`
prefix on the manifest's own root element, so the merged manifest is invalid XML and
Gradle's `generateDebugBuildConfig` fails before it even gets to compiling anything. And
because your `config.xml` is itself compiled as an Android resource
(`res/xml/config.xml`), any `android:`-prefixed attribute you write there — `android:name`
included — needs that same namespace bound on `config.xml`'s own `<widget>` root, or the
resource merge step fails too, with a different, equally unhelpful XML error. The form
that actually builds clean needs all three pieces together:

```xml
<widget ... xmlns:android="http://schemas.android.com/apk/res/android">
    ...
    <platform name="android">
        <edit-config target="/manifest" file="AndroidManifest.xml" mode="merge">
            <manifest xmlns:tools="http://schemas.android.com/tools" />
        </edit-config>
        <config-file target="AndroidManifest.xml" parent="/manifest" xmlns:tools="http://schemas.android.com/tools">
            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove" />
            <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove" />
        </config-file>
    </platform>
</widget>
```

Verified against `cordova-android` 15.1.0: the merged manifest kept both `tools:node`
markers, and `aapt2 dump permissions` on the built debug APK showed
`android.permission.INTERNET` present and neither location permission.

### If Android destroys your app during a payment

The payment runs in the SDK's own activity, and Android can destroy your app's process
while it is on top. When the payer comes back, Cordova rebuilds the plugin, and the
rebuilt instance has no callback to answer: **your success and error callbacks will not
fire.** The SDK does report the outcome — when it was destroyed for more than three
minutes it deliberately ends the operation as `USER_CANCELED` — but the bridge no longer
has anywhere to deliver it. A plain system back press is a further exception: it finishes
the SDK's activity with no payload at all, so what your error callback gets is not a
result object but the plain string `"The Khipu operation returned no result."`

So do not treat a missing callback as a missing outcome. Confirm the operation's status
against the Khipu API from your backend before deciding a payment did not happen. That
holds on iOS too, for a different reason: an event the SDK cannot decode is logged and
leaves the operation unfinished.

## Example app

[`example/`](example/) has an app that exercises every option of the plugin with a test
harness, and that runs in the three supported scenarios. See
[`example/README.md`](example/README.md).

## Usage

The `cordova-khipu` plugin makes the `Khipu.startOperation` method available on the
`window` object.

Called with two callbacks, the first parameter is the `operationId` of the payment to
authorize together with its options (detailed below), the second is a callback invoked
when the authorization completes, and the third is invoked when it fails. Called with
neither callback, `startOperation` instead returns a Promise for the same result — see
below for what it resolves and rejects with.

```javascript

  window.Khipu.startOperation({
          operationId: '<paymentId>',
          options: {
              title: '<Title to display in the payment process>', // Title for the top bar during the payment process.
              titleImageUrl: '<Image to display centered in the topbar>', // Url of the image to display in the top bar.
              locale: 'es_CL', // Regional settings for the interface language. The standard format combines an ISO 639-1 language code and an ISO 3166 country code. For example, "es_CL" for Spanish (Chile). Send it always: if omitted, the language differs between platforms (see the note below the example).
              theme: 'light', // The theme of the interface, can be 'dark', 'light' or 'system'
              showFooter: true, // If true, a message is displayed at the bottom with the Khipu logo.
              showMerchantLogo: true, // If true, the merchant's logo is displayed in the top bar.
              showPaymentDetails: true, // If true, the payment code and a link to view the details are displayed.
              skipExitPage: false, // If true, skips the exit page at the end of the payment process, whether successful or failed.
              skipExitSuccessPage: false, // If true, skips the exit page at the end of the payment process when it's successful.
              colors: {
                  lightTopBarContainer: '<colorHex>', // Optional background color for the top bar in light mode.
                  lightOnTopBarContainer: '<colorHex>', // Optional color of the elements on the top bar in light mode.
                  lightPrimary: '<colorHex>', // Optional primary color in light mode.
                  lightOnPrimary: '<colorHex>', // Optional color of elements on the primary color in light mode.
                  lightBackground: '<colorHex>', // Optional general background color in light mode.
                  lightOnBackground: '<colorHex>', // Optional color of elements on the general background in light mode.
                  darkTopBarContainer: '<colorHex>', // Optional background color for the top bar in dark mode.
                  darkOnTopBarContainer: '<colorHex>', // Optional color of the elements on the top bar in dark mode.
                  darkPrimary: '<colorHex>', // Optional primary color in dark mode.
                  darkOnPrimary: '<colorHex>', // Optional color of elements on the primary color in dark mode.
                  darkBackground: '<colorHex>', // Optional general background color in dark mode.
                  darkOnBackground: '<colorHex>', // Optional color of elements on the general background in dark mode.
              }
          }
      },
      (success) => {
        console.log(JSON.stringify(success))
      },
      (error) => {
        console.error(JSON.stringify(error))
      }
  )
```

The promise rejects with an `Error` when the call itself is malformed — a missing
`operationId`, say — and with the `KhipuResult` object when the operation reached Khipu
and failed there. The callback form receives the same two cases as a plain string and as
a `KhipuResult` respectively. So a `catch` that assumes one shape will be wrong half the
time; check what you got.

### TypeScript

The plugin ships its own declarations. TypeScript does not pick them up automatically, so
add this to your `tsconfig.json` once:

```json
    {
      "compilerOptions": {
        "types": ["cordova-khipu"]
      }
    }
```

`window.Khipu` is then typed, and so are the options and the result. A triple-slash
`/// <reference types="cordova-khipu" />` in a single file works too if you would rather
not touch your compiler options.

### Send `locale` always, even if it looks redundant

If you omit `locale`, **the language is not the same on both platforms**. We verified it
in the native SDKs: `KhipuClientIOS` defaults it to `es_CL` (`KhipuOptions.swift`, `var
_locale: String = "es_CL"`), while `khipu-client-android` leaves it undefined — its
`Builder`'s constructor passes `null` and the string `es_CL` does not appear in any class
of the `.aar` — and resolution falls through to the device's own configuration.

In practice: the same operation, with the same payload and no `locale`, comes out in
Spanish on iOS and in the phone's language on Android. This is not a defect in the plugin
but a difference between the native SDKs, and it is on you to handle it. For a
deterministic language, send it explicitly.

The `data` and `error` objects passed to the callback functions are of type `KhipuResult`.

#### KhipuResult

| Prop                | Type                                                    |
| ------------------- | ------------------------------------------------------- |
| **`operationId`**   | <code>string</code>                                     |
| **`exitTitle`**     | <code>string</code>                                     |
| **`exitMessage`**   | <code>string</code>                                     |
| **`exitUrl`**       | <code>string \| null</code>                             |
| **`result`**        | <code>'OK' \| 'ERROR' \| 'WARNING' \| 'CONTINUE'</code> |
| **`failureReason`** | <code>string \| null</code>                             |
| **`continueUrl`**   | <code>string \| null</code>                             |
| **`events`**        | <code>KhipuEvent[]</code>                               |

The three nullable fields are nullable in the SDK, not by accident: in `KhipuClientIOS`
they are declared `String?`, while `operationId`, `exitTitle`, `exitMessage` and `result`
are not.

**Watch how they arrive empty, because they do not all arrive the same way.** In a real
cancelled operation we observed this:

| Field | Value received |
| --- | --- |
| `continueUrl` | `null` |
| `exitUrl` | `""` — empty string, **not** `null` |

So this check, which looks reasonable, **does not catch the empty `exitUrl`**:

```javascript
if (result.exitUrl === null) { /* never enters */ }
```

And this one does:

```javascript
if (!result.exitUrl) { /* enters with "" and with null */ }
```

Always check for *falsy*, not for `=== null`.

#### KhipuEvent

| Prop            | Type                |
| --------------- | ------------------- |
| **`name`**      | <code>string</code> |
| **`timestamp`** | <code>string</code> |
| **`type`**      | <code>string</code> |
