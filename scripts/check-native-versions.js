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
