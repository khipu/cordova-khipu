# App de ejemplo de `cordova-khipu`

Ejercita el plugin en los tres escenarios que soporta, y es la forma de
verificarlo: el repositorio no tiene CI por decisión de diseño.

## Requisitos

- Node `^20.17.0` o `>=22.9.0` (el rango real de `engines` en `example/package.json`; deja fuera
  20.0–20.16 y toda la serie 21.x)
- Xcode 15 o superior, con un simulador de iOS instalado
- CocoaPods, **solo** para el escenario de cordova-ios 7
- Android SDK con un emulador o un dispositivo conectado

## Cómo se instala el plugin

El plugin se empaqueta con `npm pack` y se instala desde el tarball, con
`scripts/install-plugin.mjs`. Se probaron los tres métodos posibles contra un
clon desechable del repositorio, y los otros dos se descartaron con evidencia:

| Método | Qué pasa |
| --- | --- |
| `cordova plugin add ../` | Falla con `EINVAL: cp ... subdirectory of self`. El destino (`example/plugins/`) es hijo del origen (el repo). |
| `cordova plugin add ../ --link` | Compila, pero deja al plugin dependiendo de `apache/cordova-ios` por git en vez de la CordovaLib local. SwiftPM lo tolera dedupeando y avisa: *"Conflicting identity for cordova-ios … will be escalated to an error in future versions of SwiftPM"*. |
| **Tarball** | Compila limpio, sin advertencias de identidad. |

Dos detalles del script que no son adorno: usa el prefijo `file:` con **ruta
absoluta**, porque `cordova plugin add ./algo.tgz` falla por un bug de parseo de
`cordova-lib` 13.0.0; y borra los tarballs viejos antes de empaquetar, para que
no quede eligiendo el de una versión anterior.

El efecto secundario es bueno: se instala exactamente el mismo artefacto que
recibe un comercio desde npm, así que el campo `files` de `package.json` queda
verificado de paso.

## Matriz de verificación

Correr los tres antes de publicar una versión.

| Escenario | Comando | Qué prueba |
| --- | --- | --- |
| cordova-ios 7 + CocoaPods | `npm run ios:pods` | `<podspec>` + `<source-file>` y el hook `configure-swift-ios.js` |
| cordova-ios 8 + SPM | `npm run ios:spm` | `Package.swift`; ningún pod se linkea (Podfile vacío) — desde este ejemplo el comando igual invoca `pod install`, ver más abajo |
| cordova-android 15 | `npm run android` | `khipu.gradle` y el hook `enable-gradle-kotlin-plugin.js` |

Cada script borra `platforms/` y `plugins/` antes de empezar: el gestor de
paquetes de iOS lo decide el major de la plataforma y no se puede cambiar en
caliente.

### La corrida que de verdad prueba SPM

Este escenario **no se puede correr desde esta app de ejemplo**. El
`config.xml` de acá declara `<preference name="deployment-target"
value="13.0" />` para que funcione el camino de cordova-ios 7 (que sí lo
necesita), pero esa misma preferencia hace que cordova-ios, en el camino de
SPM, sincronice con `pod install` el `Podfile` vacío que crea igual al
instalar el plugin (el motivo completo está en el README principal, sección
"Setup de iOS"). Con esa preferencia puesta, `npm run ios:spm` va a pedir
CocoaPods aunque no vaya a usar ningún pod.

La comprobación real se hace aparte, contra un proyecto Cordova limpio que
**no** declare `deployment-target` (dejando que cordova-ios 8 use su default
de 13.0):

```bash
cordova create khipu-spm-check com.example.khipuspmcheck "Khipu SPM check"
cd khipu-spm-check
cordova plugin add file:/ruta/absoluta/a/cordova-khipu-*.tgz --nosave
cordova platform add ios@8.1.1 --nosave
PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -x -F "$(dirname "$(command -v pod)")" | paste -sd: -) cordova run ios
```

No hay una ruta fija de `pod` que excluir: CocoaPods se instala en lugares
distintos según el método (Homebrew, RubyGems del sistema, rbenv, rvm), así
que el comando ubica el directorio real con `command -v` y recién ahí lo saca
del `PATH`. Antes de lanzar el build, confirmar que el recorte funcionó con
`PATH=<el mismo PATH recortado> which pod`: no debería encontrar nada.

Así se verificó en la práctica: `BUILD SUCCEEDED`, la app corriendo, y cero
menciones de CocoaPods en todo el log.

## Qué revisar en el harness

- **Tri-estado.** Con todo sin marcar, el preview muestra solo `operationId`,
  sin la clave `options`. Es el caso del comercio que no configura nada, y es el
  que más se rompe sin querer.
- **`false` explícito.** Marcar `showFooter` con el interruptor apagado manda
  `"showFooter": false`, que no es lo mismo que no mandar la clave.
- **Presets.** *Marca Khipu* usa púrpura `#8347AD` y cian `#3CB4E5`.
- **Recursos en el camino CocoaPods.** El plugin ya no declara `use_frameworks!`, así que los
  pods se enlazan estáticos. Esto está verificado a nivel de build —`KhipuClientIOS.bundle`
  aparece copiado dentro del `.app`— pero no en runtime. Corriendo `npm run ios:pods`, verificar
  que la vista de Khipu muestre imágenes y tipografías reales, no cuadros vacíos. Un recurso que
  no resuelve falla al mostrarse, no al compilar, así que el build verde no basta.
- **Persistencia.** El `operationId` sobrevive a una recarga.
- **Resultado — no verificado con un `operationId` real.** Lo único que se probó hasta ahora fue
  un id inventado (dispara la pantalla nativa de error del SDK) y una inyección sintética
  directamente en `mostrarResultado()`, sin pasar por el SDK. Falta correr el camino feliz con un
  `operationId` de un ambiente de pruebas de Khipu y confirmar que, al terminar la operación,
  aparecen los campos de `KhipuResult`; la tabla de eventos solo aparece si la operación devolvió
  eventos (`harness.js` no la dibuja cuando `events` viene vacío).

## Fricciones conocidas del entorno

Ninguna es del plugin, pero cuestan tiempo si no se saben:

- **`cordova run ios` en el camino de CocoaPods** puede fallar buscando un runtime que el
  simulador por defecto no tiene. Se resuelve con `cordova run ios --target=<simIdentifier>`.
  Ojo: `cordova-ios` 7 espera un identificador tipo `iPhone-17`, **no** un UDID.
- **`adb install` puede fallar por falta de espacio** en la partición `/data` del emulador, sin
  que el build de Gradle tenga nada que ver. Se resuelve arrancando el AVD con
  `-wipe-data -partition-size 8192`.
- **`[ios-sim] Simulator already running`** si quedó un simulador abierto de una corrida
  anterior. Se resuelve con `xcrun simctl shutdown all` antes de reintentar.

## Limitaciones

Cordova no tiene fallback web: `window.Khipu` solo existe después de
`deviceready`. Abrir `www/index.html` en un navegador muestra la interfaz pero
el botón queda deshabilitado.
