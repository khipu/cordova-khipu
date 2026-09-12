const fs = require('node:fs');
const path = require('node:path');

// Rewrites one attribute and nothing else.
//
// This used to parse plugin.xml with xml2js and write it back out through the Builder,
// which reformats the whole file: attribute order, self-closing tags, the declaration,
// and any comment. check-native-versions.js still carries attribute-order-tolerant
// regexes that were written for that reformatting. Replacing just the attribute keeps
// the file the author wrote.
function withVersion (pluginXml, version) {
    // The <plugin> tag is isolated first because `version` also appears in the XML
    // declaration and on every <engine>.
    const pluginTag = pluginXml.match(/<plugin\b[^>]*>/);

    if (!pluginTag) {
        throw new Error('plugin.xml has no <plugin> tag');
    }

    if (!/\bversion="[^"]*"/.test(pluginTag[0])) {
        throw new Error('the <plugin> tag of plugin.xml does not declare a version');
    }

    const updatedTag = pluginTag[0].replace(/\bversion="[^"]*"/, `version="${version}"`);

    return pluginXml.slice(0, pluginTag.index) +
        updatedTag +
        pluginXml.slice(pluginTag.index + pluginTag[0].length);
}

function main () {
    const root = path.resolve(__dirname, '..');
    const pluginXmlPath = path.join(root, 'plugin.xml');
    const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

    fs.writeFileSync(
        pluginXmlPath,
        withVersion(fs.readFileSync(pluginXmlPath, 'utf-8'), version),
        'utf-8'
    );

    console.log(`update-plugin-version: plugin.xml set to ${version}.`);
}

module.exports = { withVersion };

if (require.main === module) {
    main();
}
