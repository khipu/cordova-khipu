const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { enableKotlin } = require('../../scripts/enable-gradle-kotlin-plugin.js');

function aConfigFile (contents) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'khipu-hook-'));
    const file = path.join(directory, 'cdv-gradle-config.json');
    fs.writeFileSync(file, JSON.stringify(contents, null, 4), 'utf-8');
    return file;
}

test('turns the flag on and keeps every other key', () => {
    const file = aConfigFile({ MIN_SDK_VERSION: 24, IS_GRADLE_PLUGIN_KOTLIN_ENABLED: false });

    assert.strictEqual(enableKotlin(file), 'enabled');

    const written = JSON.parse(fs.readFileSync(file, 'utf-8'));
    assert.strictEqual(written.IS_GRADLE_PLUGIN_KOTLIN_ENABLED, true);
    assert.strictEqual(written.MIN_SDK_VERSION, 24);
});

test('does not rewrite a file that is already enabled', () => {
    const file = aConfigFile({ IS_GRADLE_PLUGIN_KOTLIN_ENABLED: true });
    const before = fs.statSync(file).mtimeMs;

    assert.strictEqual(enableKotlin(file), 'already-enabled');
    assert.strictEqual(fs.statSync(file).mtimeMs, before);
});

test('reports a missing file instead of throwing', () => {
    assert.strictEqual(enableKotlin(path.join(os.tmpdir(), 'nope', 'cdv-gradle-config.json')), 'missing');
});

test('reads from disk rather than from the module cache', () => {
    const file = aConfigFile({ IS_GRADLE_PLUGIN_KOTLIN_ENABLED: false });

    enableKotlin(file);
    fs.writeFileSync(file, JSON.stringify({ IS_GRADLE_PLUGIN_KOTLIN_ENABLED: false }), 'utf-8');

    // With `require`, the second call would see the cached first read and report
    // already-enabled without touching the file.
    assert.strictEqual(enableKotlin(file), 'enabled');
});
