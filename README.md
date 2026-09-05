# cordova-khipu

Cordova plugin for Khipu


## Requisitos

| | Mínimo | Probado con |
| --- | --- | --- |
| `cordova` (CLI) | 13.0.0 | 13.0.0 |
| `cordova-ios` | 7.0.0 | 7.1.1 y 8.1.1 |
| `cordova-android` | 13.0.0 | 13.0.0, 14.0.0 y 15.1.0 |
| iOS | 13.0 | |
| Node | `^20.17.0 \|\| >=22.9.0` | 20.19.4 |

De esta tabla, solo `cordova-ios` y `cordova-android` están declarados en el
`<engines>` de `plugin.xml`. Ojo con lo que eso hace: si la plataforma
instalada no cumple el mínimo, `cordova plugin add` **no falla**. Cordova
avisa y omite el plugin para esa plataforma —un `warn` del tipo `Plugin
doesn't support this project's cordova-ios version` seguido de `Skipping
'cordova-khipu' for ios`— y la instalación igual termina bien, con código de
salida 0 (verificado en `checkEngines()` y en el `catch` que la rodea,
`cordova-lib/src/plugman/install.js`). Un comercio en una versión de
`cordova-ios` por debajo del mínimo ve una instalación en verde, el plugin
queda anotado en su `package.json`, no se instala nada nativo, y recién
descubre el problema en runtime con `window.Khipu === undefined`. Lo que
protege al comercio es leer ese warning, no un error que Cordova nunca
lanza. Las otras tres filas (`cordova` CLI, iOS, Node) son compatibilidad
probada y recomendada, no una barrera automática — el chequeo de engines de
Cordova ni siquiera reconoce un tipo `node`, y el `package.json` del plugin
no declara `engines`.

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
| `cordova-ios` 7 | CocoaPods | CocoaPods 1.7 o superior |

El piso de CocoaPods 1.7 no es arbitrario: el plugin ya no declara un
`<config><source>` en su `<podspec>` (ver Setup de iOS más abajo) y depende
de que CocoaPods use por defecto el CDN del trunk en vez del spec repo clásico,
que es el comportamiento desde esa versión.

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
              locale: 'es_CL', // Regional settings for the interface language. The standard format combines an ISO 639-1 language code and an ISO 3166 country code. For example, "es_CL" for Spanish (Chile). Conviene enviarlo siempre: si se omite, el idioma difiere entre plataformas (ver la nota debajo del ejemplo).
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

### Envía `locale` siempre, aunque parezca redundante

Si omites `locale`, **el idioma no es el mismo en las dos plataformas**. Lo
verificamos en los SDK nativos: `KhipuClientIOS` lo fija en `es_CL` por omisión
(`KhipuOptions.swift`, `var _locale: String = "es_CL"`), mientras que
`khipu-client-android` lo deja sin definir —el constructor de su `Builder` pasa
`null` y la cadena `es_CL` no aparece en ninguna clase del `.aar`— y la
resolución termina más abajo, siguiendo la configuración del dispositivo.

En la práctica: la misma operación, con el mismo payload y sin `locale`, sale en
español en iOS y en el idioma del teléfono en Android. No es un defecto del
plugin sino una diferencia entre los SDK nativos, pero te toca a ti. Para un
idioma determinista, mándalo explícito.

The `data` and `error` object passed to the callback functions are of the type `KhipuResult`

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

Los tres campos anulables lo son en el SDK, no por casualidad: en
`KhipuClientIOS` están declarados `String?`, mientras que `operationId`,
`exitTitle`, `exitMessage` y `result` no lo están.

**Ojo con cómo llegan vacíos, porque no todos llegan igual.** En una operación
cancelada de verdad observamos esto:

| Campo | Valor recibido |
| --- | --- |
| `continueUrl` | `null` |
| `exitUrl` | `""` — cadena vacía, **no** `null` |

O sea que este chequeo, que parece razonable, **no atrapa el `exitUrl` vacío**:

```javascript
if (result.exitUrl === null) { /* nunca entra */ }
```

Y este sí:

```javascript
if (!result.exitUrl) { /* entra con "" y con null */ }
```

Chequea siempre por *falsy* y no por `=== null`.


#### KhipuEvent

| Prop            | Type                |
| --------------- | ------------------- |
| **`name`**      | <code>string</code> |
| **`timestamp`** | <code>string</code> |
| **`type`**      | <code>string</code> |
