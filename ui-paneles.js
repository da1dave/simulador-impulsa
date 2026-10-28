/* Paneles del Simulador: lo que se ve bajo la respuesta, uno por subpestaña.
   Cada panel recibe { cur, ref, vars } (resultados ya calculados por el modelo) y devuelve HTML.
   Por qué → requisitos × alternativa.  Escenarios → los siete escenarios, con el puntaje o con cualquier indicador.
   ¿Y si…? → curva de sensibilidad y puntos de quiebre.  Indicadores → las ocho barras y su cálculo.
   Todo sale de modelo.js: aquí no hay ningún resultado escrito a mano. */
(function () {
  'use strict';

  var UI = window.UI, S = window.Sim, D = window.DATOS, M = window.Modelo;
  var e = UI.e, num = UI.num;

  var varSens = 'd';       // variable que mueve la curva de sensibilidad
  var metrica = 'puntaje'; // qué muestra la tabla de escenarios
  var calcAbiertos = {};   // indicadores con el cálculo desplegado
  var seccion = {};        // secciones plegables recordadas entre cálculos

  function vc(ind, v) { return UI.fmtInd(ind, v); }
  function vcMeta(ind, v) { return UI.fmtMeta(ind, v); }
  function simbolo(op) { return UI.simboloOp(op); }

  /* ---------- Por qué: matriz requisito × alternativa ---------- */
  function porque(ctx) {
    var cur = ctx.cur;
    var base = cur.alternativas[0].reqs.map(function (r, i) { return { i: i, r: r }; }).filter(function (x) { return x.r.evaluable; });
    if (!base.length) return '<p class="nota">Ningún requisito tiene una meta válida. Corrígelas en <a href="#configuracion">Configuración</a>.</p>';
    base.sort(function (a, b) { return (a.r.tipo === b.r.tipo ? 0 : a.r.tipo === 'obligatorio' ? -1 : 1) || a.i - b.i; });
    var lider = cur.ranking.length > 1 ? cur.ranking[0] : null;
    var h = '<div class="tabla-scroll" tabindex="0" role="region" aria-label="Requisitos por alternativa"><table class="matriz"><thead><tr><th scope="col">Requisito y meta</th>' +
      cur.alternativas.map(function (a) {
        return '<th scope="col"><span class="letra-sm" aria-hidden="true">' + a.alt.id + '</span><span class="vh">Alternativa </span><span class="nm">' + e(a.alt.nombre) + '</span>' + (lider === a.alt.id && !a.descartada ? '<span class="lid">Lidera</span>' : '') + '</th>';
      }).join('') + '</tr></thead><tbody>';
    base.forEach(function (x) {
      var r0 = x.r;
      var ind = M.indicador(r0.indicador);
      h += '<tr><th scope="row"><span class="rq">' + e(r0.corto) + '</span><span class="rq-m">' + simbolo(r0.op) + ' ' + e(vcMeta(ind, r0.meta)) + ' · <span class="tp ' + r0.tipo + '">' + e(r0.tipo) + '</span></span></th>';
      cur.alternativas.forEach(function (a) {
        var r = a.reqs[x.i];
        var cl = r.cumple ? 'si' : (r.tipo === 'obligatorio' ? 'no ob' : 'no de');
        h += '<td class="cel ' + cl + '" data-k="m_' + r0.id + '_' + a.alt.id + '"><span class="val">' + e(vc(ind, r.valor)) + '</span><span class="est">' + (r.cumple ? 'Cumple' : 'No cumple') + '</span></td>';
      });
      h += '</tr>';
    });
    h += '</tbody><tfoot><tr><th scope="row">Resultado</th>' + cur.alternativas.map(function (a) {
      return '<td>' + (a.descartada ? UI.chip('malo', 'Descartada') : UI.chip('bueno', 'Viable')) + '</td>';
    }).join('') + '</tr></tfoot></table></div>';
    return h + '<p class="pista">Un requisito obligatorio que no se cumple descarta la alternativa; uno deseable solo resta puntaje.</p>';
  }

  /* ---------- Escenarios: siete situaciones × tres alternativas ---------- */
  function celdaEscenario(a, lider) {
    if (metrica === 'puntaje') {
      if (a.descartada) return { cl: 'no ob', val: 'Descartada', est: '' };
      return { cl: 'si' + (lider ? ' lidera' : ''), val: num(a.puntaje, 1), est: lider ? 'Lidera' : '' };
    }
    var ind = M.indicador(metrica);
    var rq = a.reqs.filter(function (r) { return r.indicador === metrica && r.evaluable; });
    var mal = rq.some(function (r) { return !r.cumple; });
    var ob = rq.some(function (r) { return !r.cumple && r.tipo === 'obligatorio'; });
    return { cl: rq.length ? (mal ? (ob ? 'no ob' : 'no de') : 'si') : '', val: vc(ind, a.ind[metrica].valor), est: rq.length ? (mal ? 'No cumple' : 'Cumple') : '' };
  }

  function escenarios() {
    var evals = M.evaluarEscenarios(S.cfg, S.pesos);
    var activo = UI.casoActivo ? UI.casoActivo() : null;
    var ind = metrica === 'puntaje' ? null : M.indicador(metrica);
    var h = '<div class="esc-ctl"><label for="f_metrica">Mostrar</label><select id="f_metrica" data-metrica>' +
      '<option value="puntaje"' + (metrica === 'puntaje' ? ' selected' : '') + '>Puntaje</option>' +
      M.INDICADORES.map(function (i) { return '<option value="' + i.id + '"' + (i.id === metrica ? ' selected' : '') + '>' + e(i.nombre) + '</option>'; }).join('') +
      '</select></div>';
    if (ind) {
      var reqs = evals[0].res.alternativas[0].reqs.filter(function (r) { return r.indicador === metrica && r.evaluable; });
      h += '<p class="pista">' + (reqs.length
        ? 'Meta: ' + reqs.map(function (r) { return simbolo(r.op) + ' ' + e(vcMeta(ind, r.meta)) + ' (' + e(r.tipo) + ')'; }).join(' · ')
        : 'Este indicador no tiene un requisito asociado: se muestra sin juicio.') + '</p>';
    }
    h += '<div class="tabla-scroll" tabindex="0" role="region" aria-label="' + (ind ? e(ind.nombre) : 'Puntaje') + ' de cada alternativa en cada escenario"><table class="matriz t-esc"><thead><tr><th scope="col">Escenario</th>' +
      D.ALTERNATIVAS.map(function (a) { return '<th scope="col"><span class="letra-sm" aria-hidden="true">' + a.id + '</span><span class="vh">Alternativa </span><span class="nm">' + e(a.nombre) + '</span></th>'; }).join('') + '</tr></thead><tbody>';
    evals.forEach(function (ev) {
      var lider = ev.res.ranking.length > 1 ? ev.res.ranking[0] : null;
      var es = activo && activo.id === ev.esc.id;
      h += '<tr' + (es ? ' class="actual"' : '') + '><th scope="row"><button type="button" class="esc-fila" data-act="ir-esc" data-esc="' + ev.esc.id + '"' + (es ? ' aria-current="true"' : '') + ' title="' + e(ev.esc.pregunta) + '">' + e(ev.esc.nombre) + (es ? '<span class="vh"> (el que tienes puesto)</span>' : '') + '</button></th>';
      ev.res.alternativas.forEach(function (a) {
        var c = celdaEscenario(a, lider === a.alt.id);
        var motivo = a.descartada ? 'Descartada por: ' + a.incumple.map(function (r) { return r.corto; }).join(', ') : '';
        h += '<td class="cel ' + c.cl + '"' + (motivo ? ' title="' + e(motivo) + '"' : '') + '><span class="val">' + e(c.val) + '</span>' + (c.est ? '<span class="est">' + c.est + '</span>' : '') + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody><tfoot><tr><th scope="row">Viable en</th>' + D.ALTERNATIVAS.map(function (alt, j) {
      var n = evals.filter(function (ev) { return !ev.res.alternativas[j].descartada; }).length;
      return '<td><b>' + n + '</b> de ' + evals.length + '</td>';
    }).join('') + '</tr></tfoot></table></div>';
    return h + '<p class="pista">Toca un escenario para cargarlo en el simulador.</p>';
  }

  /* ---------- ¿Y si…?: sensibilidad y puntos de quiebre ---------- */
  function sensibilidad(ctx) {
    var elegibles = M.VARIABLES.filter(function (v) { return v.tipo !== 'opcion'; });
    var bar = M.barrido(S.cfg, ctx.vars, S.pesos, varSens, 44);
    var h = '<div class="sens-cab"><p class="sens-t">¿Qué pasa si cambia…?</p>' +
      '<div class="sens-sel"><label for="f_sens" class="vh">Variable que se mueve</label><select id="f_sens" data-sens>' +
      elegibles.map(function (v) { return '<option value="' + v.id + '"' + (v.id === varSens ? ' selected' : '') + '>' + e(v.nombre) + '</option>'; }).join('') +
      '</select></div></div>';
    h += UI.gCurva(bar) + UI.gLeyenda(D.ALTERNATIVAS.map(function (a) { return { id: a.id, nombre: a.nombre }; }));
    h += '<div class="sens-lec">';
    if (!bar) h += '<p class="nota">Esta variable no se puede barrer.</p>';
    else if (!bar.cortes.length) h += UI.chip('neutro', 'En todo el rango no cambia quién lidera');
    else {
      h += bar.cortes.map(function (c) {
        var punto = M.limpio(c.x, bar.def.paso < 1 ? 2 : 0) + (bar.def.unidad ? ' ' + bar.def.unidad : '');
        var txt = c.desde && c.hasta
          ? 'En ' + punto + ' el liderazgo pasa de ' + c.desde + ' a ' + c.hasta
          : (c.hasta ? 'Desde ' + punto + ' ya hay una alternativa viable: ' + c.hasta
                     : 'En ' + punto + ' deja de haber alternativas viables');
        return '<span class="corte">' + e(txt) + '</span>';
      }).join('');
    }
    h += '</div><p class="pista">La línea negra es el valor que tienes puesto. Las franjas rojas son tramos sin ninguna alternativa viable.</p>';
    var rec = M.recomendar(S.cfg, ctx.vars, S.pesos);
    if (rec.condiciones.length) {
      h += '<details class="sub" data-sec="quiebre"' + (seccion.quiebre ? ' open' : '') + '><summary><span>Puntos de quiebre de la recomendación (' + rec.condiciones.length + ')</span><span class="chev" aria-hidden="true"></span></summary>' +
        '<div class="sub-cuerpo"><ul>' + rec.condiciones.map(function (c) { return '<li>' + e(c.texto) + '</li>'; }).join('') + '</ul></div></details>';
    }
    return h;
  }

  /* ---------- Indicadores: las ocho barras y cómo se calcula cada una ---------- */
  function calculoInd(ind, cur) {
    var vars = M.VARIABLES.filter(function (d) { return d.ind.indexOf(ind.id) >= 0; }).map(function (d) { return '<li>' + e(d.nombre) + '</li>'; }).join('');
    return '<details class="calc" data-ind="' + ind.id + '"' + (calcAbiertos[ind.id] ? ' open' : '') + '><summary><span>' + e(ind.nombre) + '</span><span class="chev" aria-hidden="true"></span></summary><div class="sub-cuerpo">' +
      '<p class="formula"><code>' + e(ind.formula) + '</code></p><p>' + e(ind.explica) + '</p>' +
      (vars ? '<p class="rel-t">Variables que lo mueven</p><ul class="chips-l">' + vars + '</ul>' : '') +
      '<p class="rel-t">Con tus valores actuales</p><ul class="sust-l">' + cur.alternativas.map(function (a) {
        return '<li><span class="letra-sm" aria-hidden="true">' + a.alt.id + '</span><span>' + e(a.ind[ind.id].sust) + '</span></li>';
      }).join('') + '</ul></div></details>';
  }

  function indicadores(ctx) {
    var h = '<div class="gb-grid">' + M.INDICADORES.map(function (ind) { return UI.gBarrasInd(ind, ctx.cur.alternativas); }).join('') + '</div>';
    h += '<details class="sub" data-sec="calculo"' + (seccion.calculo ? ' open' : '') + '><summary><span>Cómo se calcula cada indicador</span><span class="chev" aria-hidden="true"></span></summary>' +
      '<div class="sub-cuerpo">' + M.INDICADORES.map(function (i) { return calculoInd(i, ctx.cur); }).join('') + '</div></details>';
    return h;
  }

  UI.paneles = {
    porque: porque,
    escenarios: escenarios,
    sensibilidad: sensibilidad,
    indicadores: indicadores,
    elegirVariable: function (id) { varSens = id; },
    elegirMetrica: function (id) { metrica = id; },
    recordarCalculo: function (id, abierto) { calcAbiertos[id] = abierto; },
    recordarSeccion: function (id, abierto) { seccion[id] = abierto; }
  };
})();
