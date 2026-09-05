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
cordova platform add ios       # o android
cordova plugin add cordova-khipu
```

**En iOS el orden importa, y si lo inviertes el error no te va a decir por qué.**
Declara el `deployment-target` en `config.xml` **antes** de agregar la
plataforma — ver [Setup de iOS](#setup-de-ios). Si agregas la plataforma
primero y editas `config.xml` después, en `cordova-ios` 7 el
`cordova plugin add` falla con esto:

```
[!] CocoaPods could not find compatible versions for pod "KhipuClientIOS":
    ... required a higher minimum deployment target
```

La causa no es la que sugiere el mensaje: el `Podfile` que cordova genera
todavía tiene el default de `cordova-ios` 7 (11.0) y no se resincronizó con tu
`config.xml`. Si ya te pasó, un `cordova prepare ios` antes de reintentar el
`plugin add` lo resuelve.

## Setup de iOS

El plugin soporta los dos gestores de paquetes, y **el que se use lo decide la
versión de `cordova-ios`**, no una opción:

| Versión | Gestor | Qué necesitas instalado |
| --- | --- | --- |
| `cordova-ios` 8 y superior | Swift Package Manager | nada extra |
| `cordova-ios` 7 | CocoaPods | CocoaPods 1.7 o superior |

El piso de CocoaPods 1.7 no es arbitrario: el `<podspec>` del plugin ya no
declara un `<config><source>`, así que depende de que CocoaPods use por defecto
el CDN del trunk en vez del spec repo clásico — el comportamiento desde esa
versión.

### El deployment target, y cuándo declararlo

Khipu necesita **iOS 13.0**. Qué hacer depende de tu versión de `cordova-ios`, y
son cuatro casos:

**En `cordova-ios` 7 no hay decisión que tomar.** No existe SPM: el plugin usa
CocoaPods siempre, declares o no la preferencia. Y sí tienes que declararla,
porque el default de `cordova-ios` 7 es 11.0, por debajo de lo que Khipu exige.
Ponla en `config.xml` **antes** de agregar la plataforma:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

Los otros tres casos son de `cordova-ios` 8:

1. **Si te alcanza con iOS 13, no la declares.** El default ya es 13.0 y el
   plugin se queda en SPM, sin tocar CocoaPods.
2. **Si la declaras con cualquier valor, incluido 13.0, vas a necesitar
   CocoaPods.** El plugin sigue cargando un `<podspec>` —lo necesita el camino
   de `cordova-ios` 7—, así que cordova crea igual un `Podfile` vacío al
   instalar el plugin. Cuando `config.xml` trae un `deployment-target`, cordova
   sincroniza ese Podfile corriendo `pod install` en cada `prepare`, aunque no
   tenga ninguna dependencia adentro.
3. **Si necesitas un piso mayor a 13.0, la preferencia es la única vía**, y
   tener CocoaPods es el costo. No es un error tuyo ni algo que se pueda
   esquivar: es la consecuencia de que el plugin soporte los dos gestores desde
   un mismo `plugin.xml`.

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

**No hace falta que fijes versiones de Kotlin, Gradle ni AGP.** Los defaults de
cada `cordova-android` funcionan tal cual, y son bastante distintos entre sí.
Estos son los que trae cada versión, y con los tres se verificó que el plugin
compila y corre una operación real:

| | cordova-android 13.0.0 | 14.0.0 | 15.1.0 |
| --- | --- | --- | --- |
| Kotlin | 1.9.24 | 1.9.24 | 2.1.21 |
| Gradle | 8.7 | 8.13 | 8.14.2 |
| Android Gradle Plugin | 8.3.0 | 8.7.3 | 8.10.1 |
| `compileSdk` / `targetSdk` | 34 | 35 | 36 |
| Java | 21 | 21 | 21 |

Si vas a sobreescribir alguna, no la bajes por debajo de la columna que
corresponde a **tu** versión de `cordova-android`. Fijar valores de una versión
distinta es peor que no fijar nada: por ejemplo, imponer Kotlin 1.9 en un
proyecto con `cordova-android` 15 lo baja dos majors respecto de su default.

### Acceso de red en CI

El plugin agrega un repositorio Maven propio de Khipu además de Google y Maven
Central:

```
https://dev.khipu.com/nexus/content/repositories/khenshin
```

En una máquina de desarrollo no vas a notarlo, pero si tu CI corre detrás de un
proxy o con una lista de hosts permitidos, ese dominio tiene que estar
habilitado o el build falla al resolver dependencias.

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
