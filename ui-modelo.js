/* Vista Modelo (requisito 4, documentación): de dónde sale cada número, en cuatro subpestañas que se ven
   de una en una: Cálculo (los ocho indicadores), Valores (variables y parámetros), Decisión (la regla y los
   pesos) y Límites (supuestos, limitaciones y qué falta validar). Todo se genera desde modelo.js y datos.js,
   así que lo que se lee aquí es exactamente lo que se calcula.
   Patrón de lectura: cada lista muestra una línea por elemento y despliega el detalle de uno solo a la vez. */
(function () {
  'use strict';

  var UI = window.UI, S = window.Sim, D = window.DATOS, M = window.Modelo;
  var e = UI.e, num = UI.num, tag = UI.tag, app = UI.app;

  var TABS = [
    { id: 'calculo', nombre: 'Cálculo' },
    { id: 'valores', nombre: 'Valores' },
    { id: 'decision', nombre: 'Decisión' },
    { id: 'limites', nombre: 'Límites' }
  ];
  var LISTAS = [
    { id: 'sup', nombre: 'Supuestos', datos: function () { return M.SUPUESTOS; } },
    { id: 'lim', nombre: 'Limitaciones', datos: function () { return M.LIMITACIONES; } },
    { id: 'val', nombre: 'Por validar', datos: function () { return M.PARA_VALIDAR; } }
  ];
  var tab = 'calculo';          // subpestaña visible
  var lista = 'sup';            // lista visible en Límites
  var abierta = { ind: 'disp' };  // fila desplegada de cada lista (una por lista)

  var ETIQUETAS = {
    enSerie: 'Componentes en serie',
    saltos: 'Llamadas por petición pesada',
    saltosLigeros: 'Llamadas por petición ligera',
    acoplamiento: 'Acoplamiento',
    asincrona: 'Si el diseño es asíncrono',
    componentes: 'Componentes que operar',
    cuotas: 'Cuotas del plan gratuito',
    uso: 'Uso de cuota (indicador)'
  };

  function nombreUsa(k) {
    var v = M.defVar(k);
    if (v) return v.nombre;
    for (var i = 0; i < M.PARAMS.length; i++) if (M.PARAMS[i].id === k) return M.PARAMS[i].nombre;
    return ETIQUETAS[k] || k;
  }

  /* Un texto «Titular. Detalle.» se parte en la primera frase y el resto. */
  function partir(t) {
    var i = t.indexOf('. ');
    return i < 0 ? { cab: t, det: '' } : { cab: t.slice(0, i + 1), det: t.slice(i + 2) };
  }

  /* ---------- Fila desplegable (una abierta por lista) ---------- */
  function fila(g, id, o) {
    if (!o.det) return '<li class="fx sin"><span class="fx-t">' + (o.n ? '<span class="fx-num" aria-hidden="true">' + o.n + '</span>' : '') + '<span class="fx-tx">' + o.cab + '</span></span></li>';
    var abre = abierta[g] === id, sid = 'fx-' + g + '-' + id;
    return '<li class="fx"><button type="button" class="fx-cab" data-act="fx" data-g="' + g + '" data-id="' + id + '" aria-expanded="' + (abre ? 'true' : 'false') + '" aria-controls="' + sid + '">' +
      '<span class="fx-t">' + (o.n ? '<span class="fx-num" aria-hidden="true">' + o.n + '</span>' : '') + '<span class="fx-tx">' + o.cab + (o.sub ? '<span class="fx-s">' + o.sub + '</span>' : '') + '</span></span>' +
      (o.val ? '<span class="fx-v">' + o.val + '</span>' : '') + '<span class="chev" aria-hidden="true"></span></button>' +
      '<div class="fx-det" id="' + sid + '"' + (abre ? '' : ' hidden') + '>' + o.det + '</div></li>';
  }

  function listaFx(filas, etiqueta) {
    return '<ul class="fx-lista" aria-label="' + e(etiqueta) + '">' + filas.join('') + '</ul>';
  }

  /* ---------- Flujo de una línea ---------- */
  function hilo() {
    return '<ol class="hilo" aria-label="Cómo funciona el modelo">' + ['Entradas', 'Cálculo', 'Indicadores', 'Comparación', 'Puntaje'].map(function (t, i) {
      return '<li><span class="n" aria-hidden="true">' + (i + 1) + '</span>' + e(t) + '</li>';
    }).join('') + '</ol>';
  }

  /* ---------- Cálculo ---------- */
  function panelCalculo() {
    var filas = M.INDICADORES.map(function (i) {
      var usa = i.usa.map(function (k) { return '<li>' + e(nombreUsa(k)) + '</li>'; }).join('');
      return fila('ind', i.id, {
        cab: e(i.nombre), sub: e(i.claro),
        det: '<p class="formula"><code>' + e(i.formula) + '</code></p><p>' + e(i.explica) + '</p>' +
          '<p class="rel-t">Usa</p><ul class="chips-l">' + usa + '</ul>' +
          '<p class="pista">' + (i.mejor === 'mayor' ? 'Más alto es mejor.' : 'Más bajo es mejor.') + ' Unidad: ' + e(i.unidad) + '.</p>'
      });
    });
    return '<p class="mod-ayuda">Ocho indicadores calculados igual para A, B y C. Toca uno para ver su fórmula.</p>' + listaFx(filas, 'Indicadores');
  }

  /* ---------- Valores ---------- */
  function filasVariables() {
    return M.VARIABLES.map(function (d) {
      var dec = d.paso < 1 ? 6 : 0;   // M.limpio quita los ceros sobrantes: 0,00075 no se redondea
      var rango = d.tipo === 'opcion' ? d.opciones.map(function (o) { return o[1]; }).join(' / ') : M.limpio(d.min, dec) + ' a ' + M.limpio(d.max, dec) + (d.unidad ? ' ' + d.unidad : '');
      var ref = d.tipo === 'opcion' ? d.opciones.filter(function (o) { return o[0] === d.ref; })[0][1] : M.limpio(d.ref, dec) + (d.unidad ? ' ' + d.unidad : '');
      return fila('var', d.id, {
        cab: e(d.nombre) + (d.simbolo ? ' <span class="sim">' + e(d.simbolo) + '</span>' : ''),
        val: e(ref) + ' ' + tag(d.base),
        det: (d.pregunta === d.nombre ? '' : '<p class="fx-preg">' + e(d.pregunta) + '</p>') + '<p>' + e(d.porque) + (d.soloC ? ' Solo afecta a la alternativa C.' : '') + '</p><p class="pista">Rango válido: ' + e(rango) + '. Se mueve en el Simulador.</p>'
      });
    });
  }

  function filasParametros() {
    return M.PARAMS.map(function (p) {
      return fila('par', p.id, {
        cab: e(p.nombre) + ' <span class="sim">' + e(p.simbolo) + '</span>',
        val: e(num(p.valor, p.valor < 1 ? 2 : 0) + ' ' + p.unidad) + ' ' + tag(p.base),
        det: '<p>' + e(p.nota) + '</p>'
      });
    });
  }

  function tablaDiseno() {
    var h = '';
    h += '<div class="tabla-scroll" tabindex="0" role="region" aria-label="Tabla de parámetros por alternativa"><table class="comparacion"><thead><tr><th scope="col">Parámetro</th>' +
      D.ALTERNATIVAS.map(function (a) { return '<th scope="col"><span class="letra-sm" aria-hidden="true">' + a.id + '</span> ' + e(a.nombre) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var filas = [
      ['Componentes que operar', 'componentes'], ['Componentes en serie', 'enSerie'], ['Llamadas por petición pesada', 'saltos'],
      ['Llamadas por petición ligera', 'saltosLigeros'], ['Acoplamiento (0 a 1)', 'acoplamiento'], ['Asíncrona', 'asincrona'],
      ['Consultas de estado', 'usaSondeo'], ['Costo de infraestructura (plan gratuito)', 'costoInfra']
    ];
    filas.forEach(function (f) {
      h += '<tr><th scope="row">' + e(f[0]) + '</th>' + D.ALTERNATIVAS.map(function (a) {
        var p = a.parametros[f[1]];
        var v = typeof p.valor === 'boolean' ? (p.valor ? 'Sí' : 'No') : (f[1] === 'costoInfra' ? 'USD ' + num(p.valor, 2) : num(p.valor, f[1] === 'acoplamiento' ? 1 : 0));
        return '<td>' + e(v) + ' ' + tag(p.base) + '</td>';
      }).join('') + '</tr>';
    });
    h += '<tr><th scope="row">Cuotas que se vigilan</th>' + D.ALTERNATIVAS.map(function (a) {
      return '<td class="texto-largo">' + a.parametros.cuotas.map(function (q) { return e(q.nombre + ': ' + num(q.limite, 0) + ' ' + q.unidad + (q.opsPorMensaje ? ' (' + q.opsPorMensaje + ' por mensaje)' : '')) + ' ' + tag(q.base); }).join('<br>') + '</td>';
    }).join('') + '</tr>';
    h += '</tbody></table></div>';
    return h;
  }

  function panelValores() {
    return '<h3 class="mod-h">Variables que mueves <span class="cuenta">' + M.VARIABLES.length + '</span></h3>' + listaFx(filasVariables(), 'Variables de entrada') +
      '<details class="sub mod-diseno"><summary><span>Parámetros fijos <span class="cuenta">' + M.PARAMS.length + '</span></span><span class="chev" aria-hidden="true"></span></summary><div class="sub-cuerpo">' + listaFx(filasParametros(), 'Parámetros globales') + '</div></details>' +
      '<details class="sub"><summary><span>Parámetros de cada diseño</span><span class="chev" aria-hidden="true"></span></summary><div class="sub-cuerpo">' + tablaDiseno() + '</div></details>';
  }

  /* ---------- Decisión ---------- */
  function pesos() {
    var des = S.cfg.requisitos.filter(function (r) { return r.nucleo && r.tipo === 'deseable' && M.REQ_MAP[r.id]; });
    var h = '<h3 class="mod-h">Pesos de los deseables</h3><p class="mod-ayuda">Más peso, más cuenta en el puntaje. Por defecto todos valen 1.</p>';
    if (!des.length) return h + '<p class="pista">No hay requisitos deseables: marca alguno como deseable en Configuración para ponderarlo.</p>';
    h += '<div class="pesos">' + des.map(function (r) {
      var w = S.pesos[r.id];
      var id = 'peso_' + r.id;
      return '<div class="peso"><label for="' + id + '">' + e(M.REQ_MAP[r.id].corto) + '</label><input type="number" id="' + id + '" data-peso="' + r.id + '" min="1" max="10" step="1" inputmode="numeric" value="' + (typeof w === 'number' ? w : 1) + '" aria-describedby="e_' + id + '"><p class="err" id="e_' + id + '" data-err-peso="' + r.id + '"></p></div>';
    }).join('') + '</div><button type="button" class="btn sec" data-act="pesos-reset">Restablecer pesos</button>';
    return h;
  }

  function panelDecision() {
    var filas = M.CRITERIOS.map(function (t, i) {
      var p = partir(t);
      return fila('crit', String(i), { n: i + 1, cab: e(p.cab), det: p.det ? '<p>' + e(p.det) + '</p>' : '' });
    });
    return '<p class="mod-ayuda">Así se decide qué alternativa conviene.</p>' + listaFx(filas, 'Regla de decisión') + pesos();
  }

  /* ---------- Límites ---------- */
  function panelLimites() {
    var l = LISTAS.filter(function (x) { return x.id === lista; })[0];
    var pills = '<div class="casos" role="group" aria-label="Qué lista ver">' + LISTAS.map(function (x) {
      return '<button type="button" class="caso" data-act="lista" data-lista="' + x.id + '" aria-pressed="' + (x.id === lista ? 'true' : 'false') + '">' + e(x.nombre) + ' <span class="cuenta">' + x.datos().length + '</span></button>';
    }).join('') + '</div>';
    var filas = l.datos().map(function (t, i) {
      var p = partir(t);
      return fila('lim', lista + i, { cab: e(p.cab), det: p.det ? '<p>' + e(p.det) + '</p>' : '' });
    });
    return '<p class="mod-ayuda">Qué asume el modelo, qué no cubre y qué falta medir para confirmarlo.</p>' + pills + listaFx(filas, l.nombre);
  }

  var PANELES = { calculo: panelCalculo, valores: panelValores, decision: panelDecision, limites: panelLimites };

  /* ---------- Vista ---------- */
  function htmlTabs() {
    return '<div class="subtabs" role="tablist" aria-label="Partes del modelo">' + TABS.map(function (t) {
      return '<button type="button" role="tab" class="subtab" id="mtab-' + t.id + '" data-act="mtab" data-tab="' + t.id + '" aria-controls="mod-panel" aria-selected="' + (t.id === tab ? 'true' : 'false') + '" tabindex="' + (t.id === tab ? '0' : '-1') + '">' + e(t.nombre) + '</button>';
    }).join('') + '</div>';
  }

  function render() {
    return '<header class="vista-cab"><div><h2>Modelo</h2><p>De dónde sale cada número. <a href="pruebas.html">Ver pruebas del modelo</a></p></div></header>' +
      hilo() + htmlTabs() +
      '<section class="mod-panel" id="mod-panel" role="tabpanel" aria-labelledby="mtab-' + tab + '">' + PANELES[tab]() + '</section>';
  }

  function pintar(enfocar) {
    var p = document.getElementById('mod-panel');
    if (!p) return;
    p.innerHTML = PANELES[tab]();
    p.setAttribute('aria-labelledby', 'mtab-' + tab);
    app.querySelectorAll('.subtab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    if (enfocar) { var b = document.getElementById('mtab-' + tab); if (b) b.focus(); }
  }

  function irATab(id, enfocar) {
    if (id === tab) return;
    tab = id;
    pintar(enfocar);
  }

  function alternar(b) {
    var g = b.getAttribute('data-g'), id = b.getAttribute('data-id');
    abierta[g] = abierta[g] === id ? null : id;
    var ul = b.closest('ul');
    ul.querySelectorAll('.fx-cab').forEach(function (x) {
      var on = abierta[g] === x.getAttribute('data-id');
      x.setAttribute('aria-expanded', on ? 'true' : 'false');
      var d = document.getElementById(x.getAttribute('aria-controls'));
      if (d) d.hidden = !on;
    });
  }

  function onPeso(ev) {
    var el = ev.target;
    var id = el.getAttribute && el.getAttribute('data-peso');
    if (!id) return;
    var w = el.value === '' ? null : Number(el.value);
    var msg = S.errorPeso(w === null ? NaN : w);
    var er = app.querySelector('[data-err-peso="' + id + '"]');
    if (er) er.textContent = msg;
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    if (!msg) { S.setPeso(id, w); UI.guardar(); }
  }

  UI.vistas.modelo = {
    render: render,
    oninput: onPeso,
    onchange: onPeso,
    onclick: function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'fx') alternar(b);
      else if (a === 'mtab') irATab(b.getAttribute('data-tab'), false);
      else if (a === 'lista') { lista = b.getAttribute('data-lista'); delete abierta.lim; pintar(false); }
      else if (a === 'pesos-reset') {
        S.pesos = {};
        UI.guardar();
        app.querySelectorAll('[data-peso]').forEach(function (i) { i.value = '1'; i.removeAttribute('aria-invalid'); });
        app.querySelectorAll('[data-err-peso]').forEach(function (p) { p.textContent = ''; });
        UI.toast('Todos los pesos vuelven a 1.');
      }
    },
    onkeydown: function (ev) {
      var t = ev.target;
      if (!t.classList || !t.classList.contains('subtab')) return;
      var i = TABS.map(function (x) { return x.id; }).indexOf(t.getAttribute('data-tab'));
      var j = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? TABS.length - 1 : -1;
      if (j >= 0) { ev.preventDefault(); irATab(TABS[(j + TABS.length) % TABS.length].id, true); }
    }
  };
})();
