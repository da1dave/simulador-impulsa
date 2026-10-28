/* Vista Simulador (requisitos 3, 5, 6, 7 y 8): una sola pantalla de trabajo.
   Arriba, las siete situaciones (escenarios) de un clic. A la izquierda se ajustan las variables de entrada
   (cinco a la vista y cuatro en «Ajustes avanzados»). A la derecha, la respuesta (qué se recomienda y por qué)
   y cuatro subpestañas que se ven de una en una: Por qué, Escenarios, ¿Y si…? e Indicadores (ui-paneles.js).
   Ningún texto de resultado está escrito a mano: todo sale de Modelo.evaluarTodas / lectura / recomendar. */
(function () {
  'use strict';

  var UI = window.UI, S = window.Sim, D = window.DATOS, M = window.Modelo;
  var e = UI.e, num = UI.num, tag = UI.tag, app = UI.app;

  var tab = 'porque';
  var avanzadoAbierto = null;
  var riesgosAbierto = false;
  var tocadas = {};
  var programado = false;
  var prevTxt = null;
  var obs = null;   // observa si la respuesta está a la vista
  var consulta = window.matchMedia ? window.matchMedia('(min-width: 1000px)') : null;

  var TABS = [
    { id: 'porque', nombre: 'Por qué' },
    { id: 'escenarios', nombre: 'Escenarios' },
    { id: 'sensibilidad', nombre: '¿Y si…?' },
    { id: 'indicadores', nombre: 'Indicadores' }
  ];

  /* ---------- Formato de valores ---------- */
  function vc(ind, v) {
    if (typeof v !== 'number') return '—';
    if (!isFinite(v)) return '∞';
    if (ind.unidad === '%') return num(v, ind.dec) + ' %';
    if (ind.unidad === 's') return num(v, ind.dec) + ' s';
    if (ind.unidad === 'USD') return 'USD ' + num(v, 2);
    return num(v, ind.dec);
  }
  function vcMeta(ind, v) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    var t = M.limpio(v, Math.max(ind.dec, 2));
    if (ind.unidad === '%') return t + ' %';
    if (ind.unidad === 's') return t + ' s';
    if (ind.unidad === 'USD') return 'USD ' + t;
    return t + ' ' + ind.unidad;
  }
  function simbolo(op) { return op === '>=' ? '≥' : '≤'; }
  function nombreAlt(a) { return a.alt.id + ' · ' + a.alt.nombre; }
  var CORTO_VAR = { P: 'previews por negocio', sondeo: 'consulta de estado', costoIA: 'costo de IA', contarSaltos: 'llamadas entre componentes' };
  function nombreVar(d) { return CORTO_VAR[d.id] || d.nombre; }

  UI.fmtInd = vc;
  UI.fmtMeta = vcMeta;
  UI.simboloOp = simbolo;
  UI.nombreAlt = nombreAlt;

  function listaY(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
  }
  UI.listaY = listaY;

  function motivosTxt(ms) {
    return ms.map(function (r) {
      var ind = M.indicador(r.indicador);
      return r.corto + ' ' + vc(ind, r.valor) + ' (necesita ' + simbolo(r.op) + ' ' + vcMeta(ind, r.meta) + ')';
    }).join('; ');
  }
  UI.motivosTxt = motivosTxt;

  /* ---------- Situaciones (escenarios) de un clic ---------- */
  function valorCorto(k, v) {
    var d = M.defVar(k);
    if (d.tipo === 'opcion') return d.opciones.filter(function (o) { return o[0] === v; })[0][1];
    return M.limpio(v, d.paso < 1 ? 4 : 0) + (d.unidad === '%' || d.unidad === 's' ? ' ' + d.unidad : '');
  }
  function resumenCaso(caso) {
    var ks = Object.keys(caso.vars);
    if (!ks.length) return 'Todo en su valor base';
    return ks.map(function (k) { var d = M.defVar(k); return (d.simbolo || d.nombre) + ' = ' + valorCorto(k, caso.vars[k]); }).join(' · ');
  }
  /* Qué cambió frente a la referencia en los valores que hay puestos (para «Valores personalizados»). */
  function cambiosActuales() {
    var ref = M.referencia();
    var ks = M.VARIABLES.filter(function (d) { return S.vars[d.id] !== ref[d.id] && typeof S.vars[d.id] === 'number'; });
    if (!ks.length) return 'Todo en su valor base';
    return ks.map(function (d) { return (d.simbolo || d.nombre) + ' = ' + valorCorto(d.id, S.vars[d.id]); }).join(' · ');
  }

  function htmlCasos() {
    return '<section class="situacion" aria-labelledby="h-casos"><h3 id="h-casos" class="vh">Situación</h3>' +
      '<div class="casos" role="group" aria-labelledby="h-casos">' + M.CASOS.map(function (c) {
        return '<button type="button" class="caso" data-act="caso" data-caso="' + c.id + '" aria-pressed="false" title="' + e(c.pregunta) + '">' + e(c.nombre) + '</button>';
      }).join('') + '</div>' +
      '<details class="caso-d" id="caso-d"><summary><span id="caso-preg"></span><span class="chev" aria-hidden="true"></span></summary><div class="caso-cuerpo" id="caso-cuerpo"></div></details></section>';
  }

  function casoActivo() {
    for (var i = 0; i < M.CASOS.length; i++) {
      var vs = M.varsDeCaso(M.CASOS[i]);
      if (M.VARIABLES.every(function (d) { return S.vars[d.id] === vs[d.id]; })) return M.CASOS[i];
    }
    return null;
  }

  UI.casoActivo = casoActivo;

  function pintarCasos() {
    var act = casoActivo();
    app.querySelectorAll('[data-caso]').forEach(function (b) {
      b.setAttribute('aria-pressed', act && act.id === b.getAttribute('data-caso') ? 'true' : 'false');
    });
    var p = document.getElementById('caso-preg'), c = document.getElementById('caso-cuerpo');
    if (p) p.textContent = act ? act.pregunta : 'Valores personalizados';
    if (c) c.innerHTML = act
      ? '<p>' + e(act.contexto) + '</p><p class="caso-vals">' + e(resumenCaso(act)) + '</p>'
      : '<p class="caso-vals">' + e(cambiosActuales()) + '</p>';
    var n = document.getElementById('ajustes-n');
    if (n) { n.textContent = act ? '' : 'personalizado'; n.className = 'sec-badge' + (act ? '' : ' hay mod'); }
  }

  function cambiarVars(nuevos) {
    var antes = JSON.parse(JSON.stringify(S.vars));
    M.VARIABLES.forEach(function (d) { S.setVar(d.id, nuevos[d.id]); });
    UI.guardar();
    M.VARIABLES.forEach(refrescarControl);
    programar();
    return antes;
  }
  function deshacer(antes) {
    return { texto: 'Deshacer', fn: function () {
      M.VARIABLES.forEach(function (d) { S.setVar(d.id, antes[d.id]); });
      UI.guardar();
      M.VARIABLES.forEach(refrescarControl);
      programar();
    } };
  }

  function aplicarCaso(id) {
    var caso = M.CASOS.filter(function (c) { return c.id === id; })[0];
    if (!caso) return;
    var antes = cambiarVars(M.varsDeCaso(caso));
    UI.toast('Situación «' + caso.nombre + '» aplicada.', deshacer(antes));
  }

  /* ---------- Controles de variables ---------- */
  function pct(d, x) {
    var lo = d.deslizar[0], hi = d.deslizar[1];
    return Math.round(Math.min(1, Math.max(0, (x - lo) / (hi - lo))) * 1000) / 10;
  }
  function controlVar(d) {
    var val = S.vars[d.id];
    var ok = M.errorVar(d, val) === '';
    var base = ok ? val : S.ultimaValida[d.id];
    var h = '<div class="var" data-var="' + d.id + '">';
    if (d.tipo === 'opcion') {
      h += '<div class="var-cab"><span class="var-nom" id="vl_' + d.id + '">' + e(d.pregunta) + '</span></div>';
      h += '<div class="seg seg-v" role="radiogroup" aria-labelledby="vl_' + d.id + '">' + d.opciones.map(function (o) {
        return '<label class="seg-op"><input type="radio" name="v_' + d.id + '" data-var-o="' + d.id + '" value="' + o[0] + '"' + (val === o[0] ? ' checked' : '') + '><span>' + e(o[1]) + '</span></label>';
      }).join('') + '</div>';
    } else {
      h += '<div class="var-cab"><label class="var-nom" for="v_' + d.id + '">' + e(d.pregunta) + '</label></div>';
      var lo = d.deslizar[0], hi = d.deslizar[1];
      var pos = Math.min(hi, Math.max(lo, base));
      h += '<div class="var-in">' +
        '<input type="range" data-var-r="' + d.id + '" min="' + lo + '" max="' + hi + '" step="' + d.paso + '" value="' + pos + '" style="--p:' + pct(d, pos) + '%" aria-label="' + e(d.nombre) + ' (deslizador)">' +
        '<span class="num-u"><input type="number" id="v_' + d.id + '" data-var-n="' + d.id + '" inputmode="decimal" min="' + d.min + '" max="' + d.max + '" step="' + d.paso + '" value="' + (typeof val === 'number' ? e(val) : '') + '" aria-describedby="ev_' + d.id + '">' +
        (d.unidad ? '<span class="unidad">' + e(d.unidad) + '</span>' : '') + '</span></div>';
    }
    h += '<p class="err" id="ev_' + d.id + '" data-err-var="' + d.id + '"></p>';
    var refTxt = d.tipo === 'opcion' ? d.opciones.filter(function (o) { return o[0] === d.ref; })[0][1] : M.limpio(d.ref, d.paso < 1 ? 4 : 0) + (d.unidad ? ' ' + d.unidad : '');
    h += '<button type="button" class="mini" data-act="var-reset" data-id="' + d.id + '" title="Volver a la referencia: ' + e(refTxt) + '" hidden>↺ Restablecer</button>';
    h += '<details class="mas"><summary><span aria-hidden="true">ⓘ</span><span class="vh">Por qué importa</span></summary><div class="mas-cuerpo">' +
      '<p>' + e(d.porque) + (d.soloC ? ' Solo afecta a la alternativa C.' : '') + '</p>' +
      '<p class="mas-nom">' + e(d.nombre) + (d.simbolo ? ' <span class="sim">' + e(d.simbolo) + '</span>' : '') + ' ' + tag(d.base) + '</p>' +
      '<ul class="chips-l afecta" aria-label="Requisitos que toca"><li class="afecta-t">Toca:</li>' + d.req.map(function (id) { return '<li>' + e(M.REQ_MAP[id].corto) + '</li>'; }).join('') + '</ul>' +
      (d.sensibilidad ? '<div class="sens" id="sens"></div>' : '') + '</div></details>';
    return h + '</div>';
  }

  function actualizarControl(d) {
    var box = app.querySelector('[data-var="' + d.id + '"]');
    if (!box) return;
    var val = S.vars[d.id];
    var msg = M.errorVar(d, val);
    var mostrar = msg && (typeof val === 'number' || tocadas[d.id]);
    var er = box.querySelector('[data-err-var]');
    er.textContent = mostrar ? msg : '';
    var n = box.querySelector('[data-var-n]');
    if (n) { if (mostrar) n.setAttribute('aria-invalid', 'true'); else n.removeAttribute('aria-invalid'); }
    var bt = box.querySelector('[data-act="var-reset"]');
    if (bt) bt.hidden = !(msg || val !== d.ref);
    var rg = box.querySelector('[data-var-r]');
    if (rg) {
      // Si el número escrito queda fuera del rango del deslizador, el punto se queda en el extremo y se ve hueco.
      var fuera = typeof val === 'number' && (val < d.deslizar[0] || val > d.deslizar[1]);
      rg.classList.toggle('fuera', fuera);
      rg.title = fuera ? 'El valor escrito está fuera del rango del deslizador' : '';
    }
    actualizarAvanzado();
  }

  function avanzadasModificadas() {
    return M.VARIABLES.filter(function (d) { return !d.esencial && (S.vars[d.id] !== d.ref); }).length;
  }
  function actualizarAvanzado() {
    var b = document.getElementById('avanzado-n');
    if (!b) return;
    var n = avanzadasModificadas();
    b.textContent = n ? n + (n === 1 ? ' modificado' : ' modificados') : '';
    b.className = 'sec-badge' + (n ? ' hay mod' : '');
  }

  /* ---------- La respuesta ----------
     Titular y frase salen de Modelo.lectura(), una función pura que se prueba en pruebas.html. */
  function frases(L) {
    if (!L.viables.length) {
      return {
        clase: ' nada',
        tit: 'Ninguna alternativa cumple todos los obligatorios',
        sub: 'Con estos valores las tres quedan descartadas. Mira en «Por qué» qué requisito rompe cada una y cambia la variable que lo mueve.'
      };
    }
    if (!L.segunda) {
      return {
        clase: '',
        tit: nombreAlt(L.lider),
        sub: 'Es la única que cumple todos los obligatorios' + (L.lider.puntaje != null ? ', con ' + num(L.lider.puntaje, 1) + ' puntos en los deseables.' : '.')
      };
    }
    var sub;
    if (L.sinDeseables) sub = 'No hay requisitos deseables con meta válida para desempatar.';
    else if (L.empate) sub = L.lider.alt.id + ' y ' + L.segunda.alt.id + ' empatan en puntaje.';
    else {
      var v = L.ventajas.map(function (x) { return x.corto; });
      sub = L.lider.alt.id + ' supera a ' + L.segunda.alt.id + ' por ' + num(L.diferencia, 1) + ' puntos' + (v.length ? ', sobre todo en ' + listaY(v) : '') + '.';
    }
    return { clase: '', tit: nombreAlt(L.lider), sub: sub };
  }

  function hero(cur) {
    var L = M.lectura(cur);
    var f = frases(L);
    var aguanta = '';
    if (L.lider && L.viables.length) {
      var evals = M.evaluarEscenarios(S.cfg, S.pesos);
      var n = evals.filter(function (ev) {
        return !ev.res.alternativas.filter(function (a) { return a.alt.id === L.lider.alt.id; })[0].descartada;
      }).length;
      aguanta = '<span class="chip neutro" title="En cuántos de los siete escenarios esta alternativa cumple todos los obligatorios">Aguanta ' + n + ' de ' + evals.length + ' escenarios</span>';
    }
    var h = '<section class="rec' + f.clase + '" aria-labelledby="h-rec"><div class="rec-cab">';
    h += '<div class="rec-txt"><p class="v-kicker">Recomendación · estimación del modelo</p>' +
      '<h3 id="h-rec" data-k="vt">' + e(f.tit) + '</h3>' +
      (f.sub ? '<p class="rec-por" data-k="vs">' + e(f.sub) + '</p>' : '') + (aguanta ? '<p class="rec-chips">' + aguanta + '</p>' : '') + '</div>';
    h += '<div class="rec-dials" role="group" aria-label="Puntaje de cada alternativa">' + cur.alternativas.map(function (a) {
      var gana = L.lider && L.viables.length && L.lider.alt.id === a.alt.id;
      return '<div class="rec-dial' + (gana ? ' gana' : '') + (a.descartada ? ' fuera' : '') + '" title="' + e(a.alt.nombre) + '" data-k="p_' + a.alt.id + '">' +
        UI.gDial(a.puntaje, a.alt.id, a.descartada) +
        '<span class="rd-id">' + a.alt.id + '</span>' +
        '<span class="rd-est">' + (a.descartada ? 'descartada' : (gana ? 'recomendada' : 'viable')) + '</span></div>';
    }).join('') + '</div></div>';
    if (L.descartadas.length) {
      h += '<ul class="v-desc">' + L.descartadas.map(function (a) {
        return '<li><b>' + e(a.id) + '</b> queda descartada: ' + e(motivosTxt(a.motivos)) + '.</li>';
      }).join('') + '</ul>';
    }
    h += '<details class="riesgos" data-riesgos' + (riesgosAbierto ? ' open' : '') + '><summary><span>Riesgos de esta recomendación</span><span class="chev" aria-hidden="true"></span></summary>' +
      '<div class="riesgos-cuerpo" id="riesgos-cuerpo">' + (riesgosAbierto ? htmlRiesgos() : '') + '</div></details>';
    return h + '</section>';
  }

  /* Los riesgos salen de Modelo.recomendar, que es lo más pesado del cálculo: solo se pide si se abre. */
  function htmlRiesgos() {
    var rec = M.recomendar(S.cfg, S.varsEfectivas(), S.pesos);
    if (!rec.ganador) return '<p class="nota">Sin una alternativa recomendada no hay riesgos que declarar. Cambia la situación.</p>';
    return (rec.riesgos.length ? UI.lista(rec.riesgos) : '<p class="nota">Sin riesgos detectados.</p>') +
      '<p class="pista">Son estimaciones del modelo, no mediciones. Qué haría falta para validarlas: <a href="#modelo">Modelo</a>.</p>';
  }

  /* ---------- Subpestañas ---------- */
  function htmlTabs() {
    return '<div class="subtabs" role="tablist" aria-label="Detalle del resultado">' + TABS.map(function (t) {
      return '<button type="button" role="tab" class="subtab" id="tab-' + t.id + '" data-act="tab" data-tab="' + t.id + '" aria-controls="res-panel" aria-selected="' + (t.id === tab ? 'true' : 'false') + '" tabindex="' + (t.id === tab ? '0' : '-1') + '">' + e(t.nombre) + '</button>';
    }).join('') + '</div>';
  }

  function pintarTabs() {
    app.querySelectorAll('.subtab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    var p = document.getElementById('res-panel');
    if (p) p.setAttribute('aria-labelledby', 'tab-' + tab);
  }

  function irATab(id, enfocar) {
    if (id === tab) return;
    tab = id;
    prevTxt = null;
    pintarTabs();
    calcular();
    if (enfocar) { var b = document.getElementById('tab-' + id); if (b) b.focus(); }
  }

  /* ---------- Avisos de validación ---------- */
  function avisos() {
    var v = S.validate(), vv = S.validarVars();
    var h = '';
    if (v.count) h += '<p class="aviso-i malo-i" role="status"><b>La configuración tiene ' + v.count + (v.count === 1 ? ' campo' : ' campos') + ' por corregir.</b> Los requisitos con meta inválida no se evalúan. <a href="#configuracion">Revisar configuración</a></p>';
    if (vv.count) h += '<p class="aviso-i malo-i" role="status"><b>' + vv.count + (vv.count === 1 ? ' variable inválida.' : ' variables inválidas.') + '</b> El cálculo usa el último valor válido de cada una.</p>';
    return h;
  }

  function htmlSens() {
    var rd = S.req('disp_min');
    if (!rd || typeof rd.meta !== 'number' || !(rd.meta > 0)) return '';
    var d = S.varsEfectivas().d;
    var h = '<p class="rel-t">Para llegar a ≥ ' + num(rd.meta, 1) + ' % de disponibilidad, cada componente necesita</p><ul class="sens-l">';
    D.ALTERNATIVAS.forEach(function (a) {
      var dm = M.dMinimo(a, rd.meta);
      var marg = d - dm;
      var ok = marg >= -1e-9;
      h += '<li><span class="letra-sm" aria-hidden="true">' + a.id + '</span><span>d ≥ <b>' + num(dm, 3) + ' %</b></span><span class="mini-est ' + (ok ? 'si' : 'no') + '">' + (ok ? 'margen ' + num(Math.max(0, marg), 3) : 'falta ' + num(-marg, 3)) + '</span></li>';
    });
    return h + '</ul>';
  }

  /* Resalta un instante lo que cambió respecto al cálculo anterior (solo con movimiento permitido). */
  function marcarCambios(raiz) {
    var nuevos = {};
    raiz.querySelectorAll('[data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k'), t = el.textContent;
      nuevos[k] = t;
      if (prevTxt && prevTxt[k] !== undefined && prevTxt[k] !== t) el.classList.add('flash');
    });
    prevTxt = nuevos;
  }

  function calcular() {
    programado = false;
    var vars = S.varsEfectivas();
    var cur = M.evaluarTodas(S.cfg, vars, S.pesos);
    var panel = document.getElementById('res-panel');
    var cab = document.getElementById('res-hero');
    if (!panel || !cab) return;
    cab.innerHTML = hero(cur);
    var pn = UI.paneles[tab];
    panel.innerHTML = pn ? pn({ cur: cur, ref: M.evaluarTodas(S.cfg, M.referencia(), S.pesos), vars: vars }) : '';
    marcarCambios(document.getElementById('res-col'));
    var sens = document.getElementById('sens');
    if (sens) sens.innerHTML = htmlSens();
    var av = document.getElementById('aviso-vars');
    if (av) av.innerHTML = avisos();
    var mini = document.getElementById('mini-res');
    if (mini) {
      mini.innerHTML = cur.alternativas.map(function (a) {
        return '<span class="mini-alt ' + a.estado + '"><b>' + a.alt.id + '</b> ' + (a.descartada ? 'Descartada' : '<span class="vh">viable, </span>' + num(a.puntaje, 1)) + '</span>';
      }).join('') + '<button type="button" class="mini-ir" data-act="ver-res">Ver<span class="vh"> resultados</span> <span aria-hidden="true">↓</span></button>';
    }
    pintarCasos();
    UI.estadoGlobal();
  }
  function programar() {
    if (programado) return;
    programado = true;
    (window.requestAnimationFrame || window.setTimeout)(calcular);
  }

  /* ---------- Vista ---------- */
  function ajustesAbiertos() { return consulta ? consulta.matches : true; }

  function render() {
    if (avanzadoAbierto === null) avanzadoAbierto = avanzadasModificadas() > 0;
    if (UI.subpestana) { tab = UI.subpestana; UI.subpestana = null; }
    var esenciales = M.VARIABLES.filter(function (d) { return d.esencial; });
    var avanzadas = M.VARIABLES.filter(function (d) { return !d.esencial; });
    var h = '<header class="vista-cab"><div><h2>Simulador</h2><p>Elige una situación y mira qué arquitectura conviene.</p></div></header>';
    h += '<div id="aviso-vars">' + avisos() + '</div>';
    h += htmlCasos();
    h += '<div class="sim-layout">';
    h += '<details class="ajustes" id="ajustes"' + (ajustesAbiertos() ? ' open' : '') + '><summary><span>Ajustar valores</span><span class="sec-badge" id="ajustes-n"></span><span class="chev" aria-hidden="true"></span></summary>' +
      '<div class="ajustes-cuerpo">';
    h += esenciales.map(controlVar).join('');
    h += '<details class="bloque sec avanzado" data-avanzado' + (avanzadoAbierto ? ' open' : '') + '><summary><span class="sum-t"><h3>Ajustes avanzados</h3><span class="sum-d">' + avanzadas.length + ' variables más</span></span><span class="sec-badge" id="avanzado-n"></span><span class="chev" aria-hidden="true"></span></summary>' +
      '<div class="sec-cuerpo">' + avanzadas.map(controlVar).join('') + '</div></details>';
    h += '<button type="button" class="btn sec" data-act="vars-reset-todas">↺ Restablecer todo</button></div></details>';
    h += '<section class="res-col" id="res-col" aria-label="Resultado"><div id="res-hero"></div>' + htmlTabs() +
      '<div class="res-panel" id="res-panel" role="tabpanel" tabindex="-1" aria-labelledby="tab-' + tab + '"></div></section>';
    h += '</div>';
    h += '<div class="mini-res" id="mini-res" role="group" aria-label="Resumen por alternativa"></div>';
    return h;
  }

  function sincronizarAjustes() {
    var d = document.getElementById('ajustes');
    if (d && consulta) d.open = consulta.matches;
  }

  function despues() {
    prevTxt = null;
    M.VARIABLES.forEach(actualizarControl);
    calcular();
    if (consulta && consulta.addEventListener) consulta.addEventListener('change', sincronizarAjustes);
    vigilarRespuesta();
  }

  /* En pantallas pequeñas, la barra con los puntajes solo aparece cuando la respuesta queda fuera de la vista. */
  function vigilarRespuesta() {
    if (!window.IntersectionObserver) return;
    var hero = document.getElementById('res-hero'), mini = document.getElementById('mini-res');
    if (!hero || !mini) return;
    obs = new IntersectionObserver(function (en) {
      mini.classList.toggle('oculta', en[0].intersectionRatio >= 0.6);
    }, { threshold: 0.6 });
    obs.observe(hero);
  }

  function salir() {
    if (consulta && consulta.removeEventListener) consulta.removeEventListener('change', sincronizarAjustes);
    if (obs) { obs.disconnect(); obs = null; }
  }

  function aplicar(id, valor) {
    S.setVar(id, valor);
    UI.guardar();
    var d = M.defVar(id);
    actualizarControl(d);
    programar();
  }

  function onInput(ev) {
    var el = ev.target;
    var id;
    if ((id = el.getAttribute('data-var-r'))) {
      var v = Number(el.value);
      var d = M.defVar(id);
      // Evita residuos de coma flotante al arrastrar (0.0035000000000000005).
      v = Number(v.toFixed(d.paso < 1 ? 4 : 0));
      var n = app.querySelector('[data-var-n="' + id + '"]');
      if (n) n.value = String(v);
      el.style.setProperty('--p', pct(d, v) + '%');
      aplicar(id, v);
    } else if ((id = el.getAttribute('data-var-n'))) {
      var raw = el.value === '' ? null : Number(el.value);
      if (raw !== null && !isFinite(raw)) raw = null;
      aplicar(id, raw);
      var dd = M.defVar(id);
      var r = app.querySelector('[data-var-r="' + id + '"]');
      if (r && raw !== null && M.errorVar(dd, raw) === '') {
        r.value = String(Math.min(dd.deslizar[1], Math.max(dd.deslizar[0], raw)));
        r.style.setProperty('--p', pct(dd, raw) + '%');
      }
    } else if ((id = el.getAttribute('data-var-o'))) {
      aplicar(id, Number(el.value));
    }
  }

  function onChange(ev) {
    var el = ev.target;
    if (el.hasAttribute && el.hasAttribute('data-sens')) {
      UI.paneles.elegirVariable(el.value);
      calcular();
      var s = document.getElementById('f_sens');
      if (s) s.focus();
      return;
    }
    if (el.hasAttribute && el.hasAttribute('data-metrica')) {
      UI.paneles.elegirMetrica(el.value);
      calcular();
      var m = document.getElementById('f_metrica');
      if (m) m.focus();
      return;
    }
    onInput(ev);
  }

  function onFocusin(ev) {
    var t = ev.target;
    if (t.getAttribute && t.getAttribute('data-var-n') && t.select) t.select();
  }
  function onKeydown(ev) {
    var t = ev.target;
    if (ev.key === 'Enter' && t.getAttribute && t.getAttribute('data-var-n')) { ev.preventDefault(); t.blur(); return; }
    if (t.classList && t.classList.contains('subtab')) {
      var i = TABS.map(function (x) { return x.id; }).indexOf(t.getAttribute('data-tab'));
      var j = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? TABS.length - 1 : -1;
      if (j >= 0) { ev.preventDefault(); irATab(TABS[(j + TABS.length) % TABS.length].id, true); }
    }
  }

  function onFocusout(ev) {
    var id = ev.target.getAttribute && ev.target.getAttribute('data-var-n');
    if (!id) return;
    tocadas[id] = true;
    actualizarControl(M.defVar(id));
  }

  function restablecerVar(id) {
    var d = M.defVar(id);
    var antes = S.vars[id];
    S.setVar(id, d.ref);
    UI.guardar();
    refrescarControl(d);
    programar();
    UI.toast('«' + nombreVar(d) + '» vuelve a la referencia.', { texto: 'Deshacer', fn: function () { S.setVar(id, antes); UI.guardar(); refrescarControl(d); programar(); } });
  }

  function refrescarControl(d) {
    var box = app.querySelector('[data-var="' + d.id + '"]');
    if (!box) return;
    var val = S.vars[d.id];
    var n = box.querySelector('[data-var-n]');
    var r = box.querySelector('[data-var-r]');
    if (n) n.value = typeof val === 'number' ? String(val) : '';
    if (r) {
      var vr = typeof val === 'number' ? val : S.ultimaValida[d.id];
      r.value = String(Math.min(d.deslizar[1], Math.max(d.deslizar[0], vr)));
      r.style.setProperty('--p', pct(d, vr) + '%');
    }
    box.querySelectorAll('[data-var-o]').forEach(function (o) { o.checked = Number(o.value) === val; });
    actualizarControl(d);
  }

  function onClick(ev) {
    var b = ev.target.closest && ev.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'var-reset') restablecerVar(b.getAttribute('data-id'));
    else if (act === 'caso') aplicarCaso(b.getAttribute('data-caso'));
    else if (act === 'tab') irATab(b.getAttribute('data-tab'), false);
    else if (act === 'ver-res') {
      var col = document.getElementById('res-col');
      if (col) col.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else if (act === 'ir-esc') {
      var esc = M.escenario(b.getAttribute('data-esc'));
      if (!esc) return;
      var antes = cambiarVars(M.varsDeCaso(esc));
      UI.toast('Situación «' + esc.nombre + '» aplicada.', deshacer(antes));
    } else if (act === 'vars-reset-todas') {
      var ref = {};
      M.VARIABLES.forEach(function (d) { ref[d.id] = d.ref; });
      var copia = cambiarVars(ref);
      UI.toast('Se restablecieron todas las variables.', deshacer(copia));
    }
  }

  UI.vistas.simulador = {
    render: render,
    despues: despues,
    salir: salir,
    oninput: onInput,
    onchange: onChange,
    onfocusin: onFocusin,
    onkeydown: onKeydown,
    onfocusout: onFocusout,
    onclick: onClick,
    ontoggle: function (ev) {
      var d = ev.target;
      if (!d || !d.getAttribute) return;
      if (d.getAttribute('data-ind')) UI.paneles.recordarCalculo(d.getAttribute('data-ind'), d.open);
      else if (d.getAttribute('data-sec') === 'calculo') UI.paneles.recordarSeccion('calculo', d.open);
      else if (d.getAttribute('data-sec') === 'quiebre') UI.paneles.recordarSeccion('quiebre', d.open);
      else if (d.hasAttribute('data-avanzado')) avanzadoAbierto = d.open;
      else if (d.hasAttribute('data-riesgos')) {
        riesgosAbierto = d.open;
        var c = document.getElementById('riesgos-cuerpo');
        if (c) c.innerHTML = d.open ? (c.innerHTML || htmlRiesgos()) : '';
      }
    }
  };
})();
