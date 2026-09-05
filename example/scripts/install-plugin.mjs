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
