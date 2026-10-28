/* Modelo de simulación (requisitos 3 y 4).
   Funciones puras: no tocan el DOM ni el almacenamiento. Reciben variables, alternativas y
   requisitos, y devuelven indicadores con la traza del cálculo (fórmula con los valores sustituidos).
   El paso Modelo se genera desde los mismos arreglos de este archivo, así la documentación
   no se puede desfasar del cálculo. */
(function () {
  'use strict';

  var D = window.DATOS;

  /* Un formateador por cantidad de decimales: crear uno en cada llamada es lo que más tarda al recalcular. */
  var FORMATOS = {};
  function n(x, dec) {
    if (typeof x !== 'number' || !isFinite(x)) return '∞';
    dec = dec || 0;
    var f = FORMATOS[dec];
    if (!f) f = FORMATOS[dec] = new Intl.NumberFormat('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return f.format(x);
  }

  /* Número en es-CO sin ceros sobrantes después de la coma (0,5000 → 0,5; 100 → 100). */
  function limpio(x, dec) {
    var s = n(x, dec);
    return s.indexOf(',') >= 0 ? s.replace(/0+$/, '').replace(/,$/, '') : s;
  }

  /* ---------- Parámetros globales del modelo (iguales para las tres alternativas) ---------- */
  var PARAMS = [
    { id: 'DIAS', simbolo: 'días/mes', nombre: 'Días por mes', valor: 30, unidad: 'días', base: 'Supuesto', nota: 'Mes comercial para pasar de previews al mes a previews al día.' },
    { id: 'T_LIG', simbolo: 't_L', nombre: 'Tiempo base de una petición ligera', valor: 0.15, unidad: 's', base: 'Supuesto', nota: 'Un Worker que lee D1 o R2, sin saltos ni congestión. Se mide en el prototipo.' },
    { id: 'T_SALTO', simbolo: 't_s', nombre: 'Tiempo de una llamada entre Workers', valor: 0.04, unidad: 's', base: 'Supuesto', nota: 'Costo de saltar de un componente a otro. Se mide en el prototipo.' },
    { id: 'CAP_IA', simbolo: 'C', nombre: 'Capacidad del servicio de IA', valor: 8, unidad: 'generaciones a la vez', base: 'Supuesto', nota: 'Generaciones que el servicio de IA atiende en paralelo; las demás esperan su ronda.' },
    { id: 'T_CONEXION', simbolo: 'T_c', nombre: 'Espera máxima de una petición síncrona', valor: 60, unidad: 's', base: 'Supuesto', nota: 'En A y B el navegador mantiene la conexión abierta; pasado este tiempo la petición falla por tiempo de espera.' },
    { id: 'T_LOTE', simbolo: 't_b', nombre: 'Espera de lote de la cola (C)', valor: 1, unidad: 's', base: 'Supuesto', nota: 'Se asume configurada para entrega casi inmediata. El máximo permitido por Cloudflare es 60 s (Verificado): si no se configura, C podría romper el requisito de tiempo hasta el preview.' },
    { id: 'PLAN_PAGO', simbolo: 'USD_pago', nombre: 'Cargo mínimo de Workers Paid', valor: 5, unidad: 'USD al mes', base: 'Verificado', nota: 'Se paga si alguna cuota del plan gratuito se excede. Fuente: precios de Cloudflare Workers.' },
    { id: 'REQ_INCLUIDAS', simbolo: 'R_inc', nombre: 'Peticiones incluidas en Workers Paid', valor: 10000000, unidad: 'peticiones al mes', base: 'Verificado', nota: 'Fuente: precios de Cloudflare Workers.' },
    { id: 'REQ_EXTRA', simbolo: 'USD_req', nombre: 'Costo por millón de peticiones adicionales', valor: 0.3, unidad: 'USD', base: 'Verificado', nota: 'Fuente: precios de Cloudflare Workers.' },
    { id: 'OPS_INCLUIDAS', simbolo: 'O_inc', nombre: 'Operaciones de cola incluidas en el plan de pago', valor: 1000000, unidad: 'operaciones al mes', base: 'Verificado', nota: 'Fuente: precios de Cloudflare Queues.' },
    { id: 'OPS_EXTRA', simbolo: 'USD_op', nombre: 'Costo por millón de operaciones de cola adicionales', valor: 0.4, unidad: 'USD', base: 'Verificado', nota: 'Fuente: precios de Cloudflare Queues.' }
  ];
  var P = {};
  PARAMS.forEach(function (p) { P[p.id] = p.valor; });

  /* ---------- Variables de entrada (requisito 3) ---------- */
  var VARIABLES = [
    { id: 'N', pregunta: '¿Cuántos negocios usan el servicio?', simbolo: 'N', nombre: 'Negocios activos', unidad: 'negocios', grupo: 'Carga', min: 1, max: 100000, paso: 1, deslizar: [1, 1000], entero: true, ref: 50, base: 'Supuesto',
      porque: 'Es la medida de escala del proyecto: fija cuántas peticiones y cuántos previews recibe el backend.',
      req: ['escala', 'costo'], ind: ['uso', 'capacidad', 'costo'] },
    { id: 'P', pregunta: '¿Cuántos previews genera cada negocio al mes?', simbolo: 'P', nombre: 'Previews por negocio al mes', unidad: 'previews', grupo: 'Carga', min: 1, max: 500, paso: 1, deslizar: [1, 50], entero: true, ref: 5, base: 'Supuesto',
      porque: 'Cada negocio genera una primera versión y varios ajustes. Cada generación consume IA y cuota.',
      req: ['costo', 'escala'], ind: ['costo', 'uso', 'capacidad'] },
    { id: 'L', pregunta: '¿Cuántas acciones sencillas hace cada negocio al día?', simbolo: 'L', nombre: 'Peticiones ligeras por negocio al día', unidad: 'peticiones', grupo: 'Carga', min: 0, max: 5000, paso: 1, deslizar: [0, 200], entero: true, ref: 20, base: 'Supuesto',
      porque: 'Ver plantillas, abrir un preview y guardar ajustes. Pesan sobre la cuota diaria y la latencia ligera.',
      req: ['lat_lig', 'escala'], ind: ['latLig', 'uso', 'capacidad'] },
    { id: 'Q', pregunta: '¿Cuántos negocios piden un preview a la vez en el peor momento?', simbolo: 'Q', nombre: 'Generaciones simultáneas en el pico', unidad: 'generaciones', grupo: 'Rendimiento', min: 1, max: 1000, paso: 1, deslizar: [1, 60], entero: true, ref: 5, base: 'Supuesto',
      porque: 'Mide el peor momento: varios negocios piden preview a la vez. Las que no caben en la capacidad de la IA esperan.',
      req: ['t_preview', 'lat_lig', 'pico'], ind: ['tPrev', 'latLig', 'exito'] },
    { id: 'tIA', pregunta: '¿Cuánto tarda la IA en generar un preview?', simbolo: 't_IA', nombre: 'Tiempo de respuesta de la IA', unidad: 's', grupo: 'Rendimiento', min: 0.5, max: 120, paso: 0.5, deslizar: [0.5, 40], entero: false, ref: 15, base: 'Supuesto',
      porque: 'Lo que tarda el modelo en generar el preview. Domina el tiempo hasta tenerlo y decide cuántas rondas caben antes del tiempo de espera. La referencia de 15 s asume una respuesta JSON de 1.500 tokens a 100 tokens por segundo; la velocidad no está verificada.',
      req: ['t_preview', 'pico'], ind: ['tPrev', 'exito'] },
    { id: 'sondeo', pregunta: '¿Cada cuántos segundos pregunta el navegador si el preview ya está listo?', simbolo: 't_q', nombre: 'Intervalo de consulta de estado (solo C)', unidad: 's', grupo: 'Rendimiento', min: 1, max: 60, paso: 1, deslizar: [1, 20], entero: true, ref: 3, base: 'Supuesto',
      porque: 'Cada cuántos segundos el navegador pregunta si el preview está listo. Un intervalo corto gasta más peticiones; uno largo añade espera.',
      req: ['t_preview', 'costo'], ind: ['tPrev', 'uso'], soloC: true },
    { id: 'd', pregunta: '¿Qué tan fiable es cada componente de la plataforma?', simbolo: 'd', nombre: 'Disponibilidad de cada componente', unidad: '%', grupo: 'Fiabilidad y costo', min: 90, max: 100, paso: 0.01, deslizar: [95, 100], entero: false, ref: 99.5, base: 'Supuesto',
      porque: 'El plan gratuito no tiene SLA, así que es el supuesto que más pesa: cada componente en serie multiplica el riesgo.',
      req: ['disp_min', 'disp_alta'], ind: ['disp'], sensibilidad: true },
    { id: 'costoIA', pregunta: '¿Cuánto cuesta la IA por cada preview?', simbolo: 'USD_IA', nombre: 'Costo de IA por preview', unidad: 'USD', grupo: 'Fiabilidad y costo', min: 0, max: 1, paso: 0.00025, deslizar: [0, 0.01], entero: false, ref: 0.00075, base: 'Supuesto',
      porque: 'Se cobra por token y es igual en las tres alternativas. Con muchos negocios domina el costo mensual y puede romper el tope de costo. La referencia sale de los precios verificados de Workers AI (USD 0,10 por millón de tokens de entrada y USD 0,30 de salida) con 3.000 tokens de entrada y 1.500 de salida: el precio está verificado, el conteo de tokens es un supuesto.',
      req: ['costo'], ind: ['costo'] },
    { id: 'contarSaltos', pregunta: '¿Las llamadas entre componentes cuentan como peticiones?', simbolo: 'cs', nombre: '¿Las llamadas entre componentes cuentan como peticiones?', unidad: '', grupo: 'Supuestos de la plataforma', tipo: 'opcion', opciones: [[1, 'Sí, cuentan (peor caso)'], [0, 'No cuentan']], ref: 1, base: 'Supuesto',
      porque: 'Los precios de Cloudflare no cobran peticiones extra por llamadas entre Workers, pero no aclaran si cuentan en el límite diario gratuito. Cambia la capacidad de B y de C.',
      req: ['escala'], ind: ['uso', 'capacidad'] }
  ];

  function defVar(id) {
    for (var i = 0; i < VARIABLES.length; i++) if (VARIABLES[i].id === id) return VARIABLES[i];
    return null;
  }

  function referencia() {
    var o = {};
    VARIABLES.forEach(function (d) { o[d.id] = d.ref; });
    return o;
  }

  /* Variables que se ven siempre; las demás van en «Ajustes avanzados». */
  ['N', 'L', 'Q', 'tIA', 'd'].forEach(function (id) { defVar(id).esencial = true; });

  /* ---------- Escenarios (requisito 5) ----------
     Cada escenario parte de la referencia y cambia solo lo que indica «vars».
     Ningún resultado está escrito aquí: todos se calculan con evaluarTodas. */
  var ESCENARIOS = [
    {
      id: 'ref', nombre: 'Lanzamiento', historia: 'Los valores base del equipo',
      contexto: 'El servicio arranca con los primeros 50 negocios de Bogotá. Cada uno pide unos pocos previews al mes y entra a diario a revisar su página.',
      pregunta: '¿Con qué diseño conviene salir a producción?',
      vars: {}
    },
    {
      id: 'crece', nombre: 'Crecimiento sostenido', historia: 'Veinte veces más negocios, más activos',
      contexto: 'Un año después el servicio llega a 1.000 negocios y cada uno entra el doble de veces al día. La carga sube de forma pareja, sin picos.',
      pregunta: '¿El diseño elegido aguanta crecer sin cambiar de plan?',
      vars: { N: 1000, L: 40 }
    },
    {
      id: 'cuota', nombre: 'Cuota al límite', historia: 'La carga roza el tope del plan gratuito',
      contexto: 'Con 1.200 negocios muy activos y 8 previews cada uno, el consumo diario se acerca al tope del plan gratuito de Cloudflare.',
      pregunta: '¿Cuál diseño empieza a pagar primero y cuánto cuesta eso?',
      vars: { N: 1200, L: 50, P: 8 }
    },
    {
      id: 'pico', nombre: 'Campaña con pico', historia: 'Un taller con 12 negocios generando a la vez',
      contexto: 'El equipo dicta un taller presencial y doce negocios piden su preview en el mismo minuto, con la IA tardando lo que tarda hoy.',
      pregunta: '¿Alguna arquitectura sostiene un pico así?',
      vars: { Q: 12 }
    },
    {
      id: 'prompt', nombre: 'IA más rápida', historia: 'El prompt se optimiza y la IA baja a 6 s',
      contexto: 'Tras medir el prototipo, el equipo recorta el prompt y la respuesta de la IA baja de 15 a 6 segundos. El taller crece a 24 negocios a la vez.',
      pregunta: '¿Mejorar el prompt rinde más que cambiar de arquitectura?',
      vars: { tIA: 6, Q: 24 }
    },
    {
      id: 'inestable', nombre: 'Plataforma inestable', historia: 'Cada componente cae más seguido',
      contexto: 'El plan gratuito de Cloudflare no tiene SLA. Este escenario supone que cada componente baja a 99,0 % de disponibilidad.',
      pregunta: '¿Cuántos componentes en serie se puede permitir el proyecto?',
      vars: { d: 99 }
    },
    {
      id: 'fiable', nombre: 'Plataforma muy fiable', historia: 'Cada componente casi no falla',
      contexto: 'El caso opuesto: cada componente alcanza 99,9 % de disponibilidad, como prometen los planes de pago de muchos proveedores.',
      pregunta: '¿Con una plataforma más fiable cambia qué diseños son viables?',
      vars: { d: 99.9 }
    }
  ];
  var CASOS = ESCENARIOS; // nombre anterior, conservado por compatibilidad

  /* Valores completos de un escenario: referencia más sus cambios. */
  function varsDeCaso(caso) {
    var o = referencia();
    Object.keys(caso.vars).forEach(function (k) { o[k] = caso.vars[k]; });
    return o;
  }

  function escenario(id) {
    for (var i = 0; i < ESCENARIOS.length; i++) if (ESCENARIOS[i].id === id) return ESCENARIOS[i];
    return null;
  }

  /* Devuelve '' si el valor es válido, o el mensaje de error. */
  function errorVar(def, x) {
    if (typeof x !== 'number' || !isFinite(x)) return 'Escribe un número.';
    if (def.tipo === 'opcion') {
      return def.opciones.some(function (o) { return o[0] === x; }) ? '' : 'Elige una de las opciones.';
    }
    if (x < def.min || x > def.max) return 'Debe estar entre ' + limpio(def.min, def.paso < 1 ? 4 : 0) + ' y ' + limpio(def.max, def.paso < 1 ? 4 : 0) + '.';
    if (def.entero && Math.floor(x) !== x) return 'Debe ser un número entero.';
    return '';
  }

  function validarVars(vars) {
    var er = {};
    VARIABLES.forEach(function (d) {
      var m = errorVar(d, vars[d.id]);
      if (m) er[d.id] = m;
    });
    return { errors: er, count: Object.keys(er).length };
  }

  /* ---------- Contexto de cálculo: cantidades intermedias compartidas por los indicadores ---------- */
  function contexto(v, alt) {
    var p = alt.parametros;
    var cs = v.contarSaltos === 1 ? 1 : 0;
    var G = v.N * v.P / P.DIAS;                       // previews generados por día
    var Rl = v.N * v.L;                               // peticiones ligeras por día
    var rondas = Math.ceil(v.Q / P.CAP_IA);           // rondas de IA para atender el pico
    var rho = Math.min(1, v.Q / P.CAP_IA);            // ocupación del servicio de IA en el pico
    var tBase = v.tIA * rondas + p.saltos.valor * P.T_SALTO + P.T_LIG;
    var lote = p.asincrona.valor ? P.T_LOTE : 0;
    var sondeos = p.usaSondeo.valor ? Math.max(1, Math.ceil((tBase + lote) / v.sondeo)) : 0;
    var tPrev = tBase + lote + (p.usaSondeo.valor ? v.sondeo : 0);
    var peticionesW = Rl * (1 + p.saltosLigeros.valor * cs) + G * (1 + p.saltos.valor * cs) + G * sondeos;

    var usos = p.cuotas.map(function (q) {
      var consumo = q.id === 'workers' ? peticionesW : G * q.opsPorMensaje;
      return { id: q.id, nombre: q.nombre, unidad: q.unidad, limite: q.limite, consumo: consumo, ratio: consumo / q.limite, opsPorMensaje: q.opsPorMensaje };
    });
    var lim = usos.reduce(function (a, b) { return b.ratio > a.ratio ? b : a; }, usos[0]);

    return { v: v, p: p, alt: alt, cs: cs, G: G, Rl: Rl, rondas: rondas, rho: rho, tBase: tBase, lote: lote, sondeos: sondeos, tPrev: tPrev, peticionesW: peticionesW, usos: usos, lim: lim };
  }

  /* ---------- Indicadores (requisito 6 lo presentará; aquí se calculan) ---------- */
  var INDICADORES = [
    {
      id: 'disp', claro: 'Qué tanto tiempo está funcionando el servicio. Si una pieza cae, la petición falla.', nombre: 'Disponibilidad', unidad: '%', dec: 2, mejor: 'mayor', eje: [95, 100], credito: 'caida',
      formula: 'D = 100 × (d / 100)^n',
      explica: 'n es el número de componentes en serie que deben funcionar a la vez; d, la disponibilidad de cada uno. Si cualquiera cae, la petición falla.',
      usa: ['d', 'enSerie'],
      calc: function (c) {
        var val = D.disponibilidad(c.alt, c.v.d);
        return { valor: val, sust: '100 × (' + n(c.v.d, 2) + ' / 100)^' + c.p.enSerie.valor + ' = ' + n(val, 2) + ' %' };
      }
    },
    {
      id: 'latLig', claro: 'Qué tan rápido responde una acción sencilla, como abrir la página de un negocio.', nombre: 'Latencia de petición ligera', unidad: 's', dec: 2, mejor: 'menor',
      formula: 'L = (t_L + s_L × t_s) × (1 + κ × ρ),   ρ = mín(1, Q / C)',
      explica: 's_L son las llamadas entre componentes de una petición ligera y κ el acoplamiento: cuánto la afecta una generación en curso. ρ es la ocupación del servicio de IA en el pico.',
      usa: ['Q', 'T_LIG', 'T_SALTO', 'CAP_IA', 'saltosLigeros', 'acoplamiento'],
      calc: function (c) {
        var k = c.p.acoplamiento.valor, sl = c.p.saltosLigeros.valor;
        var b = P.T_LIG + sl * P.T_SALTO;
        var val = b * (1 + k * c.rho);
        return { valor: val, sust: '(' + n(P.T_LIG, 2) + ' + ' + sl + ' × ' + n(P.T_SALTO, 2) + ') × (1 + ' + n(k, 1) + ' × ' + n(c.rho, 2) + ') = ' + n(val, 2) + ' s' };
      }
    },
    {
      id: 'tPrev', claro: 'Cuánto espera el cliente, en el peor momento del pico, hasta ver su preview.', nombre: 'Tiempo hasta tener el preview (peor caso del pico)', unidad: 's', dec: 1, mejor: 'menor',
      formula: 'T = t_IA × ⌈Q / C⌉ + s × t_s + t_L   (+ t_b + t_q en C)',
      explica: 'Las Q generaciones del pico se atienden en ⌈Q / C⌉ rondas y la última espera todas. s son las llamadas entre componentes por petición pesada. En C se suman la espera de lote t_b y, en el peor caso, un intervalo completo de consulta t_q.',
      usa: ['tIA', 'Q', 'sondeo', 'CAP_IA', 'T_SALTO', 'T_LIG', 'T_LOTE', 'saltos'],
      calc: function (c) {
        var s = c.p.saltos.valor;
        var txt = n(c.v.tIA, 1) + ' × ' + c.rondas + ' + ' + s + ' × ' + n(P.T_SALTO, 2) + ' + ' + n(P.T_LIG, 2);
        if (c.p.asincrona.valor) txt += ' + ' + n(P.T_LOTE, 1) + ' + ' + n(c.v.sondeo, 0);
        return { valor: c.tPrev, sust: txt + ' = ' + n(c.tPrev, 1) + ' s' };
      }
    },
    {
      id: 'exito', claro: 'De los pedidos que llegan juntos en el pico, cuántos se alcanzan a atender.', nombre: 'Pedidos atendidos en el pico', unidad: '%', dec: 1, mejor: 'mayor',
      formula: 'A y B: X = 100 × mín(Q, C × ⌊T_c / t_IA⌋) / Q      C: X = 100',
      explica: 'En A y B la conexión se mantiene abierta: solo se atienden las generaciones que terminan antes del tiempo de espera T_c. En C los pedidos esperan en la cola (hasta 24 h en el plan gratuito) y se atienden todos.',
      usa: ['Q', 'tIA', 'CAP_IA', 'T_CONEXION', 'asincrona'],
      calc: function (c) {
        if (c.p.asincrona.valor) return { valor: 100, sust: 'La cola retiene los pedidos: 100 %' };
        var rm = Math.floor(P.T_CONEXION / c.v.tIA);
        var at = Math.min(c.v.Q, P.CAP_IA * rm);
        var val = 100 * at / c.v.Q;
        return { valor: val, sust: '100 × mín(' + c.v.Q + ', ' + P.CAP_IA + ' × ⌊' + n(P.T_CONEXION, 0) + ' / ' + n(c.v.tIA, 1) + '⌋) / ' + c.v.Q + ' = ' + n(val, 1) + ' %' };
      }
    },
    {
      id: 'uso', claro: 'Qué tan cerca está el servicio del límite diario del plan gratuito.', nombre: 'Uso de la cuota diaria más exigente', unidad: '%', dec: 1, mejor: 'menor',
      formula: 'U = máx sobre cuotas (consumo / límite)',
      explica: 'Peticiones de Workers = N·L·(1 + s_L·cs) + G·(1 + s·cs) + G·sondeos, con G = N·P / 30 previews al día. Operaciones de cola = 3·G. cs vale 1 si las llamadas entre componentes cuentan. Se toma la cuota que más se acerca a su límite.',
      usa: ['N', 'P', 'L', 'contarSaltos', 'sondeo', 'DIAS', 'saltos', 'saltosLigeros', 'cuotas'],
      calc: function (c) {
        var partes = c.usos.map(function (u) { return u.nombre + ': ' + n(u.consumo, 0) + ' / ' + n(u.limite, 0) + ' = ' + n(u.ratio * 100, 2) + ' %'; });
        return { valor: c.lim.ratio * 100, sust: partes.join('  |  ') + '  →  limita: ' + c.lim.nombre + ' (' + n(c.lim.ratio * 100, 1) + ' %)' };
      }
    },
    {
      id: 'capacidad', claro: 'Cuántos negocios aguantaría antes de pasar ese límite gratuito.', nombre: 'Capacidad máxima de negocios', unidad: 'negocios', dec: 0, mejor: 'mayor',
      formula: 'N_máx = ⌊ N / U ⌋',
      explica: 'La carga crece en proporción a N, así que N_máx es el número de negocios con el que la cuota más exigente llegaría al 100 %. Pasado ese punto hay que pagar Workers Paid.',
      usa: ['N', 'uso'],
      calc: function (c) {
        var val = Math.floor(c.v.N / c.lim.ratio);
        return { valor: val, sust: '⌊' + n(c.v.N, 0) + ' / ' + n(c.lim.ratio, 4) + '⌋ = ' + n(val, 0) + ' negocios' };
      }
    },
    {
      id: 'costo', claro: 'Cuánto cuesta al mes: la infraestructura más la IA.', nombre: 'Costo mensual total (infraestructura + IA)', unidad: 'USD', dec: 2, mejor: 'menor',
      formula: 'K = K_infra + N × P × USD_IA,   K_infra = costo del diseño si U ≤ 100 %; si no, USD_pago + excedentes',
      explica: 'Mientras ninguna cuota se exceda, la infraestructura cuesta lo que indica el diseño (USD 0 en el plan gratuito). Si se excede una cuota, se asume que el equipo paga Workers Paid más los excedentes de peticiones y de operaciones de cola.',
      usa: ['N', 'P', 'costoIA', 'uso', 'PLAN_PAGO', 'REQ_INCLUIDAS', 'REQ_EXTRA', 'OPS_INCLUIDAS', 'OPS_EXTRA'],
      calc: function (c) {
        var pagado = c.lim.ratio > 1;
        var infra = c.p.costoInfra.valor;
        var detalle = '';
        if (pagado) {
          var reqMes = c.peticionesW * P.DIAS;
          var extraReq = Math.max(0, reqMes - P.REQ_INCLUIDAS) / 1e6 * P.REQ_EXTRA;
          var opsMes = c.G * P.DIAS * 3;
          var tieneCola = c.p.cuotas.some(function (q) { return q.id === 'queues'; });
          var extraOps = tieneCola ? Math.max(0, opsMes - P.OPS_INCLUIDAS) / 1e6 * P.OPS_EXTRA : 0;
          infra = P.PLAN_PAGO + extraReq + extraOps;
          detalle = 'Se excede una cuota gratuita → Workers Paid: ' + n(P.PLAN_PAGO, 2) + ' + excedentes ' + n(extraReq + extraOps, 2) + ' = ' + n(infra, 2) + '. ';
        } else {
          detalle = 'Ninguna cuota se excede → infraestructura ' + n(infra, 2) + '. ';
        }
        var ia = c.v.N * c.v.P * c.v.costoIA;
        var val = infra + ia;
        return { valor: val, sust: detalle + 'IA: ' + n(c.v.N, 0) + ' × ' + n(c.v.P, 0) + ' × ' + n(c.v.costoIA, 4) + ' = ' + n(ia, 2) + '. Total: ' + n(val, 2) + ' USD' };
      }
    },
    {
      id: 'comp', claro: 'Cuántas piezas tiene que vigilar el equipo.', nombre: 'Componentes que operar', unidad: 'componentes', dec: 0, mejor: 'menor',
      formula: 'S = número de componentes del diseño',
      explica: 'Mide la simplicidad operativa: cuántas piezas debe vigilar el equipo de 3 personas.',
      usa: ['componentes'],
      calc: function (c) {
        var val = c.p.componentes.valor;
        return { valor: val, sust: n(val, 0) + ' componente' + (val === 1 ? '' : 's') + ' según el diseño' };
      }
    }
  ];

  function indicador(id) {
    for (var i = 0; i < INDICADORES.length; i++) if (INDICADORES[i].id === id) return INDICADORES[i];
    return null;
  }

  /* Qué indicador responde cada requisito del paso Configuración, y en qué sentido. */
  var REQ_MAP = {
    costo: { ind: 'costo', op: '<=', corto: 'Costo' },
    disp_min: { ind: 'disp', op: '>=', corto: 'Disponibilidad mínima' },
    lat_lig: { ind: 'latLig', op: '<=', corto: 'Latencia ligera' },
    t_preview: { ind: 'tPrev', op: '<=', corto: 'Tiempo hasta el preview' },
    disp_alta: { ind: 'disp', op: '>=', corto: 'Disponibilidad alta' },
    escala: { ind: 'capacidad', op: '>=', corto: 'Escalabilidad' },
    simplicidad: { ind: 'comp', op: '<=', corto: 'Simplicidad' },
    pico: { ind: 'exito', op: '>=', corto: 'Pico atendido' }
  };

  /* ---------- Cálculo y evaluación ---------- */
  function calcular(vars, alt) {
    var c = contexto(vars, alt);
    var out = { alt: alt, ctx: c, ind: {} };
    INDICADORES.forEach(function (i) {
      var r = i.calc(c);
      out.ind[i.id] = { id: i.id, valor: r.valor, sust: r.sust };
    });
    return out;
  }

  function cumple(op, valor, meta) {
    return op === '>=' ? valor + 1e-9 >= meta : valor <= meta + 1e-9;
  }

  /* Crédito parcial de un deseable entre 0 y 1. Para disponibilidad se comparan minutos de caída,
     porque 99,5 % y 99,9 % se parecen como porcentaje pero difieren 5 veces en caída. */
  function credito(def, op, valor, meta) {
    if (cumple(op, valor, meta)) return 1;
    if (def.credito === 'caida') {
      var caida = 100 - valor;
      return caida <= 0 ? 1 : Math.max(0, Math.min(1, (100 - meta) / caida));
    }
    if (op === '>=') return meta <= 0 ? 1 : Math.max(0, Math.min(1, valor / meta));
    return valor <= 0 ? 1 : Math.max(0, Math.min(1, meta / valor));
  }

  function evaluar(cfg, vars, alt, pesos) {
    pesos = pesos || {};
    var calc = calcular(vars, alt);
    var reqs = [];
    var sumaPesos = 0, sumaCred = 0;
    cfg.requisitos.forEach(function (r) {
      var m = REQ_MAP[r.id];
      if (!m || !r.nucleo) return;
      var def = indicador(m.ind);
      var valor = calc.ind[m.ind].valor;
      var evaluable = typeof r.meta === 'number' && isFinite(r.meta);
      var item = { id: r.id, nombre: r.nombre, corto: m.corto, tipo: r.tipo, op: m.op, meta: r.meta, indicador: m.ind, valor: valor, evaluable: evaluable, cumple: null, margen: null, credito: null };
      if (evaluable) {
        item.cumple = cumple(m.op, valor, r.meta);
        item.margen = m.op === '>=' ? valor - r.meta : r.meta - valor;
        item.credito = credito(def, m.op, valor, r.meta);
        if (r.tipo === 'deseable') {
          var w = typeof pesos[r.id] === 'number' && pesos[r.id] > 0 ? pesos[r.id] : 1;
          item.peso = w;
          sumaPesos += w;
          sumaCred += w * item.credito;
        }
      }
      reqs.push(item);
    });
    var incumple = reqs.filter(function (r) { return r.evaluable && r.tipo === 'obligatorio' && !r.cumple; });
    return {
      alt: alt,
      ind: calc.ind,
      ctx: calc.ctx,
      reqs: reqs,
      incumple: incumple,
      descartada: incumple.length > 0,
      estado: incumple.length ? 'descartada' : 'viable',
      puntaje: sumaPesos > 0 ? 100 * sumaCred / sumaPesos : null
    };
  }

  function evaluarTodas(cfg, vars, pesos) {
    var res = D.ALTERNATIVAS.map(function (a) { return evaluar(cfg, vars, a, pesos); });
    var ranking = res.filter(function (r) { return !r.descartada; }).sort(function (a, b) {
      return (b.puntaje == null ? -1 : b.puntaje) - (a.puntaje == null ? -1 : a.puntaje);
    }).map(function (r) { return r.alt.id; });
    return { alternativas: res, ranking: ranking };
  }

  /* ---------- Lectura del resultado (texto generado del cálculo, no escrito a mano) ----------
     Devuelve datos, no HTML: la vista los formatea. Así se puede probar sin navegador. */
  function requisitosQueFallan(a) {
    return a.incumple.map(function (r) {
      return { corto: r.corto, op: r.op, meta: r.meta, valor: r.valor, indicador: r.indicador };
    });
  }

  /* Requisitos deseables en los que la primera supera a la segunda, de mayor a menor diferencia ponderada. */
  function ventajasSobre(L, R) {
    var out = [];
    L.reqs.forEach(function (r, i) {
      var q = R.reqs[i];
      if (r.tipo !== 'deseable' || r.credito == null || !q || q.credito == null) return;
      var dif = (r.credito - q.credito) * (r.peso || 1);
      if (dif > 0.005) out.push({ corto: r.corto, dif: dif });
    });
    out.sort(function (a, b) { return b.dif - a.dif; });
    return out.slice(0, 3);
  }

  function lectura(cur) {
    var porId = {};
    cur.alternativas.forEach(function (a) { porId[a.alt.id] = a; });
    var vi = cur.ranking.map(function (id) { return porId[id]; });
    var desc = cur.alternativas.filter(function (a) { return a.descartada; });
    var o = { clase: '', lider: null, segunda: null, ventajas: [], empate: false, sinDeseables: false, diferencia: null };
    if (!vi.length) {
      o.clase = 'nada';
    } else {
      o.lider = vi[0];
      if (vi.length > 1) {
        o.segunda = vi[1];
        if (vi[0].puntaje == null || vi[1].puntaje == null) o.sinDeseables = true;
        else {
          o.diferencia = vi[0].puntaje - vi[1].puntaje;
          if (o.diferencia < 0.05) o.empate = true;
          else o.ventajas = ventajasSobre(vi[0], vi[1]);
        }
      }
    }
    o.descartadas = desc.map(function (a) { return { id: a.alt.id, nombre: a.alt.nombre, motivos: requisitosQueFallan(a) }; });
    o.viables = vi;
    return o;
  }

  /* ---------- Escenarios evaluados (requisitos 5, 6 y 7) ---------- */
  function evaluarEscenarios(cfg, pesos) {
    return ESCENARIOS.map(function (esc) {
      var vars = varsDeCaso(esc);
      var res = evaluarTodas(cfg, vars, pesos);
      return { esc: esc, vars: vars, res: res, lectura: lectura(res) };
    });
  }

  /* Busca el valor de una variable en el que la alternativa cambia de viable a descartada o al revés.
     Bisección sobre el rango válido de la variable; devuelve null si no cambia dentro del rango. */
  function umbral(cfg, vars, pesos, altId, varId) {
    var def = defVar(varId);
    if (!def || def.tipo === 'opcion') return null;
    function viableEn(x) {
      var v = {};
      Object.keys(vars).forEach(function (k) { v[k] = vars[k]; });
      v[varId] = x;
      var r = evaluarTodas(cfg, v, pesos).alternativas.filter(function (a) { return a.alt.id === altId; })[0];
      return !r.descartada;
    }
    var lo = def.min, hi = def.max;
    var vLo = viableEn(lo), vHi = viableEn(hi);
    if (vLo === vHi) return null;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (viableEn(mid) === vLo) lo = mid; else hi = mid;
    }
    var punto = def.entero ? (vLo ? Math.floor(lo) : Math.ceil(hi)) : (vLo ? lo : hi);
    return { variable: def, valor: punto, viableHacia: vLo ? 'menor' : 'mayor' };
  }

  /* Disponibilidad por componente que necesita una alternativa para llegar a una meta de disponibilidad. */
  function dMinimo(alt, metaDisp) {
    return 100 * Math.pow(metaDisp / 100, 1 / alt.parametros.enSerie.valor);
  }

  /* ---------- Barrido de sensibilidad ----------
     Recorre una variable por su rango visible y evalúa las tres alternativas en cada punto.
     Sirve para dibujar cómo cambia el puntaje y en qué punto cambia la recomendación. */
  function barrido(cfg, vars, pesos, varId, pasos) {
    var def = defVar(varId);
    if (!def || def.tipo === 'opcion') return null;
    pasos = pasos || 40;
    var lo = def.deslizar ? def.deslizar[0] : def.min;
    var hi = def.deslizar ? def.deslizar[1] : def.max;
    var actual = vars[varId];
    if (actual < lo) lo = actual;
    if (actual > hi) hi = actual;
    var puntos = [];
    for (var i = 0; i <= pasos; i++) {
      var x = lo + (hi - lo) * (i / pasos);
      if (def.entero) x = Math.round(x);
      var v = {};
      Object.keys(vars).forEach(function (k) { v[k] = vars[k]; });
      v[varId] = x;
      var r = evaluarTodas(cfg, v, pesos);
      var fila = { x: x, lider: r.ranking.length ? r.ranking[0] : null, alts: {} };
      r.alternativas.forEach(function (a) {
        fila.alts[a.alt.id] = { puntaje: a.descartada ? null : a.puntaje, descartada: a.descartada };
      });
      puntos.push(fila);
    }
    /* Puntos donde cambia quién lidera: son los que hacen falta para explicar la decisión. */
    var cortes = [];
    for (var j = 1; j < puntos.length; j++) {
      if (puntos[j].lider !== puntos[j - 1].lider) {
        cortes.push({ desde: puntos[j - 1].lider, hasta: puntos[j].lider, x: puntos[j].x });
      }
    }
    return { def: def, lo: lo, hi: hi, actual: actual, puntos: puntos, cortes: cortes };
  }

  /* ---------- Recomendación explicable (requisito 8) ----------
     Se arma sobre los resultados de todos los escenarios. No hay texto de conclusión escrito a mano:
     la alternativa elegida, los motivos y las condiciones salen del cálculo. */
  function recomendar(cfg, vars, pesos) {
    vars = vars || referencia();
    var evals = evaluarEscenarios(cfg, pesos);
    var total = evals.length;
    /* La situación que el usuario tiene puesta ahora mismo en el Simulador. */
    var actual = evaluarTodas(cfg, vars, pesos);
    var actualPorId = {};
    actual.alternativas.forEach(function (a) { actualPorId[a.alt.id] = a; });

    /* Cuenta por alternativa: en cuántos escenarios es viable y en cuántos lidera. */
    var conteo = {};
    D.ALTERNATIVAS.forEach(function (a) {
      conteo[a.id] = { alt: a, viable: 0, lidera: 0, descartada: 0, sumaPuntaje: 0, conPuntaje: 0, fallos: {} };
    });
    evals.forEach(function (e) {
      var lider = e.res.ranking.length ? e.res.ranking[0] : null;
      e.res.alternativas.forEach(function (r) {
        var c = conteo[r.alt.id];
        if (r.descartada) {
          c.descartada++;
          r.incumple.forEach(function (x) { c.fallos[x.corto] = (c.fallos[x.corto] || 0) + 1; });
        } else {
          c.viable++;
          if (r.puntaje != null) { c.sumaPuntaje += r.puntaje; c.conPuntaje++; }
          if (r.alt.id === lider) c.lidera++;
        }
      });
    });
    Object.keys(conteo).forEach(function (k) {
      var c = conteo[k];
      c.actual = actualPorId[k];
      c.promedio = c.conPuntaje ? c.sumaPuntaje / c.conPuntaje : null;
      c.motivosFrecuentes = Object.keys(c.fallos).map(function (m) { return { corto: m, veces: c.fallos[m] }; })
        .sort(function (a, b) { return b.veces - a.veces; });
    });

    /* Criterio, en este orden:
       1. Ser viable en la situación actual (lo que el usuario tiene puesto en el Simulador).
       2. Entre las viables ahora, el mayor puntaje en esa misma situación.
       3. A igualdad, la que aguanta más escenarios distintos (robustez).
       Si ninguna es viable ahora, se ordena solo por robustez. */
    var hayViableAhora = D.ALTERNATIVAS.some(function (a) { return !actualPorId[a.id].descartada; });
    var orden = D.ALTERNATIVAS.map(function (a) { return conteo[a.id]; }).sort(function (x, y) {
      var xv = x.actual.descartada ? 0 : 1, yv = y.actual.descartada ? 0 : 1;
      if (hayViableAhora && xv !== yv) return yv - xv;
      if (hayViableAhora && xv === 1) {
        var dif = (y.actual.puntaje || 0) - (x.actual.puntaje || 0);
        if (Math.abs(dif) > 0.05) return dif;
      }
      return (y.viable - x.viable) || (y.lidera - x.lidera) || ((y.promedio || 0) - (x.promedio || 0));
    });
    var ganador = hayViableAhora
      ? orden.filter(function (c) { return !c.actual.descartada; })[0]
      : null;
    var segundo = orden.filter(function (c) { return c !== ganador; })[0] || null;

    /* Detalle en la situación actual: qué requisitos cumple y cuáles no. */
    var detalleRef = ganador ? ganador.actual : null;

    /* Riesgos: supuestos no medidos de los que depende la recomendación, y lo que el modelo no cubre. */
    var riesgos = [];
    if (ganador) {
      var variablesClave = VARIABLES.filter(function (v) { return v.base === 'Supuesto' && v.sensibilidad; });
      variablesClave.forEach(function (v) {
        riesgos.push('La recomendación depende de «' + v.nombre + '», que es un supuesto sin medir (referencia: ' + limpio(v.ref, 2) + ' ' + v.unidad + ').');
      });
      if (ganador.descartada > 0) {
        riesgos.push(ganador.alt.nombre + ' queda descartada en ' + ganador.descartada + ' de ' + total + ' escenarios, por ' +
          ganador.motivosFrecuentes.map(function (m) { return m.corto; }).join(' y ') + '.');
      }
      var p = ganador.alt.parametros;
      if (p.enSerie.valor === 1) riesgos.push('Con un solo componente no hay aislamiento: un error de código afecta todas las rutas a la vez.');
      if (p.asincrona.valor) riesgos.push('El usuario no recibe el preview en la misma respuesta, así que la interfaz debe manejar la espera y los reintentos.');
    }

    /* Condiciones que harían cambiar la recomendación, calculadas sobre el escenario de referencia. */
    var condiciones = [];
    var metaDisp = null;
    cfg.requisitos.forEach(function (r) {
      if (r.id === 'disp_min' && r.nucleo && typeof r.meta === 'number' && isFinite(r.meta)) metaDisp = r.meta;
    });
    if (metaDisp != null) {
      D.ALTERNATIVAS.forEach(function (a) {
        var enRef = actualPorId[a.id];
        var falla = enRef.incumple.some(function (x) { return x.id === 'disp_min'; });
        if (!falla) return;
        condiciones.push({
          tipo: 'disponibilidad', alt: a,
          texto: a.id + ' · ' + a.nombre + ' solo alcanzaría la disponibilidad mínima de ' + limpio(metaDisp, 2) +
            ' % si cada uno de sus ' + a.parametros.enSerie.valor + ' componentes en serie llegara a ' + n(dMinimo(a, metaDisp), 3) + ' %.'
        });
      });
    }
    if (ganador) {
      var vRef = vars;
      ['Q', 'tIA', 'N', 'd', 'L'].forEach(function (varId) {
        var u = umbral(cfg, vRef, pesos, ganador.alt.id, varId);
        if (!u) return;
        condiciones.push({
          tipo: 'umbral', alt: ganador.alt,
          texto: ganador.alt.id + ' deja de ser viable si «' + u.variable.nombre + '» ' +
            (u.viableHacia === 'menor' ? 'sube de ' : 'baja de ') +
            limpio(u.valor, u.variable.paso < 1 ? 2 : 0) + (u.variable.unidad ? ' ' + u.variable.unidad : '') +
            ' (hoy está en ' + limpio(vRef[varId], u.variable.paso < 1 ? 2 : 0) + ').'
        });
      });
    }

    return {
      escenarios: evals,
      vars: vars,
      actual: actual,
      actualPorId: actualPorId,
      hayViableAhora: hayViableAhora,
      total: total,
      conteo: conteo,
      orden: orden,
      ganador: ganador,
      segundo: segundo,
      detalleRef: detalleRef,
      riesgos: riesgos,
      condiciones: condiciones
    };
  }

  /* ---------- Documentación del modelo (se muestra en la pestaña Modelo) ---------- */
  /* Cada texto empieza con una frase corta que sirve de titular; el resto es el detalle.
     La interfaz muestra solo el titular y despliega el detalle al tocar la fila. */
  var SUPUESTOS = [
    'Las tres reciben la misma carga. Usan el mismo modelo de IA, el mismo hosting estático y los mismos servicios de datos.',
    'Los componentes fallan de forma independiente. La disponibilidad del conjunto es el producto de la de los componentes en serie.',
    'El pico llega de golpe. Se modela como Q generaciones a la vez; el servicio de IA atiende C en paralelo y las demás esperan por rondas. Se reporta el peor caso del pico, no el promedio.',
    'Todas las peticiones de un mismo tipo cuestan lo mismo. No se modelan ráfagas ni distribución por horas.',
    'Si se excede una cuota gratuita, se paga. El equipo paga Workers Paid (USD 5 al mes más excedentes) en vez de rechazar tráfico.',
    'Las llamadas entre componentes cuentan como peticiones en el peor caso. Lo mismo vale para las invocaciones del consumidor de la cola. Se puede cambiar en el Simulador.',
    'El tiempo de la IA es igual en las tres y no depende de la carga.',
    'Las consultas de estado de C son peticiones ligeras al Worker de entrada.',
    'Una meta inválida no se evalúa. Un requisito informativo (agregado a mano) no entra al cálculo.'
  ];
  var LIMITACIONES = [
    'Es un modelo analítico y determinista. No simula el paso del tiempo ni llegadas aleatorias, y no calcula percentiles reales (p95, p99).',
    'No modela el límite de 10 ms de CPU del plan gratuito. Si un Worker lo excede, la petición falla aunque la cuota alcance.',
    'Los parámetros Supuesto no están medidos. Son los tiempos base, los saltos, el acoplamiento y la capacidad de la IA; si cambian, los resultados cambian.',
    'No considera la red del usuario, los arranques en frío, las cachés ni el comportamiento de D1 y R2 bajo carga.',
    'No incluye costos de almacenamiento, dominio ni el tiempo del equipo.',
    '«Pico atendido» informa, pero no discrimina. No descarta a nadie mientras su meta de tiempo sea menor que la espera máxima de una petición síncrona (T_c = 60 s): los pedidos que se pierden por tiempo de espera solo aparecen cuando el tiempo hasta el preview ya rompió su propia meta.',
    'Son estimaciones del modelo, no mediciones de rendimiento. Los estudios de referencia (por ejemplo, que el monolito rinde mejor en una sola máquina) no se deben generalizar a este caso.'
  ];
  var PARA_VALIDAR = [
    'Pruebas de carga sobre un prototipo de cada alternativa. Con k6 o Apache JMeter, usando N, Q y L del escenario y midiendo p50, p95 y p99.',
    'Tiempo real de la IA y tokens por preview. Sirven para fijar t_IA y el costo de IA por preview.',
    'CPU por petición de cada Worker en el prototipo. Confirma el límite de 10 ms del plan gratuito.',
    'Disponibilidad observada durante varias semanas. Con analíticas de Cloudflare o pruebas sintéticas, para calibrar d.',
    'Confirmar con Cloudflare si las llamadas entre Workers cuentan contra el límite gratuito. Aplica también a las invocaciones del consumidor de Queues.',
    'Pedidos reales de los primeros clientes. Reemplazan los supuestos de N, P y L.'
  ];
  var CRITERIOS = [
    'Un requisito obligatorio incumplido descarta la alternativa.',
    'Cada requisito deseable da un crédito de 0 a 1. Vale 1 si se cumple; si no, qué tan cerca queda de la meta. En la disponibilidad se comparan minutos de caída, no porcentajes.',
    'El puntaje (0 a 100) es el promedio de los créditos, ponderado por los pesos. Con pesos iguales, todos los deseables valen lo mismo.'
  ];

  window.Modelo = {
    PARAMS: PARAMS,
    P: P,
    VARIABLES: VARIABLES,
    CASOS: CASOS,
    ESCENARIOS: ESCENARIOS,
    escenario: escenario,
    varsDeCaso: varsDeCaso,
    INDICADORES: INDICADORES,
    REQ_MAP: REQ_MAP,
    SUPUESTOS: SUPUESTOS,
    LIMITACIONES: LIMITACIONES,
    PARA_VALIDAR: PARA_VALIDAR,
    CRITERIOS: CRITERIOS,
    defVar: defVar,
    indicador: indicador,
    referencia: referencia,
    errorVar: errorVar,
    validarVars: validarVars,
    contexto: contexto,
    calcular: calcular,
    evaluar: evaluar,
    evaluarTodas: evaluarTodas,
    dMinimo: dMinimo,
    lectura: lectura,
    ventajasSobre: ventajasSobre,
    evaluarEscenarios: evaluarEscenarios,
    umbral: umbral,
    barrido: barrido,
    recomendar: recomendar,
    fmt: n,
    limpio: limpio
  };
})();
