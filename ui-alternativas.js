/* Vista Alternativas (requisito 2): comparación resumida primero, detalle plegable después.
   Los números que dependen de la carga (latencia, capacidad, costo con IA) no se muestran aquí:
   se calculan en el Simulador. Esta pantalla muestra los parámetros del diseño. */
(function () {
  'use strict';

  var UI = window.UI, S = window.Sim, D = window.DATOS, M = window.Modelo;
  var app = UI.app;
  var e = UI.e, num = UI.num, tag = UI.tag, lista = UI.lista;
  var sel = null;   // alternativa cuyo detalle se está viendo
  var PISTA = '<p class="pista">Elige una para ver su flujo, ventajas y riesgos.</p>';

  /* Chequeos que dependen solo del diseño (no de la carga). */
  function chequeosDiseno(alt, d) {
    var out = [];
    var disp = D.disponibilidad(alt, d);
    var rd = S.req('disp_min'), ra = S.req('disp_alta'), rc = S.req('costo'), rs = S.req('simplicidad');
    function add(rq, texto, ok) {
      if (!rq || typeof rq.meta !== 'number') return;
      out.push({ ok: ok, texto: texto, tipo: rq.tipo });
    }
    add(rd, 'Disponibilidad ≥ ' + num(rd && rd.meta, 1) + ' %', rd && disp >= rd.meta);
    add(ra, 'Disponibilidad ≥ ' + num(ra && ra.meta, 1) + ' %', ra && disp >= ra.meta);
    add(rc, 'Costo de infraestructura ≤ USD ' + num(rc && rc.meta, 2) + ' al mes', rc && alt.parametros.costoInfra.valor <= rc.meta);
    add(rs, 'Componentes que operar ≤ ' + (rs && rs.meta), rs && alt.parametros.componentes.valor <= rs.meta);
    return out;
  }

  function estadoDiseno(chq) {
    var falla = chq.filter(function (c) { return !c.ok && c.tipo === 'obligatorio'; });
    if (!chq.length) return UI.chip('neutro', 'Sin metas válidas');
    return falla.length
      ? UI.chip('malo', 'Incumple un obligatorio de diseño')
      : UI.chip('bueno', 'Cumple obligatorios de diseño');
  }

  function flujo(items) {
    return '<ol class="flujo">' + items.map(function (f, i) {
      return '<li><span class="n" aria-hidden="true">' + (i + 1) + '</span><span class="t">' + e(f) + '</span></li>';
    }).join('') + '</ol>';
  }

  function plegable(titulo, cuerpo, abierto) {
    return '<details class="sub"' + (abierto ? ' open' : '') + '><summary><span>' + e(titulo) + '</span><span class="chev" aria-hidden="true"></span></summary><div class="sub-cuerpo">' + cuerpo + '</div></details>';
  }

  /* Detalle de una alternativa: se muestra una a la vez, elegida con los botones de arriba. */
  function detalle(alt, d) {
    var p = alt.parametros;
    var disp = D.disponibilidad(alt, d);
    var h = '<article class="alt-det" id="alt-det" aria-labelledby="alt-' + alt.id + '"><header><span class="letra" aria-hidden="true">' + alt.id + '</span><div><h3 id="alt-' + alt.id + '">' + e(alt.nombre) + '</h3><p class="lema">' + e(alt.lema) + '</p></div></header>';
    h += '<section class="alt-sec"><h4>Cómo funciona</h4><p>' + e(alt.queEs) + '</p>' + flujo(alt.flujo) +
      '<p class="comps"><span class="comps-t">Componentes:</span> ' + alt.componentes.map(function (c) { return '<span class="comp">' + e(c) + '</span>'; }).join('') + '</p></section>';
    h += '<section class="alt-sec dos"><div><h4>Ventajas</h4>' + lista(alt.ventajas) + '</div><div><h4>Desventajas</h4>' + lista(alt.desventajas) + '</div></section>';
    h += '<section class="alt-sec"><h4>Qué falta verificar</h4><p>' + e(alt.riesgo) + '</p><p class="pista">Hipótesis a contrastar: ' + e(alt.hipotesis) + '</p></section>';
    h += plegable('Parámetros del modelo',
      '<dl class="params">' +
      '<div><dt>Componentes que operar</dt><dd>' + p.componentes.valor + ' ' + tag(p.componentes.base) + '</dd></div>' +
      '<div><dt>Componentes en serie</dt><dd>' + p.enSerie.valor + ' ' + tag(p.enSerie.base) + '</dd></div>' +
      '<div><dt>Llamadas entre componentes por petición pesada</dt><dd>' + p.saltos.valor + ' ' + tag(p.saltos.base) + '</dd></div>' +
      '<div><dt>Llamadas entre componentes por petición ligera</dt><dd>' + p.saltosLigeros.valor + ' ' + tag(p.saltosLigeros.base) + '</dd></div>' +
      '<div><dt>Acoplamiento entre generación y peticiones ligeras</dt><dd>' + num(p.acoplamiento.valor, 1) + ' ' + tag(p.acoplamiento.base) + '</dd></div>' +
      '<div><dt>Disponibilidad</dt><dd>' + num(disp, 2) + ' % (' + num(D.caidaHoras(alt, d), 1) + ' h de caída al mes) ' + tag('Supuesto') + '</dd></div>' +
      '<div><dt>Costo de infraestructura</dt><dd>USD ' + num(p.costoInfra.valor, 2) + ' al mes ' + tag(p.costoInfra.base) + '</dd></div>' +
      '<div><dt>Límite diario del plan gratuito</dt><dd>' + e(p.limite.texto) + ' ' + tag(p.limite.base) + '</dd></div>' +
      '</dl>', false);
    return h + '</article>';
  }

  function selector() {
    return '<div class="alt-sel" role="group" aria-label="Ver cómo funciona una alternativa">' + D.ALTERNATIVAS.map(function (a) {
      return '<button type="button" class="caso" data-act="alt" data-alt="' + a.id + '" aria-pressed="' + (sel === a.id ? 'true' : 'false') + '"><span class="letra-sm" aria-hidden="true">' + a.id + '</span> ' + e(a.nombre) + '</button>';
    }).join('') + '</div>';
  }

  function tablaResumen(d) {
    var A = D.ALTERNATIVAS;
    var filas = [
      { l: 'Componentes que operar', v: function (a) { return a.parametros.componentes.valor; }, mejor: 'menor', f: function (x) { return num(x, 0); } },
      { l: 'Disponibilidad (d = ' + num(d, 2) + ' %)', v: function (a) { return D.disponibilidad(a, d); }, mejor: 'mayor', f: function (x) { return num(x, 2) + ' %'; } },
      { l: 'Caída estimada al mes', v: function (a) { return D.caidaHoras(a, d); }, mejor: 'menor', f: function (x) { return num(x, 1) + ' h'; } },
      { l: 'Costo de infraestructura', v: function (a) { return a.parametros.costoInfra.valor; }, mejor: 'menor', f: function (x) { return 'USD ' + num(x, 2); } },
      { l: 'Límite diario del plan gratuito', t: function (a) { return a.parametros.limite.texto; } }
    ];
    var h = '<p class="pista hint-scroll">Desliza la tabla para ver las tres alternativas →</p><div class="tabla-scroll" tabindex="0" role="region" aria-labelledby="h-tabla"><table class="comparacion"><caption class="vh">Comparación de parámetros de diseño entre las tres alternativas</caption><thead><tr><th scope="col">Parámetro</th>' +
      A.map(function (a) { return '<th scope="col"><span class="letra-sm" aria-hidden="true">' + a.id + '</span> ' + e(a.nombre) + '</th>'; }).join('') + '</tr></thead><tbody>';
    filas.forEach(function (f) {
      h += '<tr><th scope="row">' + e(f.l) + '</th>';
      if (f.t) {
        h += A.map(function (a) { return '<td class="texto-largo">' + e(f.t(a)) + '</td>'; }).join('');
      } else {
        var vals = A.map(f.v);
        var best = f.mejor === 'mayor' ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
        var distintos = Math.max.apply(null, vals) !== Math.min.apply(null, vals);
        h += A.map(function (a, i) {
          var es = distintos && Math.abs(vals[i] - best) < 1e-9;
          return '<td class="' + (es ? 'mejor' : '') + '">' + e(f.f(vals[i])) + (es ? '<span class="vh"> (mejor)</span>' : '') + '</td>';
        }).join('');
      }
      h += '</tr>';
    });
    h += '<tr><th scope="row">Obligatorios de diseño</th>' + A.map(function (a) { return '<td>' + estadoDiseno(chequeosDiseno(a, d)) + '</td>'; }).join('') + '</tr>';
    h += '</tbody></table></div>';
    return h;
  }

  function pintarDetalle() {
    var cont = document.getElementById('alt-detalle');
    if (!cont) return;
    var alt = D.ALTERNATIVAS.filter(function (a) { return a.id === sel; })[0];
    cont.innerHTML = alt ? detalle(alt, S.varsEfectivas().d) : PISTA;
    app.querySelectorAll('[data-alt]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-alt') === sel ? 'true' : 'false'); });
  }

  function render() {
    var d = S.varsEfectivas().d;
    var alt = D.ALTERNATIVAS.filter(function (a) { return a.id === sel; })[0];
    var h = '<header class="vista-cab"><div><h2>Alternativas</h2>' +
      '<p>Tres formas de montar el backend, en las mismas condiciones.</p></div></header>';
    h += '<section class="bloque" aria-labelledby="h-tabla"><h3 id="h-tabla" class="vh">Comparación</h3>' + tablaResumen(d) + '</section>';
    h += '<section class="alt-explora" aria-labelledby="h-explora"><h3 id="h-explora">Cómo funciona cada una</h3>' + selector() +
      '<div id="alt-detalle">' + (alt ? detalle(alt, d) : PISTA) + '</div></section>';
    h += '<details class="sub comparables"><summary><span>Condiciones en las que se comparan</span><span class="chev" aria-hidden="true"></span></summary><div class="sub-cuerpo">' + lista(D.COMUNES) + '</div></details>';
    return h;
  }

  UI.vistas.alternativas = {
    render: render,
    onclick: function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-act="alt"]');
      if (!b) return;
      var id = b.getAttribute('data-alt');
      sel = sel === id ? null : id;
      pintarDetalle();
    }
  };
})();
