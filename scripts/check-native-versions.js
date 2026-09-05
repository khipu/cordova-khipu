const fs = require('node:fs');
const path = require('node:path');

// El soporte dual de iOS (CocoaPods en cordova-ios 7, SPM en cordova-ios 8) depende de que
// varias cosas de plugin.xml y Package.swift se mantengan sincronizadas. Sin CI, esto es lo
// único que impide publicar una versión que rompa esa sincronía: la versión de KhipuClientIOS
// entre los dos manifiestos, que `nospm="true"` siga en el <pod> (si se cae, cordova-ios 8
// vuelve a instalar el pod además de SPM), que `package="swift"` siga en
// <platform name="ios"> (sin él, cordova-ios 8 deja de usar SPM), y que cada archivo .swift de
// src/ios/ tenga su <source-file>: SPM toma el directorio entero, pero CocoaPods toma la lista
// explícita, así que un archivo nuevo compila bajo cordova-ios 8 y falta en silencio bajo el 7.

function escapeRegExp (value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `iosSourceFiles` se recibe como parámetro en vez de leerse del disco acá adentro, para que
// esta función siga siendo pura y testeable sin tocar el filesystem. `main()` la llena listando
// src/ios/.
function compare (packageSwift, pluginXml, iosSourceFiles = []) {
    const spm = packageSwift.match(/KhipuClientIOS\.git"\s*,\s*exact:\s*"([^"]+)"/);

    if (!spm) {
        return {
            ok: false,
            message: 'no se encontró la versión de KhipuClientIOS en Package.swift'
        };
    }

    // Se aíslan las etiquetas <pod> primero y después se extrae la versión, para
    // no depender del orden de los atributos: update-plugin-version.js
    // reescribe plugin.xml con el Builder de xml2js en cada release.
    const podTags = [...pluginXml.matchAll(/<pod\b[^>]*name="KhipuClientIOS"[^>]*>/g)];

    if (podTags.length === 0) {
        return {
            ok: false,
            message: 'no se encontró ninguna etiqueta <pod name="KhipuClientIOS"> en plugin.xml'
        };
    }

    // Dos <pod> del mismo nombre instalarían versiones distintas de CocoaPods
    // según cuál gane, y eso ya es un problema en sí mismo (un merge o un
    // copy-paste que dejó un duplicado). Se falla por cardinalidad antes de
    // mirar `spec`, para no dar por buena una coincidencia parcial ni un falso
    // bloqueo si el duplicado que falta `spec` no es el primero.
    if (podTags.length > 1) {
        return {
            ok: false,
            message: `se encontraron ${podTags.length} etiquetas <pod name="KhipuClientIOS"> en plugin.xml; debería haber una sola`
        };
    }

    // `spec`, no `version`: Podfile.js de cordova-ios solo emite la restricción de versión si
    // encuentra `spec`. Un `version=` se ignora en silencio y el pod queda sin pin, que es
    // exactamente el bug que tenía el plugin publicado.
    const pod = podTags[0][0].match(/spec="([^"]+)"/);

    if (!pod) {
        return {
            ok: false,
            message: 'el <pod name="KhipuClientIOS"> de plugin.xml no tiene `spec` (¿quedó como `version=`, que cordova-ios ignora?)'
        };
    }

    if (spm[1] !== pod[1]) {
        return {
            ok: false,
            message: `KhipuClientIOS difiere: Package.swift dice ${spm[1]} y plugin.xml dice ${pod[1]}`
        };
    }

    // Sin `nospm="true"`, cordova-ios 8 vuelve a instalar el pod además de SPM: el camino SPM
    // empieza a exigir CocoaPods y el SDK queda enlazado dos veces.
    if (!/\bnospm\s*=\s*"true"/.test(podTags[0][0])) {
        return {
            ok: false,
            message: 'el <pod name="KhipuClientIOS"> de plugin.xml perdió `nospm="true"`: cordova-ios 8 volvería a instalar el pod además de SPM'
        };
    }

    // Se aísla la etiqueta <platform name="ios"> igual que se aisló <pod>, tolerante al orden
    // de atributos por la misma razón: update-plugin-version.js reescribe plugin.xml en cada
    // release.
    const iosPlatformTags = [...pluginXml.matchAll(/<platform\b[^>]*\bname="ios"[^>]*>/g)];

    if (iosPlatformTags.length === 0 || !/\bpackage\s*=\s*"swift"/.test(iosPlatformTags[0][0])) {
        return {
            ok: false,
            message: 'no se encontró `package="swift"` en <platform name="ios"> de plugin.xml: sin él, cordova-ios 8 deja de usar Swift Package Manager'
        };
    }

    // SPM toma el directorio src/ios/ completo (`path: "src/ios"` en Package.swift), pero
    // CocoaPods (cordova-ios 7) solo instala lo que declara un <source-file> explícito: un
    // archivo .swift nuevo compila bajo cordova-ios 8 y falta en silencio bajo el 7.
    for (const archivo of iosSourceFiles) {
        const regex = new RegExp(`<source-file\\b[^>]*\\bsrc="src/ios/${escapeRegExp(archivo)}"`);

        if (!regex.test(pluginXml)) {
            return {
                ok: false,
                message: `src/ios/${archivo} no tiene su <source-file> en plugin.xml: SPM lo compila igual (toma todo el directorio), pero cordova-ios 7 vía CocoaPods lo va a ignorar en silencio`
            };
        }
    }

    return {
        ok: true,
        message: `KhipuClientIOS ${spm[1]} sincronizado entre Package.swift y plugin.xml`
    };
}

// La versión del plugin también vive en dos archivos, y el release la sincroniza con un hook.
// Si ese hook falla o el release se interrumpe entre el bump y la sincronía, los dos quedan
// descoordinados: le pasó al 2.10.0, que abortó con plugin.xml en 2.10.0 y package.json en
// 2.9.1. Nada lo detectaba, porque `compare()` mira la versión de KhipuClientIOS y no la del
// plugin. Va aparte y no como un parámetro más de `compare()` a propósito: un parámetro
// opcional es un chequeo que se puede dejar de pasar sin que nadie se entere.
function compararVersionDelPlugin (versionEnPackageJson, pluginXml) {
    if (!versionEnPackageJson) {
        return {
            ok: false,
            message: 'no se pudo leer la versión del plugin desde package.json'
        };
    }

    // Se aísla la etiqueta <plugin> antes de buscar `version`, porque ese atributo también
    // aparece en la declaración XML (`<?xml version="1.0"?>`) y en cada <engine>.
    const pluginTag = pluginXml.match(/<plugin\b[^>]*>/);
    const enPluginXml = pluginTag && pluginTag[0].match(/\bversion="([^"]+)"/);

    if (!enPluginXml) {
        return {
            ok: false,
            message: 'el <plugin> de plugin.xml no declara `version`'
        };
    }

    if (enPluginXml[1] !== versionEnPackageJson) {
        return {
            ok: false,
            message: `la versión del plugin difiere: package.json dice ${versionEnPackageJson} y plugin.xml dice ${enPluginXml[1]}`
        };
    }

    return {
        ok: true,
        message: `versión del plugin ${versionEnPackageJson} sincronizada entre package.json y plugin.xml`
    };
}

function main () {
    const root = path.resolve(__dirname, '..');
    const iosSourceFiles = fs
        .readdirSync(path.join(root, 'src', 'ios'))
        .filter(entry => entry.endsWith('.swift'));
    const pluginXml = fs.readFileSync(path.join(root, 'plugin.xml'), 'utf-8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

    const resultados = [
        compare(
            fs.readFileSync(path.join(root, 'Package.swift'), 'utf-8'),
            pluginXml,
            iosSourceFiles
        ),
        compararVersionDelPlugin(packageJson.version, pluginXml)
    ];

    const falla = resultados.find(resultado => !resultado.ok);

    if (falla) {
        console.error(`check-native-versions: ${falla.message}`);
        process.exit(1);
    }

    for (const resultado of resultados) {
        console.log(`check-native-versions: ${resultado.message}.`);
    }
}

module.exports = { compare, compararVersionDelPlugin };

if (require.main === module) {
    main();
}
