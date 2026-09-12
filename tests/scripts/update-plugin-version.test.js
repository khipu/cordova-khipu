const assert = require('node:assert');
const { test } = require('node:test');

const { withVersion } = require('../../scripts/update-plugin-version.js');

test('replaces the version on the plugin tag', () => {
    const xml = '<plugin id="cordova-khipu" version="2.10.1" xmlns="http://apache.org/cordova/ns/plugins/1.0">\n</plugin>\n';

    assert.match(withVersion(xml, '2.11.0'), /<plugin id="cordova-khipu" version="2\.11\.0"/);
});

test('leaves the rest of the file byte for byte', () => {
    const xml = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<plugin id="cordova-khipu" version="2.10.1">',
        '  <!-- a comment the old script deleted -->',
        '  <engine name="cordova-ios" version=">=7.0.0"/>',
        '</plugin>',
        ''
    ].join('\n');

    const updated = withVersion(xml, '2.11.0');

    assert.strictEqual(updated, xml.replace('version="2.10.1"', 'version="2.11.0"'));
    assert.ok(updated.includes('a comment the old script deleted'));
});

test('does not touch the version of the xml declaration or of an engine', () => {
    const xml = '<?xml version="1.0"?>\n<plugin id="x" version="1.0.0">\n<engine name="cordova-ios" version=">=7.0.0"/>\n</plugin>';

    const updated = withVersion(xml, '2.11.0');

    assert.ok(updated.includes('<?xml version="1.0"?>'));
    assert.ok(updated.includes('name="cordova-ios" version=">=7.0.0"'));
    assert.ok(updated.includes('<plugin id="x" version="2.11.0">'));
});

test('refuses a file whose plugin tag has no version', () => {
    assert.throws(
        () => withVersion('<plugin id="cordova-khipu">\n</plugin>', '2.11.0'),
        /does not declare a version/
    );
});
