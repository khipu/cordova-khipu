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
    try {
        const projectRoot = context.opts.projectRoot;
        const platformPath = path.join(projectRoot, 'platforms', 'ios');

        if (!fs.existsSync(platformPath)) {
            return;
        }

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

    // cordova-ios 8 renombró el proyecto a App.xcodeproj de forma fija: su presencia es señal
    // positiva de 8.
    if (fs.existsSync(path.join(platformPath, 'App.xcodeproj'))) {
        return 8;
    }

    // Que exista un .xcodeproj con OTRO nombre sí es señal positiva de cordova-ios 7 (solo
    // cordova-ios 8 fuerza App.xcodeproj), pero que no exista ninguno no prueba nada: antes
    // ese caso caía igual a 7, que es el camino que escribe en el pbxproj. Ahora cae a 8, que
    // es el que no hace nada. Fallar hacia el lado inerte.
    const hayOtroXcodeproj = fs.existsSync(platformPath) &&
        fs.readdirSync(platformPath).some(entry => entry.endsWith('.xcodeproj'));

    return hayOtroXcodeproj ? 7 : 8;
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
