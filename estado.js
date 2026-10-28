/* Estado del simulador: configuración del proyecto (requisito 1), variables de entrada (requisito 3)
   y pesos del puntaje. Incluye valores por defecto, edición, validación de entradas, guardado en el
   navegador y exportar/importar en JSON. */
(function () {
  'use strict';

  var M = window.Modelo;
  var KEY = 'impulsa-sim-config-v1';
  var KEY_VARS = 'impulsa-sim-vars-v1';
  var BASES = ['Proyecto', 'Verificado', 'Tercero', 'Supuesto'];
  var PETICIONES = ['Pesadas y ligeras', 'Ligeras', 'Solo archivos estáticos'];
  var TIPOS = [['obligatorio', 'Obligatorio'], ['deseable', 'Deseable']];

  // Requisitos que el modelo calcula. Su meta es numérica y se valida con estos límites.
  var REQ_DEF = [
    { id: 'costo', nombre: 'Costo mensual total (infraestructura + IA)', meta: 5, unidad: 'USD al mes', tipo: 'obligatorio', base: 'Supuesto', min: 0, max: 10000, entero: false, paso: 0.5, ayuda: 'La meta real es USD 0. El tope de USD 5 es el plan de pago de Workers.' },
    { id: 'disp_min', nombre: 'Disponibilidad del backend', meta: 99, unidad: '% mínimo', tipo: 'obligatorio', base: 'Supuesto', min: 0.01, max: 100, entero: false, paso: 0.1, ayuda: '99.0 % equivale a unas 7.3 h de caída al mes.' },
    { id: 'lat_lig', nombre: 'Latencia de peticiones ligeras', meta: 1, unidad: 's máximo', tipo: 'obligatorio', base: 'Supuesto', min: 0.01, max: 60, entero: false, paso: 0.1, ayuda: 'Ver plantillas, abrir un preview, guardar ajustes.' },
    { id: 't_preview', nombre: 'Tiempo hasta tener el preview', meta: 30, unidad: 's máximo', tipo: 'obligatorio', base: 'Supuesto', min: 1, max: 600, entero: false, paso: 1, ayuda: 'Desde que se pide hasta que el preview está listo.' },
    { id: 'disp_alta', nombre: 'Disponibilidad alta', meta: 99.9, unidad: '% mínimo', tipo: 'deseable', base: 'Supuesto', min: 0.01, max: 100, entero: false, paso: 0.1, ayuda: '99.9 % equivale a unos 44 min de caída al mes.' },
    { id: 'escala', nombre: 'Escalabilidad', meta: 500, unidad: 'negocios', tipo: 'deseable', base: 'Supuesto', min: 1, max: 1000000, entero: true, paso: 1, ayuda: 'Negocios que debe soportar sin cambiar de arquitectura.' },
    { id: 'simplicidad', nombre: 'Simplicidad operativa', meta: 3, unidad: 'componentes máx.', tipo: 'deseable', base: 'Supuesto', min: 1, max: 100, entero: true, paso: 1, ayuda: 'Componentes que el equipo de 3 puede operar.' },
    { id: 'pico', nombre: 'Pedidos atendidos en el pico', meta: 95, unidad: '% mínimo', tipo: 'deseable', base: 'Supuesto', min: 1, max: 100, entero: false, paso: 1, ayuda: 'Porcentaje de las generaciones simultáneas del pico que se atienden sin fallar por tiempo de espera.' }
  ];

  function uid() {
    return 'x' + Math.random().toString(36).slice(2, 8);
  }

  function defaults() {
    return {
      caracteristicas: {
        nombre: 'Impulsa Digital',
        descripcion: 'Servicio que genera landing pages interactivas con IA a partir de 3 plantillas base, adaptadas al logo, nombre, colores y servicios de cada negocio.',
        funciones: 'Mostrador de plantillas\nCarga de datos del negocio\nGeneración del preview con IA\nAjustes y aprobación\nPublicación del sitio',
        etapa: 'MVP académico, curso Ingeniería Aplicada (2026-2)',
        fuera: 'Automatización del seguimiento de clientes (n8n)'
      },
      usuarios: [
        { id: 'u1', nombre: 'Dueño de negocio o institución', descripcion: 'Pymes, mipymes y colegios de Bogotá. Escoge plantilla, ve su preview y pide ajustes.', peticion: 'Pesadas y ligeras' },
        { id: 'u2', nombre: 'Equipo Innovadores UL', descripcion: 'Opera el servicio y aprueba la versión que se publica.', peticion: 'Ligeras' },
        { id: 'u3', nombre: 'Visitante final', descripcion: 'Entra a la landing ya publicada de cada negocio.', peticion: 'Solo archivos estáticos' }
      ],
      requisitos: REQ_DEF.map(function (d) {
        return { id: d.id, nucleo: true, nombre: d.nombre, meta: d.meta, tipo: d.tipo, base: d.base };
      }),
      restricciones: [
        { id: 'r1', nombre: 'Equipo', valor: '3 personas', base: 'Proyecto' },
        { id: 'r2', nombre: 'Presupuesto', valor: 'Meta de USD 0 al mes; el tope está en el requisito de costo', base: 'Supuesto' },
        { id: 'r3', nombre: 'Plataforma', valor: 'Cloudflare, plan gratuito: Pages, Workers, D1, R2, Queues y Workers AI. Sin AWS', base: 'Proyecto' },
        { id: 'r4', nombre: 'Lenguaje del backend', valor: 'JavaScript o TypeScript. NestJS o Spring Boot no se despliegan tal cual en Workers', base: 'Verificado' },
        { id: 'r5', nombre: 'Generación con IA', valor: 'Servicio externo cobrado por token. Referencia: Workers AI con un modelo de bajo costo', base: 'Verificado' },
        { id: 'r6', nombre: 'Plazo', valor: 'Por confirmar con el profesor', base: 'Proyecto' }
      ]
    };
  }

  function def(id) {
    for (var i = 0; i < REQ_DEF.length; i++) if (REQ_DEF[i].id === id) return REQ_DEF[i];
    return null;
  }

  /* Convierte datos guardados o importados (no confiables) en una configuración válida en forma. */
  function normalizar(s) {
    var base = defaults();
    if (!s || typeof s !== 'object') return base;
    if (s.caracteristicas && typeof s.caracteristicas === 'object') {
      Object.keys(base.caracteristicas).forEach(function (k) {
        if (typeof s.caracteristicas[k] === 'string') base.caracteristicas[k] = s.caracteristicas[k];
      });
    }
    if (Array.isArray(s.usuarios)) {
      base.usuarios = s.usuarios.filter(function (u) { return u && typeof u === 'object'; }).map(function (u) {
        return { id: String(u.id || uid()), nombre: String(u.nombre || ''), descripcion: String(u.descripcion || ''), peticion: PETICIONES.indexOf(u.peticion) >= 0 ? u.peticion : PETICIONES[0] };
      });
    }
    if (Array.isArray(s.requisitos)) {
      var guardados = {};
      s.requisitos.forEach(function (r) { if (r && r.id) guardados[r.id] = r; });
      var out = base.requisitos.map(function (r) {
        var g = guardados[r.id];
        if (!g) return r;
        return {
          id: r.id, nucleo: true, nombre: r.nombre,
          meta: typeof g.meta === 'number' && isFinite(g.meta) ? g.meta : null,
          tipo: g.tipo === 'deseable' ? 'deseable' : 'obligatorio',
          base: BASES.indexOf(g.base) >= 0 ? g.base : 'Supuesto'
        };
      });
      s.requisitos.forEach(function (g) {
        if (g && !def(g.id) && !g.nucleo) {
          out.push({ id: String(g.id || uid()), nucleo: false, nombre: String(g.nombre || ''), metaTexto: String(g.metaTexto || ''), tipo: g.tipo === 'obligatorio' ? 'obligatorio' : 'deseable', base: BASES.indexOf(g.base) >= 0 ? g.base : 'Supuesto' });
        }
      });
      base.requisitos = out;
    }
    if (Array.isArray(s.restricciones)) {
      base.restricciones = s.restricciones.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
        return { id: String(r.id || uid()), nombre: String(r.nombre || ''), valor: String(r.valor || ''), base: BASES.indexOf(r.base) >= 0 ? r.base : 'Supuesto' };
      });
    }
    return base;
  }

  /* Variables y pesos: solo se aceptan valores que pasan la validación del modelo. */
  function normalizarVars(s) {
    var vars = M.referencia();
    var pesos = {};
    if (s && typeof s === 'object') {
      if (s.vars && typeof s.vars === 'object') {
        M.VARIABLES.forEach(function (d) {
          var x = s.vars[d.id];
          if (typeof x === 'number' && M.errorVar(d, x) === '') vars[d.id] = x;
        });
      }
      if (s.pesos && typeof s.pesos === 'object') {
        Object.keys(s.pesos).forEach(function (k) {
          var w = s.pesos[k];
          if (def(k) && typeof w === 'number' && isFinite(w) && w >= 1 && w <= 10 && Math.floor(w) === w) pesos[k] = w;
        });
      }
    }
    return { vars: vars, pesos: pesos };
  }

  var storageOk = true;
  function leer(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      storageOk = false;
      return null;
    }
  }

  var Sim = {
    BASES: BASES, PETICIONES: PETICIONES, TIPOS: TIPOS, REQ_DEF: REQ_DEF, def: def, uid: uid, defaults: defaults,
    cfg: normalizar(leer(KEY)),
    vars: null,
    pesos: {},
    ultimaValida: M.referencia(),
    storageOk: function () { return storageOk; },

    save: function () {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(Sim.cfg));
        window.localStorage.setItem(KEY_VARS, JSON.stringify({ vars: Sim.vars, pesos: Sim.pesos }));
        storageOk = true;
      } catch (err) {
        storageOk = false;
      }
      return storageOk;
    },
    reset: function () {
      Sim.cfg = defaults();
      try { window.localStorage.removeItem(KEY); } catch (err) { storageOk = false; }
    },
    resetVars: function () {
      Sim.vars = M.referencia();
      Sim.pesos = {};
      Sim.ultimaValida = M.referencia();
      try { window.localStorage.removeItem(KEY_VARS); } catch (err) { storageOk = false; }
    },
    req: function (id) {
      for (var i = 0; i < Sim.cfg.requisitos.length; i++) if (Sim.cfg.requisitos[i].id === id) return Sim.cfg.requisitos[i];
      return null;
    },
    // Asigna un valor a partir de una ruta como 'car.nombre' o 'req.costo.meta'.
    set: function (path, value) {
      var p = path.split('.');
      var c = Sim.cfg;
      if (p[0] === 'car') { c.caracteristicas[p[1]] = value; return; }
      var lista = p[0] === 'usr' ? c.usuarios : p[0] === 'req' ? c.requisitos : c.restricciones;
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === p[1]) { lista[i][p[2]] = value; return; }
      }
    },

    /* ----- Variables de entrada ----- */
    setVar: function (id, valor) {
      Sim.vars[id] = valor;
      var d = M.defVar(id);
      if (d && M.errorVar(d, valor) === '') Sim.ultimaValida[id] = valor;
    },
    // Valores que usa el cálculo: si una variable está inválida (por ejemplo, mientras se escribe), se usa su último valor válido.
    varsEfectivas: function () {
      var o = {};
      M.VARIABLES.forEach(function (d) {
        var x = Sim.vars[d.id];
        if (M.errorVar(d, x) === '') { Sim.ultimaValida[d.id] = x; o[d.id] = x; } else o[d.id] = Sim.ultimaValida[d.id];
      });
      return o;
    },
    validarVars: function () { return M.validarVars(Sim.vars); },
    setPeso: function (id, w) {
      if (w === null || w === undefined) delete Sim.pesos[id]; else Sim.pesos[id] = w;
    },
    errorPeso: function (w) {
      if (typeof w !== 'number' || !isFinite(w)) return 'Escribe un número.';
      if (w < 1 || w > 10 || Math.floor(w) !== w) return 'Debe ser un entero entre 1 y 10.';
      return '';
    },

    /* ----- Exportar e importar ----- */
    exportar: function () {
      return { app: 'simulador-impulsa-digital', version: 1, cfg: Sim.cfg, vars: Sim.vars, pesos: Sim.pesos };
    },
    importar: function (obj) {
      if (!obj || typeof obj !== 'object' || (!obj.cfg && !obj.vars)) return { ok: false, mensaje: 'El archivo no tiene el formato del simulador.' };
      if (obj.cfg) Sim.cfg = normalizar(obj.cfg);
      var nv = normalizarVars(obj);
      Sim.vars = nv.vars;
      Sim.pesos = nv.pesos;
      Sim.ultimaValida = M.referencia();
      Sim.varsEfectivas();
      Sim.save();
      return { ok: true };
    },

    // Controles de entradas inválidas (requisito 10). Devuelve { errors: {ruta: mensaje}, count }.
    validate: function (cfg) {
      cfg = cfg || Sim.cfg;
      var er = {};
      var vacio = function (s) { return !String(s == null ? '' : s).trim(); };
      var car = cfg.caracteristicas;
      if (vacio(car.nombre)) er['car.nombre'] = 'Escribe el nombre del proyecto.';
      if (vacio(car.descripcion)) er['car.descripcion'] = 'Escribe una descripción.';
      if (!String(car.funciones || '').split('\n').some(function (l) { return l.trim(); })) er['car.funciones'] = 'Escribe al menos una función, una por línea.';
      if (vacio(car.etapa)) er['car.etapa'] = 'Escribe la etapa del proyecto.';

      if (!cfg.usuarios.length) er['usr'] = 'Agrega al menos un tipo de usuario.';
      cfg.usuarios.forEach(function (u) {
        if (vacio(u.nombre)) er['usr.' + u.id + '.nombre'] = 'Escribe el nombre del usuario.';
        if (vacio(u.descripcion)) er['usr.' + u.id + '.descripcion'] = 'Describe al usuario.';
      });

      cfg.requisitos.forEach(function (r) {
        var d = def(r.id);
        if (d && r.nucleo) {
          var m = r.meta;
          var ruta = 'req.' + r.id + '.meta';
          if (m === null || m === undefined || typeof m !== 'number' || !isFinite(m)) er[ruta] = 'Escribe un número.';
          else if (m < d.min || m > d.max) er[ruta] = 'Debe estar entre ' + d.min + ' y ' + d.max + '.';
          else if (d.entero && Math.floor(m) !== m) er[ruta] = 'Debe ser un número entero.';
        } else {
          if (vacio(r.nombre)) er['req.' + r.id + '.nombre'] = 'Escribe el nombre del requisito.';
          if (vacio(r.metaTexto)) er['req.' + r.id + '.metaTexto'] = 'Escribe la meta.';
        }
      });
      var dm = Sim.reqEn(cfg, 'disp_min'), da = Sim.reqEn(cfg, 'disp_alta');
      if (dm && da && typeof dm.meta === 'number' && typeof da.meta === 'number' && !er['req.disp_alta.meta'] && da.meta < dm.meta) {
        er['req.disp_alta.meta'] = 'Debe ser igual o mayor que la disponibilidad mínima (' + dm.meta + ' %).';
      }
      if (!cfg.requisitos.some(function (r) { return r.tipo === 'obligatorio'; })) er['req'] = 'Marca al menos un requisito como obligatorio; sin eso no hay nada que filtre las alternativas.';

      if (!cfg.restricciones.length) er['res'] = 'Agrega al menos una restricción.';
      cfg.restricciones.forEach(function (r) {
        if (vacio(r.nombre)) er['res.' + r.id + '.nombre'] = 'Escribe el nombre de la restricción.';
        if (vacio(r.valor)) er['res.' + r.id + '.valor'] = 'Escribe su valor.';
      });
      return { errors: er, count: Object.keys(er).length };
    },
    reqEn: function (cfg, id) {
      for (var i = 0; i < cfg.requisitos.length; i++) if (cfg.requisitos[i].id === id) return cfg.requisitos[i];
      return null;
    }
  };

  var nv = normalizarVars(leer(KEY_VARS));
  Sim.vars = nv.vars;
  Sim.pesos = nv.pesos;
  Sim.ultimaValida = M.referencia();
  Sim.varsEfectivas();
  window.Sim = Sim;
})();
