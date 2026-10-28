/* Gráficos del simulador: SVG dibujado a mano, sin librerías.
   Todos reciben resultados ya calculados por modelo.js y se vuelven a dibujar en cada render,
   así que cambian con las variables, los requisitos y los pesos. Los colores salen de los tokens
   del tema, por lo que funcionan igual en claro y en oscuro. Ninguno depende solo del color:
   cada figura lleva su valor o su etiqueta en texto. */
(function () {
  'use strict';

  var UI = window.UI, M = window.Modelo;
  var e = UI.e, num = UI.num;
  var COL = { A: 'var(--serie-a)', B: 'var(--serie-b)', C: 'var(--serie-c)' };

  function leyenda(alts, extra) {
    return '<ul class="g-leyenda">' + alts.map(function (a) {
      var id = a.alt ? a.alt.id : a.id;
      var nom = a.alt ? a.alt.nombre : a.nombre;
      var est = a.descartada ? ' <span class="g-desc">descartada</span>' : '';
      return '<li><span class="g-pt" style="background:' + COL[id] + '"></span><b>' + id + '</b> ' + e(nom) + est + '</li>';
    }).join('') + (extra || '') + '</ul>';
  }

  /* ---------- 1. Barras por indicador, con la meta marcada ----------
     Una fila por alternativa; la línea vertical es la meta del requisito. */
  UI.gBarrasInd = function (ind, alternativas, opciones) {
    opciones = opciones || {};
    var reqs = alternativas[0].reqs.filter(function (r) { return r.indicador === ind.id && r.evaluable; });
    var vals = alternativas.map(function (a) { return a.ind[ind.id].valor; }).filter(isFinite);
    if (!vals.length) return '';
    var metas = reqs.map(function (r) { return r.meta; });
    var lo = ind.eje ? ind.eje[0] : 0;
    var hi = Math.max.apply(null, vals.concat(metas)) * 1.15;
    if (ind.eje) hi = Math.max(ind.eje[1], Math.max.apply(null, vals));
    if (!isFinite(hi) || hi <= lo) hi = lo + 1;
    function px(x) { return 4 + Math.max(0, Math.min(1, (x - lo) / (hi - lo))) * 92; }
    var filas = alternativas.map(function (a) {
      var v = a.ind[ind.id].valor;
      var rq = a.reqs.filter(function (r) { return r.indicador === ind.id && r.evaluable; });
      var mal = rq.some(function (r) { return !r.cumple; });
      var ob = rq.some(function (r) { return !r.cumple && r.tipo === 'obligatorio'; });
      var w = isFinite(v) ? px(v) - 4 : 92;
      return '<div class="gb-fila"><span class="gb-id" style="background:' + COL[a.alt.id] + '">' + a.alt.id + '</span>' +
        '<span class="gb-pista" role="img" aria-label="' + e(a.alt.id + ': ' + num(v, ind.dec) + ' ' + ind.unidad + (rq.length ? (mal ? ', no cumple' : ', cumple') : '')) + '">' +
        '<span class="gb-rell' + (ob ? ' mal' : (mal ? ' tibio' : '')) + '" style="width:' + w.toFixed(1) + '%;background:' + (ob ? 'var(--bad)' : COL[a.alt.id]) + '"></span>' +
        metas.map(function (m, k) {
          return '<i class="gb-meta ' + (reqs[k].tipo) + '" style="left:' + px(m).toFixed(1) + '%" title="' + e(reqs[k].corto + ': ' + num(m, ind.dec)) + '"></i>';
        }).join('') + '</span>' +
        '<span class="gb-val">' + e(UI.fmtInd(ind, v)) + '</span></div>';
    }).join('');
    var pieMeta = reqs.length
      ? reqs.map(function (r) { return '<span class="gb-ref"><i class="gb-meta ' + r.tipo + '"></i> ' + e(r.corto) + ' ' + UI.simboloOp(r.op) + ' ' + e(UI.fmtMeta(ind, r.meta)) + '</span>'; }).join('')
      : '<span class="sin-meta">sin requisito asociado</span>';
    return '<div class="gb"><div class="gb-cab"><h5>' + e(ind.nombre) + '</h5><span class="gb-sentido">' +
      (ind.mejor === 'mayor' ? 'más alto, mejor' : 'más bajo, mejor') + '</span></div>' + filas +
      '<div class="gb-pie">' + pieMeta + '</div></div>';
  };

  /* ---------- 2. Curva de sensibilidad ----------
     Mueve una variable por todo su rango y dibuja el puntaje de cada alternativa.
     Las franjas verticales marcan dónde cambia quién lidera. */
  UI.gCurva = function (bar, opciones) {
    if (!bar) return '';
    opciones = opciones || {};
    var W = 620, H = 220, izq = 36, der = 12, top = 16, abajo = 44;
    var gw = W - izq - der, gh = H - top - abajo;
    function x(v) { return izq + ((v - bar.lo) / (bar.hi - bar.lo || 1)) * gw; }
    function y(p) { return top + gh - (p / 100) * gh; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="g-svg g-curva" role="img" aria-label="' +
      e('Puntaje de cada alternativa al variar ' + bar.def.nombre + ' entre ' + M.limpio(bar.lo, 2) + ' y ' + M.limpio(bar.hi, 2) + ' ' + bar.def.unidad +
        (bar.cortes.length ? '. Cambia quién lidera en ' + bar.cortes.map(function (c) { return M.limpio(c.x, 2); }).join(' y ') : '. No cambia quién lidera en todo el rango')) + '">';
    /* Tramos donde no hay ninguna alternativa viable */
    var tramo = null;
    bar.puntos.forEach(function (p, i) {
      var vacio = !p.lider;
      if (vacio && !tramo) tramo = p.x;
      if ((!vacio || i === bar.puntos.length - 1) && tramo != null) {
        var fin = vacio ? p.x : bar.puntos[i - 1].x;
        s += '<rect x="' + x(tramo).toFixed(1) + '" y="' + top + '" width="' + Math.max(1, x(fin) - x(tramo)).toFixed(1) + '" height="' + gh + '" fill="var(--bad)" fill-opacity=".07"/>';
        tramo = null;
      }
    });
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += '<line x1="' + izq + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - der) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)"/>' +
        '<text x="' + (izq - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--muted)">' + v + '</text>';
    });
    /* Una línea por alternativa; los tramos descartados no se dibujan. */
    window.DATOS.ALTERNATIVAS.forEach(function (alt) {
      var seg = [], actual = [];
      bar.puntos.forEach(function (p) {
        var d = p.alts[alt.id];
        if (d && d.puntaje != null) actual.push(x(p.x).toFixed(1) + ',' + y(d.puntaje).toFixed(1));
        else if (actual.length) { seg.push(actual); actual = []; }
      });
      if (actual.length) seg.push(actual);
      seg.forEach(function (g) {
        if (g.length === 1) s += '<circle cx="' + g[0].split(',')[0] + '" cy="' + g[0].split(',')[1] + '" r="2.5" fill="' + COL[alt.id] + '"/>';
        else s += '<polyline points="' + g.join(' ') + '" fill="none" stroke="' + COL[alt.id] + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      });
    });
    /* Cortes: donde cambia quién lidera */
    bar.cortes.forEach(function (c) {
      s += '<line x1="' + x(c.x).toFixed(1) + '" y1="' + top + '" x2="' + x(c.x).toFixed(1) + '" y2="' + (top + gh) + '" stroke="var(--warm-ink)" stroke-width="1.5" stroke-dasharray="4 3"/>';
      s += '<text x="' + x(c.x).toFixed(1) + '" y="' + (top - 4) + '" text-anchor="middle" font-size="9" font-weight="700" fill="var(--warm-ink)">' + e(M.limpio(c.x, bar.def.paso < 1 ? 2 : 0)) + '</text>';
    });
    /* Valor que el usuario tiene puesto ahora */
    s += '<line x1="' + x(bar.actual).toFixed(1) + '" y1="' + (top - 2) + '" x2="' + x(bar.actual).toFixed(1) + '" y2="' + (top + gh + 6) + '" stroke="var(--ink)" stroke-width="2"/>';
    s += '<circle cx="' + x(bar.actual).toFixed(1) + '" cy="' + (top + gh + 10) + '" r="3.5" fill="var(--ink)"/>';
    s += '<text x="' + x(bar.actual).toFixed(1) + '" y="' + (top + gh + 26) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--ink)">ahora: ' + e(M.limpio(bar.actual, bar.def.paso < 1 ? 2 : 0)) + '</text>';
    /* Eje horizontal */
    [bar.lo, (bar.lo + bar.hi) / 2, bar.hi].forEach(function (v, i) {
      s += '<text x="' + x(v).toFixed(1) + '" y="' + (top + gh + 14) + '" text-anchor="' + (i === 0 ? 'start' : i === 2 ? 'end' : 'middle') + '" font-size="9" fill="var(--muted)">' + e(M.limpio(v, bar.def.paso < 1 ? 2 : 0)) + '</text>';
    });
    s += '<text x="' + (W - der) + '" y="' + (H - 4) + '" text-anchor="end" font-size="9.5" fill="var(--muted)">' + e(bar.def.nombre + (bar.def.unidad ? ' (' + bar.def.unidad + ')' : '')) + '</text>';
    s += '</svg>';
    return s;
  };

  /* ---------- 3. Medidor de puntaje ---------- */
  UI.gDial = function (puntaje, id, descartada) {
    var R = 30, cx = 36, cy = 36, circ = 2 * Math.PI * R;
    var frac = descartada || puntaje == null ? 0 : Math.max(0, Math.min(1, puntaje / 100));
    var s = '<svg viewBox="0 0 72 72" class="g-dial" role="img" aria-label="' +
      (descartada ? 'Alternativa ' + id + ' descartada' : 'Puntaje de ' + id + ': ' + num(puntaje, 1) + ' de 100') + '">';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="7"/>';
    if (!descartada && puntaje != null) {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' + COL[id] + '" stroke-width="7" stroke-linecap="round" ' +
        'stroke-dasharray="' + (circ * frac).toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      s += '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-size="18" font-weight="700" fill="var(--ink)">' + num(puntaje, 0) + '</text>';
    } else {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--bad)" stroke-width="7" stroke-dasharray="5 5" stroke-opacity=".5"/>';
      s += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="10" font-weight="700" fill="var(--bad)">fuera</text>';
    }
    return s + '</svg>';
  };

  UI.gLeyenda = leyenda;
  UI.gCOL = COL;
})();
