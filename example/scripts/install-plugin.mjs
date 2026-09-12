// Installs the plugin into the example app from an `npm pack` tarball.
//
// The two detours here look unnecessary and are not. They came out of trying
// all three possible methods against a throwaway clone (spec §15):
//
// 1. Tarball instead of `cordova plugin add ../`. That form fails with
//    `EINVAL: cp ... subdirectory of self`, because the destination
//    (example/plugins/) is a child of the source (the repo). And `--link`,
//    which does work today, leaves the plugin depending on apache/cordova-ios
//    via git instead of the project's local CordovaLib: SwiftPM tolerates it
//    by deduping, but warns "Conflicting identity for cordova-ios ... will be
//    escalated to an error in future versions of SwiftPM". Installing from
//    the tarball also has the advantage of exercising exactly the artifact a
//    merchant gets from npm.
//
// 2. `file:` prefix with an absolute path. `cordova plugin add ./thing.tgz`
//    fails on a parsing bug in cordova-lib 13.0.0.

import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const example = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(example, '..');

const isTarball = (name) => name.startsWith('cordova-khipu-') && name.endsWith('.tgz');

// A tarball from an earlier version would make the wrong one get picked below.
for (const old of readdirSync(example).filter(isTarball)) {
    rmSync(join(example, old));
}

execFileSync('npm', ['pack', '--pack-destination', example], { cwd: repo, stdio: 'inherit' });

const tarball = readdirSync(example).find(isTarball);

if (!tarball) {
    throw new Error('npm pack left no cordova-khipu-*.tgz in example/');
}

execFileSync('npx', ['cordova', 'plugin', 'add', `file:${join(example, tarball)}`, '--nosave'], {
    cwd: example,
    stdio: 'inherit'
});
