/* Vista Configuración (requisito 1): características, usuarios, requisitos de calidad y restricciones.
   Cada bloque es un <details> que se vuelve a dibujar por separado al agregar o quitar filas,
   así no se pierde el foco ni el scroll. Los errores se muestran solo después de tocar el campo
   o de pedir "ver errores". */
(function () {
  'use strict';

  var UI = window.UI, S = window.Sim;
  var e = UI.e, eid = UI.eid, tag = UI.tag;
  var app = UI.app;

  var tocados = {};
  var mostrarTodos = false;
  var confirmando = false;
  var abiertos = null;

  var SECCIONES = [
    { id: 'req', prop: 'requisitos', titulo: 'Requisitos de calidad' },
    { id: 'car', prop: null, titulo: 'Características del proyecto' },
    { id: 'usr', prop: 'usuarios', titulo: 'Usuarios previstos' },
    { id: 'res', prop: 'restricciones', titulo: 'Restricciones' }
  ];

  /* ---------- Controles ---------- */
  function select(path, opciones, valor, etiqueta) {
    var o = opciones.map(function (op) {
      var v = Array.isArray(op) ? op[0] : op, t = Array.isArray(op) ? op[1] : op;
      return '<option value="' + e(v) + '"' + (v === valor ? ' selected' : '') + '>' + e(t) + '</option>';
    }).join('');
    return '<select id="' + eid(path) + '" data-path="' + e(path) + '" aria-label="' + e(etiqueta) + '">' + o + '</select>';
  }
  function texto(path, valor, etiqueta) {
    return '<input type="text" id="' + eid(path) + '" data-path="' + e(path) + '" value="' + e(valor) + '" aria-label="' + e(etiqueta) + '" aria-describedby="e_' + eid(path) + '">';
  }
  function area(path, valor, etiqueta, filas) {
    return '<textarea id="' + eid(path) + '" data-path="' + e(path) + '" rows="' + (filas || 2) + '" aria-label="' + e(etiqueta) + '" aria-describedby="e_' + eid(path) + '">' + e(valor) + '</textarea>';
  }
  function err(path) {
    return '<p class="err" id="e_' + eid(path) + '" data-err-for="' + e(path) + '"></p>';
  }
  function rotulo(path, t) { return '<label class="rotulo" for="' + eid(path) + '">' + e(t) + '</label>'; }
  function etq(path, t) { return '<label class="etq" for="' + eid(path) + '">' + e(t) + '</label>'; }

  function seg(path, valor, etiqueta) {
    return '<div class="seg" role="radiogroup" aria-label="' + e(etiqueta) + '">' + S.TIPOS.map(function (t) {
      return '<label class="seg-op"><input type="radio" name="' + eid(path) + '" id="' + eid(path) + '_' + t[0] + '" data-path="' + e(path) + '" value="' + t[0] + '"' + (valor === t[0] ? ' checked' : '') + '><span>' + t[1] + '</span></label>';
    }).join('') + '</div>';
  }

  /* ---------- Bloques ---------- */
  function resumenSec(id, titulo, detalle) {
    return '<summary><span class="sum-t"><h3 id="h-' + id + '">' + e(titulo) + '</h3><span class="sum-d">' + e(detalle) + '</span></span>' +
      '<span class="sec-badge" data-badge="' + id + '"></span><span class="chev" aria-hidden="true"></span></summary>';
  }

  function interiorCar() {
    var car = S.cfg.caracteristicas;
    var h = resumenSec('car', 'Características del proyecto', (car.nombre || 'Sin nombre') + ' · ' + (car.etapa || 'sin etapa'));
    h += '<div class="sec-cuerpo"><div class="campos">';
    h += '<div class="campo">' + etq('car.nombre', 'Nombre') + texto('car.nombre', car.nombre, 'Nombre del proyecto') + err('car.nombre') + '</div>';
    h += '<div class="campo">' + etq('car.etapa', 'Etapa') + texto('car.etapa', car.etapa, 'Etapa') + err('car.etapa') + '</div>';
    h += '<div class="campo ancho">' + etq('car.descripcion', 'Descripción') + area('car.descripcion', car.descripcion, 'Descripción', 3) + err('car.descripcion') + '</div>';
    h += '<div class="campo">' + etq('car.funciones', 'Funciones a soportar') + '<textarea id="' + eid('car.funciones') + '" data-path="car.funciones" rows="5" aria-describedby="e_' + eid('car.funciones') + ' h_fun">' + e(car.funciones) + '</textarea><p class="pista" id="h_fun">Una por línea.</p>' + err('car.funciones') + '</div>';
    h += '<div class="campo">' + etq('car.fuera', 'Fuera de alcance') + '<textarea id="' + eid('car.fuera') + '" data-path="car.fuera" rows="5">' + e(car.fuera) + '</textarea></div>';
    h += '</div></div>';
    return h;
  }

  function interiorUsr() {
    var c = S.cfg;
    var h = resumenSec('usr', 'Usuarios previstos', c.usuarios.length + (c.usuarios.length === 1 ? ' tipo de usuario' : ' tipos de usuario'));
    h += '<div class="sec-cuerpo"><div class="filas">';
    h += '<div class="fila cab g-usr" aria-hidden="true"><span>Usuario</span><span>Descripción</span><span>Tipo de petición</span><span></span></div>';
    c.usuarios.forEach(function (u) {
      var p = 'usr.' + u.id + '.';
      h += '<div class="fila g-usr" role="group" aria-label="Usuario ' + e(u.nombre) + '">' +
        '<div class="celda">' + rotulo(p + 'nombre', 'Usuario') + texto(p + 'nombre', u.nombre, 'Nombre del usuario') + err(p + 'nombre') + '</div>' +
        '<div class="celda">' + rotulo(p + 'descripcion', 'Descripción') + area(p + 'descripcion', u.descripcion, 'Descripción del usuario') + err(p + 'descripcion') + '</div>' +
        '<div class="celda">' + rotulo(p + 'peticion', 'Tipo de petición') + select(p + 'peticion', S.PETICIONES, u.peticion, 'Tipo de petición') + '</div>' +
        '<div class="celda acc"><button type="button" class="icono" data-act="del-usr" data-id="' + e(u.id) + '" aria-label="Quitar usuario ' + e(u.nombre || 'sin nombre') + '"><span aria-hidden="true">×</span></button></div></div>';
    });
    h += '</div>' + err('usr') + '<button type="button" class="btn sec" data-act="add-usr">+ Agregar usuario</button></div>';
    return h;
  }

  /* Una fila por requisito: nombre, meta y tipo. Lo secundario (explicación y base del dato) va detrás del ⓘ. */
  function masReq(p, ayuda, base, nombre) {
    return '<details class="mas req-mas"><summary><span aria-hidden="true">ⓘ</span><span class="vh">Más sobre ' + e(nombre) + '</span></summary><div class="mas-cuerpo">' +
      (ayuda ? '<p>' + e(ayuda) + '</p>' : '') +
      '<div class="req-base">' + etq(p + 'base', 'Base del dato') + select(p + 'base', S.BASES, base, 'Base de ' + nombre) + '</div></div></details>';
  }

  function filaReq(r) {
    var p = 'req.' + r.id + '.';
    var d = S.def(r.id);
    if (r.nucleo && d) {
      return '<div class="req-fila" role="group" aria-label="' + e(r.nombre) + '">' +
        '<span class="nom">' + e(r.nombre) + '</span>' +
        '<div class="req-meta"><div class="meta-in"><input type="number" inputmode="decimal" id="' + eid(p + 'meta') + '" data-path="' + e(p + 'meta') + '" step="' + d.paso + '" min="' + d.min + '" max="' + d.max + '" value="' + (r.meta === null || r.meta === undefined ? '' : e(r.meta)) + '" aria-label="Meta de ' + e(r.nombre) + '" aria-describedby="e_' + eid(p + 'meta') + '"><span class="unidad">' + e(d.unidad) + '</span></div>' + err(p + 'meta') + '</div>' +
        '<fieldset class="seg-f"><legend class="vh">Tipo de ' + e(r.nombre) + '</legend>' + seg(p + 'tipo', r.tipo, 'Tipo de ' + r.nombre) + '</fieldset>' +
        masReq(p, d.ayuda, r.base, r.nombre) + '</div>';
    }
    return '<div class="req-fila libre" role="group" aria-label="Requisito informativo ' + e(r.nombre) + '">' +
      '<div class="req-meta">' + texto(p + 'nombre', r.nombre, 'Nombre del requisito') + err(p + 'nombre') + '</div>' +
      '<div class="req-meta">' + texto(p + 'metaTexto', r.metaTexto, 'Meta del requisito') + err(p + 'metaTexto') + '</div>' +
      '<fieldset class="seg-f"><legend class="vh">Tipo del requisito</legend>' + seg(p + 'tipo', r.tipo, 'Tipo del requisito') + '</fieldset>' +
      '<div class="req-base">' + select(p + 'base', S.BASES, r.base, 'Base del requisito') + '</div>' +
      '<button type="button" class="icono" data-act="del-req" data-id="' + e(r.id) + '" aria-label="Quitar requisito ' + e(r.nombre || 'sin nombre') + '"><span aria-hidden="true">×</span></button></div>';
  }

  function interiorReq() {
    var c = S.cfg;
    var ob = c.requisitos.filter(function (r) { return r.tipo === 'obligatorio'; }).length;
    var h = resumenSec('req', 'Requisitos de calidad', ob + (ob === 1 ? ' obligatorio' : ' obligatorios') + ' · ' + (c.requisitos.length - ob) + (c.requisitos.length - ob === 1 ? ' deseable' : ' deseables'));
    h += '<div class="sec-cuerpo"><p class="nota">Obligatorio: descarta si no se cumple. Deseable: suma puntaje.</p>';
    h += '<div class="req-lista">' + c.requisitos.map(filaReq).join('') + '</div>';
    h += err('req') + '<button type="button" class="btn sec" data-act="add-req">+ Agregar requisito informativo</button></div>';
    return h;
  }

  function interiorRes() {
    var c = S.cfg;
    var h = resumenSec('res', 'Restricciones', c.restricciones.length + (c.restricciones.length === 1 ? ' restricción' : ' restricciones'));
    h += '<div class="sec-cuerpo"><div class="filas"><div class="fila cab g-res" aria-hidden="true"><span>Restricción</span><span>Valor</span><span>Base</span><span></span></div>';
    c.restricciones.forEach(function (r) {
      var p = 'res.' + r.id + '.';
      h += '<div class="fila g-res" role="group" aria-label="Restricción ' + e(r.nombre) + '">' +
        '<div class="celda">' + rotulo(p + 'nombre', 'Restricción') + texto(p + 'nombre', r.nombre, 'Nombre de la restricción') + err(p + 'nombre') + '</div>' +
        '<div class="celda">' + rotulo(p + 'valor', 'Valor') + area(p + 'valor', r.valor, 'Valor de la restricción') + err(p + 'valor') + '</div>' +
        '<div class="celda">' + rotulo(p + 'base', 'Base') + select(p + 'base', S.BASES, r.base, 'Base de la restricción') + '</div>' +
        '<div class="celda acc"><button type="button" class="icono" data-act="del-res" data-id="' + e(r.id) + '" aria-label="Quitar restricción ' + e(r.nombre || 'sin nombre') + '"><span aria-hidden="true">×</span></button></div></div>';
    });
    h += '</div>' + err('res') + '<button type="button" class="btn sec" data-act="add-res">+ Agregar restricción</button></div>';
    return h;
  }

  var INTERIOR = { car: interiorCar, usr: interiorUsr, req: interiorReq, res: interiorRes };

  function pieReset() {
    if (confirmando) {
      return '<span class="conf">Se borrarán tus cambios y volverán los valores por defecto.</span> <button type="button" class="btn peligro" data-act="reset-si">Sí, restablecer</button> <button type="button" class="btn sec" data-act="reset-no">Cancelar</button>';
    }
    return '<button type="button" class="btn sec" data-act="exportar">Exportar (.json)</button>' +
      '<button type="button" class="btn sec" data-act="importar">Importar…</button>' +
      '<input type="file" id="archivo-imp" accept="application/json,.json" hidden>' +
      '<button type="button" class="btn sec" data-act="reset">Restablecer valores por defecto</button>';
  }

  function render() {
    if (abiertos === null) {
      abiertos = {};
      SECCIONES.forEach(function (s) { abiertos[s.id] = s.id === 'req'; });
    }
    var h = '<header class="vista-cab"><div><h2>Configuración</h2><p>Fija las metas que debe cumplir el proyecto. Lo demás es contexto.</p></div></header>';
    h += '<form id="cfg" novalidate>';
    SECCIONES.forEach(function (s) {
      h += '<details class="bloque sec" data-sec="' + s.id + '"' + (abiertos[s.id] ? ' open' : '') + '>' + INTERIOR[s.id]() + '</details>';
    });
    h += '</form>';
    h += '<div class="pie-datos"><p class="nota">Se guarda solo en este navegador. Exporta un archivo para respaldarlo.</p><div class="pie-acciones" id="pie">' + pieReset() + '</div></div>';
    h += '<details class="leyenda-d"><summary>¿Qué significan las etiquetas?</summary><div class="leyenda-base">' + tag('Proyecto') + ' del proyecto ' + tag('Verificado') + ' en página oficial ' + tag('Tercero') + ' fuente no oficial ' + tag('Supuesto') + ' del equipo, por medir</div></details>';
    return h;
  }

  /* ---------- Validación (se muestra solo tras tocar el campo) ---------- */
  function actualizarValidacion() {
    var v = S.validate();
    var nodos = app.querySelectorAll('[data-err-for]');
    var visibles = {};
    for (var i = 0; i < nodos.length; i++) {
      var path = nodos[i].getAttribute('data-err-for');
      var msg = v.errors[path] || '';
      var estructural = path === 'usr' || path === 'req' || path === 'res';
      var mostrar = msg && (estructural || mostrarTodos || tocados[path]);
      var t = mostrar ? msg : '';
      if (nodos[i].textContent !== t) nodos[i].textContent = t;
      if (mostrar) visibles[path] = true;
    }
    var campos = app.querySelectorAll('[data-path]');
    for (var j = 0; j < campos.length; j++) {
      var cp = campos[j].getAttribute('data-path');
      if (visibles[cp]) campos[j].setAttribute('aria-invalid', 'true');
      else campos[j].removeAttribute('aria-invalid');
    }
    var cuenta = { car: 0, usr: 0, req: 0, res: 0 };
    Object.keys(v.errors).forEach(function (k) { var s = k.split('.')[0]; if (cuenta[s] !== undefined) cuenta[s]++; });
    var badges = app.querySelectorAll('[data-badge]');
    for (var b = 0; b < badges.length; b++) {
      var n = cuenta[badges[b].getAttribute('data-badge')] || 0;
      badges[b].textContent = n ? n + (n === 1 ? ' por corregir' : ' por corregir') : '';
      badges[b].className = 'sec-badge' + (n ? ' hay' : '');
    }
    var res = document.getElementById('resumen');
    if (res) {
      var ob = S.cfg.requisitos.filter(function (r) { return r.tipo === 'obligatorio'; }).length;
      var de = S.cfg.requisitos.length - ob;
      res.innerHTML = '<span class="cuenta"><b>' + ob + '</b> obligatorios</span><span class="cuenta"><b>' + de + '</b> deseables</span>';
    }
    UI.estadoGlobal();
    return v;
  }

  function mostrarErrores() {
    mostrarTodos = true;
    var v = actualizarValidacion();
    var primero = null;
    Object.keys(v.errors).some(function (k) {
      var el = app.querySelector('[data-path="' + k + '"]');
      if (el) { primero = el; return true; }
      return false;
    });
    if (!primero) {
      var k0 = Object.keys(v.errors)[0];
      if (k0) primero = app.querySelector('[data-act="add-' + k0.split('.')[0] + '"]');
    }
    if (primero) {
      var det = primero.closest('details');
      if (det && !det.open) det.open = true;
      primero.focus();
      primero.scrollIntoView({ block: 'center' });
    }
  }

  function rerender(sec) {
    var det = app.querySelector('details[data-sec="' + sec + '"]');
    if (!det) return;
    det.innerHTML = INTERIOR[sec]();
    actualizarValidacion();
  }

  /* ---------- Eventos ---------- */
  function onCampo(ev) {
    var el = ev.target;
    var path = el.getAttribute && el.getAttribute('data-path');
    if (!path) return;
    var valor;
    if (el.type === 'number') {
      valor = el.value === '' ? null : Number(el.value);
      if (valor !== null && !isFinite(valor)) valor = null;
    } else valor = el.value;
    S.set(path, valor);
    UI.guardar();
    if (ev.type === 'change') tocados[path] = true;
    actualizarValidacion();
    // El resumen de la sección (conteos) cambia al cambiar el tipo de un requisito.
    if (path.indexOf('req.') === 0 && /\.tipo$/.test(path)) {
      var sd = app.querySelector('details[data-sec="req"] .sum-d');
      if (sd) {
        var ob = S.cfg.requisitos.filter(function (r) { return r.tipo === 'obligatorio'; }).length;
        var de = S.cfg.requisitos.length - ob;
        sd.textContent = ob + (ob === 1 ? ' obligatorio' : ' obligatorios') + ' · ' + de + (de === 1 ? ' deseable' : ' deseables');
      }
    }
  }

  function indice(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
    return -1;
  }

  function quitar(prop, id, sec, rotuloTipo) {
    var arr = S.cfg[prop];
    var i = indice(arr, id);
    if (i < 0) return;
    var item = arr.splice(i, 1)[0];
    UI.guardar();
    rerender(sec);
    var add = app.querySelector('[data-act="add-' + sec + '"]');
    if (add) add.focus();
    UI.toast('Se quitó «' + (item.nombre || rotuloTipo) + '».', {
      texto: 'Deshacer',
      fn: function () {
        var a = S.cfg[prop];
        a.splice(Math.min(i, a.length), 0, item);
        UI.guardar();
        if (UI.actual === 'configuracion') rerender(sec);
      }
    });
  }

  function agregar(prop, nuevo, sec, campoFoco) {
    S.cfg[prop].push(nuevo);
    var det = app.querySelector('details[data-sec="' + sec + '"]');
    if (det) { det.open = true; abiertos[sec] = true; }
    UI.guardar();
    rerender(sec);
    var el = document.getElementById(eid(campoFoco));
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
  }

  function onClick(ev) {
    var b = ev.target.closest && ev.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'add-usr') { var nu = { id: S.uid(), nombre: '', descripcion: '', peticion: S.PETICIONES[0] }; agregar('usuarios', nu, 'usr', 'usr.' + nu.id + '.nombre'); }
    else if (act === 'del-usr') quitar('usuarios', id, 'usr', 'usuario sin nombre');
    else if (act === 'add-req') { var nr = { id: S.uid(), nucleo: false, nombre: '', metaTexto: '', tipo: 'deseable', base: 'Supuesto' }; agregar('requisitos', nr, 'req', 'req.' + nr.id + '.nombre'); }
    else if (act === 'del-req') quitar('requisitos', id, 'req', 'requisito sin nombre');
    else if (act === 'add-res') { var ns = { id: S.uid(), nombre: '', valor: '', base: 'Supuesto' }; agregar('restricciones', ns, 'res', 'res.' + ns.id + '.nombre'); }
    else if (act === 'del-res') quitar('restricciones', id, 'res', 'restricción sin nombre');
    else if (act === 'ver-errores') mostrarErrores();
    else if (act === 'exportar') exportar();
    else if (act === 'importar') { var f = document.getElementById('archivo-imp'); if (f) f.click(); }
    else if (act === 'reset') { confirmando = true; document.getElementById('pie').innerHTML = pieReset(); var si = app.querySelector('[data-act="reset-si"]'); if (si) si.focus(); }
    else if (act === 'reset-no') { confirmando = false; document.getElementById('pie').innerHTML = pieReset(); var rb = app.querySelector('[data-act="reset"]'); if (rb) rb.focus(); }
    else if (act === 'reset-si') { confirmando = false; tocados = {}; mostrarTodos = false; S.reset(); S.resetVars(); UI.render(); UI.toast('Se restablecieron los valores por defecto.'); }
  }

  function exportar() {
    var datos = JSON.stringify(S.exportar(), null, 2);
    var blob = new Blob([datos], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'simulador-impulsa-digital.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    UI.toast('Archivo exportado.');
  }

  function onChangeArchivo(ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var r;
      try { r = S.importar(JSON.parse(String(rd.result))); } catch (err) { r = { ok: false, mensaje: 'El archivo no es un JSON válido.' }; }
      if (r.ok) { tocados = {}; mostrarTodos = false; UI.render(); UI.toast('Configuración importada.'); }
      else UI.toast(r.mensaje);
    };
    rd.onerror = function () { UI.toast('No se pudo leer el archivo.'); };
    rd.readAsText(f);
  }

  UI.vistas.configuracion = {
    render: render,
    despues: function () { actualizarValidacion(); },
    mostrarErrores: mostrarErrores,
    salir: function () { confirmando = false; },
    oninput: onCampo,
    onchange: function (ev) {
      if (ev.target && ev.target.id === 'archivo-imp') return onChangeArchivo(ev);
      onCampo(ev);
    },
    onfocusout: function (ev) {
      var path = ev.target.getAttribute && ev.target.getAttribute('data-path');
      if (!path) return;
      tocados[path] = true;
      actualizarValidacion();
    },
    onclick: onClick,
    ontoggle: function (ev) {
      var d = ev.target;
      if (d && d.getAttribute && d.getAttribute('data-sec')) abiertos[d.getAttribute('data-sec')] = d.open;
    }
  };
})();
