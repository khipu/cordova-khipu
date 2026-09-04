# Migración de `cordova-khipu` a SPM, compatibilidad con Cordova actual y app de ejemplo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `cordova-khipu` se pueda instalar por Swift Package Manager en cordova-ios 8 sin dejar de funcionar por CocoaPods en cordova-ios 7, esté al día con cordova-android 15, y traiga una app de ejemplo que ejercite los dos gestores.

**Architecture:** Un solo `plugin.xml` describe ambos caminos: cordova-ios 7 ignora el atributo `package="swift"` y usa `<podspec>` + `<source-file>`; cordova-ios 8 lo reconoce, descarta los `<source-file>` y, gracias a `nospm="true"` en el `<pod>`, también descarta CocoaPods, quedando con el `Package.swift` de la raíz. El código Swift usa `#if canImport(Cordova)` para compilar en los dos mundos. La app de ejemplo vive en `example/` y elige el gestor pinneando el major de la plataforma.

**Tech Stack:** Cordova 13 · cordova-ios 7.1.1 y 8.1.1 · cordova-android 15.1.0 · Swift 5.9 / SPM · CocoaPods · `KhipuClientIOS` 2.16.5 · `khipu-client-android` 2.27.0 · Node 20+ (`node --test`, sin frameworks de test nuevos)

**Spec:** `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md`

## Global Constraints

Estos valores aplican a **todas** las tareas. Están copiados textuales del spec.

- El **package y el product de SPM deben llamarse exactamente `cordova-khipu`** (el id del plugin). `SwiftPackage._pluginReference()` de cordova-ios genera `.product(name: "cordova-khipu", package: "cordova-khipu")`; cualquier otro nombre rompe la resolución. El nombre del **target** sí es libre y es `CordovaKhipu`.
- **`KhipuClientIOS` fijado en `2.16.5` exacto** en los dos manifests: `exact: "2.16.5"` en `Package.swift` y **`spec="2.16.5"`** en el `<pod>` de `plugin.xml`. Nunca rangos, y nunca el atributo `version`: `Podfile.js` de cordova-ios solo lee `spec` y descarta `version` en silencio, dejando el pod sin pin.
- **Piso de iOS 13.0** en los dos caminos.
- **`khipu-client-android` queda en `2.27.0`**, que ya es la última.
- **`@objc(KhipuPlugin)` no se toca.** `CDVViewController` resuelve la clase con `NSClassFromString("KhipuPlugin")` y su fallback usa `CFBundleExecutable`, que bajo SPM nunca coincide con el módulo. Sin ese atributo el plugin no se encuentra en runtime.
- **`<engines>`:** `cordova-ios >=7.0.0`, `cordova-android >=13.0.0`.
- **Versión a publicar al final: `2.10.0`.** Hasta la Task 13 el `version` de `package.json` y `plugin.xml` se deja en `2.9.1`.
- **Colores de marca Khipu:** púrpura `#8347AD`, cian `#3CB4E5`.
- **Node 20.19.4** para todo lo que invoque cordova. `cordova-ios` 8.1.1 declara
  `engines.node: "^20.17.0 || >=22.9.0"`, y la v20.12.2 que toma el shell por defecto en esta
  máquina no lo cumple. Usar el prefijo de PATH:
  `export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"`.
- **No se agrega CI.** Está fuera de alcance por decisión explícita.
- **No se publica a npm dentro de este plan.** La Task 13 deja todo listo; publicar requiere una confirmación aparte.
- Todo comentario y texto de usuario va en español, con acentos correctos.

## File Structure

**Se crean:**

| Archivo | Responsabilidad |
| --- | --- |
| `Package.swift` | Manifiesto SPM del plugin. Único lugar donde vive la versión de `KhipuClientIOS` para el camino SPM. |
| `src/ios/KhipuOptionsMapper.swift` | Traduce el diccionario que llega de JS a un tipo propio y de ahí al Builder del SDK. Es lo único de iOS que se puede testear en aislamiento. |
| `tests/ios/KhipuOptionsMapperTests.swift` | Tests del mapper. |
| `scripts/configure-swift-ios.js` | Hook `after_prepare` que configura Swift solo en cordova-ios < 8. Reemplaza a `cordova-plugin-add-swift-support`. |
| `scripts/check-native-versions.js` | Falla si la versión de `KhipuClientIOS` difiere entre `Package.swift` y `plugin.xml`. |
| `tests/scripts/configure-swift-ios.test.js` | Tests de los helpers del hook (`node --test`). |
| `tests/scripts/check-native-versions.test.js` | Tests del comparador de versiones. |
| `example/package.json` | Scripts `ios:pods` / `ios:spm` / `android`. |
| `example/scripts/install-plugin.mjs` | Empaqueta el plugin y lo instala en el ejemplo desde el tarball, con los dos rodeos que exige `cordova-lib` 13. |
| `.nvmrc` | Fija Node 20.19.4. Hoy el repo hereda el `.nvmrc` del directorio padre, que apunta a una versión que `cordova-ios` 8 no acepta. |
| `example/config.xml` | Config de la app de ejemplo. Piso iOS 13. |
| `example/.gitignore` | Ignora `platforms/`, `plugins/`, `node_modules/` y los tarballs. |
| `example/www/index.html` | Shell del harness. |
| `example/www/css/harness.css` | Estilos del harness. |
| `example/www/js/harness.js` | Toda la lógica del harness: campos, tri-estado, presets, preview, resultado. |
| `example/README.md` | Matriz de verificación manual. |
| `CHANGELOG.md` | Generado por `@release-it/conventional-changelog`. |
| `LICENSE` | Falta hoy pese a que `package.json` declara MIT. **Bloqueado** hasta confirmar la licencia (ver Task 12). |

**Se modifican:**

| Archivo | Cambio |
| --- | --- |
| `plugin.xml` | `package="swift"`, `nospm="true"`, `KhipuClientIOS` 2.16.5, `<engines>`, hook nuevo, baja de `cordova-plugin-add-swift-support`, `<source-file>` del mapper |
| `src/ios/KhipuPlugin.swift` | Shim de `import`, uso del mapper, presenter desde `self.viewController` |
| `src/android/khipu.gradle` | `mavenCentral()` en vez de `jcenter()`, DSL de packaging de AGP 8 |
| `package.json` | `files`, `scripts.test`, `scripts.verify:versions`, hooks de `release-it`, `infile` del changelog |
| `README.md` | Secciones de iOS y Android reescritas |
| `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` | Sección de resultados de verificación (Tasks 3 y 4) |

---

### Task 1: `Package.swift` y `plugin.xml` dual

**Files:**
- Create: `Package.swift`
- Modify: `plugin.xml`
- Modify: `src/ios/KhipuPlugin.swift:1`

**Interfaces:**
- Consumes: nada.
- Produces: package SPM `cordova-khipu`, product `cordova-khipu`, target `CordovaKhipu` (módulo Swift `CordovaKhipu`) con sus fuentes en `src/ios`. Las tareas 9 y 10 agregan archivos a ese mismo target y a `<source-file>`.

- [ ] **Step 1: Confirmar que hoy no hay paquete SPM**

Run: `swift package describe`
Expected: FAIL con `error: Could not find Package.swift in this directory`

- [ ] **Step 2: Crear `Package.swift`**

```swift
// swift-tools-version:5.9

import PackageDescription

// El nombre del package y el del product tienen que ser exactamente el id del
// plugin: cordova-ios genera `.product(name: "cordova-khipu", package:
// "cordova-khipu")` a partir de él (SwiftPackage._pluginReference). El nombre
// del target sí es libre.
//
// La dependencia a apache/cordova-ios la reescribe cordova al instalar el
// plugin, apuntándola a la CordovaLib local del proyecto; acá solo se usa para
// compilar y testear el paquete suelto. En la práctica resuelve a 8.0.0 exacto,
// porque Apache etiqueta los releases posteriores como `rel/8.1.1` y SPM no lee
// esos tags como semver.
let package = Package(
    name: "cordova-khipu",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(name: "cordova-khipu", targets: ["CordovaKhipu"])
    ],
    dependencies: [
        .package(url: "https://github.com/apache/cordova-ios.git", from: "8.0.0"),
        .package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "2.16.5")
    ],
    targets: [
        .target(
            name: "CordovaKhipu",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "KhipuClientIOS", package: "KhipuClientIOS")
            ],
            path: "src/ios"
        )
    ]
)
```

- [ ] **Step 3: Resolver dependencias**

Run: `swift package resolve`
Expected: PASS. Resuelve `khipuclientios 2.16.5`, `cordova-ios 8.0.0`, `khenshinprotocolswift`, `khenshinsecuremessage`, `socket.io-client-swift`, `starscream`, `tweetnacl-swiftwrap`.

Si falla con `the package ... does not contain a Package.swift`, revisar la URL. Si falla con `Dependencies could not be resolved`, revisar que el tag `2.16.5` exista en `khipu/KhipuClientIOS`.

- [ ] **Step 4: Ver los schemes que genera Xcode**

Run: `xcodebuild -list`
Expected: aparece el scheme `cordova-khipu`. Anotar el nombre exacto; los pasos siguientes lo usan.

- [ ] **Step 5: Compilar y ver que falla por el `import` faltante**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: FAIL con `cannot find type 'CDVPlugin' in scope` y `cannot find type 'CDVInvokedUrlCommand' in scope`.

Esto es lo esperado: hoy `KhipuPlugin.swift` recibe `CDVPlugin` por el bridging header del proyecto, que bajo SPM no existe.

- [ ] **Step 6: Agregar el shim de `import`**

En `src/ios/KhipuPlugin.swift`, reemplazar la primera línea (`import KhipuClientIOS`) por:

```swift
import UIKit
#if canImport(Cordova)
// cordova-ios 8 expone CordovaLib como el módulo `Cordova` (viene de
// CordovaLib/include/Cordova/). En cordova-ios 7 no hay módulo: CDVPlugin llega
// por el bridging header del proyecto y este import no aplica.
import Cordova
#endif
import KhipuClientIOS
```

- [ ] **Step 7: Compilar y verificar que pasa**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: PASS, `BUILD SUCCEEDED`.

- [ ] **Step 8: Reemplazar `plugin.xml`**

Contenido completo del archivo:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<plugin id="cordova-khipu" version="2.9.1" xmlns="http://apache.org/cordova/ns/plugins/1.0" xmlns:android="http://schemas.android.com/apk/res/android">
  <name>Cordova Khipu</name>
  <engines>
    <engine name="cordova-ios" version=">=7.0.0"/>
    <engine name="cordova-android" version=">=13.0.0"/>
  </engines>
  <js-module name="Khipu" src="www/cordova-khipu.js">
    <clobbers target="window.Khipu"/>
  </js-module>
  <platform name="android">
    <framework src="src/android/khipu.gradle" custom="true" type="gradleReference"/>
    <config-file parent="/*" target="res/xml/config.xml">
      <feature name="cordova-khipu">
        <param name="android-package" value="com.khipu.cordova.KhipuPlugin"/>
      </feature>
    </config-file>
    <config-file parent="/*" target="AndroidManifest.xml"/>
    <source-file src="src/android/com/khipu/cordova/KhipuPlugin.java" target-dir="src/com/khipu/cordova"/>
  </platform>
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
  </platform>
  <dependency id="cordova-plugin-add-swift-support" version="2.0.2"/>
  <hook type="after_prepare" src="scripts/enable-gradle-kotlin-plugin.js"/>
</plugin>
```

Cambios respecto del archivo anterior: se agregó `<engines>`, `package="swift"` en el `<platform>` de iOS, `nospm="true"` en el `<pod>`, y la versión del pod subió de `2.16.2` a `2.16.5`. La `<dependency>` de `cordova-plugin-add-swift-support` sigue ahí a propósito: sale en la Task 2.

- [ ] **Step 9: Verificar que `plugin.xml` sigue siendo XML válido**

Run: `grep -c 'platform name="ios" package="swift"' plugin.xml && grep -c 'nospm="true"' plugin.xml`
Expected: `1` y `1`.

> **Superado por la Task 3b.** El `<podspec>` que escribe esta tarea todavía usa `version=`,
> `<config><source>` y `use-frameworks="true"`. Los tres resultaron estar mal y los corrige la
> Task 3b; se dejan acá tal como se ejecutaron, para que el historial se entienda.

- [ ] **Step 10: Commit**

```bash
git add Package.swift plugin.xml src/ios/KhipuPlugin.swift
git commit -m "feat(ios): agregar soporte SPM dual con CocoaPods

Package.swift para cordova-ios 8, con el podspec intacto y marcado
nospm para cordova-ios 7. KhipuClientIOS sube a 2.16.5, que es la
primera versión consumible por SPM."
```

---

### Task 2: Hook propio de Swift, en reemplazo de `cordova-plugin-add-swift-support`

**Files:**
- Create: `scripts/configure-swift-ios.js`
- Create: `tests/scripts/configure-swift-ios.test.js`
- Modify: `plugin.xml`
- Modify: `package.json`

**Interfaces:**
- Consumes: el `plugin.xml` de la Task 1.
- Produces: `scripts/configure-swift-ios.js` exporta la función de hook por defecto y, para tests, `getCordovaIosMajor(platformPath) -> number`, `findXcodeProjectName(platformPath) -> string` y `readSwiftVersionPreference(projectRoot) -> string | null`. `package.json` gana el script `npm test` que corre `node --test tests/scripts/`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/scripts/configure-swift-ios.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hook = require('../../scripts/configure-swift-ios.js');

function tempDir () {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cordova-khipu-test-'));
}

test('detecta cordova-ios 8 por la presencia de App.xcodeproj', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'App.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 8);
});

test('detecta cordova-ios 7 cuando el proyecto tiene otro nombre', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MiApp.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 7);
});

test('el script cordova/version manda por sobre el heurístico', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'cordova'), { recursive: true });
    fs.mkdirSync(path.join(platformPath, 'MiApp.xcodeproj'), { recursive: true });

    const versionScript = path.join(platformPath, 'cordova', 'version');
    fs.writeFileSync(versionScript, '#!/bin/sh\necho 8.1.1\n');
    fs.chmodSync(versionScript, 0o755);

    assert.strictEqual(hook.getCordovaIosMajor(platformPath), 8);
});

test('encuentra el nombre del proyecto Xcode en disco', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'MiApp.xcodeproj'), { recursive: true });

    assert.strictEqual(hook.findXcodeProjectName(platformPath), 'MiApp');
});

test('lee la preferencia SwiftVersion del config.xml', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'config.xml'),
        '<widget><platform name="ios">' +
        '<preference name="SwiftVersion" value="5.9" />' +
        '</platform></widget>');

    assert.strictEqual(hook.readSwiftVersionPreference(root), '5.9');
});

test('sin preferencia SwiftVersion devuelve null', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'config.xml'), '<widget></widget>');

    assert.strictEqual(hook.readSwiftVersionPreference(root), null);
});

test('en cordova-ios 8 el hook no toca nada', () => {
    const root = tempDir();
    const platformPath = path.join(root, 'platforms', 'ios');
    fs.mkdirSync(path.join(platformPath, 'App.xcodeproj'), { recursive: true });
    fs.writeFileSync(path.join(platformPath, 'App.xcodeproj', 'project.pbxproj'), 'original');

    hook({ opts: { projectRoot: root } });

    assert.strictEqual(
        fs.readFileSync(path.join(platformPath, 'App.xcodeproj', 'project.pbxproj'), 'utf-8'),
        'original');
});

test('sin plataforma ios el hook sale sin lanzar', () => {
    const root = tempDir();
    assert.doesNotThrow(() => hook({ opts: { projectRoot: root } }));
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `node --test tests/scripts/`
Expected: FAIL con `Cannot find module '../../scripts/configure-swift-ios.js'`

- [ ] **Step 3: Escribir el hook**

Crear `scripts/configure-swift-ios.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// cordova-ios 8 define SWIFT_VERSION y SWIFT_OBJC_BRIDGING_HEADER en su
// plantilla; cordova-ios 7 no define ninguno de los dos, así que un plugin
// escrito en Swift no compila sin esto. Este hook cubre solo ese hueco.
//
// Reemplaza a cordova-plugin-add-swift-support, que arma la ruta del proyecto
// como `<config.name()>.xcodeproj` y por eso revienta con ENOENT en
// cordova-ios 8, donde el proyecto se llama siempre App.xcodeproj.

const DEFAULT_SWIFT_VERSION = '5.0';

module.exports = function (context) {
    const projectRoot = context.opts.projectRoot;
    const platformPath = path.join(projectRoot, 'platforms', 'ios');

    if (!fs.existsSync(platformPath)) {
        return;
    }

    try {
        if (getCordovaIosMajor(platformPath) >= 8) {
            return;
        }
        configureLegacyProject(projectRoot, platformPath);
    } catch (error) {
        // Un problema configurando Swift no debe voltear el build entero: se
        // avisa y se deja al comercio la salida manual.
        console.warn(
            `cordova-khipu: no se pudo configurar Swift para iOS (${error.message}). ` +
            'Si el build falla con "Cannot determine Swift version", agrega ' +
            '<preference name="SwiftVersion" value="5.0" /> dentro de la sección ' +
            'ios de tu config.xml.'
        );
    }
};

function getCordovaIosMajor (platformPath) {
    try {
        const output = execFileSync(path.join(platformPath, 'cordova', 'version'), {
            encoding: 'utf-8'
        });
        const match = output.trim().match(/(\d+)\./);
        if (match) {
            return Number(match[1]);
        }
    } catch (_) {
        // Sin el script de version, cae al heurístico de abajo.
    }

    // cordova-ios 8 renombró el proyecto a App.xcodeproj de forma fija.
    return fs.existsSync(path.join(platformPath, 'App.xcodeproj')) ? 8 : 7;
}

function configureLegacyProject (projectRoot, platformPath) {
    // `xcode` es dependencia de cordova-ios, así que resuelve desde el
    // node_modules del proyecto. Es el mismo mecanismo que usaba
    // cordova-plugin-add-swift-support.
    const xcode = require('xcode');

    const projectName = findXcodeProjectName(platformPath);
    const pbxprojPath = path.join(platformPath, `${projectName}.xcodeproj`, 'project.pbxproj');
    const bridgingHeader = path.join(platformPath, projectName, 'Bridging-Header.h');

    if (!fs.existsSync(bridgingHeader)) {
        throw new Error(`no existe ${bridgingHeader}`);
    }

    const swiftVersion = readSwiftVersionPreference(projectRoot) || DEFAULT_SWIFT_VERSION;

    const project = xcode.project(pbxprojPath);
    project.parseSync();

    project.updateBuildProperty('SWIFT_VERSION', swiftVersion);
    project.updateBuildProperty(
        'SWIFT_OBJC_BRIDGING_HEADER',
        '"$(PROJECT_DIR)/$(PROJECT_NAME)/Bridging-Header.h"'
    );
    project.updateBuildProperty('ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES', 'YES');

    fs.writeFileSync(pbxprojPath, project.writeSync(), 'utf-8');

    console.log(`cordova-khipu: SWIFT_VERSION=${swiftVersion} configurado para cordova-ios < 8.`);
}

// Se busca el .xcodeproj en disco en vez de derivarlo del nombre en config.xml:
// es el mismo dato y evita depender de que cordova-common resuelva desde el
// node_modules del proyecto.
function findXcodeProjectName (platformPath) {
    const found = fs.readdirSync(platformPath).filter(entry => entry.endsWith('.xcodeproj'));

    if (found.length !== 1) {
        throw new Error(`se esperaba un .xcodeproj en ${platformPath}, hay ${found.length}`);
    }

    return path.basename(found[0], '.xcodeproj');
}

// Lectura deliberadamente simple: alcanza para la única preferencia que nos
// interesa y no arrastra cordova-common a un hook.
function readSwiftVersionPreference (projectRoot) {
    const configPath = path.join(projectRoot, 'config.xml');

    if (!fs.existsSync(configPath)) {
        return null;
    }

    const match = fs
        .readFileSync(configPath, 'utf-8')
        .match(/<preference\s+name="SwiftVersion"\s+value="([^"]+)"/);

    return match ? match[1] : null;
}

// Exportados para los tests.
module.exports.getCordovaIosMajor = getCordovaIosMajor;
module.exports.findXcodeProjectName = findXcodeProjectName;
module.exports.readSwiftVersionPreference = readSwiftVersionPreference;
```

- [ ] **Step 4: Agregar el script `test` a `package.json`**

En el objeto `scripts` de `package.json`, agregar como primera entrada:

```json
    "test": "node --test tests/scripts/",
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS, 8 tests, 0 fallas.

- [ ] **Step 6: Registrar el hook y dar de baja la dependencia en `plugin.xml`**

Dentro de `<platform name="ios" package="swift">`, después del `<source-file>`, agregar:

```xml
    <hook type="after_prepare" src="scripts/configure-swift-ios.js"/>
```

Y borrar esta línea completa:

```xml
  <dependency id="cordova-plugin-add-swift-support" version="2.0.2"/>
```

- [ ] **Step 7: Verificar que la dependencia ya no está**

Run: `grep -c "add-swift-support" plugin.xml || echo "0 ocurrencias, correcto"`
Expected: `0 ocurrencias, correcto`

- [ ] **Step 8: Commit**

```bash
git add scripts/configure-swift-ios.js tests/scripts/configure-swift-ios.test.js plugin.xml package.json
git commit -m "fix(ios): reemplazar cordova-plugin-add-swift-support por un hook propio

Ese plugin arma la ruta del proyecto como <config.name()>.xcodeproj y
revienta con ENOENT en cordova-ios 8, donde el proyecto se llama siempre
App.xcodeproj. El hook nuevo no hace nada en cordova-ios 8 y solo
configura Swift en las versiones que no lo traen."
```

---

### Task 3: Verificar los dos majors de iOS en proyectos desechables

Esta tarea es un **gate**: resuelve el riesgo 5 del spec. Si cordova-ios 7 no compila con el Xcode instalado, hay que detenerse y reevaluar el soporte dual antes de invertir en el resto del plan.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` (agregar sección de resultados)

**Interfaces:**
- Consumes: el plugin tal como quedó después de la Task 2.
- Produces: una sección `## 15. Resultados de verificación` en el spec, con la versión de Xcode usada y el resultado de cada escenario.

- [ ] **Step 1: Anotar la versión de Xcode**

Run: `xcodebuild -version`
Guardar la salida; va en el spec al final de la tarea.

- [ ] **Step 2: Empaquetar el plugin**

```bash
cd /Users/edavis/git/cordova-khipu
npm pack --pack-destination /tmp
ls /tmp/cordova-khipu-2.9.1.tgz
```
Expected: el archivo existe.

- [ ] **Step 3: Crear el proyecto de cordova-ios 7 y verificar que falla sin el plugin**

```bash
cd /tmp && rm -rf cdvtest7
npx cordova@13 create cdvtest7 com.khipu.test7 CdvTest7
cd /tmp/cdvtest7
```

Editar `/tmp/cdvtest7/config.xml` y agregar antes de `</widget>`:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

Run: `npx cordova@13 plugin list`
Expected: `No plugins added. Use 'cordova plugin add <plugin>'.`

- [ ] **Step 4: Instalar plataforma y plugin, y compilar**

```bash
cd /tmp/cdvtest7
npx cordova@13 platform add ios@7.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
npx cordova@13 build ios --emulator 2>&1 | tail -40
```
Expected: `BUILD SUCCEEDED`.

Si falla, leer el error completo. Los dos modos de falla previstos:
- `Cannot determine Swift version` → el hook de la Task 2 no se ejecutó o no encontró el pbxproj.
- Errores del SDK de iOS o de Xcode → es exactamente el riesgo 5. **Detenerse y reportar** antes de seguir.

- [ ] **Step 5: Verificar que cordova-ios 7 tomó el camino de CocoaPods**

```bash
cd /tmp/cdvtest7
test -f platforms/ios/Podfile && echo "Podfile presente: OK"
grep KhipuClientIOS platforms/ios/Podfile
test ! -d platforms/ios/packages && echo "sin packages/: OK"
```
Expected: `Podfile presente: OK`, una línea con `pod 'KhipuClientIOS', '2.16.5'`, y `sin packages/: OK`.

- [ ] **Step 6: Verificar que el hook configuró Swift**

```bash
cd /tmp/cdvtest7
grep -m2 "SWIFT_VERSION\|SWIFT_OBJC_BRIDGING_HEADER" platforms/ios/CdvTest7.xcodeproj/project.pbxproj
```
Expected: aparecen `SWIFT_VERSION = 5.0;` y `SWIFT_OBJC_BRIDGING_HEADER = "$(PROJECT_DIR)/$(PROJECT_NAME)/Bridging-Header.h";`

- [ ] **Step 7: Crear el proyecto de cordova-ios 8 y compilar**

```bash
cd /tmp && rm -rf cdvtest8
npx cordova@13 create cdvtest8 com.khipu.test8 CdvTest8
cd /tmp/cdvtest8
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
npx cordova@13 build ios --emulator 2>&1 | tail -40
```
Expected: `BUILD SUCCEEDED`.

- [ ] **Step 8: Verificar que cordova-ios 8 tomó el camino SPM y no CocoaPods**

```bash
cd /tmp/cdvtest8
test ! -f platforms/ios/Podfile && echo "sin Podfile: OK"
test -d platforms/ios/packages/cordova-khipu && echo "package copiado: OK"
grep cordova-khipu platforms/ios/packages/cordova-ios-plugins/Package.swift
grep -n "cordova-ios" platforms/ios/packages/cordova-khipu/Package.swift
```
Expected:
- `sin Podfile: OK`
- `package copiado: OK`
- dos líneas: `package.dependencies.append(.package(name: "cordova-khipu", path: "../cordova-khipu"))` y `package.targets.first?.dependencies.append(.product(name: "cordova-khipu", package: "cordova-khipu"))`
- la dependencia reescrita a `package(name: "cordova-ios", path: "../cordova-ios")`

- [ ] **Step 9: Verificar que el hook no hizo nada en cordova-ios 8**

Run: `cd /tmp/cdvtest8 && npx cordova@13 prepare ios 2>&1 | grep -i "cordova-khipu" || echo "sin salida del hook: OK"`
Expected: `sin salida del hook: OK`

- [ ] **Step 10: Escribir los resultados en el spec**

Agregar al final de `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md`:

```markdown
## 15. Resultados de verificación

### Fase 1 — los dos majors de iOS (Task 3 del plan)

Ejecutado el <FECHA> con <SALIDA DE xcodebuild -version>.

| Escenario | Resultado |
| --- | --- |
| `cordova-ios@7.1.1` + CocoaPods, `cordova build ios --emulator` | <OK / detalle de la falla> |
| `cordova-ios@7.1.1`: Podfile presente con `KhipuClientIOS 2.16.5` | <sí / no> |
| `cordova-ios@7.1.1`: hook fijó `SWIFT_VERSION` y el bridging header | <sí / no> |
| `cordova-ios@8.1.1` + SPM, `cordova build ios --emulator` | <OK / detalle de la falla> |
| `cordova-ios@8.1.1`: sin Podfile, con `packages/cordova-khipu` | <sí / no> |
| `cordova-ios@8.1.1`: el hook no emitió salida | <sí / no> |

**Riesgo 5 (viabilidad de cordova-ios 7 con el Xcode actual):** <resuelto / abierto,
con el detalle>.
```

Reemplazar cada `<...>` por el valor real observado. No dejar ningún `<...>` en el archivo.

- [ ] **Step 11: Limpiar y commitear**

```bash
rm -rf /tmp/cdvtest7 /tmp/cdvtest8 /tmp/cordova-khipu-2.9.1.tgz
cd /Users/edavis/git/cordova-khipu
git add docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md
git commit -m "docs: registrar la verificación de cordova-ios 7 y 8"
```

---

### Task 3b: Corregir el pin del pod y el Podfile fantasma

Dos defectos que encontró la Task 3 compilando de verdad. Los dos invalidan afirmaciones del
spec, así que se arreglan antes de seguir.

**a) El pin de versión del pod nunca se aplicó.** `Podfile.js` de cordova-ios solo emite la
restricción de versión si el JSON del pod trae la clave `spec` (`if ('spec' in json &&
json.spec.length)`, línea 300). El atributo `version` se ignora en silencio. El `plugin.xml`
publicado en `cordova-khipu` 2.9.1 usa `version="2.16.2"`, o sea que **el plugin nunca fijó la
versión del pod**: genera `pod 'KhipuClientIOS'` sin restricción. Es un defecto preexistente.

**b) Se crea un Podfile aunque el pod esté descartado.** El bloque `// sources` de `Api.js` no
está protegido por `isSwiftPackagePlugin`, a diferencia del `// libraries` que le sigue. Con un
`<config><source>` declarado, cordova-ios 8 marca el Podfile como sucio y corre `pod install`
igual, rompiendo la premisa de "SPM puro, sin CocoaPods instalado". Declarar el trunk de
CocoaPods era redundante: es el source por defecto cuando no hay ninguno.

**Files:**
- Modify: `plugin.xml`
- Modify: `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` (sección §15)

**Interfaces:**
- Consumes: el `plugin.xml` de las Tasks 1 y 2.
- Produces: un `<podspec>` sin `<config>` y con `spec="2.16.5"`. La Task 12 lo verifica con
  `check-native-versions.js`, que busca `spec=` y falla ante `version=`.

- [ ] **Step 1: Confirmar el estado actual**

Run: `grep -n "podspec\|<config>\|<source url\|<pod " plugin.xml`
Expected: aparecen el `<config>`, el `<source url=...>` y un `<pod ... version="2.16.5" ...>`.

- [ ] **Step 2: Corregir el bloque `<podspec>`**

Reemplazar el bloque completo:

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

por:

```xml
    <podspec>
      <pods>
        <pod name="KhipuClientIOS" spec="2.16.5" swift-version="5.1" nospm="true"/>
      </pods>
    </podspec>
```

Tres cambios:

1. `version=` pasa a **`spec=`**, que es el atributo que cordova-ios lee de verdad.
2. Se elimina el `<config>` entero, cuyo `<source>` marcaba el Podfile como sucio.
3. Se elimina **`use-frameworks="true"`** del `<pods>`. `PluginInfo.getPodSpecs()` convierte los
   atributos de `<pods>` en *declaraciones* del Podfile (`use_frameworks!`), y el bloque
   `// declarations` de `Api.js` tampoco tiene guarda de `isSwiftPackagePlugin` — así que esa
   sola declaración basta para marcar el Podfile como sucio y disparar `pod install`.

Sobre el punto 3, que es el que cambia comportamiento en el camino viejo: sin `use_frameworks!`
los pods se enlazan como librerías estáticas en vez de frameworks dinámicos. Es seguro para
`KhipuClientIOS` porque su podspec declara `s.resource_bundles` —el mecanismo pensado
justamente para enlace estático— y su `BundleHelper` resuelve con
`Bundle(for: KhipuClientBundleHelper.self).path(forResource: "KhipuClientIOS", ofType: "bundle")`,
que funciona en los dos modelos: con framework dinámico apunta al bundle del framework, y con
librería estática la clase queda en el binario de la app, donde CocoaPods copia el resource
bundle. **Aun así hay que confirmarlo en runtime**, no solo que compile: los recursos que
fallan lo hacen al mostrarse, no al enlazar.

Y no se puede simplemente dejarlo: en macOS, `check_cocoapods` de cordova-ios llama a
`checkTool('pod', ...)`, que **rechaza** si el binario falta (solo devuelve `ignore` cuando el
SO no es macOS). Con el Podfile sucio, un comercio en cordova-ios 8 sin CocoaPods instalado ve
fallar `cordova plugin add`, que es exactamente lo que esta migración promete evitar.

- [ ] **Step 3: Verificar el texto**

Run: `grep -c 'spec="2.16.5"' plugin.xml && grep -c "<config>" plugin.xml`
Expected: `1` y luego `0`.

- [ ] **Step 4: Re-verificar cordova-ios 7 — el pod ahora sí queda pinneado**

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"
node -v   # debe decir v20.19.4
npm pack --pack-destination /tmp
cd /tmp && rm -rf cdvpin7 && npx cordova@13 create cdvpin7 com.khipu.pin7 CdvPin7
cd /tmp/cdvpin7
```

Editar `/tmp/cdvpin7/config.xml` y agregar antes de `</widget>`:

```xml
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
```

```bash
cd /tmp/cdvpin7
npx cordova@13 platform add ios@7.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
grep -n "KhipuClientIOS" platforms/ios/Podfile
```
Expected: la línea dice **`pod 'KhipuClientIOS', '2.16.5'`**, con la versión. Antes de este
arreglo decía `pod 'KhipuClientIOS'` a secas. Si sigue sin versión, el arreglo no funcionó:
detente y reporta el contenido completo del Podfile.

- [ ] **Step 5: Re-verificar cordova-ios 8 — sin `Pods/` y sin `pod install`**

```bash
cd /tmp && rm -rf cdvpin8 && npx cordova@13 create cdvpin8 com.khipu.pin8 CdvPin8
cd /tmp/cdvpin8
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
test ! -d platforms/ios/Pods && echo "sin Pods/: OK" || echo "TODAVÍA HAY Pods/"
test -d platforms/ios/packages/cordova-khipu && echo "package SPM copiado: OK"
grep -c "pod '" platforms/ios/Podfile 2>/dev/null || echo "Podfile sin pods: OK"
cat platforms/ios/pods.json 2>/dev/null
```
Expected: `sin Pods/: OK`, `package SPM copiado: OK`, `Podfile sin pods: OK`, y un `pods.json`
con `declarations`, `sources` y `libraries` vacíos.

**Va a existir un `platforms/ios/Podfile` vacío, y está bien.** Es inevitable: el constructor de
la clase `Podfile` de cordova-ios escribe el archivo apenas se instancia, antes de evaluar
contenido (`if (!fs.existsSync(this.path)) { this.clear(); this.write(); }`), y se instancia por
el solo hecho de que el plugin declare un `<podspec>`. Como no se agrega nada, `isDirty()` queda
en `false` y **`pod install` nunca corre**. Lo que el diseño promete es que no hace falta tener
CocoaPods instalado, no que el archivo no exista. Esa promesa se verifica en el paso siguiente.

- [ ] **Step 6: La prueba que de verdad importa — cordova-ios 8 sin CocoaPods en el PATH**

Un `Podfile` vacío no cuesta nada; lo que costaría es que el camino SPM invocara el binario
`pod`. Esto lo comprueba de forma directa:

```bash
cd /tmp && rm -rf cdvnopod && npx cordova@13 create cdvnopod com.khipu.nopod CdvNoPod
cd /tmp/cdvnopod
export PATH_SIN_POD=$(dirname $(which pod))
env PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -F "$PATH_SIN_POD" | paste -sd: -) sh -c '
  which pod && echo "ERROR: pod sigue en el PATH" && exit 1
  npx cordova@13 platform add ios@8.1.1
  npx cordova@13 plugin add /tmp/cordova-khipu-2.9.1.tgz --nosave
  npx cordova@13 build ios --emulator 2>&1 | tail -20
'
```
Expected: `which pod` no encuentra nada, y aun así `BUILD SUCCEEDED`.

Si esto falla con algo como `CocoaPods was not found`, el arreglo no alcanzó y hay que
reportarlo: es la promesa central del trabajo.

- [ ] **Step 6b: Compilar ambos caminos normales para confirmar que nada se rompió**

```bash
cd /tmp/cdvpin7 && npx cordova@13 build ios --emulator 2>&1 | tail -20
cd /tmp/cdvpin8 && npx cordova@13 build ios --emulator 2>&1 | tail -20
```
Expected: `BUILD SUCCEEDED` en los dos.

Y como señal temprana sobre el enlace estático, en el proyecto de cordova-ios 7:

```bash
cd /tmp/cdvpin7
find platforms/ios/Pods -name "*.bundle" -maxdepth 3 2>/dev/null
```
Expected: aparece `KhipuClientIOS.bundle`. Si no aparece por ningún lado, es señal de que sacar
`use_frameworks!` rompió los recursos, y hay que reportarlo antes de seguir.

- [ ] **Step 7: Registrar los resultados en el spec**

Agregar a la sección `## 15. Resultados de verificación` una subsección:

```markdown
### Corrección del pin del pod y del Podfile fantasma (Task 3b del plan)

| Verificación | Antes | Después |
| --- | --- | --- |
| Línea del pod en el Podfile de cordova-ios 7 | `<lo que decía>` | `<lo que dice ahora>` |
| ¿Existe `Pods/` en cordova-ios 8? | `<sí / no>` | `<sí / no>` |
| ¿Corrió `pod install` en cordova-ios 8? | `<sí / no>` | `<sí / no>` |
| Build de cordova-ios 8 **sin `pod` en el PATH** | `<no se probó>` | `<OK / detalle>` |
| Build de cordova-ios 7 | `<OK / detalle>` | `<OK / detalle>` |
| Build de cordova-ios 8 | `<OK / detalle>` | `<OK / detalle>` |
```

Reemplazar cada `<...>` por el valor real. La columna "Antes" sale del reporte de la Task 3.

- [ ] **Step 8: Limpiar y commitear**

```bash
rm -rf /tmp/cdvpin7 /tmp/cdvpin8 /tmp/cordova-khipu-2.9.1.tgz
cd /Users/edavis/git/cordova-khipu
git add plugin.xml docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md
git commit -m "fix(ios): fijar de verdad la versión del pod y no generar Podfile bajo SPM

cordova-ios solo lee el atributo `spec` del <pod>; `version` se ignora en
silencio, así que el plugin publicado nunca fijó la versión de
KhipuClientIOS y cada comercio recibía la que CocoaPods resolviera.

Y el bloque // sources de Api.js no está protegido por
isSwiftPackagePlugin, así que declarar un <source> forzaba un Podfile y
un pod install en cordova-ios 8, rompiendo la premisa de SPM puro. El
trunk de CocoaPods es el source por defecto: declararlo era redundante."
```

---

### Task 4: Spike — cómo instala el ejemplo el plugin local

El riesgo es concreto: si `cordova plugin add ../` deja un symlink al repo, `SwiftPackage.addPlugin()` reescribiría el `Package.swift` real del plugin. Por eso el spike corre sobre un **clon desechable**, nunca sobre el repo de trabajo.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md` (sección de resultados)

**Interfaces:**
- Consumes: el plugin de la Task 2.
- Produces: una decisión documentada sobre cómo `example/package.json` instala el plugin. La Task 5 la implementa.

- [ ] **Step 1: Clonar el repo a un directorio desechable**

```bash
rm -rf /tmp/spike-khipu
git clone /Users/edavis/git/cordova-khipu /tmp/spike-khipu
cd /tmp/spike-khipu
git rev-parse --short HEAD
```

- [ ] **Step 2: Armar un ejemplo mínimo dentro del clon**

```bash
cd /tmp/spike-khipu
npx cordova@13 create example com.khipu.spike Spike
cd /tmp/spike-khipu/example
npx cordova@13 platform add ios@8.1.1
```

- [ ] **Step 3: Probar el método 1 — ruta relativa**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 plugin add ../ --nosave 2>&1 | tail -20
ls -la plugins/cordova-khipu | head -3
ls -la platforms/ios/packages/ 2>/dev/null
cd /tmp/spike-khipu && git status --porcelain
```

Anotar tres cosas: si el comando terminó bien, si `plugins/cordova-khipu` es un symlink o un directorio real, y si `git status` muestra `Package.swift` modificado. **Un `Package.swift` modificado significa que este método corrompe el repo y queda descartado.**

- [ ] **Step 4: Probar el método 2 — `--link`**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 plugin rm cordova-khipu --nosave 2>/dev/null
rm -rf platforms plugins
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add ../ --link --nosave 2>&1 | tail -20
ls -la platforms/ios/packages/ 2>/dev/null
grep -n "cordova-ios" platforms/ios/packages/cordova-ios-plugins/Package.swift
cd /tmp/spike-khipu && git status --porcelain
```

Con `--link`, `SwiftPackage.addPlugin` no copia ni reescribe: referencia el directorio del plugin desde `packages/cordova-ios-plugins/Package.swift`. Anotar si el `Package.swift` del plugin quedó intacto y si el build resuelve. Ojo con el efecto secundario esperado: el plugin seguiría dependiendo de `apache/cordova-ios` desde git en vez de la CordovaLib local, lo que puede producir dos módulos `Cordova` distintos.

- [ ] **Step 5: Probar el método 3 — tarball**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 plugin rm cordova-khipu --nosave 2>/dev/null
rm -rf platforms plugins
cd /tmp/spike-khipu && npm pack --pack-destination ./example
cd /tmp/spike-khipu/example
npx cordova@13 platform add ios@8.1.1
npx cordova@13 plugin add ./cordova-khipu-*.tgz --nosave 2>&1 | tail -20
ls -la platforms/ios/packages/
grep -n "cordova-ios" platforms/ios/packages/cordova-khipu/Package.swift
cd /tmp/spike-khipu && git status --porcelain
```

- [ ] **Step 6: Compilar con el método que haya quedado en pie**

```bash
cd /tmp/spike-khipu/example
npx cordova@13 build ios --emulator 2>&1 | tail -30
```
Expected: `BUILD SUCCEEDED`.

Si el método 3 es el único que compila limpio, esa es la decisión.

- [ ] **Step 7: Escribir la decisión en el spec**

Agregar a la sección `## 15. Resultados de verificación`:

```markdown
### Fase 2 — instalación del plugin local en el ejemplo (Task 4 del plan)

| Método | `plugins/cordova-khipu` | ¿Modificó el `Package.swift` del repo? | ¿Compiló? |
| --- | --- | --- | --- |
| `cordova plugin add ../` | <symlink / directorio> | <sí / no> | <sí / no> |
| `cordova plugin add ../ --link` | <symlink / directorio> | <sí / no> | <sí / no> |
| `npm pack` + `cordova plugin add ./*.tgz` | <symlink / directorio> | <sí / no> | <sí / no> |

**Decisión:** <método elegido>, porque <razón observada>.

Esto resuelve el riesgo 1 del §13.
```

Reemplazar cada `<...>` por el valor real. No dejar ningún `<...>`.

- [ ] **Step 8: Limpiar y commitear**

```bash
rm -rf /tmp/spike-khipu
cd /Users/edavis/git/cordova-khipu
git add docs/superpowers/specs/2026-09-04-spm-cordova-khipu-design.md
git commit -m "docs: registrar el spike de instalación del plugin local"
```

---

### Task 5: Esqueleto de la app de ejemplo

**Files:**
- Create: `example/package.json`
- Create: `example/config.xml`
- Create: `example/.gitignore`
- Create: `example/www/index.html`

**Interfaces:**
- Consumes: la decisión de la Task 4 sobre cómo instalar el plugin.
- Produces: los scripts `npm run ios:pods`, `npm run ios:spm`, `npm run android` y `npm run reset` en `example/`. Las tareas 6 y 7 reemplazan el contenido de `example/www/`.

> **Resuelto por la Task 4.** El spike probó los tres métodos: `cordova plugin add ../` falla con `EINVAL: cp ... subdirectory of self`; `--link` compila pero deja dos identidades de `cordova-ios` y SwiftPM avisa que eso pasará a ser error; el tarball compila limpio. Se usa el tarball, con prefijo `file:` y ruta absoluta.

- [ ] **Step 1: Crear `example/package.json`**

```json
{
  "name": "cordova-khipu-example",
  "displayName": "Khipu Example",
  "version": "1.0.0",
  "private": true,
  "description": "App de ejemplo del plugin cordova-khipu",
  "license": "MIT",
  "scripts": {
    "reset": "rm -rf platforms plugins cordova-khipu-*.tgz",
    "plugin:add": "node scripts/install-plugin.mjs",
    "ios:pods": "npm run reset && npm run plugin:add && cordova platform add ios@7.1.1 --nosave && cordova run ios",
    "ios:spm": "npm run reset && npm run plugin:add && cordova platform add ios@8.1.1 --nosave && cordova run ios",
    "android": "npm run reset && npm run plugin:add && cordova platform add android@15.1.0 --nosave && cordova run android"
  },
  "engines": {
    "node": "^20.17.0 || >=22.9.0"
  },
  "devDependencies": {
    "cordova": "^13.0.0"
  },
  "cordova": {
    "platforms": []
  }
}
```

Notas sobre el diseño de los scripts:
- `reset` borra `platforms/` y `plugins/` porque el gestor de paquetes de iOS lo decide el major de la plataforma, y no se puede cambiar en caliente.
- `cordova.platforms` queda vacío a propósito: cada script agrega la que necesita.
- **El plugin se instala ANTES de agregar la plataforma, y ese orden no es casual.** Instalar el
  plugin dispara por dentro un `npm install` del tarball, y ese `npm install` reconcilia todo el
  árbol de `node_modules`. Si la plataforma ya está agregada, `node_modules/cordova-ios` es lo
  que npm encuentra sin declarar en ningún lado, y lo **poda**; entonces
  `platforms/ios/cordova/Api.js` —que es literalmente `module.exports = require('cordova-ios')`—
  falla con `Cannot find module 'cordova-ios'`. Haciéndolo al revés, el `npm install` ocurre
  cuando todavía no hay nada que podar, y `cordova platform add` instala después el plugin que
  ya está en `plugins/`. Que lo instale está garantizado por `installPluginsForNewPlatform()` de
  `cordova-lib`, que toma los plugins del **contenido del directorio `plugins/`**
  (`cordova_util.findPlugins`) y usa `package.json` solo para ordenarlos.
- **Las plataformas no van en `devDependencies`.** Solo el CLI. Quién decide el major es el
  script, con `platform add ios@7.1.1` o `ios@8.1.1`; declarar además `cordova-ios` como
  dependencia crea una contradicción que npm resuelve en contra nuestra. Cualquier `npm install`
  posterior dentro de `example/` —incluido el que `cordova plugin add` dispara internamente—
  reconcilia el árbol contra `package.json` y revierte `node_modules/cordova-ios` al major
  declarado, aunque el `platform add` haya dejado el otro instalado un paso antes. El síntoma es
  `CordovaError: ... not an up-to-date Cordova iOS project` al instalar el plugin, en el camino
  de CocoaPods.
- **`--nosave` en los tres `cordova platform add`, y no solo en el `plugin add`.** Sin él,
  cordova reescribe este `package.json` en cada corrida: `cordova.platforms` se llena y
  `devDependencies.cordova-ios` queda con el major de la última corrida. Como los scripts se
  corren en secuencia para verificar los tres escenarios, el archivo terminaría declarando el
  camino que se probó último, que es justo el dato que uno quiere fijo. Sin esto, `reset` no es
  un reset de verdad: borra `platforms/` y `plugins/` pero deja el `package.json` sucio.
- El `engines` declara el piso que exige `cordova-ios` 8.1.1; sirve de aviso, no de barrera.
- La instalación del plugin vive en un script aparte porque tiene dos rodeos que necesitan explicación: ver el paso siguiente.

- [ ] **Step 1b: Crear `example/scripts/install-plugin.mjs`**

```js
// Instala el plugin en la app de ejemplo desde un tarball de `npm pack`.
//
// Los dos rodeos de acá parecen innecesarios y no lo son. Salieron de probar los
// tres métodos posibles contra un clon desechable (§15 del spec de diseño):
//
// 1. Tarball en vez de `cordova plugin add ../`. Esa forma falla con
//    `EINVAL: cp ... subdirectory of self`, porque el destino (example/plugins/)
//    es hijo del origen (el repo). Y `--link`, que sí funciona hoy, deja al
//    plugin dependiendo de apache/cordova-ios por git en vez de la CordovaLib
//    local del proyecto: SwiftPM lo tolera dedupeando, pero avisa "Conflicting
//    identity for cordova-ios ... will be escalated to an error in future
//    versions of SwiftPM". Instalar desde el tarball tiene además la ventaja de
//    ejercitar exactamente el artefacto que recibe un comercio desde npm.
//
// 2. Prefijo `file:` y ruta absoluta. `cordova plugin add ./algo.tgz` falla por
//    un bug de parseo de cordova-lib 13.0.0.

import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const example = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(example, '..');

const esTarball = (nombre) => nombre.startsWith('cordova-khipu-') && nombre.endsWith('.tgz');

// Un tarball de una versión anterior haría que más abajo se elija el equivocado.
for (const viejo of readdirSync(example).filter(esTarball)) {
    rmSync(join(example, viejo));
}

execFileSync('npm', ['pack', '--pack-destination', example], { cwd: repo, stdio: 'inherit' });

const tarball = readdirSync(example).find(esTarball);

if (!tarball) {
    throw new Error('npm pack no dejó ningún cordova-khipu-*.tgz en example/');
}

execFileSync('npx', ['cordova', 'plugin', 'add', `file:${join(example, tarball)}`, '--nosave'], {
    cwd: example,
    stdio: 'inherit'
});
```

- [ ] **Step 1c: Agregar el campo `files` al `package.json` de la RAÍZ del repositorio**

No es cosmético y por eso va acá y no más adelante: el ejemplo se instala desde un tarball de
`npm pack`, y hoy `package.json` no tiene `files` ni hay `.npmignore`, así que ese tarball se
lleva todo el repositorio. El spike ya lo comprobó: apareció `.husky/` dentro de
`plugins/cordova-khipu`. En cuanto exista `example/`, el tarball que instala el ejemplo
contendría además una copia del ejemplo y los 3.000 y pico de líneas de `docs/`.

En `/Users/edavis/git/cordova-khipu/package.json`, después de `"homepage"`, agregar:

```json
  "files": [
    "plugin.xml",
    "Package.swift",
    "www/",
    "src/",
    "tests/",
    "scripts/",
    "README.md",
    "LICENSE"
  ],
```

`tests/` **tiene que estar**: `Package.swift` declara un target en `tests/ios` y SPM falla si esa
ruta no existe en el paquete instalado. Son unos pocos KB. `LICENSE` todavía no existe; npm
avisa y sigue, y el archivo lo crea la Task 12.

Run: `npm pack --dry-run 2>&1 | grep -cE "docs/|\.husky/|example/" || echo "no se publica docs/, .husky/ ni example/: OK"`
Expected: `no se publica docs/, .husky/ ni example/: OK`

- [ ] **Step 2: Crear `example/config.xml`**

```xml
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.khipu.cordova.example" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>Khipu Example</name>
    <description>App de ejemplo del plugin cordova-khipu</description>
    <author email="developers@khipu.com" href="https://khipu.com">Khipu</author>
    <content src="index.html" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <preference name="DisallowOverscroll" value="true" />
    <platform name="ios">
        <preference name="deployment-target" value="13.0" />
    </platform>
</widget>
```

No se declara `GradlePluginKotlinEnabled`: la idea es que el ejemplo ejercite el hook del plugin, no que lo tape.

- [ ] **Step 3: Crear `example/.gitignore`**

```
platforms/
plugins/
node_modules/
cordova-khipu-*.tgz
```

- [ ] **Step 4: Crear `example/www/index.html` mínimo**

Este archivo es provisorio: sirve para probar la cañería antes de invertir en la interfaz. La Task 6 lo reemplaza.

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Khipu Example</title>
  </head>
  <body>
    <h1>cordova-khipu</h1>
    <p id="estado">Esperando <code>deviceready</code>…</p>
    <script src="cordova.js"></script>
    <script>
      document.addEventListener('deviceready', function () {
        document.getElementById('estado').textContent =
          'deviceready OK · window.Khipu es ' + typeof window.Khipu;
      });
    </script>
  </body>
</html>
```

- [ ] **Step 5: Verificar el camino SPM**

Run: `cd example && npm install && npm run ios:spm`
Expected: la app arranca en el simulador y muestra `deviceready OK · window.Khipu es object`.

- [ ] **Step 6: Verificar el camino CocoaPods**

Run: `cd example && npm run ios:pods`
Expected: mismo resultado en pantalla.

- [ ] **Step 7: Verificar Android**

Run: `cd example && npm run android`
Expected: mismo resultado en pantalla.

Si falla el build de Gradle, **no arreglarlo acá**: anotar el error y seguir. La Task 11 se ocupa de Android.

- [ ] **Step 8: Commit**

```bash
git add package.json example/package.json example/config.xml example/.gitignore \
  example/www/index.html example/scripts/install-plugin.mjs example/package-lock.json
git commit -m "feat(example): esqueleto de la app de ejemplo

Scripts ios:pods, ios:spm y android, que pinnean el major de la
plataforma porque es el major el que decide el gestor de paquetes."
```

---

### Task 6: Harness — estructura HTML y estilos

**Files:**
- Modify: `example/www/index.html`
- Create: `example/www/css/harness.css`

**Interfaces:**
- Consumes: el esqueleto de la Task 5.
- Produces: los ids del DOM que consume `harness.js` en la Task 7: `#estado`, `#operationId`, `#campos-texto`, `#campos-switch`, `#campos-color`, `#incluir-colors`, `#presets`, `#preview`, `#lanzar`, `#resultado`.

Los campos se generan desde JavaScript en vez de escribirse a mano: son 12 colores más 5 interruptores más 5 textos, y repetirlos en HTML sería 22 bloques casi idénticos.

- [ ] **Step 1: Reemplazar `example/www/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="format-detection" content="telephone=no" />
    <title>Khipu Example</title>
    <link rel="stylesheet" href="css/harness.css" />
  </head>
  <body>
    <header>
      <h1>cordova-khipu</h1>
      <p id="estado" class="estado estado--esperando">Esperando <code>deviceready</code>…</p>
    </header>

    <main>
      <section class="tarjeta">
        <h2>Operación</h2>
        <label class="campo campo--obligatorio">
          <span class="campo__nombre">operationId</span>
          <input id="operationId" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="9sy0aufujsgq" />
        </label>
      </section>

      <section class="tarjeta">
        <h2>Presets</h2>
        <div id="presets" class="presets"></div>
      </section>

      <section class="tarjeta">
        <h2>Opciones de texto</h2>
        <p class="nota">
          La casilla <strong>incluir</strong> decide si la clave viaja en el
          payload. Sin marcar, el SDK aplica su propio valor por omisión, que no
          es lo mismo que mandar un valor vacío.
        </p>
        <div id="campos-texto"></div>
      </section>

      <section class="tarjeta">
        <h2>Interruptores</h2>
        <div id="campos-switch"></div>
      </section>

      <section class="tarjeta">
        <h2>Colores</h2>
        <label class="campo campo--maestro">
          <input id="incluir-colors" type="checkbox" />
          <span class="campo__nombre">incluir el objeto <code>colors</code></span>
        </label>
        <div id="campos-color"></div>
      </section>

      <section class="tarjeta">
        <h2>Payload</h2>
        <pre id="preview" class="preview"></pre>
        <button id="lanzar" type="button" class="boton" disabled>
          Iniciar operación
        </button>
      </section>

      <section class="tarjeta">
        <h2>Resultado</h2>
        <div id="resultado" class="resultado">Todavía no se ha ejecutado nada.</div>
      </section>
    </main>

    <script src="cordova.js"></script>
    <script src="js/harness.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Crear `example/www/css/harness.css`**

```css
/* Paleta de marca Khipu: púrpura #8347AD y cian #3CB4E5. */
:root {
  --purpura: #8347ad;
  --cian: #3cb4e5;
  --fondo: #f6f4f9;
  --superficie: #ffffff;
  --texto: #1a1a1a;
  --texto-tenue: #5f5f6b;
  --borde: #ded8e6;
  --ok: #1f8a4c;
  --error: #c0392b;
}

@media (prefers-color-scheme: dark) {
  :root {
    --fondo: #101014;
    --superficie: #1b1b22;
    --texto: #e8e8ee;
    --texto-tenue: #a0a0ae;
    --borde: #33333f;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0 0 3rem;
  background: var(--fondo);
  color: var(--texto);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding-top: env(safe-area-inset-top);
}

header {
  background: var(--purpura);
  color: #fff;
  padding: 1.25rem 1rem;
  padding-top: calc(1.25rem + env(safe-area-inset-top));
}

header h1 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}

.estado {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.9;
}

.estado--listo::before {
  content: "● ";
  color: var(--cian);
}

.estado--esperando::before {
  content: "○ ";
}

main {
  padding: 1rem;
  display: grid;
  gap: 1rem;
  max-width: 46rem;
  margin: 0 auto;
}

.tarjeta {
  background: var(--superficie);
  border: 1px solid var(--borde);
  border-radius: 12px;
  padding: 1rem;
}

.tarjeta h2 {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--texto-tenue);
}

.nota {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--texto-tenue);
}

.campo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--borde);
}

.campo:last-child {
  border-bottom: none;
}

.campo__nombre {
  flex: 1 1 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}

.campo--obligatorio {
  flex-direction: column;
  align-items: stretch;
  border-bottom: none;
}

.campo--maestro {
  border-bottom: 2px solid var(--borde);
  margin-bottom: 0.5rem;
}

.campo input[type="text"] {
  flex: 1 1 8rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--borde);
  border-radius: 8px;
  background: var(--fondo);
  color: var(--texto);
  font-size: 16px; /* menos de 16px hace que iOS haga zoom al enfocar */
}

.campo input[type="color"] {
  width: 3rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: 6px;
  background: none;
}

.campo select {
  padding: 0.45rem;
  border: 1px solid var(--borde);
  border-radius: 8px;
  background: var(--fondo);
  color: var(--texto);
  font-size: 16px;
}

.campo--apagado .campo__nombre,
.campo--apagado input,
.campo--apagado select {
  opacity: 0.45;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.presets button {
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--purpura);
  border-radius: 999px;
  background: none;
  color: var(--purpura);
  font-size: 0.82rem;
}

.preview {
  margin: 0 0 0.9rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--fondo);
  border: 1px solid var(--borde);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 16rem;
  overflow: auto;
}

.boton {
  width: 100%;
  padding: 0.85rem;
  border: none;
  border-radius: 10px;
  background: var(--purpura);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
}

.boton:disabled {
  background: var(--borde);
  color: var(--texto-tenue);
}

.resultado {
  font-size: 0.85rem;
  color: var(--texto-tenue);
}

.resultado table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
  font-size: 0.78rem;
}

.resultado th,
.resultado td {
  text-align: left;
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid var(--borde);
  color: var(--texto);
}

.resultado__campo {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.resultado__campo dt {
  flex: 0 0 9rem;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: var(--texto-tenue);
}

.resultado__campo dd {
  margin: 0;
  color: var(--texto);
  word-break: break-word;
}

.resultado--ok {
  border-left: 3px solid var(--ok);
  padding-left: 0.6rem;
}

.resultado--error {
  border-left: 3px solid var(--error);
  padding-left: 0.6rem;
}
```

- [ ] **Step 3: Verificar que la página carga**

Run: `cd example && npm run ios:spm`
Expected: la app muestra el encabezado púrpura, las seis tarjetas y el botón deshabilitado. Las secciones de campos están vacías: las llena la Task 7.

- [ ] **Step 4: Commit**

```bash
git add example/www/index.html example/www/css/harness.css
git commit -m "feat(example): estructura y estilos del harness"
```

---

### Task 7: Harness — lógica

**Files:**
- Create: `example/www/js/harness.js`

**Interfaces:**
- Consumes: los ids del DOM de la Task 6 y `window.Khipu.startOperation(call, success, error)` de `www/cordova-khipu.js`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Crear `example/www/js/harness.js`**

```js
/*
 * Harness de prueba de cordova-khipu.
 *
 * El punto central es el tri-estado por campo: cada opción tiene una casilla
 * "incluir" además de su control. El plugin distingue "clave ausente" de
 * `false` — ver `options!["showFooter"] != nil` en KhipuPlugin.swift y
 * `options.has("showFooter")` en KhipuPlugin.java — y el SDK nativo aplica sus
 * propios valores por omisión. Si el harness mandara siempre los booleanos,
 * sería imposible probar el comportamiento que ve un comercio que no configura
 * nada.
 */

var CLAVE_ALMACENAMIENTO = 'cordova-khipu-harness';

var CAMPOS_TEXTO = [
  { clave: 'title', ejemplo: 'Demo Cordova' },
  { clave: 'titleImageUrl', ejemplo: 'https://s3.amazonaws.com/static.khipu.com/logo-khipu-color.png' },
  { clave: 'locale', ejemplo: 'es_CL' }
];

var CAMPOS_SWITCH = [
  'skipExitPage',
  'skipExitSuccessPage',
  'showFooter',
  'showMerchantLogo',
  'showPaymentDetails'
];

var CLAVES_COLOR = [
  'lightBackground',
  'lightOnBackground',
  'lightPrimary',
  'lightOnPrimary',
  'lightTopBarContainer',
  'lightOnTopBarContainer',
  'darkBackground',
  'darkOnBackground',
  'darkPrimary',
  'darkOnPrimary',
  'darkTopBarContainer',
  'darkOnTopBarContainer'
];

var TEMAS = ['light', 'dark', 'system'];

var PRESETS = {
  'Todo por defecto': {
    texto: {},
    interruptores: {},
    tema: null,
    colores: null
  },
  'Marca Khipu': {
    texto: { title: 'Demo Cordova', locale: 'es_CL' },
    interruptores: { showFooter: true, showMerchantLogo: true, showPaymentDetails: true },
    tema: 'light',
    colores: {
      lightBackground: '#ffffff',
      lightOnBackground: '#1a1a1a',
      lightPrimary: '#8347ad',
      lightOnPrimary: '#ffffff',
      lightTopBarContainer: '#8347ad',
      lightOnTopBarContainer: '#ffffff',
      darkBackground: '#101418',
      darkOnBackground: '#e8eaed',
      darkPrimary: '#3cb4e5',
      darkOnPrimary: '#06283a',
      darkTopBarContainer: '#1a1f26',
      darkOnTopBarContainer: '#e8eaed'
    }
  },
  'Todo activado': {
    texto: { title: 'Demo Cordova', locale: 'es_CL' },
    interruptores: {
      skipExitPage: true,
      skipExitSuccessPage: true,
      showFooter: true,
      showMerchantLogo: true,
      showPaymentDetails: true
    },
    tema: 'system',
    colores: null
  },
  'Modo oscuro': {
    texto: {},
    interruptores: {},
    tema: 'dark',
    colores: {
      darkBackground: '#101418',
      darkOnBackground: '#e8eaed',
      darkPrimary: '#3cb4e5',
      darkOnPrimary: '#06283a',
      darkTopBarContainer: '#1a1f26',
      darkOnTopBarContainer: '#e8eaed'
    }
  }
};

var controles = {
  texto: {},
  interruptores: {},
  colores: {},
  tema: null
};

document.addEventListener('DOMContentLoaded', function () {
  construirCampos();
  construirPresets();
  restaurar();
  escuchar();
  refrescarPreview();
});

document.addEventListener('deviceready', function () {
  var estado = document.getElementById('estado');
  var disponible = typeof window.Khipu !== 'undefined';

  estado.className = 'estado ' + (disponible ? 'estado--listo' : 'estado--esperando');
  estado.textContent = disponible
    ? 'Listo · window.Khipu disponible'
    : 'deviceready llegó pero window.Khipu no está: revisa la instalación del plugin.';

  document.getElementById('lanzar').disabled = !disponible;
});

/* ---------- construcción de la interfaz ---------- */

function construirCampos () {
  var contenedorTexto = document.getElementById('campos-texto');

  CAMPOS_TEXTO.forEach(function (campo) {
    var entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.placeholder = campo.ejemplo;
    entrada.autocapitalize = 'off';
    entrada.autocorrect = 'off';
    entrada.spellcheck = false;

    controles.texto[campo.clave] = agregarFila(contenedorTexto, campo.clave, entrada);
  });

  // `theme` es de texto pero con valores cerrados, así que va como selector.
  var selectorTema = document.createElement('select');
  TEMAS.forEach(function (tema) {
    var opcion = document.createElement('option');
    opcion.value = tema;
    opcion.textContent = tema;
    selectorTema.appendChild(opcion);
  });
  controles.tema = agregarFila(contenedorTexto, 'theme', selectorTema);

  var contenedorSwitch = document.getElementById('campos-switch');
  CAMPOS_SWITCH.forEach(function (clave) {
    var interruptor = document.createElement('input');
    interruptor.type = 'checkbox';
    controles.interruptores[clave] = agregarFila(contenedorSwitch, clave, interruptor);
  });

  var contenedorColor = document.getElementById('campos-color');
  CLAVES_COLOR.forEach(function (clave) {
    var selectorColor = document.createElement('input');
    selectorColor.type = 'color';
    selectorColor.value = clave.indexOf('dark') === 0 ? '#101418' : '#ffffff';
    controles.colores[clave] = agregarFila(contenedorColor, clave, selectorColor);
  });
}

// Cada fila es control + casilla "incluir". El valor del control solo llega al
// payload si la casilla está marcada.
function agregarFila (contenedor, clave, control) {
  var fila = document.createElement('label');
  fila.className = 'campo campo--apagado';

  var incluir = document.createElement('input');
  incluir.type = 'checkbox';

  var nombre = document.createElement('span');
  nombre.className = 'campo__nombre';
  nombre.textContent = clave;

  fila.appendChild(incluir);
  fila.appendChild(nombre);
  fila.appendChild(control);
  contenedor.appendChild(fila);

  return { fila: fila, incluir: incluir, control: control };
}

function construirPresets () {
  var contenedor = document.getElementById('presets');

  Object.keys(PRESETS).forEach(function (nombre) {
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = nombre;
    boton.addEventListener('click', function () {
      aplicarPreset(PRESETS[nombre]);
    });
    contenedor.appendChild(boton);
  });
}

/* ---------- estado ---------- */

function escuchar () {
  document.addEventListener('input', alCambiar);
  document.addEventListener('change', alCambiar);
  document.getElementById('lanzar').addEventListener('click', lanzar);
}

function alCambiar () {
  sincronizarOpacidad();
  refrescarPreview();
  guardar();
}

function sincronizarOpacidad () {
  var todos = []
    .concat(Object.keys(controles.texto).map(function (k) { return controles.texto[k]; }))
    .concat(Object.keys(controles.interruptores).map(function (k) { return controles.interruptores[k]; }))
    .concat(Object.keys(controles.colores).map(function (k) { return controles.colores[k]; }))
    .concat([controles.tema]);

  todos.forEach(function (entrada) {
    entrada.fila.className = 'campo' + (entrada.incluir.checked ? '' : ' campo--apagado');
  });

  var incluirColores = document.getElementById('incluir-colors').checked;
  document.getElementById('campos-color').style.display = incluirColores ? '' : 'none';
}

function construirPayload () {
  var opciones = {};

  Object.keys(controles.texto).forEach(function (clave) {
    var entrada = controles.texto[clave];
    if (entrada.incluir.checked) {
      opciones[clave] = entrada.control.value;
    }
  });

  if (controles.tema.incluir.checked) {
    opciones.theme = controles.tema.control.value;
  }

  Object.keys(controles.interruptores).forEach(function (clave) {
    var entrada = controles.interruptores[clave];
    if (entrada.incluir.checked) {
      opciones[clave] = entrada.control.checked;
    }
  });

  if (document.getElementById('incluir-colors').checked) {
    var colores = {};
    Object.keys(controles.colores).forEach(function (clave) {
      var entrada = controles.colores[clave];
      if (entrada.incluir.checked) {
        colores[clave] = entrada.control.value;
      }
    });
    opciones.colors = colores;
  }

  var payload = { operationId: document.getElementById('operationId').value.trim() };

  // `options` solo viaja si tiene algo adentro: mandarlo vacío no es lo mismo
  // que no mandarlo, y acá queremos poder probar las dos cosas.
  if (Object.keys(opciones).length > 0) {
    payload.options = opciones;
  }

  return payload;
}

function refrescarPreview () {
  document.getElementById('preview').textContent =
    JSON.stringify(construirPayload(), null, 2);
}

function aplicarPreset (preset) {
  Object.keys(controles.texto).forEach(function (clave) {
    var entrada = controles.texto[clave];
    var valor = preset.texto[clave];
    entrada.incluir.checked = valor !== undefined;
    if (valor !== undefined) {
      entrada.control.value = valor;
    }
  });

  controles.tema.incluir.checked = preset.tema !== null;
  if (preset.tema !== null) {
    controles.tema.control.value = preset.tema;
  }

  Object.keys(controles.interruptores).forEach(function (clave) {
    var entrada = controles.interruptores[clave];
    var valor = preset.interruptores[clave];
    entrada.incluir.checked = valor !== undefined;
    entrada.control.checked = valor === true;
  });

  document.getElementById('incluir-colors').checked = preset.colores !== null;
  Object.keys(controles.colores).forEach(function (clave) {
    var entrada = controles.colores[clave];
    var valor = preset.colores ? preset.colores[clave] : undefined;
    entrada.incluir.checked = valor !== undefined;
    if (valor !== undefined) {
      entrada.control.value = valor;
    }
  });

  alCambiar();
}

/* ---------- persistencia ---------- */

// Probando en dispositivo se recarga mucho, y retipear el operationId cada vez
// es fricción real.
function guardar () {
  var estado = {
    operationId: document.getElementById('operationId').value,
    incluirColores: document.getElementById('incluir-colors').checked,
    texto: {},
    tema: { incluir: controles.tema.incluir.checked, valor: controles.tema.control.value },
    interruptores: {},
    colores: {}
  };

  Object.keys(controles.texto).forEach(function (clave) {
    estado.texto[clave] = {
      incluir: controles.texto[clave].incluir.checked,
      valor: controles.texto[clave].control.value
    };
  });

  Object.keys(controles.interruptores).forEach(function (clave) {
    estado.interruptores[clave] = {
      incluir: controles.interruptores[clave].incluir.checked,
      valor: controles.interruptores[clave].control.checked
    };
  });

  Object.keys(controles.colores).forEach(function (clave) {
    estado.colores[clave] = {
      incluir: controles.colores[clave].incluir.checked,
      valor: controles.colores[clave].control.value
    };
  });

  try {
    window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado));
  } catch (error) {
    // Sin almacenamiento el harness igual funciona; solo pierde la memoria.
  }
}

function restaurar () {
  var crudo;

  try {
    crudo = window.localStorage.getItem(CLAVE_ALMACENAMIENTO);
  } catch (error) {
    return;
  }

  if (!crudo) {
    return;
  }

  var estado;
  try {
    estado = JSON.parse(crudo);
  } catch (error) {
    return;
  }

  document.getElementById('operationId').value = estado.operationId || '';
  document.getElementById('incluir-colors').checked = estado.incluirColores === true;

  if (estado.tema) {
    controles.tema.incluir.checked = estado.tema.incluir === true;
    controles.tema.control.value = estado.tema.valor || 'system';
  }

  aplicarGuardado(controles.texto, estado.texto, 'value');
  aplicarGuardado(controles.interruptores, estado.interruptores, 'checked');
  aplicarGuardado(controles.colores, estado.colores, 'value');

  sincronizarOpacidad();
}

function aplicarGuardado (grupo, guardado, propiedad) {
  if (!guardado) {
    return;
  }

  Object.keys(grupo).forEach(function (clave) {
    var entrada = guardado[clave];
    if (!entrada) {
      return;
    }
    grupo[clave].incluir.checked = entrada.incluir === true;
    grupo[clave].control[propiedad] = entrada.valor;
  });
}

/* ---------- ejecución ---------- */

function lanzar () {
  var payload = construirPayload();

  if (!payload.operationId) {
    mostrarError('Falta el operationId.');
    return;
  }

  var boton = document.getElementById('lanzar');
  boton.disabled = true;
  document.getElementById('resultado').textContent = 'Ejecutando…';

  window.Khipu.startOperation(
    payload,
    function (resultado) {
      boton.disabled = false;
      mostrarResultado(resultado, 'ok');
    },
    function (error) {
      boton.disabled = false;
      // El callback de error recibe un KhipuResult cuando el SDK terminó en
      // ERROR, y un string cuando el plugin rechazó antes de arrancar.
      if (typeof error === 'string') {
        mostrarError(error);
      } else {
        mostrarResultado(error, 'error');
      }
    }
  );
}

function mostrarError (mensaje) {
  var contenedor = document.getElementById('resultado');
  contenedor.className = 'resultado resultado--error';
  contenedor.textContent = mensaje;
}

function mostrarResultado (resultado, clase) {
  var contenedor = document.getElementById('resultado');
  contenedor.className = 'resultado resultado--' + clase;
  contenedor.textContent = '';

  var lista = document.createElement('dl');
  ['operationId', 'result', 'exitTitle', 'exitMessage', 'exitUrl', 'failureReason', 'continueUrl']
    .forEach(function (clave) {
      var fila = document.createElement('div');
      fila.className = 'resultado__campo';

      var nombre = document.createElement('dt');
      nombre.textContent = clave;

      var valor = document.createElement('dd');
      valor.textContent = resultado[clave] === null || resultado[clave] === undefined
        ? '—'
        : String(resultado[clave]);

      fila.appendChild(nombre);
      fila.appendChild(valor);
      lista.appendChild(fila);
    });
  contenedor.appendChild(lista);

  var eventos = resultado.events || [];
  if (eventos.length === 0) {
    return;
  }

  var tabla = document.createElement('table');
  tabla.innerHTML =
    '<thead><tr><th>name</th><th>type</th><th>timestamp</th></tr></thead>';

  var cuerpo = document.createElement('tbody');
  eventos.forEach(function (evento) {
    var fila = document.createElement('tr');
    [evento.name, evento.type, evento.timestamp].forEach(function (celda) {
      var td = document.createElement('td');
      td.textContent = celda === null || celda === undefined ? '—' : String(celda);
      fila.appendChild(td);
    });
    cuerpo.appendChild(fila);
  });

  tabla.appendChild(cuerpo);
  contenedor.appendChild(tabla);
}
```

- [ ] **Step 2: Verificar el tri-estado**

Run: `cd example && npm run ios:spm`

Comprobar en el simulador:
1. Con todo sin marcar y un `operationId` escrito, el preview muestra exactamente `{ "operationId": "..." }`, **sin** la clave `options`.
2. Al marcar `showFooter` sin activar el interruptor, el preview muestra `"showFooter": false`. Marcar la casilla y dejar el interruptor apagado **no** es lo mismo que no marcarla.
3. Al marcar `incluir el objeto colors` sin marcar ningún color, el preview muestra `"colors": {}`.

- [ ] **Step 3: Verificar los presets y la persistencia**

1. Tocar *Marca Khipu*: se marcan los 12 colores con la paleta púrpura/cian y el preview los refleja.
2. Tocar *Todo por defecto*: el preview vuelve a tener solo `operationId`.
3. Escribir un `operationId`, recargar la app (`Cmd+R` en el simulador) y verificar que el valor sigue ahí.

- [ ] **Step 4: Verificar una operación real**

Con un `operationId` válido, tocar *Iniciar operación*: se abre la vista de Khipu y al terminar el resultado aparece formateado con su tabla de eventos.

- [ ] **Step 5: Commit**

```bash
git add example/www/js/harness.js
git commit -m "feat(example): lógica del harness con tri-estado por campo

Cada opción tiene casilla de inclusión además de su control, porque el
plugin distingue clave ausente de false y el SDK aplica sus propios
valores por omisión."
```

---

### Task 8: `example/README.md` con la matriz de verificación

**Files:**
- Create: `example/README.md`

**Interfaces:**
- Consumes: los scripts de la Task 5 y la decisión de la Task 4.
- Produces: la documentación de la verificación manual, que reemplaza al CI que quedó fuera de alcance.

- [ ] **Step 1: Crear `example/README.md`**

```markdown
# App de ejemplo de `cordova-khipu`

Ejercita el plugin en los tres escenarios que soporta, y es la forma de
verificarlo: el repositorio no tiene CI por decisión de diseño.

## Requisitos

- Node 20 o superior
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
| cordova-ios 8 + SPM | `npm run ios:spm` | `Package.swift`, sin CocoaPods |
| cordova-android 15 | `npm run android` | `khipu.gradle` y el hook `enable-gradle-kotlin-plugin.js` |

Cada script borra `platforms/` y `plugins/` antes de empezar: el gestor de
paquetes de iOS lo decide el major de la plataforma y no se puede cambiar en
caliente.

### La corrida que de verdad prueba SPM

Al menos una vez, correr `npm run ios:spm` con CocoaPods fuera del `PATH`:

```bash
PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -i cocoapods | paste -sd: -) npm run ios:spm
```

Es lo único que demuestra que el camino de cordova-ios 8 no necesita CocoaPods.

## Qué revisar en el harness

- **Tri-estado.** Con todo sin marcar, el preview muestra solo `operationId`,
  sin la clave `options`. Es el caso del comercio que no configura nada, y es el
  que más se rompe sin querer.
- **`false` explícito.** Marcar `showFooter` con el interruptor apagado manda
  `"showFooter": false`, que no es lo mismo que no mandar la clave.
- **Presets.** *Marca Khipu* usa púrpura `#8347AD` y cian `#3CB4E5`.
- **Recursos en el camino CocoaPods.** El plugin ya no declara `use_frameworks!`, así que los
  pods se enlazan estáticos. Corriendo `npm run ios:pods`, confirmar que la vista de Khipu
  muestra **imágenes y tipografías**, no cuadros vacíos ni texto con la fuente del sistema. Un
  recurso que no resuelve falla al mostrarse, no al compilar, así que el build verde no basta.
- **Persistencia.** El `operationId` sobrevive a una recarga.
- **Resultado.** Al terminar la operación aparecen los campos de `KhipuResult`
  y la tabla de eventos.

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
```

- [ ] **Step 2: Ajustar si la Task 4 decidió otra cosa**

Si el spike concluyó que `cordova plugin add ../` o `--link` son seguros, reescribir la sección *Cómo se instala el plugin* con lo que efectivamente se hizo y por qué. El texto de arriba asume el método del tarball.

- [ ] **Step 3: Commit**

```bash
git add example/README.md
git commit -m "docs(example): matriz de verificación manual"
```

---

### Task 9: `KhipuOptionsMapper` con tests

Hoy el mapeo de opciones fuerza el cast con `as!` en unos veinte lugares: un comercio que mande `title: 123` **crashea la app** en vez de recibir un error.

**Files:**
- Create: `src/ios/KhipuOptionsMapper.swift`
- Create: `tests/ios/KhipuOptionsMapperTests.swift`
- Modify: `Package.swift`
- Modify: `plugin.xml`
- Modify: `src/ios/KhipuPlugin.swift`

**Interfaces:**
- Consumes: el target `CordovaKhipu` de la Task 1.
- Produces: `struct KhipuOptionsInput: Equatable` y `enum KhipuOptionsMapper` con `parse(_ call: [String: Any]) -> KhipuOptionsInput`, `makeOptions(from input: KhipuOptionsInput) -> KhipuOptions`, `makeColors(from colors: [String: String]) -> KhipuColors` y `static let colorKeys: [String]`. Ninguna otra tarea las consume.

> **Por qué existe `KhipuOptionsInput` y no se testea `KhipuOptions` directamente:** las propiedades de `KhipuOptions` están declaradas `let` **sin `public`**, así que son internas al módulo `KhipuClientIOS` y un test nuestro no puede leerlas. Separar el parseo (nuestro, testeable) de la aplicación sobre el Builder (trivial) resuelve eso y además aísla lo único que puede fallar de verdad.

- [ ] **Step 1: Agregar el target de tests a `Package.swift`**

Agregar el `.testTarget` al array `targets`. **Reemplazar el array completo** por
esto, en vez de insertar líneas sueltas:

```swift
    targets: [
        .target(
            name: "CordovaKhipu",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "KhipuClientIOS", package: "KhipuClientIOS")
            ],
            path: "src/ios"
        ),
        .testTarget(
            name: "CordovaKhipuTests",
            dependencies: ["CordovaKhipu"],
            path: "tests/ios"
        )
    ]
```

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/ios/KhipuOptionsMapperTests.swift`:

```swift
import XCTest
import KhipuClientIOS
@testable import CordovaKhipu

final class KhipuOptionsMapperTests: XCTestCase {

    func testSinClaveOptionsDevuelveTodoNil() {
        let input = KhipuOptionsMapper.parse(["operationId": "abc"])

        XCTAssertEqual(input, KhipuOptionsInput())
    }

    func testMapeaTodosLosCamposEscalares() {
        let input = KhipuOptionsMapper.parse([
            "operationId": "abc",
            "options": [
                "title": "Demo",
                "titleImageUrl": "https://khipu.com/logo.png",
                "skipExitPage": true,
                "skipExitSuccessPage": false,
                "showFooter": false,
                "showMerchantLogo": true,
                "showPaymentDetails": false,
                "locale": "es_CL",
                "theme": "dark"
            ]
        ])

        XCTAssertEqual(input.topBarTitle, "Demo")
        XCTAssertEqual(input.topBarImageUrl, "https://khipu.com/logo.png")
        XCTAssertEqual(input.skipExitPage, true)
        XCTAssertEqual(input.skipExitSuccessPage, false)
        XCTAssertEqual(input.showFooter, false)
        XCTAssertEqual(input.showMerchantLogo, true)
        XCTAssertEqual(input.showPaymentDetails, false)
        XCTAssertEqual(input.locale, "es_CL")
        XCTAssertEqual(input.theme, .dark)
    }

    /// El plugin tiene que poder distinguir "no me mandaron la clave" de
    /// "me mandaron false": el SDK aplica sus propios valores por omisión.
    func testClaveAusenteNoSeConfundeConFalse() {
        let input = KhipuOptionsMapper.parse(["options": ["title": "Demo"]])

        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.skipExitPage)
        XCTAssertNil(input.showMerchantLogo)
        XCTAssertNil(input.showPaymentDetails)
        XCTAssertNil(input.skipExitSuccessPage)
    }

    /// Este es el caso que hoy crashea la app.
    func testTipoEquivocadoSeDescartaEnVezDeCrashear() {
        let input = KhipuOptionsMapper.parse([
            "options": [
                "title": 123,
                "showFooter": "sí",
                "locale": ["es", "CL"]
            ]
        ])

        XCTAssertNil(input.topBarTitle)
        XCTAssertNil(input.showFooter)
        XCTAssertNil(input.locale)
    }

    func testThemeDesconocidoSeDescarta() {
        XCTAssertNil(KhipuOptionsMapper.parse(["options": ["theme": "neón"]]).theme)
    }

    func testMapeaLasDoceClavesDeColor() {
        var colores: [String: Any] = [:]
        for (indice, clave) in KhipuOptionsMapper.colorKeys.enumerated() {
            colores[clave] = String(format: "#%06X", indice)
        }

        let input = KhipuOptionsMapper.parse(["options": ["colors": colores]])

        XCTAssertEqual(input.colors?.count, 12)
        XCTAssertEqual(input.colors?["lightPrimary"], "#000002")
    }

    func testDescartaClavesDeColorDesconocidas() {
        let input = KhipuOptionsMapper.parse([
            "options": ["colors": ["lightPrimary": "#8347AD", "morado": "#8347AD"]]
        ])

        XCTAssertEqual(input.colors, ["lightPrimary": "#8347AD"])
    }

    func testColorsVacioSigueSiendoDistintoDeAusente() {
        XCTAssertEqual(KhipuOptionsMapper.parse(["options": ["colors": [String: Any]()]]).colors, [:])
        XCTAssertNil(KhipuOptionsMapper.parse(["options": [String: Any]()]).colors)
    }

    /// `KhipuColors` tiene propiedades internas pero es `Codable`, así que se
    /// puede verificar el objeto que efectivamente recibe el SDK.
    func testLosColoresLleganAlObjetoDelSdk() throws {
        let colors = KhipuOptionsMapper.makeColors(from: [
            "lightPrimary": "#8347AD",
            "darkPrimary": "#3CB4E5"
        ])

        let datos = try JSONEncoder().encode(colors)
        let decodificado = try XCTUnwrap(
            JSONSerialization.jsonObject(with: datos) as? [String: Any])

        XCTAssertEqual(decodificado["lightPrimary"] as? String, "#8347AD")
        XCTAssertEqual(decodificado["darkPrimary"] as? String, "#3CB4E5")
        XCTAssertNil(decodificado["lightBackground"])
    }
}
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `xcodebuild -list`
Expected: aparece el scheme `cordova-khipu-Package`. Anotar el nombre exacto.

Run: `xcodebuild test -scheme cordova-khipu-Package -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: FAIL con `cannot find 'KhipuOptionsMapper' in scope`.

Si no hay un simulador llamado `iPhone 16`, listar los disponibles con `xcrun simctl list devices available` y usar uno de esos.

- [ ] **Step 4: Escribir el mapper**

Crear `src/ios/KhipuOptionsMapper.swift`:

```swift
#if canImport(Cordova)
import Cordova
#endif
import KhipuClientIOS

/// Representación tipada de las opciones que llegan desde JavaScript.
///
/// Existe separada de `KhipuOptions` por dos razones. La primera es práctica:
/// las propiedades de `KhipuOptions` son internas a `KhipuClientIOS`, así que
/// un test no puede leerlas. La segunda es de diseño: separa lo que puede
/// fallar —interpretar un diccionario que arma un tercero— de lo que no,
/// que es aplicar valores ya validados sobre el Builder.
///
/// `nil` significa "el JavaScript no mandó esta clave", que no es lo mismo que
/// mandarla en `false`: el SDK aplica sus propios valores por omisión y el
/// plugin tiene que dejarlo hacerlo.
struct KhipuOptionsInput: Equatable {
    var topBarTitle: String?
    var topBarImageUrl: String?
    var skipExitPage: Bool?
    var skipExitSuccessPage: Bool?
    var showFooter: Bool?
    var showMerchantLogo: Bool?
    var showPaymentDetails: Bool?
    var locale: String?
    var theme: KhipuOptions.Theme?
    var colors: [String: String]?
}

enum KhipuOptionsMapper {

    /// Las doce claves que acepta `KhipuColors`. Una clave que no esté acá se
    /// descarta en vez de propagarse, para que un typo en el JavaScript del
    /// comercio no llegue silenciosamente al SDK.
    static let colorKeys: [String] = [
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
    ]

    /// Interpreta el diccionario que llega desde JavaScript. No lanza ni cae:
    /// un valor con el tipo equivocado se descarta como si no hubiera venido.
    static func parse(_ call: [String: Any]) -> KhipuOptionsInput {
        guard let options = call["options"] as? [String: Any] else {
            return KhipuOptionsInput()
        }

        var input = KhipuOptionsInput()
        input.topBarTitle = options["title"] as? String
        input.topBarImageUrl = options["titleImageUrl"] as? String
        input.skipExitPage = options["skipExitPage"] as? Bool
        input.skipExitSuccessPage = options["skipExitSuccessPage"] as? Bool
        input.showFooter = options["showFooter"] as? Bool
        input.showMerchantLogo = options["showMerchantLogo"] as? Bool
        input.showPaymentDetails = options["showPaymentDetails"] as? Bool
        input.locale = options["locale"] as? String

        if let theme = options["theme"] as? String {
            input.theme = KhipuOptions.Theme(rawValue: theme)
        }

        if let colors = options["colors"] as? [String: Any] {
            var validos: [String: String] = [:]
            for clave in colorKeys {
                if let valor = colors[clave] as? String {
                    validos[clave] = valor
                }
            }
            input.colors = validos
        }

        return input
    }

    /// Aplica un input ya validado sobre el Builder del SDK.
    static func makeOptions(from input: KhipuOptionsInput) -> KhipuOptions {
        var builder = KhipuOptions.Builder()

        if let valor = input.topBarTitle { builder = builder.topBarTitle(valor) }
        if let valor = input.topBarImageUrl { builder = builder.topBarImageUrl(valor) }
        if let valor = input.skipExitPage { builder = builder.skipExitPage(valor) }
        if let valor = input.skipExitSuccessPage { builder = builder.skipExitSuccessPage(valor) }
        if let valor = input.showFooter { builder = builder.showFooter(valor) }
        if let valor = input.showMerchantLogo { builder = builder.showMerchantLogo(valor) }
        if let valor = input.showPaymentDetails { builder = builder.showPaymentDetails(valor) }
        if let valor = input.locale { builder = builder.locale(valor) }
        if let valor = input.theme { builder = builder.theme(valor) }

        if let colores = input.colors {
            builder = builder.colors(makeColors(from: colores))
        }

        return builder.build()
    }

    static func makeColors(from colors: [String: String]) -> KhipuColors {
        var builder = KhipuColors.Builder()

        if let valor = colors["lightBackground"] { builder = builder.lightBackground(valor) }
        if let valor = colors["lightOnBackground"] { builder = builder.lightOnBackground(valor) }
        if let valor = colors["lightPrimary"] { builder = builder.lightPrimary(valor) }
        if let valor = colors["lightOnPrimary"] { builder = builder.lightOnPrimary(valor) }
        if let valor = colors["lightTopBarContainer"] { builder = builder.lightTopBarContainer(valor) }
        if let valor = colors["lightOnTopBarContainer"] { builder = builder.lightOnTopBarContainer(valor) }
        if let valor = colors["darkBackground"] { builder = builder.darkBackground(valor) }
        if let valor = colors["darkOnBackground"] { builder = builder.darkOnBackground(valor) }
        if let valor = colors["darkPrimary"] { builder = builder.darkPrimary(valor) }
        if let valor = colors["darkOnPrimary"] { builder = builder.darkOnPrimary(valor) }
        if let valor = colors["darkTopBarContainer"] { builder = builder.darkTopBarContainer(valor) }
        if let valor = colors["darkOnTopBarContainer"] { builder = builder.darkOnTopBarContainer(valor) }

        return builder.build()
    }
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `xcodebuild test -scheme cordova-khipu-Package -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: PASS, 9 tests, 0 fallas.

- [ ] **Step 6: Usar el mapper desde `KhipuPlugin.swift`**

Borrar el método `getOptions(call:)` completo (desde `func getOptions(call: [String: Any]) -> KhipuOptions {` hasta su llave de cierre, unas 100 líneas).

Y en `startOperation`, reemplazar:

```swift
        let options = getOptions(call: call)
```

por:

```swift
        let options = KhipuOptionsMapper.makeOptions(from: KhipuOptionsMapper.parse(call))
```

- [ ] **Step 7: Declarar el archivo nuevo en `plugin.xml`**

Dentro de `<platform name="ios" package="swift">`, después del `<source-file>` existente:

```xml
    <source-file src="src/ios/KhipuOptionsMapper.swift"/>
```

Es necesario para cordova-ios 7, que compila archivo por archivo. cordova-ios 8 lo ignora porque toma el target completo desde `Package.swift`.

- [ ] **Step 8: Verificar que todo sigue compilando y pasando**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: PASS

Run: `xcodebuild test -scheme cordova-khipu-Package -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: PASS, 9 tests.

- [ ] **Step 9: Verificar en la app de ejemplo que un tipo equivocado ya no crashea**

Run: `cd example && npm run ios:spm`

En el simulador, abrir la consola de Safari (Develop → Simulator → index.html) y ejecutar:

```js
window.Khipu.startOperation(
  { operationId: 'no-existe', options: { title: 123 } },
  function (ok) { console.log('ok', ok); },
  function (err) { console.log('error', err); }
);
```

Expected: la app **no** se cae. Antes de este cambio, el `as!` la mataba.

- [ ] **Step 10: Commit**

```bash
git add src/ios/KhipuOptionsMapper.swift tests/ios/KhipuOptionsMapperTests.swift Package.swift plugin.xml src/ios/KhipuPlugin.swift
git commit -m "fix(ios): mapear opciones con casts seguros en vez de as!

Un comercio que mandaba title: 123 crasheaba la app. El mapeo pasa a una
función pura sobre un tipo propio, con tests: las propiedades de
KhipuOptions son internas al SDK y no se pueden verificar directamente."
```

---

### Task 10: Presenter correcto y `dismiss` no destructivo

**Files:**
- Modify: `src/ios/KhipuPlugin.swift`

**Interfaces:**
- Consumes: el `KhipuPlugin.swift` de la Task 9.
- Produces: `private func presenter() -> UIViewController?` en `KhipuPlugin`. Ninguna otra tarea la consume.

Hay dos defectos acá, los dos verificados, y la corrección es la misma para ambos.

**a) `UIApplication.shared.windows` está deprecado desde iOS 15, y el compilador no lo dice.** A un deployment target de iOS 13 no emite ninguna advertencia, porque a ese piso la API todavía no estaba deprecada. Medido con `swiftc -typecheck`:

```
iOS 13.0 → (sin advertencia)
iOS 15.0 → warning: 'windows' was deprecated in iOS 15.0: Use UIWindowScene.windows on a relevant window scene instead
iOS 18.0 → ídem
```

Como `Package.swift` declara `.iOS(.v13)`, **un `grep "was deprecated"` sobre el build no sirve de test**: no encuentra nada ni antes ni después del cambio. Aparte del aviso, `windows` devuelve ventanas de todas las escenas conectadas, así que en una app con varias escenas puede entregar la que no está en pantalla.

**b) Presentar sobre un controller que ya está presentando no hace nada.** UIKit lo rechaza en silencio. El código actual esquiva eso con `presenter.presentedViewController?.dismiss(animated: false)`, o sea **cerrándole el modal al comercio sin avisar**, y después esperando un segundo fijo a que el cierre termine. Un comercio que llame al plugin con su propio modal en pantalla ve desaparecer su interfaz.

La corrección: Cordova ya entrega el controller correcto en `self.viewController` de `CDVPlugin`. Existe en cordova-ios 7 (`@property (nonatomic, weak) UIViewController* viewController;`) y en cordova-ios 8 (`@property (nonatomic, weak) CDVViewController *viewController;`), y **no está deprecado** en ninguna de las dos — a diferencia de `scrollView` y otras del mismo header, que sí llevan `CDV_DEPRECATED(8.0.0, ...)`. Desde ahí se baja por la cadena de presentados en vez de destruirla.

- [ ] **Step 1: Confirmar que la deprecación existe pero está oculta al piso actual**

```bash
cd /tmp && cat > dep.swift <<'EOF'
import UIKit
func f() -> UIViewController? {
    return UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController
}
EOF
SDK=$(xcrun --sdk iphoneos --show-sdk-path)
for t in 13.0 15.0; do
  echo "--- iOS $t"
  xcrun swiftc -typecheck -sdk "$SDK" -target arm64-apple-ios$t dep.swift 2>&1 | grep -c "was deprecated"
done
rm /tmp/dep.swift
```
Expected: `0` para iOS 13.0 y un número mayor que cero para iOS 15.0.

Esto es lo que justifica no usar el log del build como verificación.

- [ ] **Step 2: Confirmar el estado del código**

Run: `grep -n "UIApplication.shared.windows\|presentedViewController?.dismiss\|asyncAfter" src/ios/KhipuPlugin.swift`
Expected: las tres líneas aparecen.

- [ ] **Step 3: Reemplazar `startKhipuOperation` y agregar `presenter()`**

Reemplazar el método `startKhipuOperation(operationId:options:completion:)` completo por:

```swift
    func startKhipuOperation(operationId: String, options: KhipuOptions, completion: @escaping ([String: Any]?, String?) -> Void) {
        DispatchQueue.main.async {
            guard let presenter = self.presenter() else {
                completion(nil, "No view controller available to present from")
                return
            }

            KhipuLauncher.launch(presenter: presenter,
                                 operationId: operationId,
                                 options: options) { result in
                completion([
                    "operationId": result.operationId,
                    "result": result.result,
                    "exitTitle": result.exitTitle,
                    "exitMessage": result.exitMessage,
                    "exitUrl": result.exitUrl as Any,
                    "failureReason": result.failureReason as Any,
                    "continueUrl": result.continueUrl as Any,
                    "events": result.events.map { event in
                        return [
                            "name": event.name,
                            "type": event.type,
                            "timestamp": event.timestamp
                        ]
                    }
                ], nil)
            }
        }
    }

    /// El controller sobre el que presentar la vista de Khipu.
    ///
    /// Se parte de `self.viewController`, que es el que Cordova asocia al
    /// webview desde el que llegó la llamada. Es mejor punto de partida que
    /// `UIApplication.shared.windows`: esa API está deprecada desde iOS 15
    /// —sin que el compilador avise a un piso de iOS 13— y devuelve ventanas
    /// de todas las escenas conectadas, incluida alguna que no esté en
    /// pantalla.
    ///
    /// Después se baja por la cadena de presentados. UIKit rechaza presentar
    /// sobre un controller que ya está presentando algo, así que un comercio
    /// que llame al plugin con su propio modal arriba no vería nada. Antes esto
    /// se resolvía haciendo `dismiss` de lo que hubiera, es decir cerrándole el
    /// modal al comercio, y esperando un segundo fijo a que terminara; bajar
    /// por la cadena no destruye nada y no necesita esperar.
    ///
    /// Se deja privado al plugin en vez de como extensión de `UIViewController`:
    /// el plugin se enlaza estáticamente dentro de la app del comercio, donde
    /// una extensión con un nombre así puede chocar con la suya.
    private func presenter() -> UIViewController? {
        var controller: UIViewController? = self.viewController

        while let presentado = controller?.presentedViewController {
            controller = presentado
        }

        return controller
    }
```

Notar que desaparecen el `dismiss`, el `asyncAfter(deadline: .now() + 1)` y la búsqueda por `UIApplication`.

- [ ] **Step 4: Verificar que ya no queda ninguna de las tres cosas**

Run: `grep -n "UIApplication.shared.windows\|presentedViewController?.dismiss\|asyncAfter" src/ios/KhipuPlugin.swift || echo "las tres eliminadas: OK"`
Expected: `las tres eliminadas: OK`

- [ ] **Step 5: Compilar y correr los tests**

Run: `xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build`
Expected: PASS

Run: `xcodebuild test -scheme cordova-khipu-Package -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: PASS, 9 tests.

- [ ] **Step 6: Probe temporal para ver qué controller se resuelve**

Agregar temporalmente al final de `presenter()`, justo antes del `return controller`:

```swift
        // PROBE TEMPORAL — borrar en el Step 8
        NSLog("cordova-khipu probe: viewController=%@ presenter=%@ yaPresentaba=%@",
              String(describing: type(of: self.viewController)),
              String(describing: controller.map { type(of: $0) }),
              String(describing: self.viewController?.presentedViewController != nil))
```

Run: `cd example && npm run ios:spm`

Lanzar una operación y leer la consola de Xcode o `xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "cordova-khipu probe"'`.

Expected en el camino feliz: `viewController` y `presenter` son el mismo tipo y `yaPresentaba=false`. Eso confirma que el cambio no altera el caso normal — es exactamente lo que resolvía el código viejo.

- [ ] **Step 7: Verificar el caso que antes fallaba**

Con el probe todavía puesto, lanzar una operación, dejar que termine, y lanzar una segunda sin cerrar la app.

Expected: la vista de Khipu se abre las dos veces, sin pantalla en blanco y sin el segundo de demora que antes había entre el cierre y la reapertura.

El caso del modal propio del comercio no se puede reproducir desde el harness, porque Cordova no expone una forma de presentar un `UIViewController` desde JavaScript. Queda cubierto por la regla de UIKit y por la medición que hizo la sesión de `flutter_khipu` sobre el mismo patrón (`oldCodeWouldReturn = FlutterViewController, alreadyPresenting=true`). Si se quiere comprobar acá, hay que agregar un probe nativo que presente un controller vacío antes de lanzar, y eso queda fuera de esta tarea.

- [ ] **Step 8: Sacar el probe**

Borrar el bloque `// PROBE TEMPORAL` completo.

Run: `grep -c "PROBE TEMPORAL" src/ios/KhipuPlugin.swift || echo "probe eliminado: OK"`
Expected: `probe eliminado: OK`

- [ ] **Step 9: Verificar el camino de CocoaPods**

Run: `cd example && npm run ios:pods`
Expected: mismo comportamiento que en SPM. Este paso importa porque `self.viewController` está tipado distinto en cordova-ios 7 (`UIViewController*`) y en 8 (`CDVViewController*`); el código no usa nada específico de `CDVViewController`, pero hay que verlo compilar en los dos.

- [ ] **Step 10: Commit**

```bash
git add src/ios/KhipuPlugin.swift
git commit -m "fix(ios): presentar sobre el controller correcto sin cerrar el del comercio

Se parte de self.viewController, que Cordova asocia al webview que hizo
la llamada, y se baja por la cadena de presentados. UIKit rechaza
presentar sobre un controller que ya presenta algo: antes eso se
esquivaba haciendo dismiss del modal del comercio y esperando un segundo
fijo. De paso sale UIApplication.shared.windows, deprecado desde iOS 15
aunque el compilador no avise a un piso de iOS 13."
```

---

### Task 11: Android al día con cordova-android 15

**Files:**
- Modify: `src/android/khipu.gradle`

**Interfaces:**
- Consumes: la app de ejemplo de las Tasks 5-7.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Confirmar el estado actual**

Run: `grep -n "jcenter\|packagingOptions\|mavenCentral" src/android/khipu.gradle`
Expected: aparece `jcenter()` y `packagingOptions`, no aparece `mavenCentral()`.

- [ ] **Step 2: Reescribir `src/android/khipu.gradle` sin los excludes**

Primero se prueba si los excludes siguen haciendo falta. AGP moderno ya excluye varios `META-INF/*` por su cuenta.

```groovy
repositories {
    google()
    // jcenter() está apagado desde 2022. El plugin funcionaba porque el
    // template de cordova-android declara mavenCentral() en el root, no
    // porque jcenter sirviera.
    mavenCentral()
    maven { url 'https://dev.khipu.com/nexus/content/repositories/khenshin' }
}

dependencies {
    implementation 'com.khipu:khipu-client-android:2.27.0'
}
```

- [ ] **Step 3: Compilar el ejemplo en Android**

Este paso es además el primer ejercicio real de `khipu-client-android` 2.27.0 con Kotlin
2.1.21, el default de cordova-android 15 — el riesgo 4 del spec. No hay precedente:
`flutter_khipu` usa ese mismo 2.27.0 pero fijando `ext.kotlin_version = "1.9.0"`, dos majors
más abajo. `khipu-client-android` usa Jetpack Compose, cuyo compilador va atado a la versión
de Kotlin.

Run: `cd example && npm run android`
Expected: la app arranca en el emulador y muestra `deviceready OK · window.Khipu es object`.

Si falla con un error del compilador de Compose o un choque de versiones de Kotlin,
**detenerse y reportar**: no es algo que se arregle desde este plugin, hay que escalarlo al
equipo del SDK de Android. Como dato para ese reporte, anotar la versión de Kotlin efectiva
con `grep KOTLIN_VERSION example/platforms/android/cdv-gradle-config.json`.

- [ ] **Step 4: Si el build falla por recursos duplicados, reponer los excludes con la sintaxis de AGP 8**

Solo si el paso 3 falló con un error del tipo `2 files found with path 'META-INF/NOTICE'`, agregar al final de `src/android/khipu.gradle`:

```groovy
android {
    // `packagingOptions { exclude ... }` quedó deprecado en AGP 8; esta es la
    // forma equivalente. Requiere AGP 8, que es cordova-android 12 en
    // adelante, y el <engines> del plugin ya pide 13.
    packaging {
        resources {
            excludes += ['META-INF/NOTICE', 'META-INF/LICENSE']
        }
    }
}
```

Volver a correr `npm run android` y verificar que pasa.

Si el paso 3 pasó sin esto, **no agregarlo**: el bloque se elimina definitivamente.

- [ ] **Step 5: Verificar que el hook de Kotlin sigue haciendo su trabajo**

Run: `grep IS_GRADLE_PLUGIN_KOTLIN_ENABLED example/platforms/android/cdv-gradle-config.json`
Expected: `"IS_GRADLE_PLUGIN_KOTLIN_ENABLED": true`

Ese `true` lo pone `scripts/enable-gradle-kotlin-plugin.js`; el default de cordova-android 15 es `false`.

- [ ] **Step 6: Anotar las versiones efectivas para el README**

```bash
grep -E "KOTLIN_VERSION|GRADLE_VERSION|AGP_VERSION|SDK_VERSION|MIN_SDK_VERSION" example/platforms/android/cdv-gradle-config.json
```

Guardar la salida: la Task 13 la usa para escribir la sección de Android del README con números reales en vez de recordados.

- [ ] **Step 7: Commit**

```bash
git add src/android/khipu.gradle
git commit -m "fix(android): reemplazar jcenter por mavenCentral

JCenter está apagado desde 2022; declarar mavenCentral explícitamente
deja de depender de que el template de cordova-android lo traiga."
```

---

### Task 12: Empaquetado npm y check de sincronía de versiones

**Files:**
- Create: `scripts/check-native-versions.js`
- Create: `tests/scripts/check-native-versions.test.js`
- Create: `CHANGELOG.md`
- Create: `LICENSE` (**bloqueado**, ver Step 7)
- Modify: `package.json`

**Interfaces:**
- Consumes: `Package.swift` y `plugin.xml`.
- Produces: `scripts/check-native-versions.js` exporta `compare(packageSwift, pluginXml) -> { ok: boolean, message: string }` para los tests, y corre la comparación cuando se ejecuta directo. `package.json` gana el script `verify:versions`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/scripts/check-native-versions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');

const { compare } = require('../../scripts/check-native-versions.js');

const PACKAGE_SWIFT = version =>
    `.package(url: "https://github.com/khipu/KhipuClientIOS.git", exact: "${version}")`;

// El atributo que cordova-ios lee es `spec`, no `version`: Podfile.js solo emite la
// restricción si encuentra `spec`. Un `version=` se ignora en silencio y el pod queda sin pin.
const PLUGIN_XML = version =>
    `<pod name="KhipuClientIOS" spec="${version}" swift-version="5.1" nospm="true"/>`;

test('acepta versiones iguales', () => {
    const resultado = compare(PACKAGE_SWIFT('2.16.5'), PLUGIN_XML('2.16.5'));

    assert.strictEqual(resultado.ok, true);
    assert.match(resultado.message, /2\.16\.5/);
});

test('rechaza versiones distintas', () => {
    const resultado = compare(PACKAGE_SWIFT('2.16.5'), PLUGIN_XML('2.16.2'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /2\.16\.5/);
    assert.match(resultado.message, /2\.16\.2/);
});

test('rechaza si falta la versión en Package.swift', () => {
    const resultado = compare('let package = Package(name: "cordova-khipu")', PLUGIN_XML('2.16.5'));

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /Package\.swift/);
});

test('rechaza si falta el pod en plugin.xml', () => {
    const resultado = compare(PACKAGE_SWIFT('2.16.5'), '<plugin id="cordova-khipu"></plugin>');

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /plugin\.xml/);
});

test('tolera que los atributos del pod vengan en otro orden', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod spec="2.16.5" name="KhipuClientIOS" nospm="true"/>');

    assert.strictEqual(resultado.ok, true);
});

// Regresión del bug que encontró la Task 3: con `version=` el pod queda sin pin y cada
// comercio recibe la versión que CocoaPods resuelva. El check tiene que gritar, no pasar.
test('rechaza version= en vez de spec=, que cordova-ios ignora', () => {
    const resultado = compare(
        PACKAGE_SWIFT('2.16.5'),
        '<pod name="KhipuClientIOS" version="2.16.5" nospm="true"/>');

    assert.strictEqual(resultado.ok, false);
    assert.match(resultado.message, /plugin\.xml/);
});
```

El último test importa: `scripts/update-plugin-version.js` reescribe `plugin.xml` con el Builder de `xml2js` en cada release, y no hay garantía de que preserve el orden de los atributos.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL con `Cannot find module '../../scripts/check-native-versions.js'`

- [ ] **Step 3: Escribir el script**

Crear `scripts/check-native-versions.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

// La versión de KhipuClientIOS vive en dos manifests porque el plugin soporta
// CocoaPods (cordova-ios 7) y SPM (cordova-ios 8) a la vez. Sin CI, esto es lo
// único que impide publicar una versión donde los dos caminos instalen SDKs
// distintos.

function compare (packageSwift, pluginXml) {
    const spm = packageSwift.match(/KhipuClientIOS\.git"\s*,\s*exact:\s*"([^"]+)"/);

    if (!spm) {
        return {
            ok: false,
            message: 'no se encontró la versión de KhipuClientIOS en Package.swift'
        };
    }

    // Se aísla la etiqueta <pod> primero y después se extrae la versión, para
    // no depender del orden de los atributos: update-plugin-version.js
    // reescribe plugin.xml con el Builder de xml2js en cada release.
    const podTag = pluginXml.match(/<pod\b[^>]*name="KhipuClientIOS"[^>]*>/);
    // `spec`, no `version`: Podfile.js de cordova-ios solo emite la restricción de versión si
    // encuentra `spec`. Un `version=` se ignora en silencio y el pod queda sin pin, que es
    // exactamente el bug que tenía el plugin publicado.
    const pod = podTag && podTag[0].match(/spec="([^"]+)"/);

    if (!pod) {
        return {
            ok: false,
            message: 'no se encontró `spec` de KhipuClientIOS en plugin.xml (¿quedó como `version=`, que cordova-ios ignora?)'
        };
    }

    if (spm[1] !== pod[1]) {
        return {
            ok: false,
            message: `KhipuClientIOS difiere: Package.swift dice ${spm[1]} y plugin.xml dice ${pod[1]}`
        };
    }

    return {
        ok: true,
        message: `KhipuClientIOS ${spm[1]} sincronizado entre Package.swift y plugin.xml`
    };
}

function main () {
    const root = path.resolve(__dirname, '..');
    const resultado = compare(
        fs.readFileSync(path.join(root, 'Package.swift'), 'utf-8'),
        fs.readFileSync(path.join(root, 'plugin.xml'), 'utf-8')
    );

    if (!resultado.ok) {
        console.error(`check-native-versions: ${resultado.message}`);
        process.exit(1);
    }

    console.log(`check-native-versions: ${resultado.message}.`);
}

module.exports = { compare };

if (require.main === module) {
    main();
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS, 15 tests (9 del hook + 6 de este script), 0 fallas.

- [ ] **Step 5: Verificar el script contra los archivos reales**

Run: `node scripts/check-native-versions.js`
Expected: `check-native-versions: KhipuClientIOS 2.16.5 sincronizado entre Package.swift y plugin.xml.`

- [ ] **Step 6: Actualizar `package.json`**

El campo `files` ya lo agregó la Task 5, porque sin él el tarball que instala el ejemplo se
llevaba el repositorio entero. Verificar que sigue ahí y que no perdió `tests/`, que es el que
más fácil se cae porque parece prescindible y no lo es:

Run: `node -e "const f=require('./package.json').files; if(!f) throw new Error('falta files'); if(!f.includes('tests/')) throw new Error('falta tests/ en files'); console.log('files OK:', f.join(', '))"`
Expected: `files OK: plugin.xml, Package.swift, www/, src/, tests/, scripts/, README.md, LICENSE`

Dejar `scripts` así:

```json
  "scripts": {
    "test": "node --test tests/scripts/",
    "verify:versions": "node scripts/check-native-versions.js",
    "release": "release-it",
    "prepare": "husky"
  },
```

En el bloque `release-it`, reemplazar `hooks` por:

```json
    "hooks": {
      "before:init": "npm run verify:versions && npm test",
      "after:bump": "node scripts/update-plugin-version.js && git add plugin.xml && git commit -m 'chore: sync version to plugin.xml'"
    }
```

Y en `plugins`, agregar el `infile`:

```json
    "plugins": {
      "@release-it/conventional-changelog": {
        "preset": "angular",
        "infile": "CHANGELOG.md"
      }
    },
```

- [ ] **Step 7: Crear `LICENSE` — BLOQUEADO, requiere confirmación**

Hay una inconsistencia que no se puede resolver sin preguntar:

| Repo | `license` declarado | Archivo `LICENSE` |
| --- | --- | --- |
| `cordova-khipu` | MIT | no existe |
| `capacitor-khipu` | MIT | no existe |
| `flutter_khipu` | — | **LGPL-3.0** |

**No inventar el archivo.** Preguntar cuál corresponde y con qué razón social. Si se confirma MIT, este es el contenido, reemplazando `<RAZÓN SOCIAL>`:

```
MIT License

Copyright (c) 2026 <RAZÓN SOCIAL>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Si al llegar acá no hay respuesta: **sacar `"LICENSE"` del campo `files`**, seguir con el resto de la tarea, y reportar el pendiente al cerrar el plan. No bloquear las demás tareas por esto.

- [ ] **Step 7b: Crear `.nvmrc`**

Contenido, una sola línea:

```
v20.19.4
```

Hoy el repositorio no tiene `.nvmrc` y hereda el del directorio padre, que en la máquina de
desarrollo apunta a `v20.12.2`. Eso **no cumple** el engine de `cordova-ios` 8.1.1
(`^20.17.0 || >=22.9.0`), así que `cordova platform add ios@8` corre con una versión de Node
que el propio cordova declara insuficiente. Fijarlo en el repo lo hace explícito y
reproducible para cualquiera.

Run: `cat .nvmrc`
Expected: `v20.19.4`

- [ ] **Step 8: Crear `CHANGELOG.md`**

```markdown
# Changelog

Este archivo lo mantiene `@release-it/conventional-changelog` a partir de los
mensajes de commit. Las entradas anteriores a la 2.10.0 no están: el changelog
se empezó a generar recién en esa versión, y las releases previas están en
https://github.com/khipu/cordova-khipu/releases
```

- [ ] **Step 9: Verificar qué se publicaría**

Run: `npm pack --dry-run 2>&1 | grep -E "example/|node_modules|docs/" || echo "ni example/ ni docs/ se publican: OK"`
Expected: `ni example/ ni docs/ se publican: OK`

Run: `npm pack --dry-run 2>&1 | grep -E "tests/ios|Package.swift"`
Expected: aparecen `tests/ios/KhipuOptionsMapperTests.swift` y `Package.swift`.

- [ ] **Step 10: Commit**

```bash
git add package.json scripts/check-native-versions.js tests/scripts/check-native-versions.test.js CHANGELOG.md
git commit -m "chore: acotar lo que se publica y verificar la sincronía de versiones

El campo files evita publicar example/ y docs/. check-native-versions
falla el release si KhipuClientIOS difiere entre Package.swift y
plugin.xml, que es lo que se rompe solo al mantener dos gestores."
```

Si la licencia quedó confirmada, agregar `LICENSE` a ese `git add`.

---

### Task 13: README y preparación de la versión 2.10.0

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `plugin.xml`

**Interfaces:**
- Consumes: las versiones efectivas anotadas en el Step 6 de la Task 11.
- Produces: el repositorio listo para `npm run release`. **Este plan no publica.**

- [ ] **Step 1: Reemplazar las secciones de setup del README**

Reemplazar todo lo que va desde `## iOS pre setup` hasta `## Android setup` (inclusive, hasta justo antes de `## Usage`) por:

```markdown
## Requisitos

| | Mínimo | Probado con |
| --- | --- | --- |
| `cordova` (CLI) | 13.0.0 | 13.0.0 |
| `cordova-ios` | 7.0.0 | 7.1.1 y 8.1.1 |
| `cordova-android` | 13.0.0 | 15.1.0 |
| iOS | 13.0 | |
| Node | `^20.17.0 \|\| >=22.9.0` | 20.19.4 |

Estos mínimos están declarados en `<engines>`, así que `cordova plugin add`
falla con un mensaje claro en vez de romper más adelante.

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

`cordova-ios` 8 ya usa 13.0 por defecto, así que ahí es opcional.

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
```

- [ ] **Step 2: Reemplazar los valores por los reales**

Los números de la tabla de Android son los defaults de `cordova-android` 15.1.0. Contrastarlos con la salida guardada en el Step 6 de la Task 11 y corregir cualquier diferencia. Si difieren, mandan los observados.

- [ ] **Step 3: Verificar que no quedaron referencias viejas**

Run: `grep -n -i "cordova 11\|kotlin-android-extensions\|jcenter\|deployment-target.*12\|1\.9\.10\|SDK 34" README.md || echo "sin referencias obsoletas: OK"`
Expected: `sin referencias obsoletas: OK`

- [ ] **Step 4: Verificar que los enlaces del README apuntan a archivos que existen**

Run: `test -f example/README.md && test -d example && echo "enlaces OK"`
Expected: `enlaces OK`

- [ ] **Step 5: Correr la verificación completa una última vez**

```bash
npm test
npm run verify:versions
xcodebuild -scheme cordova-khipu -destination 'generic/platform=iOS' build
xcodebuild test -scheme cordova-khipu-Package -destination 'platform=iOS Simulator,name=iPhone 16'
```
Expected: los cuatro pasan.

```bash
cd example
npm run ios:spm    # verificar el harness completo en el simulador
npm run ios:pods   # verificar el harness completo en el simulador
npm run android    # verificar el harness completo en el emulador
```
Expected: los tres arrancan y el harness funciona.

Y la corrida que de verdad prueba que SPM no necesita CocoaPods, que el spec §12
pide hacer al menos una vez:

```bash
cd example
PATH=$(echo "$PATH" | tr ':' '\n' | grep -v -i cocoapods | paste -sd: -) npm run ios:spm
```
Expected: `BUILD SUCCEEDED` y la app corriendo. Si falla con `pod: command not
found`, es que algo del camino de cordova-ios 8 todavía llama a CocoaPods:
revisar que el `<pod>` tenga `nospm="true"`.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: reescribir el setup de iOS y Android

iOS documenta los dos gestores y que el major de cordova-ios decide cuál
se usa. Android pasa de los valores de cordova 11 a los defaults reales
de cordova-android 15.1.0."
```

- [ ] **Step 7: Dejar la release preparada, sin ejecutarla**

`release-it` se encarga del bump, el tag, el changelog y el publish. El comando es:

```bash
npm run release -- --increment minor
```

Eso lleva a `2.10.0`, corre `verify:versions` y `npm test` antes de empezar, sincroniza `plugin.xml` y publica a npm.

**No ejecutarlo dentro de este plan.** Publicar a npm es una acción hacia afuera e irreversible: requiere confirmación explícita. Reportar que el repositorio quedó listo y esperar el visto bueno.

---

## Notas de cierre para quien ejecute

- **Las tasks 3 y 4 son gates.** Si la Task 3 muestra que cordova-ios 7 no compila con el Xcode actual, detenerse y reportar: el soporte dual pierde sentido y hay que reabrir la decisión. Si la Task 4 muestra que los tres métodos de instalación local corrompen el repo, detenerse igual.
- **Pendientes conocidos que este plan no toca**, y que hay que repetir al cerrar:
  - La licencia del repositorio (Task 12, Step 7).
  - La compatibilidad de `khipu-client-android` 2.27.0 con Kotlin 2.1.21, que hay que confirmar con el equipo del SDK de Android.
  - El patrón `Objects.requireNonNull` / `assert` de `KhipuPlugin.java`, que tiene el mismo problema que se arregló en Swift.
