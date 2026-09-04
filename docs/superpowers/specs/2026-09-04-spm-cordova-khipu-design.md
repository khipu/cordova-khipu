# Migración de `cordova-khipu` a Swift Package Manager, compatibilidad con Cordova actual y app de ejemplo

**Fecha:** 2026-09-04
**Estado:** diseño aprobado, pendiente de plan de implementación
**Repo:** `khipu/cordova-khipu`
**Versión de partida:** `2.9.1`

## 1. Problema y objetivo

`cordova-khipu` consume `KhipuClientIOS` únicamente por CocoaPods. `cordova-ios` 8 trae
soporte nativo de Swift Package Manager, y `KhipuClientIOS` publica `Package.swift` desde
el tag 2.16.3. Hoy un comercio que quiera una app sin CocoaPods queda bloqueado por
nosotros.

Además el plugin declara una dependencia de `cordova-plugin-add-swift-support` que
**rompe cordova-ios 8** (§5), y el repositorio no tiene app de ejemplo, a diferencia de
`flutter_khipu` y `capacitor-khipu`.

Alcance de este trabajo:

1. Soporte SPM en iOS, **dual con CocoaPods**.
2. Compatibilidad con el stack Cordova actual: `cordova` 13, `cordova-ios` 8.1.1,
   `cordova-android` 15.1.0.
3. App de ejemplo con harness completo, capaz de ejercitar **ambos** gestores de paquetes.
4. Los arreglos de robustez y empaquetado que el trabajo toca de todas formas.

Este trabajo es el tercer eslabón de una serie: `KhipuClientIOS` ya migró
(`docs/superpowers/specs/2026-06-28-spm-khipuclientios-design.md` en su repo), y hay
specs hermanos del mismo día para
[`flutter_khipu`](../../../../flutter_khipu/docs/superpowers/specs/2026-09-04-spm-flutter-khipu-design.md)
y
[`capacitor-khipu`](../../../../capacitor-khipu/docs/superpowers/specs/2026-09-04-migracion-spm-capacitor-8-design.md).
Donde una decisión ya se tomó en esos specs, aquí se mantiene.

## 2. Hechos verificados el 2026-09-04

Todo lo de esta tabla se comprobó leyendo el código de los paquetes publicados, no de
memoria ni de documentación.

| Dato | Valor | Cómo se verificó |
| --- | --- | --- |
| Últimas versiones de Cordova | `cordova` 13.0.0 · `cordova-ios` 8.1.1 · `cordova-android` 15.1.0 | `npm view` |
| SPM en Cordova iOS | desde **`cordova-ios` 8.0.0** (PR GH-1515, "feat(spm): Support plugins as Swift packages") | `RELEASENOTES.md:137` del tarball de `cordova-ios@8.1.1` |
| Cómo se declara un plugin SPM | atributo `package="swift"` en `<platform name="ios">` + `Package.swift` en la raíz del plugin | `lib/SwiftPackage.js` → `isSwiftPackagePlugin()` evalúa `!!platform.package`; `getPlatforms()` de `cordova-common` devuelve todos los atributos del `<platform>` |
| Nombres obligatorios del package | package y product deben llamarse **`cordova-khipu`** (el id del plugin) | `SwiftPackage._pluginReference()` genera `.product(name: "${plugin.id}", package: "${plugin.id}")` |
| Qué hace cordova-ios 8 al instalar un plugin SPM | copia el plugin completo a `platforms/ios/packages/<id>/` y **reescribe el `Package.swift` copiado** para apuntar a la CordovaLib local | `SwiftPackage.addPlugin()`, regex `package\(.+cordova-ios.+\)` |
| Qué ignora cordova-ios 8 en un plugin SPM | `<source-file>`, `<header-file>`, `<resource-file>`, `<framework>`, `<lib-file>` | `lib/plugman/pluginHandlers.js`, seis `if (isSwiftPackagePlugin(plugin)) return;` |
| Convivencia podspec + SPM | el `<pod>` acepta `nospm="true"` para que cordova-ios 8 lo descarte | `lib/Api.js:397` (`!isSPM \|\| (isSPM && !_isTrue(podJson.nospm))`) + `getPodSpecs()` de `cordova-common`, que expone todos los atributos del `<pod>` |
| Módulo `Cordova` bajo SPM | existe en cordova-ios 8: `CordovaLib/include/Cordova/CDV.h` genera el módulo | árbol del tarball de `cordova-ios@8.1.1` |
| Módulo `Cordova` en cordova-ios 7 | **no existe**: ningún `.modulemap` en el paquete; `CDVPlugin` llega por bridging header | `find` sobre el tarball de `cordova-ios@7.1.1` |
| Resolución de la clase del plugin | `NSClassFromString(className)`, con fallback a `"<CFBundleExecutable>.<className>"` | `CordovaLib/Classes/Public/CDVViewController.m:826-831` |
| Protección contra dead-stripping | el template de cordova-ios 8 trae `-ObjC` en `OTHER_LDFLAGS` | `templates/project/App.xcodeproj/project.pbxproj:451-453, 489-491` |
| `SWIFT_VERSION` en el template | **ausente** en cordova-ios 7 · `5.0` en cordova-ios 8 | `project.pbxproj` de cada template |
| `SWIFT_OBJC_BRIDGING_HEADER` en el template | **ausente** en cordova-ios 7 · `"$(TARGET_NAME)/Bridging-Header.h"` en cordova-ios 8 | ídem |
| Nombre del proyecto Xcode | cordova-ios 7: `<config.name()>.xcodeproj` · cordova-ios 8: **siempre `App.xcodeproj`** | `lib/create.js:140` (ios 7) vs `lib/create.js:128` (ios 8) |
| `swift-version` del `<pod>` | solo aplica a los targets del proyecto `Pods`, **nunca** al target de la app | `lib/PodsJson.js` → `setSwiftVersionForCocoaPodsLibraries()` |
| `<preference name="SwiftVersion">` | soportada en ambas versiones | `lib/prepare.js:306` (ios 7), `lib/prepare.js:329` (ios 8) |
| Deployment target por defecto | cordova-ios 7: 11.0 · cordova-ios 8: 13.0 | `project.pbxproj` de cada template |
| Defaults de `cordova-android` 15.1.0 | minSdk 24, SDK 36, Gradle 8.14.2, AGP 8.10.1, Kotlin 2.1.21, Java 11 | `framework/cdv-gradle-config-defaults.json` |
| `IS_GRADLE_PLUGIN_KOTLIN_ENABLED` | **sigue existiendo** en cordova-android 15 | mismo archivo + `lib/prepare.js:113` |
| SPM en `KhipuClientIOS` | desde el tag **2.16.3**; último **2.16.5**; `platforms: [.iOS(.v13)]` | tags del repo + su `Package.swift` |
| Último `khipu-client-android` | **2.27.0**, que es lo que el plugin ya fija | spec de `capacitor-khipu`, verificado contra el nexus de Khipu |
| Plugins de Apache con soporte SPM | **ninguno publicado**: `cordova-plugin-device@3.0.0`, `-camera@8.0.0`, `-statusbar@4.0.0` no traen `Package.swift` | `tar tzf` de cada tarball |
| Archivos ausentes en el repo | `LICENSE`, `CHANGELOG.md`, `.npmignore`, `.github/`, campo `files` en `package.json` | inspección del repo |

### Antigüedad de cada línea (fechas de publicación en npm)

| Versión | Publicada | Antigüedad al 2026-09-04 |
| --- | --- | --- |
| `cordova-ios` 6.0.0 | 2020-06-01 | 6 años 3 meses |
| `cordova-ios` 6.3.0 (última de la línea 6) | 2023-04-17 | 3 años 5 meses |
| `cordova-ios` 7.0.0 | 2023-07-10 | 3 años 2 meses |
| `cordova-ios` 7.1.1 (última de la línea 7) | 2024-07-24 | 2 años 1 mes |
| `cordova-ios` 8.0.0 | 2025-11-23 | 9 meses |
| `cordova-ios` 8.1.1 | 2026-07-07 | 2 meses |
| `cordova-android` 13.0.0 | 2024-05-23 | 2 años 3 meses |
| `cordova-android` 15.1.0 | 2026-07-22 | 1 mes |
| `cordova` (CLI) 13.0.0 | 2025-11-25 | 9 meses |

Requisitos declarados por cada línea de iOS, de su `check_reqs.js` y su `package.json`:

| | Xcode mínimo | Node | `cordova-common` |
| --- | --- | --- | --- |
| `cordova-ios` 6.3.0 | no declarado | `>=10` | `^4.0.2` |
| `cordova-ios` 7.1.1 | 11.0.0 | `>=16.13.0` | `^5.0.0` |
| `cordova-ios` 8.1.1 | 15.0.0 | `^20.17.0 \|\| >=22.9.0` | `^6.0.0` |

### Estado del plugin hoy

| Ítem | Valor |
| --- | --- |
| `plugin.xml` | `<pod name="KhipuClientIOS" version="2.16.2" swift-version="5.1"/>`, `use-frameworks="true"` |
| Fuente iOS | un solo archivo, `src/ios/KhipuPlugin.swift` (~170 líneas) |
| Fuente Android | `src/android/com/khipu/cordova/KhipuPlugin.java` + `src/android/khipu.gradle` |
| JS | `www/cordova-khipu.js`, 7 líneas, expone `window.Khipu.startOperation` |
| Dependencias | `cordova-plugin-add-swift-support@2.0.2` |
| Hooks | `after_prepare` → `scripts/enable-gradle-kotlin-plugin.js` |
| README | habla de "cordova 11", Kotlin 1.9.10, Gradle 8.7, SDK 34, deployment target 12.0 |

## 3. Decisiones

| Decisión | Valor |
| --- | --- |
| Alcance iOS | **Dual** cordova-ios 7 (CocoaPods) + 8 (SPM), en una sola rama |
| App de ejemplo | **Harness completo** con tri-estado, presets y preview del JSON |
| Android | **Completo**: repositorios, DSL de AGP 8, hook de Kotlin, README |
| `cordova-plugin-add-swift-support` | **Reemplazar** por hook propio, consciente de la versión |
| Robustez de `KhipuPlugin.swift` | **Sí**, con tests |
| Higiene de empaquetado npm | **Sí** |
| CI | **Fuera de alcance** (descartado explícitamente) |
| Versión a publicar | `2.10.0` |

### Por qué dual y no una rama por major

`capacitor-khipu` eligió branch-por-major porque en Capacitor los dos gestores **no
pueden coexistir en un mismo proyecto iOS** y cada major sube el piso de iOS. En Cordova
la situación es distinta: un mismo `plugin.xml` describe los dos caminos y cada versión
de cordova-ios lee solo lo que entiende (§4). El costo del dual acá es un shim de
`import` de tres líneas y una versión de `KhipuClientIOS` duplicada en dos archivos, que
se cubre con un check en el release. No justifica dos ramas.

## 4. iOS — cómo conviven los dos gestores

### 4.1 `plugin.xml`

```xml
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
  <source-file src="src/ios/KhipuOptionsMapper.swift"/>
</platform>
```

- **cordova-ios 7** no conoce el atributo `package`, lo ignora, y usa `<podspec>` +
  `<source-file>` exactamente como hoy.
- **cordova-ios 8** ve `package="swift"` → `isSwiftPackagePlugin()` es verdadero →
  `pluginHandlers.js` descarta los `<source-file>`, y `nospm="true"` hace que `Api.js`
  descarte el pod. Queda SPM puro, **sin necesidad de CocoaPods instalado**.

Se agrega además un bloque `<engines>` para fallar temprano y con mensaje claro:

```xml
<engines>
  <engine name="cordova-ios" version=">=7.0.0"/>
  <engine name="cordova-android" version=">=13.0.0"/>
</engines>
```

El piso de iOS queda en 7 y **deja fuera a cordova-ios 6 deliberadamente**. La línea 6 lleva
3 años y 5 meses sin release, declara `node >=10` y `cordova-common ^4` mientras el CLI
`cordova` 13 trae `cordova-common` 6, y desde el 24 de abril de 2025 App Store Connect
rechaza cualquier build que no use Xcode 16 con SDK de iOS 18: un comercio en cordova-ios 6
no puede publicar actualizaciones hoy. El plugin nunca declaró `<engines>`, así que esto no
retira una promesa, la escribe.


### 4.2 `Package.swift` (raíz del plugin)

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

**Los nombres no son decorativos.** `SwiftPackage._pluginReference()` genera literalmente
`.product(name: "cordova-khipu", package: "cordova-khipu")` a partir del id del plugin, así
que el `name:` del package y el del product tienen que ser exactamente `cordova-khipu` o la
resolución falla. El target puede llamarse distinto, pero se deja igual por simetría; su
nombre de módulo en Swift queda como `cordova_khipu`.

La dependencia a `apache/cordova-ios` la reescribe el propio Cordova al instalar el plugin,
apuntándola a la CordovaLib local del proyecto. El `from: "8.0.0"` solo se usa cuando
compilamos el paquete suelto, es decir, al correr los tests.

### 4.3 El shim de `import`

En `KhipuPlugin.swift` y `KhipuOptionsMapper.swift`:

```swift
#if canImport(Cordova)
import Cordova   // cordova-ios 8: SPM genera el módulo desde CordovaLib/include/Cordova/
#endif
import KhipuClientIOS
```

En cordova-ios 7 no hay módulo `Cordova` y `CDVPlugin` llega por el bridging header, así
que `canImport` es falso y el archivo compila igual.

### 4.4 Dos cosas que no hay que romper

- **`@objc(KhipuPlugin)` pasa a ser load-bearing.** `CDVViewController` resuelve la clase
  con `NSClassFromString(@"KhipuPlugin")`; su fallback construye
  `"<CFBundleExecutable>.<className>"`, que bajo SPM nunca coincide con nuestro módulo. El
  atributo ya está en el código; solo hay que no sacarlo.
- **El `-ObjC` de `OTHER_LDFLAGS`** en el template de cordova-ios 8 es lo que impide que el
  linker descarte la clase del static lib que produce SPM. No lo ponemos nosotros, pero es
  la razón por la que esto funciona.

### 4.5 Fijación de `KhipuClientIOS`

`exact: "2.16.5"` en SPM y `version="2.16.5"` en el pod, no rangos, para que un comercio que
instala por CocoaPods y otro que instala por SPM **de la misma versión del plugin** resuelvan
el mismo grafo nativo. Es la misma decisión que tomaron `KhipuClientIOS` en su propio
`Package.swift`, `flutter_khipu` y `capacitor-khipu`.

El bump desde `2.16.2` es obligatorio: esa versión no tiene `Package.swift` y por lo tanto no
se puede consumir por SPM.

**El atributo es `spec`, no `version`.** Se descubrió compilando (Task 3 del plan): `Podfile.js`
de cordova-ios solo lee `json.spec` para emitir la restricción de versión
(`if ('spec' in json && json.spec.length)`, línea 300); un atributo `version` se ignora en
silencio. El `plugin.xml` publicado en `cordova-khipu` 2.9.1 dice `version="2.16.2"`, así que
**el plugin nunca fijó la versión del pod**: genera `pod 'KhipuClientIOS'` sin restricción y cada
comercio del camino CocoaPods recibe lo que CocoaPods resuelva. Es un defecto preexistente que
esta migración destapa y corrige.

**El bloque `<config><source>` se elimina.** El `// sources` de `Api.js` **no** está protegido por
`isSwiftPackagePlugin`, a diferencia del `// libraries` que está justo debajo. Con un `<source>`
declarado, cordova-ios 8 marca el Podfile como sucio y corre `pod install` igual, aunque
`nospm="true"` haya descartado el pod — lo que rompe la premisa de "SPM puro, sin CocoaPods".
Declarar el trunk de CocoaPods era además redundante: es el source por defecto cuando no se
declara ninguno.

**Y `use-frameworks="true"` también se elimina.** `getPodSpecs()` convierte los atributos de
`<pods>` en *declaraciones* del Podfile (`use_frameworks!`), y el bloque `// declarations` de
`Api.js` tampoco tiene guarda de `isSwiftPackagePlugin`: esa sola declaración basta para
disparar `pod install`. No alcanza con dejarlo, porque en macOS `check_cocoapods` **rechaza**
si falta el binario `pod` (solo devuelve `ignore` fuera de macOS), así que un comercio en
cordova-ios 8 sin CocoaPods vería fallar `cordova plugin add`.

Queda un artefacto que no se puede evitar: **cordova-ios 8 escribe igual un `Podfile` vacío**.
El constructor de su clase `Podfile` escribe el archivo apenas se instancia, antes de evaluar
contenido, y se instancia por el solo hecho de que el plugin declare un `<podspec>`. Como no se
le agrega nada, `isDirty()` queda en `false` y `pod install` nunca corre. La promesa del diseño
es que **no hace falta CocoaPods instalado**, no que el archivo no exista, y se verifica
compilando con el binario `pod` fuera del `PATH`.

Sin `use_frameworks!` los pods se enlazan estáticos. Es seguro para `KhipuClientIOS`: su
podspec usa `s.resource_bundles` —el mecanismo pensado para enlace estático— y su
`BundleHelper` resuelve por `Bundle(for:).path(forResource:ofType:"bundle")`, que funciona en
los dos modelos. Queda como **riesgo a confirmar en runtime** con la app de ejemplo en el
camino CocoaPods: un recurso que no resuelve falla al mostrarse, no al compilar.

Contrapartida aceptada: si la app del comercio declara además `KhipuClientIOS` en otra
versión, SPM falla con un conflicto duro en vez de negociar.

### 4.6 Piso de iOS

**13.0 en ambos caminos.** cordova-ios 8 ya trae `IPHONEOS_DEPLOYMENT_TARGET = 13.0` por
defecto y el `Package.swift` de `KhipuClientIOS` declara `.iOS(.v13)`. El README dice 12.0
hoy; se actualiza a 13.0, un solo número que documentar.

Para cordova-ios 7, cuyo template arranca en 11.0, el README mantiene la instrucción de
poner `<preference name="deployment-target" value="13.0"/>` en el `config.xml` de la app.

## 5. Reemplazo de `cordova-plugin-add-swift-support`

### Por qué sale

El hook de ese plugin arma la ruta del proyecto Xcode así:

```js
projectName = config.name();
pbxprojPath = path.join(platformPath, projectName + '.xcodeproj', 'project.pbxproj');
xcodeProject = xcode.project(pbxprojPath);
xcodeProject.parseSync();
```

En cordova-ios 8 el proyecto se llama **siempre `App.xcodeproj`**, sin importar el nombre de
la app, así que ese archivo no existe y `parseSync()` lanza ENOENT dentro de un `.then()` sin
`.catch` — rechazo no manejado. El hook corre en `platform add`, `plugin add` y `prepare`, que
son justo los comandos que usa cualquiera.

Se suma que usa `glob` con callback, API eliminada en glob v9, y que su último release es
`2.0.2`, sin mantención.

El `swift-version="5.1"` de nuestro `<pod>` no cubre el hueco:
`PodsJson.setSwiftVersionForCocoaPodsLibraries()` solo lo aplica a los targets del proyecto
`Pods`, nunca al target de la app.

### Qué entra

`scripts/configure-swift-ios.js`, registrado como `<hook type="after_prepare">` dentro de
`<platform name="ios">`:

1. Detecta la versión de cordova-ios ejecutando `platforms/ios/cordova/version`, que existe
   en ambos majors. Si eso falla, cae a un heurístico: la presencia de
   `platforms/ios/App.xcodeproj` implica cordova-ios 8+.
2. Si es **≥ 8** → no hace nada y sale. El template ya trae `SWIFT_VERSION` y
   `SWIFT_OBJC_BRIDGING_HEADER`.
3. Si es **< 8** → abre el pbxproj real y fija, solo si no están ya definidos:
   `SWIFT_VERSION` (respetando `<preference name="SwiftVersion">` si el comercio la definió,
   y `5.0` por defecto), `SWIFT_OBJC_BRIDGING_HEADER` y
   `ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES`.
4. Ante cualquier error, **emite una advertencia y sigue** en vez de abortar el build. Es
   precisamente lo que hace mal el plugin que reemplaza.

El hook usa `require('xcode')`, que resuelve desde el `node_modules` del proyecto porque
`cordova-ios` lo declara como dependencia. Es el mismo mecanismo que usaba
`cordova-plugin-add-swift-support`, con el `try/catch` que a ese le falta.

## 6. Android

| | hoy | queda |
| --- | --- | --- |
| Repositorios | `google()`, `jcenter()`, nexus de Khipu | `google()`, **`mavenCentral()`**, nexus de Khipu |
| Excludes | `packagingOptions { exclude ... }` | `packaging { resources { excludes += [...] } }` (DSL de AGP 8) |
| `khipu-client-android` | 2.27.0 | 2.27.0, ya es la última |
| Hook de Kotlin | `enable-gradle-kotlin-plugin.js` | igual, verificado contra cordova-android 15 |

`jcenter()` está apagado desde 2022: hoy solo agrega latencia y un fallo silencioso. El
plugin funciona porque el template de cordova-android ya declara `mavenCentral()` en el root,
no porque `jcenter()` sirva. Declararlo nosotros deja de depender de ese accidente.

El DSL `packaging { resources { excludes } }` requiere AGP 8, que es cordova-android 12 en
adelante; el `<engines>` de §4.1 ya declara un piso de 13. Durante la implementación hay que
verificar si esos excludes siguen siendo necesarios: AGP moderno excluye varios
`META-INF/*` por defecto, y si el conflicto ya no se produce, el bloque se borra en vez de
migrarse.

El README de Android habla de "cordova 11", Kotlin 1.9.10, Gradle 8.7, AGP 8.3.0 y SDK 34.
Se reescribe contra los defaults reales de cordova-android 15.1.0 (Kotlin 2.1.21,
Gradle 8.14.2, AGP 8.10.1, minSdk 24, SDK 36). Los workarounds de `kotlin-android-extensions`
y de `namespace` **se eliminan**: eran específicos de cordova-android 11, y el `<engines>` de
§4.1 pone el piso en 13.

## 7. App de ejemplo

```
example/
├── package.json      scripts ios:pods / ios:spm / android
├── config.xml
├── www/
│   ├── index.html
│   ├── css/harness.css
│   └── js/harness.js
└── README.md         matriz de verificación manual
```

`platforms/`, `plugins/` y `node_modules/` **no se commitean**: son generados.

### 7.1 Ejercitar los dos gestores

El gestor lo decide el major de la plataforma, no un flag:

| Script | Qué hace | Camino ejercitado |
| --- | --- | --- |
| `npm run ios:pods` | `platform rm ios` → `platform add ios@7` → `run ios` | `<podspec>` + `<source-file>` |
| `npm run ios:spm` | `platform rm ios` → `platform add ios@8` → `run ios` | `Package.swift`, sin CocoaPods |
| `npm run android` | `platform add android@15` → `run android` | `khipu.gradle` |

Un solo `www/` y un solo `config.xml` sirven para los tres. El `config.xml` declara
`deployment-target` 13.0, que satisface a ambos majors de iOS.

### 7.2 Cómo se instala el plugin — pendiente del spike

Cuando el `example/` vive **dentro** del repo del plugin, `copyPlugin()` de `cordova-lib`
(`src/plugman/fetch.js:257`) tiene una rama que fuerza modo symlink si el destino es hijo del
origen, y npm deja un symlink en `node_modules` para dependencias de ruta local. Si el
resultado es que `plugins/cordova-khipu` apunta al repo, `SwiftPackage.addPlugin()`
**reescribiría el `Package.swift` real del plugin** al reemplazar la dependencia de
cordova-ios por la ruta local.

No se pudo determinar el comportamiento exacto sin ejecutarlo. La fase 2 del plan (§10) es un
spike que prueba las tres alternativas y elige:

1. `cordova plugin add ../`
2. `cordova plugin add ../ --link`
3. `npm pack` en la raíz y `cordova plugin add ./cordova-khipu-2.10.0.tgz`

La opción 3 es el plan B preferido si las otras corrompen algo, porque además valida
exactamente el artefacto que recibe un comercio desde npm. Cualquiera que se elija queda
documentada en `example/README.md` y encapsulada en los scripts de `package.json`.

### 7.3 El harness

HTML + JS plano, sin framework. Expone **todos** los campos de `KhipuOptions` con
**tri-estado por campo**: cada fila tiene una casilla "incluir" además de su control, y sin
marcar, la clave no se agrega al payload.

Esto es el requisito central, no un adorno. El plugin distingue "clave ausente" de `false`
—ver `options!["showFooter"] != nil` en `KhipuPlugin.swift` y `options.has(...)` en
`KhipuPlugin.java`— y el SDK nativo aplica sus propios valores por omisión. Si el harness
enviara siempre los cinco booleanos, sería imposible probar el comportamiento por defecto,
que es justo el que ve un comercio que no configura nada.

Campos:

- `operationId`: texto, obligatorio.
- `title`, `titleImageUrl`, `locale`: texto.
- `theme`: selector `light` / `dark` / `system`.
- `skipExitPage`, `skipExitSuccessPage`, `showFooter`, `showMerchantLogo`,
  `showPaymentDetails`: interruptores.
- `colors`: los 12 campos (`light`/`dark` × `Background`, `OnBackground`, `Primary`,
  `OnPrimary`, `TopBarContainer`, `OnTopBarContainer`) como selectores de color. El objeto
  `colors` completo también se puede omitir.

Otras características:

- **Preview del JSON exacto** que se va a enviar, visible antes de disparar la operación.
- **Persistencia en `localStorage`**: probando en dispositivo se recarga mucho y retipear el
  `operationId` cada vez es fricción real.
- **Presets**: *todo por defecto* (solo `operationId`), *marca Khipu* (púrpura `#8347AD`,
  cian `#3CB4E5`), *todo activado*, *modo oscuro*.
- **Resultado formateado**: los campos de `KhipuResult` más una tabla de eventos.
- **Guarda de `deviceready`.** A diferencia de Flutter y Capacitor, Cordova no tiene fallback
  web: `window.Khipu` solo existe después de `deviceready`. El botón arranca deshabilitado y
  el harness dice explícitamente por qué, en vez de fallar mudo si alguien abre el
  `index.html` en un navegador.

## 8. Robustez de `KhipuPlugin.swift`

- **`as!` → casts seguros.** El mapeo de opciones fuerza el cast en alrededor de veinte
  lugares; hoy un `title: 123` **crashea la app** en vez de devolver un error al JS. Se
  extrae a `src/ios/KhipuOptionsMapper.swift`, con una función pura
  `[String: Any] -> KhipuOptions` y `as?` en todos lados.
- **La búsqueda del presenter tiene dos defectos, y un solo arreglo.** Se parte de
  `self.viewController` de `CDVPlugin` —el controller que Cordova asocia al webview que hizo
  la llamada— y se baja por la cadena de `presentedViewController`.

  El primer defecto es que `UIApplication.shared.windows` está deprecado desde iOS 15 y
  devuelve ventanas de todas las escenas conectadas. **El compilador no avisa**: a un
  deployment target de iOS 13 la API todavía no está deprecada, así que el log del build no
  sirve para detectarlo (verificado con `swiftc -typecheck` a iOS 13, 15 y 18).

  El segundo es que UIKit rechaza presentar sobre un controller que ya está presentando algo.
  El código lo esquiva con `presentedViewController?.dismiss(animated: false)` seguido de un
  `asyncAfter` de un segundo fijo: es decir, **le cierra el modal al comercio** y adivina
  cuánto tarda. Bajar por la cadena no destruye nada y no necesita esperar, así que el
  `dismiss` y el segundo fijo desaparecen juntos.

  `CDVPlugin.viewController` existe en cordova-ios 7 (`UIViewController *`) y en 8
  (`CDVViewController *`), y no está deprecado en ninguna de las dos, a diferencia de otras
  propiedades del mismo header. La función se deja privada al plugin y no como extensión de
  `UIViewController`, porque el plugin se enlaza estáticamente dentro de la app del comercio.

  Los dos defectos los detectó primero la sesión que migró `flutter_khipu`, sobre el mismo
  patrón; acá se verificaron de nuevo contra el código de cordova-ios.
- **Tests** en `tests/ios/`: los veinte campos mapean correctamente, un campo con el tipo
  equivocado no crashea, y las claves ausentes no se agregan. El target de tests recién puede
  existir cuando existe `Package.swift`, así que esta fase va después de la de SPM.

El patrón análogo de `KhipuPlugin.java` (`Objects.requireNonNull` y `assert`) queda fuera de
alcance y se anota como pendiente, igual que en el spec de `capacitor-khipu`.

## 9. Empaquetado npm

- **`files`** en `package.json`: `plugin.xml`, `Package.swift`, `www/`, `src/`, `tests/`,
  `scripts/`, `README.md`, `LICENSE`. Hoy no hay `files` ni `.npmignore`, así que se publica
  todo — y con `example/` adentro eso crecería mucho.

  `tests/` **tiene que ir en el paquete**: `Package.swift` declara ese target y SPM falla si
  la ruta declarada no existe. Son unos pocos KB.

- **`LICENSE`**: falta el archivo, pese a que `package.json` declara MIT.
- **`CHANGELOG.md`**: `release-it` ya usa `@release-it/conventional-changelog` pero sin
  `infile`, así que no escribe nada. Se agrega el archivo y la opción.
- **Check de sincronía de versión.** La versión de `KhipuClientIOS` vive en dos archivos
  (`Package.swift` y `plugin.xml`). Sin CI, se cuelga del hook `after:bump` de `release-it`,
  que ya existe: si las dos difieren, el release falla. Es barato y ataca justo lo que se
  rompe solo cuando hay dos manifests.

## 10. Orden de trabajo

Cada fase deja el repositorio compilando y es verificable por separado.

1. **iOS dual.** `Package.swift`, `plugin.xml` con `package="swift"` + `nospm`, shim de
   `import`, `scripts/configure-swift-ios.js`, baja de la dependencia de
   `cordova-plugin-add-swift-support`, bump de `KhipuClientIOS` a 2.16.5. Se verifica con un
   proyecto Cordova desechable, uno por cada major de iOS. **Esta fase resuelve el riesgo 5**:
   si cordova-ios 7 no compila con el Xcode actual, se detiene y se reevalúa el dual antes de
   invertir en el resto.
2. **Spike de instalación local** (§7.2). Necesita el `Package.swift` de la fase 1. Su salida
   es una decisión documentada, no código de producción.
3. **App de ejemplo.** Harness completo y los tres scripts. A partir de acá, todo lo demás se
   verifica corriendo el ejemplo.
4. **Robustez de iOS.** `KhipuOptionsMapper`, `connectedScenes`, el `dismiss` determinista y
   los tests.
5. **Android.** Repositorios, DSL de AGP 8, verificación del hook de Kotlin contra
   cordova-android 15.
6. **Empaquetado y documentación.** `files`, `LICENSE`, `CHANGELOG.md`, check de sincronía,
   README reescrito (iOS y Android), bump a `2.10.0`.

## 11. Versión

**`2.10.0`.** Nadie en cordova-ios 7 se rompe, el bump de `KhipuClientIOS` de 2.16.2 a 2.16.5
es un patch upstream, y sacar la dependencia de terceros no cambia la API pública del plugin.
El `<engines>` nuevo es lo más cercano a un cambio incompatible, pero solo formaliza un piso
que en la práctica ya existía.

## 12. Verificación

Sin CI, la verificación es una matriz manual documentada en `example/README.md`:

| Escenario | Comando |
| --- | --- |
| cordova-ios 7 + CocoaPods | `cd example && npm run ios:pods` |
| cordova-ios 8 + SPM, sin CocoaPods instalado | `cd example && npm run ios:spm` |
| cordova-android 15 | `cd example && npm run android` |
| Tests de iOS | `xcodebuild test -scheme cordova-khipu-Package -destination 'platform=iOS Simulator,name=iPhone 16'` |

El escenario de SPM hay que correrlo con CocoaPods fuera del `PATH` al menos una vez: es lo
único que prueba de verdad que el camino no lo necesita.

## 13. Riesgos

1. **Instalación del plugin local en el ejemplo.** Es el spike de la fase 2. Si
   `cordova plugin add ../` deja un symlink al repo, `SwiftPackage.addPlugin()` reescribiría
   nuestro `Package.swift` real. Mitigación: instalar desde un tarball de `npm pack`.
2. **Somos early adopters.** Ningún plugin publicado de Apache usa SPM todavía, así que el
   camino está bastante menos probado que el de Flutter o Capacitor. Es esperable encontrar
   fricción no documentada.
3. **Recursos de `KhipuClientIOS` bajo SPM en una app Cordova.** Su `Package.swift` usa
   `.process("Assets")`, que genera un resource bundle resuelto vía `Bundle.module`. El spec
   de `flutter_khipu` lo validó en una app Flutter (fuentes, PNG y HTML cargando bien), pero
   en Cordova solo se comprueba corriendo la app en simulador o dispositivo.
4. **`khipu-client-android` 2.27.0 con Kotlin 2.1.21**, el default de cordova-android 15.
   `khipu-client-android` usa Jetpack Compose, cuyo compilador va atado a la versión de
   Kotlin. Es el mismo riesgo abierto que anotó el spec de `capacitor-khipu`, y **no hay
   evidencia de que funcione**: `flutter_khipu` consume ese mismo 2.27.0 pero fija
   `ext.kotlin_version = "1.9.0"` en su `android/build.gradle` y su README le pide al comercio
   Kotlin 1.9.0 o superior. O sea que "funciona en Flutter" es evidencia para 1.9.0, dos
   majors por debajo, y para nada más. La Task 11 del plan es el primer ejercicio real de esa
   combinación; si falla, hay que escalarlo al equipo del SDK de Android antes de publicar.
5. **Viabilidad real de cordova-ios 7 con el Xcode actual.** `check_reqs.js` declara pisos,
   no techos: cordova-ios 7 pide Xcode >= 11 y cordova-ios 8 pide >= 15. Pero 7.1.1 es de
   julio de 2024, anterior a Xcode 16, y Apache no la ha tocado desde entonces. Si el camino
   de CocoaPods no compila limpio con el Xcode que hoy se necesita para publicar en la App
   Store, el soporte dual estaría cubriendo una configuración que ningún comercio puede
   llevar a producción, y correspondería reconsiderar el dual a favor de SPM-only. **Se
   verifica en la fase 1**, que es donde sale barato.
6. **Pin exacto de `KhipuClientIOS`**: conflicto duro de resolución si la app del comercio
   declara la misma dependencia en otra versión. Consecuencia aceptada de mantener los dos
   gestores alineados.
7. **Sin CI, el dual depende de disciplina.** El check de sincronía del `after:bump` cubre la
   versión de `KhipuClientIOS`, pero nada impide publicar sin haber corrido la matriz de §12.

## 14. Fuera de alcance

- **CI en GitHub Actions.** Descartado explícitamente.
- Publicar el podspec en el trunk de CocoaPods: el plugin se consume desde npm.
- La plataforma `browser` de Cordova.
- Limpiar el patrón `Objects.requireNonNull` / `assert` de `KhipuPlugin.java`.
- Subir `khipu-client-android`: ya está en 2.27.0, la última.
- Soporte de Cordova para macOS/Catalyst.

## 15. Resultados de verificación

### Fase 1 — los dos majors de iOS (Task 3 del plan)

Ejecutado el 2026-09-04 con:

```
Xcode 26.6
Build version 17F113
```

| Escenario | Resultado |
| --- | --- |
| `cordova-ios@7.1.1` + CocoaPods, `cordova build ios --emulator` | OK — `** BUILD SUCCEEDED **`. Dos ajustes de entorno, ninguno atribuible al plugin ni a cordova-ios 7: (1) `cordova plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave` (el comando literal del brief) falla siempre en este cordova-lib/npm, tanto en cordova-ios 7 como 8 — ver detalle debajo; se instaló desde el `.tgz` ya extraído a un directorio. (2) el simulador "iPhone 16" solo existía en runtimes iOS 18.1/18.5, no en el runtime más nuevo instalado (26.5), que es el que `xcodebuild -destination` pide por defecto cuando no se fija OS; `cordova build ios --emulator --target=iPhone-16` fallaba con `Unable to find a device matching the provided destination specifier: { OS:latest, name:iPhone 16 }` hasta crear una instancia con `xcrun simctl create "iPhone 16" com.apple.CoreSimulator.SimDeviceType.iPhone-16 com.apple.CoreSimulator.SimRuntime.iOS-26-5`. |
| `cordova-ios@7.1.1`: Podfile presente con `KhipuClientIOS 2.16.5` | Parcial. El Podfile existe y contiene `pod 'KhipuClientIOS'`, pero **sin** el pin de versión esperado (`pod 'KhipuClientIOS', '2.16.5'`). Causa raíz: `plugin.xml` declara `<pod name="KhipuClientIOS" version="2.16.5" .../>`, pero cordova-ios (`PluginInfo.getPodSpecs` + `Podfile.write` en `cordova-ios/lib/Podfile.js:311`) solo reconoce el atributo `spec` para emitir la versión al Podfile (`<pod name="..." spec="2.16.5" />`, según el propio ejemplo documentado en `PluginInfo.js`); `version` se ignora silenciosamente. `Podfile.lock` confirma que CocoaPods resolvió igualmente `KhipuClientIOS (2.16.5)`, pero por ser la última versión publicada en el spec repo, no porque el Podfile la fije — un release futuro de `KhipuClientIOS` fluiría sin control por este camino. Es un bug de `plugin.xml` (Task 1/2), no del build ni de cordova-ios 7; requiere corregir el atributo a `spec=` en una tarea aparte. |
| `cordova-ios@7.1.1`: hook fijó `SWIFT_VERSION` y el bridging header | Sí. `project.pbxproj` contiene `SWIFT_VERSION = 5.0;` y `SWIFT_OBJC_BRIDGING_HEADER = "$(PROJECT_DIR)/$(PROJECT_NAME)/Bridging-Header.h";`, y el log de build muestra `cordova-khipu: SWIFT_VERSION=5.0 configurado para cordova-ios < 8.` |
| `cordova-ios@8.1.1` + SPM, `cordova build ios --emulator` | OK — `** BUILD SUCCEEDED **`. Mismos dos ajustes de entorno que en el escenario de cordova-ios 7 (instalación desde tarball extraído; simulador iPhone 16 creado en el runtime 26.5). |
| `cordova-ios@8.1.1`: sin Podfile, con `packages/cordova-khipu` | Parcial. `packages/cordova-khipu/` existe y es correcto (Package.swift copiado, con la dependencia a `cordova-ios` reescrita a `path: "../cordova-ios"`, y `cordova-ios-plugins/Package.swift` con las dos líneas `package.dependencies.append(...)` / `package.targets.first?.dependencies.append(...)`). Pero **sí se crea un Podfile** (vacío: `[!] The Podfile does not contain any dependencies.`, con `Pods/`, `Podfile.lock` y `pods.json` cuyo `libraries` queda `{}`). Causa raíz: en `cordova-ios/lib/Api.js#addPodSpecs`, el flag `nospm` del `<pod>` solo filtra `obj.libraries` (el pod concreto); los `obj.declarations` (`use_frameworks!`, viene de `<pods use-frameworks="true">`) y `obj.sources` (`<config><source .../></config>`) del mismo `<podspec>` se agregan al Podfile sin mirar `nospm`, y eso alcanza para marcar el Podfile "dirty" y disparar un `pod install` vacío. No rompe la compilación, pero contradice el diseño de "cordova-ios 8 no toca CocoaPods" y dejaría rastros (`Podfile`, `Pods/`) en cada proyecto que use la ruta SPM. |
| `cordova-ios@8.1.1`: el hook no emitió salida | Sí — `cordova prepare ios` no imprimió ninguna línea con `cordova-khipu` (`sin salida del hook: OK`). |

**Riesgo 5 (viabilidad de cordova-ios 7 con el Xcode actual):** resuelto. `cordova-ios@7.1.1` compila limpio (`BUILD SUCCEEDED`) bajo Xcode 26.6 usando la ruta de CocoaPods, sin ningún error de SDK, toolchain o CocoaPods propios de la incompatibilidad que se temía; el único obstáculo real para llegar a ese resultado fue de entorno (selección de simulador y forma de instalar un `.tgz` local), no de compatibilidad Xcode 26 / cordova-ios 7. El soporte dual sigue siendo viable en cuanto a compilación. Quedan abiertos, sin embargo, dos hallazgos nuevos de esta verificación que no estaban contemplados en los riesgos 1-7 y que conviene resolver antes de cerrar el plan: (a) el pin de `KhipuClientIOS` en el Podfile no se aplica por el atributo `version` vs `spec` en `plugin.xml`, y (b) `cordova-ios@8.1.1` sigue generando un Podfile vacío y corriendo `pod install` por los `declarations`/`sources` del `<podspec>` que no respetan `nospm`.
