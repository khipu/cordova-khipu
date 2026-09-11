#!/usr/bin/env node
/**
 * Fails when the surfaces that declare the option and result vocabulary stop agreeing.
 *
 * The contract between JavaScript and native is strings: types/index.d.ts declares it,
 * the Swift and Java mappers read it, and the example harness offers it. Renaming a key
 * in one surface leaves the flag with no effect **and no error** — no test on either
 * side can detect a drift in the other.
 *
 * It also covers the way back, native to JavaScript: the keys KhipuPlugin.swift builds
 * its dictionary from and the ones KhipuResultMapper.java puts, against the KhipuResult
 * interface. capacitor-khipu's version of this guard could not check that half, because
 * its Android plugin delegated the whole shape of the result to the SDK's asJson(). This
 * plugin builds it, so both halves are checkable here.
 *
 * The harness is compared on options only, not on results: it renders a chosen subset of
 * the result fields, and coupling it to all eight would be a false constraint.
 *
 * On fragility: this parses source with regular expressions. The failure direction is
 * the right one — the check breaks and somebody looks, rather than passing while the
 * protocol drifted — but a broken parser could report "everything matches" with zero
 * keys everywhere. Hence the sanity floor below.
 */
const fs = require('node:fs');
const path = require('node:path');

const FLOOR = { options: 9, colors: 12, result: 8 };

function keysMatching (source, pattern) {
    return new Set([...source.matchAll(pattern)].map(match => match[1]));
}

function interfaceKeys (declarations, name) {
    // types/index.d.ts is deliberately ambient (no top-level `export`), so the
    // interfaces themselves are declared without the `export` keyword. Allow it
    // optionally rather than requiring it, so this still reads the real file.
    const block = declarations.match(new RegExp(`(?:export )?interface ${name} \\{(.*?)\\n\\}`, 's'));

    if (!block) {
        return null;
    }

    return keysMatching(block[1], /^\s{2}(\w+)\??:/gm);
}

function difference (left, right) {
    return [...left].filter(key => !right.has(key));
}

function compareSurfaces (sources) {
    const contract = {
        options: interfaceKeys(sources.declarations, 'KhipuOptions'),
        colors: interfaceKeys(sources.declarations, 'KhipuColors'),
        result: interfaceKeys(sources.declarations, 'KhipuResult')
    };
    // KhipuEvent is not one of the three interfaces this guard is FLOOR-checked
    // against, but the Swift result dictionary inlines event objects into the same
    // literal it builds KhipuResult from (see the `events` surface below), so its
    // keys have to join the expected set for that one comparison.
    const event = interfaceKeys(sources.declarations, 'KhipuEvent');

    for (const [name, keys] of Object.entries(contract)) {
        if (!keys) {
            return { ok: false, message: `could not read the ${name} interface from types/index.d.ts; this guard's parser is out of date` };
        }
    }

    if (!event) {
        return { ok: false, message: 'could not read the event interface from types/index.d.ts; this guard\'s parser is out of date' };
    }

    // `colors` is a nested object (KhipuColors), tracked in full by the `colors`
    // comparison below. Treating it as a flat option key here would force every
    // options surface to also declare a literal "colors" entry of its own, which is
    // not what any of them actually do.
    contract.options.delete('colors');

    // The floor: if the contract reads nearly empty, what broke is the parser.
    for (const [name, floor] of Object.entries(FLOOR)) {
        if (contract[name].size < floor) {
            return { ok: false, message: `read only ${contract[name].size} ${name} keys from types/index.d.ts, expected at least ${floor}; this guard's parser is out of date` };
        }
    }

    const surfaces = [
        {
            what: 'options',
            expected: contract.options,
            found: {
                // Restricted to the scalar casts (String/Bool) so the nested
                // `options["colors"] as? [String: Any]` read — the entry point into
                // the colour table, not a flat option — is not counted here too.
                'the Swift mapper': keysMatching(sources.swiftMapper, /options\["(\w+)"\] as\? (?:String|Bool)/g),
                // objectOrNull(options, "colors") is that same nested-object read on
                // the Java side; stringOrNull/booleanOrNull are the flat option reads.
                'the Java mapper': keysMatching(sources.javaMapper, /(?:stringOrNull|booleanOrNull)\(options, "(\w+)"\)/g),
                'the example harness': new Set([
                    ...keysMatching(sources.harness, /\{ key: '(\w+)'/g),
                    ...keysMatching(sources.harness, /^\s{2}'(\w+)',?$/gm),
                    // `theme` is built as a <select>, not through TEXT_FIELDS or
                    // SWITCH_FIELDS, so its key only appears as a literal argument to
                    // the shared row-builder: addRow(container, 'theme', control).
                    ...keysMatching(sources.harness, /addRow\([^,]+,\s*'(\w+)',/g)
                ])
            }
        },
        {
            what: 'colors',
            expected: contract.colors,
            found: {
                'the Swift colour table': keysMatching(sources.swiftMapper, /\("(\w+)", \{ \$0\./g),
                'the Java colour table': keysMatching(sources.javaMapper, /setters\.put\("(\w+)"/g),
                'the example harness': keysMatching(sources.harnessColors, /'(\w+)'/g)
            }
        },
        {
            what: 'result',
            expected: new Set([...contract.result, ...event]),
            found: {
                // KhipuPlugin.swift builds KhipuResult and its KhipuEvent objects in
                // one literal (see makeResult), so its keys are compared against the
                // union of both interfaces. KhipuResultMapper.java writes result keys
                // and event keys onto different receivers (`json.put` vs. a fresh
                // JSONObject per event), so anchoring on `json.put(` alone already
                // excludes the event keys — no union needed on that side.
                'the Swift result dictionary': keysMatching(sources.swiftPlugin, /"(\w+)":/g)
            }
        },
        {
            what: 'result',
            expected: contract.result,
            found: {
                'the Java result mapper': keysMatching(sources.javaResultMapper, /json\.put\("(\w+)"/g)
            }
        }
    ];

    for (const surface of surfaces) {
        for (const [name, found] of Object.entries(surface.found)) {
            const missing = difference(surface.expected, found);
            const extra = difference(found, surface.expected);

            if (missing.length > 0 || extra.length > 0) {
                return {
                    ok: false,
                    message: `${name} disagrees with types/index.d.ts on ${surface.what}` +
                        (missing.length > 0 ? `; missing: ${missing.join(', ')}` : '') +
                        (extra.length > 0 ? `; unexpected: ${extra.join(', ')}` : '')
                };
            }
        }
    }

    return {
        ok: true,
        message: `${contract.options.size} option keys, ${contract.colors.size} colour keys and ${contract.result.size} result keys agree across every surface`
    };
}

function read (root, ...parts) {
    return fs.readFileSync(path.join(root, ...parts), 'utf-8');
}

function main () {
    const root = path.resolve(__dirname, '..');
    const harness = read(root, 'example', 'www', 'js', 'harness.js');
    // The colour array is spliced OUT, not just split off, and the option-scanning
    // text keeps both what came before it and what comes after. `theme` is not part
    // of TEXT_FIELDS/SWITCH_FIELDS: it is declared where the harness builds its
    // controls, further down the file than COLOR_KEYS, so truncating at COLOR_KEYS
    // (as an earlier version of this guard did) silently stopped scanning for it.
    const colorBlock = harness.match(/var COLOR_KEYS = \[[\s\S]*?\];/);

    if (!colorBlock) {
        console.error('check-option-keys: could not find COLOR_KEYS in the example harness; this guard\'s parser is out of date');
        process.exit(1);
    }

    const harnessOptions = harness.slice(0, colorBlock.index) + harness.slice(colorBlock.index + colorBlock[0].length);
    const harnessColors = colorBlock[0];

    const result = compareSurfaces({
        declarations: read(root, 'types', 'index.d.ts'),
        swiftMapper: read(root, 'src', 'ios', 'KhipuOptionsMapper.swift'),
        swiftPlugin: read(root, 'src', 'ios', 'KhipuPlugin.swift'),
        javaMapper: read(root, 'src', 'android', 'com', 'khipu', 'cordova', 'KhipuOptionsMapper.java'),
        javaResultMapper: read(root, 'src', 'android', 'com', 'khipu', 'cordova', 'KhipuResultMapper.java'),
        harness: harnessOptions,
        harnessColors: harnessColors
    });

    console.log(`check-option-keys: ${result.message}.`);

    if (!result.ok) {
        process.exit(1);
    }
}

module.exports = { compareSurfaces };

if (require.main === module) {
    main();
}
