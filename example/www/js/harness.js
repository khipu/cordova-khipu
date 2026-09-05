/*
 * Harness de prueba de cordova-khipu.
 *
 * El punto central es el tri-estado por campo: cada opción tiene una casilla
 * "incluir" además de su control. El plugin distingue "clave ausente" de
 * `false` — ver `options["showFooter"] as? Bool` en
 * KhipuOptionsMapper.parse (src/ios/KhipuOptionsMapper.swift) y
 * `options.has("showFooter")` en KhipuPlugin.java — y el SDK nativo aplica sus
 * propios valores por omisión. Si el harness mandara siempre los booleanos,
 * sería imposible probar el comportamiento que ve un comercio que no configura
 * nada.
 */

var CLAVE_ALMACENAMIENTO = 'cordova-khipu-harness';

var CAMPOS_TEXTO = [
  { clave: 'title', ejemplo: 'Demo Cordova' },
  { clave: 'titleImageUrl', ejemplo: 'https://s3.amazonaws.com/static.khipu.com/logo-khipu-color.png' },
  { clave: 'locale', ejemplo: 'es_CL' }
];

var CAMPOS_SWITCH = [
  'skipExitPage',
  'skipExitSuccessPage',
  'showFooter',
  'showMerchantLogo',
  'showPaymentDetails'
];

var CLAVES_COLOR = [
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

var TEMAS = ['light', 'dark', 'system'];

var PRESETS = {
  'Todo por defecto': {
    texto: {},
    interruptores: {},
    tema: null,
    colores: null
  },
  'Marca Khipu': {
    texto: { title: 'Demo Cordova', locale: 'es_CL' },
    interruptores: { showFooter: true, showMerchantLogo: true, showPaymentDetails: true },
    tema: 'light',
    colores: {
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
  'Todo activado': {
    texto: { title: 'Demo Cordova', locale: 'es_CL' },
    interruptores: {
      skipExitPage: true,
      skipExitSuccessPage: true,
      showFooter: true,
      showMerchantLogo: true,
      showPaymentDetails: true
    },
    tema: 'system',
    colores: null
  },
  'Modo oscuro': {
    texto: {},
    interruptores: {},
    tema: 'dark',
    colores: {
      darkBackground: '#101418',
      darkOnBackground: '#e8eaed',
      darkPrimary: '#3cb4e5',
      darkOnPrimary: '#06283a',
      darkTopBarContainer: '#1a1f26',
      darkOnTopBarContainer: '#e8eaed'
    }
  }
};

var controles = {
  texto: {},
  interruptores: {},
  colores: {},
  tema: null
};

document.addEventListener('DOMContentLoaded', function () {
  construirCampos();
  construirPresets();
  restaurar();
  // Incondicional: en una instalación limpia (sin nada en localStorage)
  // `restaurar()` vuelve temprano y nunca llegaría a ocultar
  // `#campos-color`, dejando el bloque de colores visible aunque
  // `#incluir-colors` esté sin marcar.
  sincronizarOpacidad();
  escuchar();
  refrescarPreview();
});

document.addEventListener('deviceready', function () {
  var estado = document.getElementById('estado');
  var disponible = typeof window.Khipu !== 'undefined';

  estado.className = 'estado ' + (disponible ? 'estado--listo' : 'estado--esperando');
  estado.textContent = disponible
    ? 'Listo · window.Khipu disponible'
    : 'deviceready llegó pero window.Khipu no está: revisa la instalación del plugin.';

  document.getElementById('lanzar').disabled = !disponible;
});

/* ---------- construcción de la interfaz ---------- */

function construirCampos () {
  var contenedorTexto = document.getElementById('campos-texto');

  CAMPOS_TEXTO.forEach(function (campo) {
    var entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.placeholder = campo.ejemplo;
    entrada.autocapitalize = 'off';
    entrada.autocorrect = 'off';
    entrada.spellcheck = false;

    controles.texto[campo.clave] = agregarFila(contenedorTexto, campo.clave, entrada);
  });

  // `theme` es de texto pero con valores cerrados, así que va como selector.
  var selectorTema = document.createElement('select');
  TEMAS.forEach(function (tema) {
    var opcion = document.createElement('option');
    opcion.value = tema;
    opcion.textContent = tema;
    selectorTema.appendChild(opcion);
  });
  controles.tema = agregarFila(contenedorTexto, 'theme', selectorTema);

  var contenedorSwitch = document.getElementById('campos-switch');
  CAMPOS_SWITCH.forEach(function (clave) {
    var interruptor = document.createElement('input');
    interruptor.type = 'checkbox';
    controles.interruptores[clave] = agregarFila(contenedorSwitch, clave, interruptor);
  });

  var contenedorColor = document.getElementById('campos-color');
  CLAVES_COLOR.forEach(function (clave) {
    var selectorColor = document.createElement('input');
    selectorColor.type = 'color';
    selectorColor.value = clave.indexOf('dark') === 0 ? '#101418' : '#ffffff';
    controles.colores[clave] = agregarFila(contenedorColor, clave, selectorColor);
  });
}

// Cada fila es control + casilla "incluir". El valor del control solo llega al
// payload si la casilla está marcada.
function agregarFila (contenedor, clave, control) {
  var fila = document.createElement('label');
  fila.className = 'campo campo--apagado';

  var incluir = document.createElement('input');
  incluir.type = 'checkbox';

  var nombre = document.createElement('span');
  nombre.className = 'campo__nombre';
  nombre.textContent = clave;

  fila.appendChild(incluir);
  fila.appendChild(nombre);
  fila.appendChild(control);
  contenedor.appendChild(fila);

  return { fila: fila, incluir: incluir, control: control };
}

function construirPresets () {
  var contenedor = document.getElementById('presets');

  Object.keys(PRESETS).forEach(function (nombre) {
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = nombre;
    boton.addEventListener('click', function () {
      aplicarPreset(PRESETS[nombre]);
    });
    contenedor.appendChild(boton);
  });
}

/* ---------- estado ---------- */

function escuchar () {
  document.addEventListener('input', alCambiar);
  document.addEventListener('change', alCambiar);
  document.getElementById('lanzar').addEventListener('click', lanzar);
}

function alCambiar () {
  sincronizarOpacidad();
  refrescarPreview();
  guardar();
}

function sincronizarOpacidad () {
  var todos = []
    .concat(Object.keys(controles.texto).map(function (k) { return controles.texto[k]; }))
    .concat(Object.keys(controles.interruptores).map(function (k) { return controles.interruptores[k]; }))
    .concat(Object.keys(controles.colores).map(function (k) { return controles.colores[k]; }))
    .concat([controles.tema]);

  todos.forEach(function (entrada) {
    entrada.fila.className = 'campo' + (entrada.incluir.checked ? '' : ' campo--apagado');
  });

  var incluirColores = document.getElementById('incluir-colors').checked;
  document.getElementById('campos-color').style.display = incluirColores ? '' : 'none';
}

function construirPayload () {
  var opciones = {};

  Object.keys(controles.texto).forEach(function (clave) {
    var entrada = controles.texto[clave];
    if (entrada.incluir.checked) {
      opciones[clave] = entrada.control.value;
    }
  });

  if (controles.tema.incluir.checked) {
    opciones.theme = controles.tema.control.value;
  }

  Object.keys(controles.interruptores).forEach(function (clave) {
    var entrada = controles.interruptores[clave];
    if (entrada.incluir.checked) {
      opciones[clave] = entrada.control.checked;
    }
  });

  if (document.getElementById('incluir-colors').checked) {
    var colores = {};
    Object.keys(controles.colores).forEach(function (clave) {
      var entrada = controles.colores[clave];
      if (entrada.incluir.checked) {
        colores[clave] = entrada.control.value;
      }
    });
    opciones.colors = colores;
  }

  var payload = { operationId: document.getElementById('operationId').value.trim() };

  // `options` solo viaja si tiene algo adentro: mandarlo vacío no es lo mismo
  // que no mandarlo, y acá queremos poder probar las dos cosas.
  if (Object.keys(opciones).length > 0) {
    payload.options = opciones;
  }

  return payload;
}

function refrescarPreview () {
  document.getElementById('preview').textContent =
    JSON.stringify(construirPayload(), null, 2);
}

function aplicarPreset (preset) {
  Object.keys(controles.texto).forEach(function (clave) {
    var entrada = controles.texto[clave];
    var valor = preset.texto[clave];
    entrada.incluir.checked = valor !== undefined;
    if (valor !== undefined) {
      entrada.control.value = valor;
    }
  });

  controles.tema.incluir.checked = preset.tema !== null;
  if (preset.tema !== null) {
    controles.tema.control.value = preset.tema;
  }

  Object.keys(controles.interruptores).forEach(function (clave) {
    var entrada = controles.interruptores[clave];
    var valor = preset.interruptores[clave];
    entrada.incluir.checked = valor !== undefined;
    entrada.control.checked = valor === true;
  });

  document.getElementById('incluir-colors').checked = preset.colores !== null;
  Object.keys(controles.colores).forEach(function (clave) {
    var entrada = controles.colores[clave];
    var valor = preset.colores ? preset.colores[clave] : undefined;
    entrada.incluir.checked = valor !== undefined;
    if (valor !== undefined) {
      entrada.control.value = valor;
    }
  });

  alCambiar();
}

/* ---------- persistencia ---------- */

// Probando en dispositivo se recarga mucho, y retipear el operationId cada vez
// es fricción real.
function guardar () {
  var estado = {
    operationId: document.getElementById('operationId').value,
    incluirColores: document.getElementById('incluir-colors').checked,
    texto: {},
    tema: { incluir: controles.tema.incluir.checked, valor: controles.tema.control.value },
    interruptores: {},
    colores: {}
  };

  Object.keys(controles.texto).forEach(function (clave) {
    estado.texto[clave] = {
      incluir: controles.texto[clave].incluir.checked,
      valor: controles.texto[clave].control.value
    };
  });

  Object.keys(controles.interruptores).forEach(function (clave) {
    estado.interruptores[clave] = {
      incluir: controles.interruptores[clave].incluir.checked,
      valor: controles.interruptores[clave].control.checked
    };
  });

  Object.keys(controles.colores).forEach(function (clave) {
    estado.colores[clave] = {
      incluir: controles.colores[clave].incluir.checked,
      valor: controles.colores[clave].control.value
    };
  });

  try {
    window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado));
  } catch (error) {
    // Sin almacenamiento el harness igual funciona; solo pierde la memoria.
  }
}

function restaurar () {
  var crudo;

  try {
    crudo = window.localStorage.getItem(CLAVE_ALMACENAMIENTO);
  } catch (error) {
    return;
  }

  if (!crudo) {
    return;
  }

  var estado;
  try {
    estado = JSON.parse(crudo);
  } catch (error) {
    return;
  }

  document.getElementById('operationId').value = estado.operationId || '';
  document.getElementById('incluir-colors').checked = estado.incluirColores === true;

  if (estado.tema) {
    controles.tema.incluir.checked = estado.tema.incluir === true;
    controles.tema.control.value = estado.tema.valor || 'system';
  }

  aplicarGuardado(controles.texto, estado.texto, 'value');
  aplicarGuardado(controles.interruptores, estado.interruptores, 'checked');
  aplicarGuardado(controles.colores, estado.colores, 'value');
}

function aplicarGuardado (grupo, guardado, propiedad) {
  if (!guardado) {
    return;
  }

  Object.keys(grupo).forEach(function (clave) {
    var entrada = guardado[clave];
    if (!entrada) {
      return;
    }
    grupo[clave].incluir.checked = entrada.incluir === true;
    grupo[clave].control[propiedad] = entrada.valor;
  });
}

/* ---------- ejecución ---------- */

function lanzar () {
  var payload = construirPayload();

  if (!payload.operationId) {
    mostrarError('Falta el operationId.');
    return;
  }

  var boton = document.getElementById('lanzar');
  boton.disabled = true;
  document.getElementById('resultado').textContent = 'Ejecutando…';

  window.Khipu.startOperation(
    payload,
    function (resultado) {
      boton.disabled = false;
      mostrarResultado(resultado, 'ok');
    },
    function (error) {
      boton.disabled = false;
      // El callback de error recibe un KhipuResult cuando el SDK terminó en
      // ERROR, y un string cuando el plugin rechazó antes de arrancar.
      if (typeof error === 'string') {
        mostrarError(error);
      } else {
        mostrarResultado(error, 'error');
      }
    }
  );
}

// Distingue tres formas de "sin valor" que se ven iguales si uno no las separa,
// y que en la práctica no lo son.
//
// `continueUrl` llega `null` en una operación cancelada, pero `exitUrl` llega
// como **cadena vacía** — verificado en una operación real. Un comercio que
// escriba `if (result.exitUrl === null)` no la va a atrapar; tiene que chequear
// por falsy. Mostrarlas distinto es lo que hace visible esa diferencia.
//
// Y una celda en blanco es indistinguible de un fallo de renderizado, así que
// ninguno de los casos se deja vacío.
function pintarValor (elemento, crudo) {
  if (crudo === null || crudo === undefined) {
    elemento.textContent = '—';
  } else if (crudo === '') {
    elemento.textContent = '"" (cadena vacía)';
  } else {
    elemento.textContent = String(crudo);
    return;
  }

  elemento.className = 'resultado__ausente';
}

function mostrarError (mensaje) {
  var contenedor = document.getElementById('resultado');
  contenedor.className = 'resultado resultado--error';
  contenedor.textContent = mensaje;
}

function mostrarResultado (resultado, clase) {
  var contenedor = document.getElementById('resultado');
  contenedor.className = 'resultado resultado--' + clase;
  contenedor.textContent = '';

  var lista = document.createElement('dl');
  ['operationId', 'result', 'exitTitle', 'exitMessage', 'exitUrl', 'failureReason', 'continueUrl']
    .forEach(function (clave) {
      var fila = document.createElement('div');
      fila.className = 'resultado__campo';

      var nombre = document.createElement('dt');
      nombre.textContent = clave;

      var valor = document.createElement('dd');
      pintarValor(valor, resultado[clave]);

      fila.appendChild(nombre);
      fila.appendChild(valor);
      lista.appendChild(fila);
    });
  contenedor.appendChild(lista);

  var eventos = resultado.events || [];
  if (eventos.length === 0) {
    return;
  }

  var tabla = document.createElement('table');
  tabla.innerHTML =
    '<thead><tr><th>name</th><th>type</th><th>timestamp</th></tr></thead>';

  var cuerpo = document.createElement('tbody');
  eventos.forEach(function (evento) {
    var fila = document.createElement('tr');
    [evento.name, evento.type, evento.timestamp].forEach(function (celda) {
      var td = document.createElement('td');
      pintarValor(td, celda);
      fila.appendChild(td);
    });
    cuerpo.appendChild(fila);
  });

  tabla.appendChild(cuerpo);
  contenedor.appendChild(tabla);
}
