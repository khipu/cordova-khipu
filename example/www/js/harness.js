/*
 * Test harness for cordova-khipu.
 *
 * The central point is the per-field tri-state: every option has an
 * "include" checkbox in addition to its own control. The plugin distinguishes
 * "key absent" from `false` — see `options["showFooter"] as? Bool` in
 * KhipuOptionsMapper.parse (src/ios/KhipuOptionsMapper.swift) and
 * `options.has("showFooter")` in KhipuPlugin.java — and the native SDK
 * applies its own defaults. If the harness always sent the booleans, it
 * would be impossible to test the behaviour a merchant who configures
 * nothing actually sees.
 */

var STORAGE_KEY = 'cordova-khipu-harness';

var TEXT_FIELDS = [
  { key: 'title', example: 'Demo Cordova' },
  { key: 'titleImageUrl', example: 'https://s3.amazonaws.com/static.khipu.com/logo-khipu-color.png' },
  { key: 'locale', example: 'es_CL' }
];

var SWITCH_FIELDS = [
  'skipExitPage',
  'skipExitSuccessPage',
  'showFooter',
  'showMerchantLogo',
  'showPaymentDetails'
];

var COLOR_KEYS = [
  'lightBackground',
  'lightOnBackground',
  'lightPrimary',
  'lightOnPrimary',
  'lightTopBarContainer',
  'lightOnTopBarContainer',
  'darkBackground',
  'darkOnBackground',
  'darkPrimary',
  'darkOnPrimary',
  'darkTopBarContainer',
  'darkOnTopBarContainer'
];

var THEMES = ['light', 'dark', 'system'];

var PRESETS = {
  'All defaults': {
    text: {},
    switches: {},
    theme: null,
    colors: null
  },
  'Khipu brand': {
    text: { title: 'Demo Cordova', locale: 'es_CL' },
    switches: { showFooter: true, showMerchantLogo: true, showPaymentDetails: true },
    theme: 'light',
    colors: {
      lightBackground: '#ffffff',
      lightOnBackground: '#1a1a1a',
      lightPrimary: '#8347ad',
      lightOnPrimary: '#ffffff',
      lightTopBarContainer: '#8347ad',
      lightOnTopBarContainer: '#ffffff',
      darkBackground: '#101418',
      darkOnBackground: '#e8eaed',
      darkPrimary: '#3cb4e5',
      darkOnPrimary: '#06283a',
      darkTopBarContainer: '#1a1f26',
      darkOnTopBarContainer: '#e8eaed'
    }
  },
  'Everything on': {
    text: { title: 'Demo Cordova', locale: 'es_CL' },
    switches: {
      skipExitPage: true,
      skipExitSuccessPage: true,
      showFooter: true,
      showMerchantLogo: true,
      showPaymentDetails: true
    },
    theme: 'system',
    colors: null
  },
  'Dark mode': {
    text: {},
    switches: {},
    theme: 'dark',
    colors: {
      darkBackground: '#101418',
      darkOnBackground: '#e8eaed',
      darkPrimary: '#3cb4e5',
      darkOnPrimary: '#06283a',
      darkTopBarContainer: '#1a1f26',
      darkOnTopBarContainer: '#e8eaed'
    }
  }
};

var controls = {
  text: {},
  switches: {},
  colors: {},
  theme: null
};

document.addEventListener('DOMContentLoaded', function () {
  buildFields();
  buildPresets();
  restore();
  // Unconditional: on a clean install (nothing in localStorage) `restore()`
  // returns early and would never get to hide `#color-fields`, leaving the
  // colour block visible even though `#include-colors` is unchecked.
  syncOpacity();
  listen();
  refreshPreview();
});

document.addEventListener('deviceready', function () {
  var status = document.getElementById('status');
  var available = typeof window.Khipu !== 'undefined';

  status.className = 'status ' + (available ? 'status--ready' : 'status--waiting');
  status.textContent = available
    ? 'Ready · window.Khipu available'
    : 'deviceready fired but window.Khipu is missing: check the plugin installation.';

  document.getElementById('launch').disabled = !available;
});

/* ---------- interface construction ---------- */

function buildFields () {
  var textContainer = document.getElementById('text-fields');

  TEXT_FIELDS.forEach(function (field) {
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = field.example;
    input.autocapitalize = 'off';
    input.autocorrect = 'off';
    input.spellcheck = false;

    controls.text[field.key] = agregarFila(textContainer, field.key, input);
  });

  // `theme` is a text field but with a closed set of values, so it goes as a
  // <select>.
  var themeSelect = document.createElement('select');
  THEMES.forEach(function (theme) {
    var option = document.createElement('option');
    option.value = theme;
    option.textContent = theme;
    themeSelect.appendChild(option);
  });
  controls.theme = agregarFila(textContainer, 'theme', themeSelect);

  var switchContainer = document.getElementById('switch-fields');
  SWITCH_FIELDS.forEach(function (key) {
    var toggle = document.createElement('input');
    toggle.type = 'checkbox';
    controls.switches[key] = agregarFila(switchContainer, key, toggle);
  });

  var colorContainer = document.getElementById('color-fields');
  COLOR_KEYS.forEach(function (key) {
    var colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = key.indexOf('dark') === 0 ? '#101418' : '#ffffff';
    controls.colors[key] = agregarFila(colorContainer, key, colorPicker);
  });
}

// Each row is a control plus an "include" checkbox. The control's value only
// reaches the payload if the checkbox is checked.
//
// Kept as `agregarFila` on purpose, not translated: scripts/check-option-keys.js
// locates the `theme` key with the regex agregarFila\([^,]+,\s*'(\w+)',, so this
// literal function name is part of that guard's contract, not free prose.
function agregarFila (container, key, control) {
  var row = document.createElement('label');
  row.className = 'field field--off';

  var include = document.createElement('input');
  include.type = 'checkbox';

  var name = document.createElement('span');
  name.className = 'field__name';
  name.textContent = key;

  row.appendChild(include);
  row.appendChild(name);
  row.appendChild(control);
  container.appendChild(row);

  return { row: row, include: include, control: control };
}

function buildPresets () {
  var container = document.getElementById('presets');

  Object.keys(PRESETS).forEach(function (name) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', function () {
      applyPreset(PRESETS[name]);
    });
    container.appendChild(button);
  });
}

/* ---------- state ---------- */

function listen () {
  document.addEventListener('input', onChange);
  document.addEventListener('change', onChange);
  document.getElementById('launch').addEventListener('click', launch);
}

function onChange () {
  syncOpacity();
  refreshPreview();
  save();
}

function syncOpacity () {
  var all = []
    .concat(Object.keys(controls.text).map(function (k) { return controls.text[k]; }))
    .concat(Object.keys(controls.switches).map(function (k) { return controls.switches[k]; }))
    .concat(Object.keys(controls.colors).map(function (k) { return controls.colors[k]; }))
    .concat([controls.theme]);

  all.forEach(function (entry) {
    entry.row.className = 'field' + (entry.include.checked ? '' : ' field--off');
  });

  var includeColors = document.getElementById('include-colors').checked;
  document.getElementById('color-fields').style.display = includeColors ? '' : 'none';
}

function buildPayload () {
  var options = {};

  Object.keys(controls.text).forEach(function (key) {
    var entry = controls.text[key];
    if (entry.include.checked) {
      options[key] = entry.control.value;
    }
  });

  if (controls.theme.include.checked) {
    options.theme = controls.theme.control.value;
  }

  Object.keys(controls.switches).forEach(function (key) {
    var entry = controls.switches[key];
    if (entry.include.checked) {
      options[key] = entry.control.checked;
    }
  });

  if (document.getElementById('include-colors').checked) {
    var colors = {};
    Object.keys(controls.colors).forEach(function (key) {
      var entry = controls.colors[key];
      if (entry.include.checked) {
        colors[key] = entry.control.value;
      }
    });
    options.colors = colors;
  }

  var payload = { operationId: document.getElementById('operationId').value.trim() };

  // `options` only travels if it has something inside: sending it empty is
  // not the same as not sending it, and here we want to be able to test both.
  if (Object.keys(options).length > 0) {
    payload.options = options;
  }

  return payload;
}

function refreshPreview () {
  document.getElementById('preview').textContent =
    JSON.stringify(buildPayload(), null, 2);
}

function applyPreset (preset) {
  Object.keys(controls.text).forEach(function (key) {
    var entry = controls.text[key];
    var value = preset.text[key];
    entry.include.checked = value !== undefined;
    if (value !== undefined) {
      entry.control.value = value;
    }
  });

  controls.theme.include.checked = preset.theme !== null;
  if (preset.theme !== null) {
    controls.theme.control.value = preset.theme;
  }

  Object.keys(controls.switches).forEach(function (key) {
    var entry = controls.switches[key];
    var value = preset.switches[key];
    entry.include.checked = value !== undefined;
    entry.control.checked = value === true;
  });

  document.getElementById('include-colors').checked = preset.colors !== null;
  Object.keys(controls.colors).forEach(function (key) {
    var entry = controls.colors[key];
    var value = preset.colors ? preset.colors[key] : undefined;
    entry.include.checked = value !== undefined;
    if (value !== undefined) {
      entry.control.value = value;
    }
  });

  onChange();
}

/* ---------- persistence ---------- */

// Testing on device reloads a lot, and retyping the operationId every time is
// real friction.
function save () {
  var state = {
    operationId: document.getElementById('operationId').value,
    includeColors: document.getElementById('include-colors').checked,
    text: {},
    theme: { include: controls.theme.include.checked, value: controls.theme.control.value },
    switches: {},
    colors: {}
  };

  Object.keys(controls.text).forEach(function (key) {
    state.text[key] = {
      include: controls.text[key].include.checked,
      value: controls.text[key].control.value
    };
  });

  Object.keys(controls.switches).forEach(function (key) {
    state.switches[key] = {
      include: controls.switches[key].include.checked,
      value: controls.switches[key].control.checked
    };
  });

  Object.keys(controls.colors).forEach(function (key) {
    state.colors[key] = {
      include: controls.colors[key].include.checked,
      value: controls.colors[key].control.value
    };
  });

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Without storage the harness still works; it just loses its memory.
  }
}

function restore () {
  var raw;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return;
  }

  if (!raw) {
    return;
  }

  var state;
  try {
    state = JSON.parse(raw);
  } catch (error) {
    return;
  }

  document.getElementById('operationId').value = state.operationId || '';
  document.getElementById('include-colors').checked = state.includeColors === true;

  if (state.theme) {
    controls.theme.include.checked = state.theme.include === true;
    controls.theme.control.value = state.theme.value || 'system';
  }

  applySaved(controls.text, state.text, 'value');
  applySaved(controls.switches, state.switches, 'checked');
  applySaved(controls.colors, state.colors, 'value');
}

function applySaved (group, saved, property) {
  if (!saved) {
    return;
  }

  Object.keys(group).forEach(function (key) {
    var entry = saved[key];
    if (!entry) {
      return;
    }
    group[key].include.checked = entry.include === true;
    group[key].control[property] = entry.value;
  });
}

/* ---------- execution ---------- */

function launch () {
  var payload = buildPayload();

  if (!payload.operationId) {
    showError('Missing operationId.');
    return;
  }

  var button = document.getElementById('launch');
  button.disabled = true;
  document.getElementById('result').textContent = 'Running…';

  window.Khipu.startOperation(
    payload,
    function (result) {
      button.disabled = false;
      showResult(result, 'ok');
    },
    function (error) {
      button.disabled = false;
      // The error callback receives a KhipuResult when the SDK finished in
      // ERROR, and a string when the plugin rejected before starting.
      if (typeof error === 'string') {
        showError(error);
      } else {
        showResult(error, 'error');
      }
    }
  );
}

// Distinguishes three forms of "no value" that look the same if you don't
// separate them, and that in practice are not.
//
// `continueUrl` arrives as `null` on a cancelled operation, but `exitUrl`
// arrives as an **empty string** — verified on a real operation. A merchant
// who writes `if (result.exitUrl === null)` will not catch it; they have to
// check for falsy instead. Showing them differently is what makes that
// difference visible.
//
// And a blank cell is indistinguishable from a rendering failure, so neither
// case is left empty.
function paintValue (element, raw) {
  if (raw === null || raw === undefined) {
    element.textContent = '—';
  } else if (raw === '') {
    element.textContent = '"" (empty string)';
  } else {
    element.textContent = String(raw);
    return;
  }

  element.className = 'result__absent';
}

function showError (message) {
  var container = document.getElementById('result');
  container.className = 'result result--error';
  container.textContent = message;
}

function showResult (result, kind) {
  var container = document.getElementById('result');
  container.className = 'result result--' + kind;
  container.textContent = '';

  var list = document.createElement('dl');
  ['operationId', 'result', 'exitTitle', 'exitMessage', 'exitUrl', 'failureReason', 'continueUrl']
    .forEach(function (key) {
      var row = document.createElement('div');
      row.className = 'result__field';

      var name = document.createElement('dt');
      name.textContent = key;

      var value = document.createElement('dd');
      paintValue(value, result[key]);

      row.appendChild(name);
      row.appendChild(value);
      list.appendChild(row);
    });
  container.appendChild(list);

  var events = result.events || [];
  if (events.length === 0) {
    return;
  }

  var table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>name</th><th>type</th><th>timestamp</th></tr></thead>';

  var body = document.createElement('tbody');
  events.forEach(function (event) {
    var row = document.createElement('tr');
    [event.name, event.type, event.timestamp].forEach(function (cell) {
      var td = document.createElement('td');
      paintValue(td, cell);
      row.appendChild(td);
    });
    body.appendChild(row);
  });

  table.appendChild(body);
  container.appendChild(table);
}
