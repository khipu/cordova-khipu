const assert = require('node:assert');
const { test } = require('node:test');

const { compareSurfaces } = require('../../scripts/check-option-keys.js');

const TEXT_KEYS = ['title', 'titleImageUrl', 'locale'];
const SWITCH_KEYS = ['showFooter', 'showMerchantLogo', 'showPaymentDetails', 'skipExitPage', 'skipExitSuccessPage'];
const OPTION_KEYS = [...TEXT_KEYS, 'theme', ...SWITCH_KEYS];
const COLOR_KEYS = ['lightBackground', 'lightOnBackground', 'lightPrimary', 'lightOnPrimary',
    'lightTopBarContainer', 'lightOnTopBarContainer', 'darkBackground', 'darkOnBackground',
    'darkPrimary', 'darkOnPrimary', 'darkTopBarContainer', 'darkOnTopBarContainer'];
const RESULT_KEYS = ['operationId', 'result', 'exitTitle', 'exitMessage', 'exitUrl',
    'failureReason', 'continueUrl', 'events'];
const EVENT_KEYS = ['name', 'type', 'timestamp'];

// These fixtures mirror the shape of the real files, not just an abstract list of
// keys: KhipuOptions/KhipuColors/KhipuEvent/KhipuResult are ambient (no `export`),
// `theme` is a literal argument rather than a TEXT_FIELDS/SWITCH_FIELDS entry, the
// Swift result dictionary folds event keys into the same literal it builds
// KhipuResult from, the Java result mapper writes event keys onto a fresh
// JSONObject rather than through `json.put(`, and both mappers read the nested
// colour object through a different cast/helper than the flat option keys. A
// fixture that skipped these details would not exercise the parts of the guard
// that had to be adapted to the real files.
function sources (overrides = {}) {
    return Object.assign({
        declarations: [
            'interface KhipuColors {',
            ...COLOR_KEYS.map(key => `  ${key}?: string;`),
            '}',
            '',
            'interface KhipuOptions {',
            ...TEXT_KEYS.map(key => `  ${key}?: string;`),
            '  theme?: KhipuTheme;',
            ...SWITCH_KEYS.map(key => `  ${key}?: boolean;`),
            '  colors?: KhipuColors;',
            '}',
            '',
            'interface KhipuEvent {',
            ...EVENT_KEYS.map(key => `  ${key}: string;`),
            '}',
            '',
            'interface KhipuResult {',
            ...RESULT_KEYS.map(key => `  ${key}: string;`),
            '}'
        ].join('\n'),
        swiftMapper: [
            ...TEXT_KEYS.map(key => `input.x = options["${key}"] as? String`),
            'if let theme = options["theme"] as? String {',
            ...SWITCH_KEYS.map(key => `input.x = options["${key}"] as? Bool`),
            'if let colors = options["colors"] as? [String: Any] {',
            ...COLOR_KEYS.map(key => `("${key}", { $0.${key}($1) }),`)
        ].join('\n'),
        swiftPlugin: [
            ...RESULT_KEYS.map(key => `"${key}": something,`),
            ...EVENT_KEYS.map(key => `"${key}": event.${key},`)
        ].join('\n'),
        javaMapper: [
            ...TEXT_KEYS.map(key => `input.x = stringOrNull(options, "${key}");`),
            'input.theme = themeOrNull(stringOrNull(options, "theme"));',
            ...SWITCH_KEYS.map(key => `input.x = booleanOrNull(options, "${key}");`),
            'JSONObject colors = objectOrNull(options, "colors");',
            ...COLOR_KEYS.map(key => `setters.put("${key}", x);`)
        ].join('\n'),
        javaResultMapper: [
            ...RESULT_KEYS.map(key => `json.put("${key}", x);`),
            ...EVENT_KEYS.map(key => `.put("${key}", event.get(${key}))`)
        ].join('\n'),
        harness: [
            "var TEXT_FIELDS = [",
            ...TEXT_KEYS.map(key => `  { key: '${key}', example: 'x' },`),
            '];',
            '',
            "controles.tema = agregarFila(contenedorTexto, 'theme', selectorTema);",
            '',
            'var SWITCH_FIELDS = [',
            ...SWITCH_KEYS.map(key => `  '${key}',`),
            '];'
        ].join('\n'),
        harnessColors: COLOR_KEYS.map(key => `  '${key}',`).join('\n')
    }, overrides);
}

test('passes when every surface agrees', () => {
    const result = compareSurfaces(sources());

    assert.strictEqual(result.ok, true, result.message);
    assert.match(result.message, /9 option keys, 12 colour keys and 8 result keys/);
});

test('catches a key renamed in the Java mapper only', () => {
    const broken = sources().javaMapper.replace('"showFooter"', '"showFoter"');

    const result = compareSurfaces(sources({ javaMapper: broken }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /the Java mapper/);
    assert.match(result.message, /showFooter/);
});

test('catches a result key missing from the Swift dictionary', () => {
    const broken = sources().swiftPlugin.replace('"continueUrl": something,', '');

    const result = compareSurfaces(sources({ swiftPlugin: broken }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /the Swift result dictionary/);
    assert.match(result.message, /continueUrl/);
});

test('catches an event key missing from the Swift dictionary', () => {
    const broken = sources().swiftPlugin.replace('"timestamp": event.timestamp,', '');

    const result = compareSurfaces(sources({ swiftPlugin: broken }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /the Swift result dictionary/);
    assert.match(result.message, /timestamp/);
});

test('does not flag the event keys the Java result mapper writes on a separate object', () => {
    // Sanity check for the exclusion documented above: json.put( is the anchor, and
    // the event .put(...) calls in the fixture deliberately do not match it. If they
    // did, the baseline fixture (which includes them) would already fail.
    const result = compareSurfaces(sources());

    assert.strictEqual(result.ok, true, result.message);
});

test('catches a colour key missing from the harness', () => {
    const broken = sources().harnessColors.replace("  'darkPrimary',", '');

    assert.strictEqual(compareSurfaces(sources({ harnessColors: broken })).ok, false);
});

test('catches the harness losing the theme field', () => {
    const broken = sources().harness.replace(
        "controles.tema = agregarFila(contenedorTexto, 'theme', selectorTema);", ''
    );

    const result = compareSurfaces(sources({ harness: broken }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /the example harness/);
    assert.match(result.message, /theme/);
});

test('reports a broken parser instead of a match when the contract reads empty', () => {
    const emptyOptions = sources().declarations.replace(/interface KhipuOptions \{[^}]*\}/s, 'interface KhipuOptions {\n}');

    const result = compareSurfaces(sources({ declarations: emptyOptions }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /parser is out of date/);
});

test('reports a broken parser when an interface is not found at all', () => {
    const result = compareSurfaces(sources({ declarations: 'nothing here' }));

    assert.strictEqual(result.ok, false);
    assert.match(result.message, /could not read the options interface/);
});
