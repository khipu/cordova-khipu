# cordova-khipu

Cordova plugin for Khipu


## Requisitos

| | Mínimo | Probado con |
| --- | --- | --- |
| `cordova` (CLI) | 13.0.0 | 13.0.0 |
| `cordova-ios` | 7.0.0 | 7.1.1 y 8.1.1 |
| `cordova-android` | 13.0.0 | 15.1.0 |
| iOS | 13.0 | |
| Node | `^20.17.0 \|\| >=22.9.0` | 20.19.4 |

De esta tabla, solo `cordova-ios` y `cordova-android` están declarados en el
`<engines>` de `plugin.xml`: si la plataforma instalada no cumple el mínimo,
`cordova plugin add` falla con un mensaje claro en vez de romper más adelante.
Las otras tres filas (`cordova` CLI, iOS, Node) son compatibilidad probada y
recomendada, no una barrera automática — el chequeo de engines de Cordova ni
siquiera reconoce un tipo `node`, y el `package.json` del plugin no declara
`engines`.

## Instalación

```bash
cordova plugin add cordova-khipu
```

## Setup de iOS

El plugin soporta los dos gestores de paquetes, y **el que se use lo decide la
versión de `cordova-ios`**, no una opción:

| Versión | Gestor | Qué necesitas instalado |
| --- | --- | --- |
| `cordova-ios` 8 y superior | Swift Package Manager | nada extra |
| `cordova-ios` 7 | CocoaPods | CocoaPods |

Lo único que hay que configurar es el deployment target, porque el default de
`cordova-ios` 7 es 11.0 y Khipu necesita 13.0. En `config.xml`:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

`cordova-ios` 8 ya usa 13.0 por defecto, así que en ese caso **conviene no
declararlo**: el plugin todavía carga un `<podspec>` (lo necesita el camino de
cordova-ios 7), y `cordova-ios` crea igual un `Podfile` vacío al instalar el
plugin. Si `config.xml` trae **cualquier valor** de `deployment-target` —13.0,
14.0, el que sea—, cordova sincroniza ese Podfile con `pod install` en cada
`prepare` — aunque esté vacío — y eso exige tener CocoaPods instalado,
anulando la ventaja de no necesitarlo bajo SPM. No es solo un problema de
valores bajos: si tu app necesita fijar un deployment target más alto en
cordova-ios 8, vas a pagar el mismo costo. Dejar que `cordova-ios` 8 use su
propio default (no declarar la preferencia) es lo único que evita ese
`pod install`.

### Versión de Swift

El plugin configura `SWIFT_VERSION` por su cuenta cuando hace falta. Si
necesitas otra, declárala y el plugin la respeta:

```xml
    <platform name="ios">
        <preference name="SwiftVersion" value="5.9" />
    </platform>
```

## Setup de Android

No requiere pasos adicionales: el plugin habilita el plugin de Kotlin de Gradle
por su cuenta.

Estas son las versiones que trae `cordova-android` 15.1.0 por defecto, con las
que el plugin está probado:

| | Valor |
| --- | --- |
| Kotlin | 2.1.21 |
| Gradle | 8.14.2 |
| Android Gradle Plugin | 8.10.1 |
| `compileSdk` / `targetSdk` | 36 |
| `minSdk` | 24 |

Si tu app las sobreescribe, mantenlas en esos valores o superiores.

## App de ejemplo

En [`example/`](example/) hay una app que ejercita todas las opciones del
plugin con un harness de prueba, y que corre en los tres escenarios soportados.
Ver [`example/README.md`](example/README.md).

## Usage

The `cordova-khipu` plugin makes the `Khipu.startOperation` method available in the `window` object.

The first parameter is the `operationId` of the payment to authorize with all the options (datailed in the example).

The second parameter is a callback funcion that will be invoked if the authorization process completed and the third if it failed.


```javascript

  window.Khipu.startOperation({
          operationId: '<paymentId>',
          options: {
              title: '<Title to display in the payment process>', // Title for the top bar during the payment process.
              titleImageUrl: '<Image to display centered in the topbar>', // Url of the image to display in the top bar.
              locale: 'es_CL', // Regional settings for the interface language. The standard format combines an ISO 639-1 language code and an ISO 3166 country code. For example, "es_CL" for Spanish (Chile).
              theme: 'light', // The theme of the interface, can be 'dark', 'light' or 'system'
              showFooter: true, // If true, a message is displayed at the bottom with the Khipu logo.
              showMerchantLogo: true, // If true, the merchant's logo is displayed in the top bar.
              showPaymentDetails: true, // If true, the payment code and a link to view the details are displayed.
              skipExitPage: false, // If true, skips the exit page at the end of the payment process, whether successful or failed.
              skipExitSuccessPage: false, // If true, skips the exit page at the end of the payment process when its successful.
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

The `data` and `error` object passed to the callback functions are of the type `KhipuResult`

#### KhipuResult

| Prop                | Type                                                    |
| ------------------- | ------------------------------------------------------- |
| **`operationId`**   | <code>string</code>                                     |
| **`exitTitle`**     | <code>string</code>                                     |
| **`exitMessage`**   | <code>string</code>                                     |
| **`exitUrl`**       | <code>string</code>                                     |
| **`result`**        | <code>'OK' \| 'ERROR' \| 'WARNING' \| 'CONTINUE'</code> |
| **`failureReason`** | <code>string</code>                                     |
| **`continueUrl`**   | <code>string</code>                                     |
| **`events`**        | <code>KhipuEvent[]</code>                               |


#### KhipuEvent

| Prop            | Type                |
| --------------- | ------------------- |
| **`name`**      | <code>string</code> |
| **`timestamp`** | <code>string</code> |
| **`type`**      | <code>string</code> |
