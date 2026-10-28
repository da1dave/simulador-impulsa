/* Interfaz: núcleo compartido. Enrutado por hash, pasos de navegación, estado global,
   avisos (toasts), tema claro/oscuro y utilidades de formato. Cada vista vive en su archivo
   (ui-config.js, ui-alternativas.js, ui-simulador.js, ui-modelo.js) y se registra en UI.vistas. */
(function () {
  'use strict';

  var S = window.Sim;
  var app = document.getElementById('app');
  var tabsEl = document.getElementById('tabs');
  var estadoEl = document.getElementById('estado-global');
  var toastsEl = document.getElementById('toasts');
  var btnTema = document.getElementById('btn-tema');

  var PASOS = [
    { id: 'configuracion', nombre: 'Configuración', sub: 'Qué necesita el proyecto' },
    { id: 'alternativas', nombre: 'Alternativas', sub: 'Qué se compara' },
    { id: 'simulador', nombre: 'Simulador', sub: 'Prueba situaciones y mira qué conviene' },
    { id: 'modelo', nombre: 'Modelo', sub: 'Cómo se calcula' }
  ];

  /* Direcciones de versiones anteriores: siguen funcionando y abren la subpestaña que les corresponde. */
  var ALIAS = {
    variables: ['simulador', 'porque'],
    escenarios: ['simulador', 'escenarios'],
    decision: ['simulador', 'porque']
  };

  var UI = {
    PASOS: PASOS,
    app: app,
    vistas: {},
    actual: null,
    subpestana: null,   // subpestaña del Simulador que pide la dirección (#escenarios, por ejemplo)
    primeraCarga: true
  };

  /* ---------- Utilidades ---------- */
  UI.e = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  UI.eid = function (path) { return 'f_' + String(path).replace(/[^a-zA-Z0-9]/g, '_'); };
  var FORMATOS = {};
  UI.num = function (n, dec) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    dec = dec || 0;
    var f = FORMATOS[dec];
    if (!f) f = FORMATOS[dec] = new Intl.NumberFormat('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return f.format(n);
  };
  UI.tag = function (base) { return '<span class="tag b-' + UI.e(base) + '">' + UI.e(base) + '</span>'; };
  UI.lista = function (items) {
    return '<ul>' + items.map(function (i) { return '<li>' + UI.e(i) + '</li>'; }).join('') + '</ul>';
  };
  UI.esMovil = function () {
    return !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
  };
  /* Icono + texto: el estado nunca depende solo del color. */
  UI.chip = function (clase, texto) {
    return '<span class="chip ' + clase + '">' + UI.e(texto) + '</span>';
  };

  /* ---------- Guardado con espera corta ---------- */
  var tGuardar = null, tOcultar = null;
  var pendiente = false;
  UI.guardar = function () {
    clearTimeout(tGuardar);
    pendiente = true;
    tGuardar = setTimeout(function () {
      pendiente = false;
      var ok = S.save();
      var g = document.getElementById('guardado');
      if (!g) return;
      g.className = 'guardado ' + (ok ? 'ok' : 'no');
      g.textContent = ok ? 'Guardado en este navegador' : 'No se puede guardar: los cambios duran mientras la página esté abierta';
      clearTimeout(tOcultar);
      if (ok) tOcultar = setTimeout(function () { g.className = 'guardado'; }, 2500);
    }, 300);
  };

  /* Si la página se cierra o se oculta antes de que venza la espera, se guarda de inmediato. */
  function guardarYa() { if (pendiente) { clearTimeout(tGuardar); pendiente = false; S.save(); } }
  window.addEventListener('pagehide', guardarYa);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') guardarYa(); });

  /* ---------- Estado global (barra fija) ---------- */
  UI.estadoGlobal = function () {
    var v = S.validate();
    var vv = S.validarVars();
    var h = '';
    if (v.count) h += '<button type="button" class="chip malo chip-btn" data-go-errores><span class="ic" aria-hidden="true">!</span>' + v.count + (v.count === 1 ? ' campo por corregir' : ' campos por corregir') + '</button>';
    if (vv.count) h += '<a class="chip malo chip-btn" href="#simulador"><span class="ic" aria-hidden="true">!</span>' + vv.count + (vv.count === 1 ? ' variable inválida' : ' variables inválidas') + '</a>';
    var g = document.getElementById('guardado');
    var claseG = g ? g.className : 'guardado';
    var textoG = g ? g.textContent : '';
    h += '<span class="' + UI.e(claseG) + '" id="guardado">' + UI.e(textoG) + '</span>';
    estadoEl.innerHTML = h;
    alertasPasos(v.count, vv.count);
  };

  /* Insignia roja en el paso que tiene algo por corregir. */
  function alertasPasos(cfg, vars) {
    var cuentas = { configuracion: cfg, simulador: vars };
    Object.keys(cuentas).forEach(function (id) {
      var a = tabsEl.querySelector('.paso[data-id="' + id + '"]');
      if (!a) return;
      var b = a.querySelector('.alerta');
      var n = cuentas[id];
      if (!n) { if (b) b.parentNode.removeChild(b); return; }
      if (!b) { b = document.createElement('span'); b.className = 'alerta'; a.appendChild(b); }
      b.innerHTML = '<span aria-hidden="true">' + n + '</span><span class="vh">' + n + (n === 1 ? ' cosa por corregir' : ' cosas por corregir') + '</span>';
    });
  }
  estadoEl.addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-go-errores]')) return;
    if (UI.actual === 'configuracion') UI.vistas.configuracion.mostrarErrores();
    else { UI.pendienteErrores = true; location.hash = '#configuracion'; }
  });

  /* ---------- Avisos ---------- */
  UI.toast = function (mensaje, accion) {
    toastsEl.innerHTML = ''; // un solo aviso a la vez: el nuevo reemplaza al anterior
    var t = document.createElement('div');
    t.className = 'toast';
    var p = document.createElement('span');
    p.textContent = mensaje;
    t.appendChild(p);
    var timer = null;
    function cerrar() { clearTimeout(timer); if (t.parentNode) t.parentNode.removeChild(t); }
    function programar(ms) { clearTimeout(timer); timer = setTimeout(cerrar, ms); }
    if (accion) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = accion.texto;
      b.addEventListener('click', function () { accion.fn(); cerrar(); });
      t.appendChild(b);
    }
    // Se pausa mientras el cursor o el foco están encima, para dar tiempo de pulsar «Deshacer».
    t.addEventListener('mouseenter', function () { clearTimeout(timer); });
    t.addEventListener('mouseleave', function () { programar(1500); });
    t.addEventListener('focusin', function () { clearTimeout(timer); });
    t.addEventListener('focusout', function () { programar(1500); });
    toastsEl.appendChild(t);
    programar(accion ? 4500 : 2500);
  };

  /* ---------- Tema ---------- */
  function temaActual() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function pintarBotonTema() {
    var oscuro = temaActual() === 'dark';
    btnTema.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    btnTema.setAttribute('title', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
  btnTema.addEventListener('click', function () {
    var nuevo = temaActual() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try { window.localStorage.setItem('impulsa-sim-tema', nuevo); } catch (err) { /* sin almacenamiento */ }
    pintarBotonTema();
  });

  /* ---------- Pasos ---------- */
  function renderTabs(actual) {
    tabsEl.innerHTML = '<ol class="pasos">' + PASOS.map(function (t, i) {
      var on = t.id === actual;
      return '<li class="' + (on ? 'actual' : '') + '"><a title="' + UI.e(t.sub) + '" class="paso' + (on ? ' on' : '') + '" data-id="' + t.id + '" href="#' + t.id + '"' + (on ? ' aria-current="step"' : '') + '>' +
        '<span class="num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="txt"><span class="vh">Paso ' + (i + 1) + ': </span>' + UI.e(t.nombre) + '</span></a></li>';
    }).join('') + '</ol>';
  }

  function pasoNav(id) {
    var i = PASOS.map(function (p) { return p.id; }).indexOf(id);
    var prev = PASOS[i - 1], next = PASOS[i + 1];
    var h = '<nav class="paso-nav" aria-label="Navegar entre pasos">';
    h += prev ? '<a class="btn sec" href="#' + prev.id + '"><span aria-hidden="true">←</span> Anterior: ' + UI.e(prev.nombre) + '</a>' : '<span></span>';
    h += next ? '<a class="btn prim" href="#' + next.id + '">Siguiente: ' + UI.e(next.nombre) + ' <span aria-hidden="true">→</span></a>' : '<span></span>';
    return h + '</nav>';
  }
  UI.pasoNav = pasoNav;

  function idDeHash() {
    var h = (location.hash || '').replace('#', '');
    if (ALIAS[h]) {
      UI.subpestana = ALIAS[h][1];
      if (window.history && history.replaceState) history.replaceState(null, '', '#' + ALIAS[h][0]);
      return ALIAS[h][0];
    }
    for (var i = 0; i < PASOS.length; i++) if (PASOS[i].id === h) return h;
    return 'configuracion';
  }

  UI.render = function () {
    var id = idDeHash();
    toastsEl.innerHTML = ''; // un aviso con «Deshacer» no debe sobrevivir al cambio de pantalla
    var previa = UI.vistas[UI.actual];
    if (previa && previa.salir) previa.salir();
    UI.actual = id;
    var v = UI.vistas[id];
    renderTabs(id);
    app.innerHTML = v.render() + pasoNav(id);
    if (v.despues) v.despues();
    var paso = PASOS.filter(function (p) { return p.id === id; })[0];
    document.title = paso.nombre + ' · Simulador de arquitecturas · Impulsa Digital';
    UI.estadoGlobal();
    if (!UI.primeraCarga) {
      window.scrollTo(0, 0);
      var h2 = app.querySelector('h2');
      if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus({ preventScroll: true }); }
    }
    UI.primeraCarga = false;
    if (UI.pendienteErrores && id === 'configuracion') {
      UI.pendienteErrores = false;
      v.mostrarErrores();
    }
  };

  /* Las vistas reciben los eventos del contenedor con nombres on<evento>. */
  ['input', 'change', 'click', 'focusin', 'focusout', 'keydown'].forEach(function (t) {
    app.addEventListener(t, function (ev) {
      var v = UI.vistas[UI.actual];
      if (v && v['on' + t]) v['on' + t](ev);
    });
  });
  app.addEventListener('toggle', function (ev) {
    var v = UI.vistas[UI.actual];
    if (v && v.ontoggle) v.ontoggle(ev);
  }, true);
  app.addEventListener('submit', function (ev) { ev.preventDefault(); });

  UI.iniciar = function () {
    pintarBotonTema();
    window.addEventListener('hashchange', UI.render);
    UI.render();
  };

  window.UI = UI;
})();
