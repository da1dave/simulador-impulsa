/* Pruebas del modelo (requisito 10). Se ejecutan al abrir pruebas.html.
   Cada prueba usa la configuración y las variables de referencia, nunca las guardadas en el navegador,
   así el resultado no depende de lo que el equipo haya cambiado en la interfaz. */
(function () {
  'use strict';

  var M = window.Modelo, S = window.Sim, D = window.DATOS;

  function cfg() { return S.defaults(); }
  function vars(cambios) {
    var v = M.referencia();
    Object.keys(cambios || {}).forEach(function (k) { v[k] = cambios[k]; });
    return v;
  }
  function ev(c, v, pesos) { return M.evaluarTodas(c, v, pesos || {}).alternativas; }
  function por(alts, id) { return alts.filter(function (a) { return a.alt.id === id; })[0]; }
  function cerca(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-6); }
  function afirmar(cond, msg) { if (!cond) throw new Error(msg); }

  var PRUEBAS = [
    {
      nombre: 'Disponibilidad en serie: A, B y C con d = 99,5 %',
      que: 'Verifica la fórmula D = 100 × (d/100)^n con n = 1, 3 y 2 componentes en serie.',
      fn: function () {
        var r = ev(cfg(), vars());
        afirmar(cerca(por(r, 'A').ind.disp.valor, 99.5), 'A debería dar 99,5 y dio ' + por(r, 'A').ind.disp.valor);
        afirmar(cerca(por(r, 'B').ind.disp.valor, 100 * Math.pow(0.995, 3)), 'B no coincide con 100·0,995³');
        afirmar(cerca(por(r, 'C').ind.disp.valor, 100 * Math.pow(0.995, 2)), 'C no coincide con 100·0,995²');
      }
    },
    {
      nombre: 'Con d = 100 % las tres alternativas tienen disponibilidad 100 %',
      que: 'Caso límite: sin fallos de componentes, el número de componentes en serie no importa.',
      fn: function () {
        ev(cfg(), vars({ d: 100 })).forEach(function (a) { afirmar(cerca(a.ind.disp.valor, 100), a.alt.id + ' no dio 100'); });
      }
    },
    {
      nombre: 'Monotonía: más negocios nunca reduce el uso de cuota ni el costo',
      que: 'Coherencia: al subir N de 10 a 20.000, el uso de cuota y el costo de cada alternativa no bajan.',
      fn: function () {
        var c = cfg();
        ['A', 'B', 'C'].forEach(function (id) {
          var uso = -1, costo = -1;
          [10, 50, 100, 500, 2000, 5000, 20000].forEach(function (n) {
            var a = por(ev(c, vars({ N: n })), id);
            afirmar(a.ind.uso.valor >= uso - 1e-9, id + ': el uso bajó al subir N a ' + n);
            afirmar(a.ind.costo.valor >= costo - 1e-9, id + ': el costo bajó al subir N a ' + n);
            uso = a.ind.uso.valor; costo = a.ind.costo.valor;
          });
        });
      }
    },
    {
      nombre: 'Capacidad coherente: con N = capacidad el uso llega a 100 % y con N + 1 lo supera',
      que: 'La capacidad máxima es ⌊N/U⌋; por tanto, justo en ese punto la cuota más exigente se agota.',
      fn: function () {
        var c = cfg();
        ['A', 'B', 'C'].forEach(function (id) {
          var cap = por(ev(c, vars()), id).ind.capacidad.valor;
          var enCap = por(ev(c, vars({ N: cap })), id).ind.uso.valor;
          var sobre = por(ev(c, vars({ N: cap + 1 })), id).ind.uso.valor;
          afirmar(enCap <= 100 + 1e-6, id + ': con N = ' + cap + ' el uso es ' + enCap);
          afirmar(sobre > 100, id + ': con N = ' + (cap + 1) + ' el uso debería superar 100 y es ' + sobre);
        });
      }
    },
    {
      nombre: 'Costo: dentro de la cuota es USD 0 de infraestructura; al excederla se paga Workers Paid',
      que: 'Regla de costo: si el uso supera 100 %, la infraestructura cuesta al menos USD 5 al mes.',
      fn: function () {
        var c = cfg();
        var base = por(ev(c, vars({ N: 100, costoIA: 0 })), 'A');
        afirmar(cerca(base.ind.costo.valor, 0), 'Con IA gratis y poca carga el costo debería ser 0 y es ' + base.ind.costo.valor);
        var alto = por(ev(c, vars({ N: 6000, costoIA: 0 })), 'A');
        afirmar(alto.ind.uso.valor > 100, 'Con 6.000 negocios A debería exceder la cuota');
        afirmar(alto.ind.costo.valor >= 5, 'Al exceder la cuota el costo debería ser al menos 5 y es ' + alto.ind.costo.valor);
      }
    },
    {
      nombre: 'Un obligatorio incumplido descarta la alternativa, y relajar la meta la rehabilita',
      que: 'Con los valores de referencia B incumple la disponibilidad mínima de 99 %. Con meta 98 %, o con d = 99,9 %, deja de estar descartada.',
      fn: function () {
        var c = cfg();
        afirmar(por(ev(c, vars()), 'B').descartada, 'B debería estar descartada con los valores de referencia');
        afirmar(!por(ev(c, vars()), 'A').descartada, 'A no debería estar descartada con los valores de referencia');
        var c2 = cfg();
        c2.requisitos.filter(function (r) { return r.id === 'disp_min'; })[0].meta = 98;
        afirmar(!por(ev(c2, vars()), 'B').descartada, 'Con meta 98 % B debería estar viable');
        afirmar(!por(ev(c, vars({ d: 99.9 })), 'B').descartada, 'Con d = 99,9 % B debería estar viable');
      }
    },
    {
      nombre: 'Tiempo hasta el preview con la carga de referencia',
      que: 'A = t_IA + t_L; B suma 2 saltos; C suma además la espera de lote y el intervalo de consulta. Se compara contra el valor de referencia del modelo, no contra un número escrito aquí.',
      fn: function () {
        var v = vars();
        var r = ev(cfg(), v);
        var P = M.P, t = v.tIA;
        afirmar(cerca(por(r, 'A').ind.tPrev.valor, t + P.T_LIG), 'A: ' + por(r, 'A').ind.tPrev.valor);
        afirmar(cerca(por(r, 'B').ind.tPrev.valor, t + 2 * P.T_SALTO + P.T_LIG), 'B: ' + por(r, 'B').ind.tPrev.valor);
        afirmar(cerca(por(r, 'C').ind.tPrev.valor, t + P.T_SALTO + P.T_LIG + P.T_LOTE + v.sondeo), 'C: ' + por(r, 'C').ind.tPrev.valor);
      }
    },
    {
      nombre: 'Pico: con IA lenta y muchas generaciones, A y B pierden pedidos y C los conserva',
      que: 'Q = 50 y t_IA = 15 s: en 60 s caben 4 rondas de 8 = 32 de 50 (64 %) en A y B; C los retiene en la cola.',
      fn: function () {
        var r = ev(cfg(), vars({ Q: 50, tIA: 15 }));
        afirmar(cerca(por(r, 'A').ind.exito.valor, 64), 'A: ' + por(r, 'A').ind.exito.valor);
        afirmar(cerca(por(r, 'B').ind.exito.valor, 64), 'B: ' + por(r, 'B').ind.exito.valor);
        afirmar(cerca(por(r, 'C').ind.exito.valor, 100), 'C: ' + por(r, 'C').ind.exito.valor);
      }
    },
    {
      nombre: 'Contar o no las llamadas entre Workers solo cambia a B y a C, nunca a A',
      que: 'La variable «cs» multiplica las llamadas entre componentes; A no tiene ninguna.',
      fn: function () {
        var c = cfg();
        var si = ev(c, vars({ contarSaltos: 1 })), no = ev(c, vars({ contarSaltos: 0 }));
        afirmar(cerca(por(si, 'A').ind.uso.valor, por(no, 'A').ind.uso.valor), 'A cambió');
        afirmar(por(no, 'B').ind.uso.valor < por(si, 'B').ind.uso.valor, 'B debería usar menos cuota si las llamadas no cuentan');
        afirmar(por(no, 'C').ind.uso.valor < por(si, 'C').ind.uso.valor, 'C debería usar menos cuota si las llamadas no cuentan');
      }
    },
    {
      nombre: 'Los pesos cambian el puntaje: más peso a un deseable que A incumple lo baja',
      que: 'A cumple 99,5 % frente a la meta deseable de 99,9 %. Si ese requisito pesa 10 en vez de 1, el puntaje de A baja.',
      fn: function () {
        var c = cfg();
        var igual = por(ev(c, vars(), {}), 'A').puntaje;
        var cargado = por(ev(c, vars(), { disp_alta: 10 }), 'A').puntaje;
        afirmar(cargado < igual, 'Con peso 10 el puntaje debería bajar: ' + igual + ' → ' + cargado);
      }
    },
    {
      nombre: 'Validación de variables: rechaza vacío, texto, fuera de rango y no enteros',
      que: 'Controles de entradas inválidas (N, d y la opción de conteo de llamadas).',
      fn: function () {
        function malo(id, x) { afirmar(M.errorVar(M.defVar(id), x) !== '', id + ' = ' + x + ' debería ser inválido'); }
        function bueno(id, x) { afirmar(M.errorVar(M.defVar(id), x) === '', id + ' = ' + x + ' debería ser válido'); }
        malo('N', null); malo('N', NaN); malo('N', 0); malo('N', 1.5); malo('N', 100001); malo('d', 89.99); malo('d', 100.01); malo('contarSaltos', 2);
        bueno('N', 1); bueno('N', 100000); bueno('d', 90); bueno('d', 100); bueno('contarSaltos', 0);
        afirmar(M.validarVars(vars()).count === 0, 'Las variables de referencia deben ser válidas');
      }
    },
    {
      nombre: 'Validación de la configuración: meta vacía, disponibilidad alta menor que la mínima, sin obligatorios',
      que: 'Controles de entradas inválidas del requisito 1.',
      fn: function () {
        afirmar(S.validate(cfg()).count === 0, 'La configuración por defecto debe ser válida');
        var a = cfg();
        a.requisitos.filter(function (r) { return r.id === 'costo'; })[0].meta = null;
        afirmar(S.validate(a).errors['req.costo.meta'], 'Debería rechazar una meta vacía');
        var b = cfg();
        b.requisitos.filter(function (r) { return r.id === 'disp_alta'; })[0].meta = 98;
        afirmar(S.validate(b).errors['req.disp_alta.meta'], 'Debería rechazar disponibilidad alta menor que la mínima');
        var c = cfg();
        c.requisitos.forEach(function (r) { r.tipo = 'deseable'; });
        afirmar(S.validate(c).errors['req'], 'Debería exigir al menos un obligatorio');
      }
    },
    {
      nombre: 'Trazabilidad: cada indicador de cada alternativa devuelve su cálculo con números',
      que: 'Criterio fundamental: la relación entre entradas y resultados debe poder mostrarse paso a paso.',
      fn: function () {
        ev(cfg(), vars()).forEach(function (a) {
          M.INDICADORES.forEach(function (i) {
            var t = a.ind[i.id].sust;
            afirmar(typeof t === 'string' && /\d/.test(t), a.alt.id + '/' + i.id + ' no tiene traza numérica');
            afirmar(typeof a.ind[i.id].valor === 'number' && isFinite(a.ind[i.id].valor), a.alt.id + '/' + i.id + ' no es un número finito');
          });
        });
      }
    },
    {
      nombre: 'Escenarios: cada uno produce un resultado coherente con su contexto',
      que: 'Cada escenario solo cambia variables; el resultado sale del cálculo. Se comprueba el estado de cada alternativa en los escenarios clave y que ningún escenario deje una variable fuera de rango.',
      fn: function () {
        function estados(caso) {
          var c = M.CASOS.filter(function (x) { return x.id === caso; })[0];
          afirmar(!!c, 'No existe el caso ' + caso);
          var r = M.evaluarTodas(cfg(), M.varsDeCaso(c), {});
          return r.alternativas.map(function (a) { return a.alt.id + ':' + a.estado; }).join(' ');
        }
        afirmar(estados('ref') === 'A:viable B:descartada C:viable', 'Lanzamiento: ' + estados('ref'));
        afirmar(estados('fiable') === 'A:viable B:viable C:viable', 'Plataforma muy fiable: ' + estados('fiable'));
        afirmar(estados('inestable') === 'A:viable B:descartada C:descartada', 'Plataforma inestable: ' + estados('inestable'));
        afirmar(estados('pico') === 'A:descartada B:descartada C:descartada', 'Campaña con pico: ' + estados('pico'));
        afirmar(estados('prompt') === 'A:viable B:descartada C:viable', 'IA más rápida: ' + estados('prompt'));
        // El caso de referencia no cambia ninguna variable.
        var ref = M.referencia(), cr = M.varsDeCaso(M.CASOS[0]);
        M.VARIABLES.forEach(function (d) { afirmar(ref[d.id] === cr[d.id], 'El caso de referencia cambió ' + d.id); });
        // Todos los valores de todos los casos son válidos para el modelo.
        M.CASOS.forEach(function (c) {
          M.VARIABLES.forEach(function (d) {
            afirmar(M.errorVar(d, M.varsDeCaso(c)[d.id]) === '', 'El caso ' + c.id + ' deja ' + d.id + ' fuera de rango');
          });
        });
      }
    },
    {
      nombre: 'Variables: cada una tiene pregunta en lenguaje llano y hay cinco esenciales',
      que: 'Garantiza que la interfaz pueda mostrar las variables con su pregunta y que lo esencial quede a la vista.',
      fn: function () {
        M.VARIABLES.forEach(function (d) { afirmar(typeof d.pregunta === 'string' && d.pregunta.length > 10, d.id + ' no tiene pregunta'); });
        afirmar(M.VARIABLES.filter(function (d) { return d.esencial; }).length === 5, 'Debe haber 5 variables esenciales');
      }
    },
    {
      nombre: 'Escenarios: los siete tienen contexto, pregunta y valores válidos',
      que: 'Requisito 5: cada escenario formal necesita nombre, contexto, pregunta e identificador único, y sus valores deben caer dentro del rango de cada variable.',
      fn: function () {
        afirmar(M.ESCENARIOS.length >= 3, 'La guía pide al menos 3 escenarios y hay ' + M.ESCENARIOS.length);
        var ids = {};
        M.ESCENARIOS.forEach(function (esc) {
          afirmar(!!esc.nombre && !!esc.contexto && !!esc.pregunta, 'El escenario ' + esc.id + ' no tiene nombre, contexto o pregunta');
          afirmar(esc.contexto.length > 40, 'El contexto de ' + esc.id + ' es demasiado corto');
          afirmar(!ids[esc.id], 'El identificador ' + esc.id + ' está repetido');
          ids[esc.id] = true;
          var v = M.varsDeCaso(esc);
          M.VARIABLES.forEach(function (d) {
            afirmar(M.errorVar(d, v[d.id]) === '', 'El escenario ' + esc.id + ' deja ' + d.id + ' fuera de rango');
          });
        });
      }
    },
    {
      nombre: 'Escenarios: evaluarEscenarios da un resultado por escenario y por alternativa',
      que: 'Requisito 6: cada escenario devuelve los ocho indicadores calculados para A, B y C, todos con un valor numérico.',
      fn: function () {
        var evals = M.evaluarEscenarios(cfg(), {});
        afirmar(evals.length === M.ESCENARIOS.length, 'Faltan escenarios: ' + evals.length);
        afirmar(M.INDICADORES.length >= 4, 'La guía pide al menos 4 indicadores y hay ' + M.INDICADORES.length);
        evals.forEach(function (e) {
          afirmar(e.res.alternativas.length === 3, 'El escenario ' + e.esc.id + ' no evaluó las 3 alternativas');
          e.res.alternativas.forEach(function (a) {
            M.INDICADORES.forEach(function (ind) {
              var v = a.ind[ind.id];
              afirmar(v && typeof v.valor === 'number', 'El indicador ' + ind.id + ' de ' + a.alt.id + ' en ' + e.esc.id + ' no es un número');
              afirmar(!!v.sust, 'El indicador ' + ind.id + ' de ' + a.alt.id + ' no trae la traza del cálculo');
            });
          });
        });
      }
    },
    {
      nombre: 'Comparación: el resultado no es el mismo en todos los escenarios',
      que: 'Requisito 7: si todos los escenarios dieran lo mismo, no servirían para decidir. Se comprueba que al menos una alternativa cambie de estado entre escenarios.',
      fn: function () {
        var evals = M.evaluarEscenarios(cfg(), {});
        var cambia = false;
        D.ALTERNATIVAS.forEach(function (alt) {
          var estados = evals.map(function (e) {
            return e.res.alternativas.filter(function (a) { return a.alt.id === alt.id; })[0].estado;
          });
          if (estados.indexOf('viable') >= 0 && estados.indexOf('descartada') >= 0) cambia = true;
        });
        afirmar(cambia, 'Ninguna alternativa cambia de estado entre los escenarios');
      }
    },
    {
      nombre: 'Lectura del modelo: nombra como líder a la primera del ranking',
      que: 'La frase que se muestra arriba de Variables sale de Modelo.lectura, no está escrita a mano. Se comprueba que el líder coincida con el ranking y que las descartadas traigan su motivo.',
      fn: function () {
        var cur = M.evaluarTodas(cfg(), vars(), {});
        var L = M.lectura(cur);
        if (cur.ranking.length) {
          afirmar(L.lider && L.lider.alt.id === cur.ranking[0], 'El líder no coincide con el ranking');
        } else {
          afirmar(L.lider === null, 'Sin viables no debería haber líder');
        }
        L.descartadas.forEach(function (d) {
          afirmar(d.motivos.length > 0, d.id + ' se descarta sin decir por qué');
          d.motivos.forEach(function (m) {
            afirmar(typeof m.valor === 'number' && typeof m.meta === 'number', 'El motivo de ' + d.id + ' no trae valor y meta');
          });
        });
        // Con d = 100 % ninguna debería descartarse por disponibilidad.
        var alto = M.lectura(M.evaluarTodas(cfg(), vars({ d: 100 }), {}));
        alto.descartadas.forEach(function (x) {
          x.motivos.forEach(function (m) { afirmar(m.corto.indexOf('Disponibilidad') < 0, 'Con d = 100 % no debería fallar por disponibilidad'); });
        });
      }
    },
    {
      nombre: 'Umbral: encuentra el punto exacto donde una alternativa deja de ser viable',
      que: 'El umbral se busca por bisección. Se comprueba que justo antes del punto la alternativa sea viable y justo después no, usando las generaciones simultáneas del pico.',
      fn: function () {
        var c = cfg(), v = vars();
        var u = M.umbral(c, v, {}, 'A', 'Q');
        afirmar(!!u, 'No se encontró umbral de Q para A');
        function estadoCon(q) {
          var vv = vars({ Q: q });
          return M.evaluarTodas(c, vv, {}).alternativas.filter(function (a) { return a.alt.id === 'A'; })[0].descartada;
        }
        afirmar(estadoCon(u.valor) === false, 'En el umbral (' + u.valor + ') A debería seguir viable');
        afirmar(estadoCon(u.valor + 1) === true, 'Pasado el umbral (' + (u.valor + 1) + ') A debería quedar descartada');
        // Una variable que no cambia el estado devuelve null.
        afirmar(M.umbral(c, v, {}, 'A', 'sondeo') === null || typeof M.umbral(c, v, {}, 'A', 'sondeo').valor === 'number', 'El umbral debe ser un número o null');
      }
    },
    {
      nombre: 'Recomendación: elige la alternativa viable en más escenarios y la justifica',
      que: 'Requisito 8: la recomendación sale del cálculo. Se comprueba que la elegida sea la de más escenarios viables, que las descartadas traigan motivo y que haya riesgos y condiciones de cambio.',
      fn: function () {
        var rec = M.recomendar(cfg(), vars(), {});
        afirmar(rec.total === M.ESCENARIOS.length, 'La recomendación no evaluó todos los escenarios');
        afirmar(!!rec.ganador, 'Con la configuración por defecto debería haber una recomendación');
        var maxViable = 0;
        Object.keys(rec.conteo).forEach(function (k) { maxViable = Math.max(maxViable, rec.conteo[k].viable); });
        afirmar(rec.ganador.viable === maxViable, 'La recomendada no es la viable en más escenarios');
        afirmar(rec.riesgos.length > 0, 'La recomendación no declara ningún riesgo');
        afirmar(rec.condiciones.length > 0, 'La recomendación no dice qué la haría cambiar');
        rec.orden.forEach(function (c) {
          if (c.descartada > 0) afirmar(c.motivosFrecuentes.length > 0, c.alt.id + ' se descarta sin motivo registrado');
        });
      }
    },
    {
      nombre: 'Recomendación: cambia si cambian los requisitos obligatorios',
      que: 'Comprueba que la recomendación no esté fijada: al exigir una disponibilidad que ninguna alcanza, el modelo no debe recomendar nada.',
      fn: function () {
        var c = cfg();
        c.requisitos.forEach(function (r) { if (r.id === 'disp_min') { r.meta = 99.999; r.tipo = 'obligatorio'; } });
        var rec = M.recomendar(c, vars(), {});
        afirmar(rec.ganador === null, 'Con una meta inalcanzable no debería recomendar ninguna alternativa');
        var c2 = cfg();
        c2.requisitos.forEach(function (r) { if (r.id === 'disp_min') r.meta = 90; });
        var rec2 = M.recomendar(c2, vars(), {});
        afirmar(rec2.ganador !== null, 'Con una meta laxa debería haber recomendación');
        afirmar(rec2.conteo.B.viable > rec.conteo.B.viable, 'Al bajar la meta, B debería ser viable en más escenarios');
      }
    },
    {
      nombre: 'La recomendación cambia al mover las variables',
      que: 'Requisito 8 y criterio fundamental de la guía: la recomendación no puede estar fijada. Con una plataforma poco fiable solo debe quedar A; con una muy fiable, las tres; con un pico grande, ninguna.',
      fn: function () {
        function recomendada(cambios) {
          var r = M.recomendar(cfg(), vars(cambios), {});
          return r.ganador ? r.ganador.alt.id : 'ninguna';
        }
        function viablesAhora(cambios) {
          var r = M.recomendar(cfg(), vars(cambios), {});
          return D.ALTERNATIVAS.filter(function (a) { return !r.actualPorId[a.id].descartada; }).length;
        }
        afirmar(recomendada({}) === 'A', 'Con la referencia debería recomendar A y recomendó ' + recomendada({}));
        afirmar(viablesAhora({ d: 99 }) === 1, 'Con d = 99 % solo A debería ser viable, y hay ' + viablesAhora({ d: 99 }));
        afirmar(viablesAhora({ d: 99.9 }) === 3, 'Con d = 99,9 % las tres deberían ser viables, y hay ' + viablesAhora({ d: 99.9 }));
        afirmar(recomendada({ Q: 40 }) === 'ninguna', 'Con un pico de 40 generaciones no debería recomendar nada');
        afirmar(viablesAhora({ N: 50000 }) === 0, 'Con 50.000 negocios el costo debería descartarlas a todas');
      }
    },
    {
      nombre: 'La recomendación usa las variables, no solo los escenarios fijos',
      que: 'Comprueba que dos juegos de variables distintos den detalles distintos: el puntaje de la recomendada en la situación actual tiene que cambiar.',
      fn: function () {
        var a = M.recomendar(cfg(), vars(), {});
        var b = M.recomendar(cfg(), vars({ d: 99.9 }), {});
        afirmar(a.ganador && b.ganador, 'Ambas deberían recomendar algo');
        afirmar(a.ganador.actual.puntaje !== b.ganador.actual.puntaje,
          'El puntaje de la situación actual no cambió al subir d: ' + a.ganador.actual.puntaje + ' y ' + b.ganador.actual.puntaje);
        afirmar(a.vars.d !== b.vars.d, 'La recomendación no guardó las variables que recibió');
      }
    },
    {
      nombre: 'Barrido: recorre el rango y detecta dónde cambia quién lidera',
      que: 'El barrido alimenta la curva de sensibilidad. Se comprueba que cubra el rango, que cada punto traiga las tres alternativas y que los cortes coincidan con un cambio real de líder.',
      fn: function () {
        var bar = M.barrido(cfg(), vars(), {}, 'd', 30);
        afirmar(!!bar && bar.puntos.length === 31, 'El barrido debería tener 31 puntos y tiene ' + (bar ? bar.puntos.length : 0));
        afirmar(bar.lo <= bar.actual && bar.actual <= bar.hi, 'El valor actual queda fuera del rango barrido');
        bar.puntos.forEach(function (p) {
          D.ALTERNATIVAS.forEach(function (a) { afirmar(p.alts[a.id] !== undefined, 'Falta ' + a.id + ' en un punto del barrido'); });
        });
        bar.cortes.forEach(function (c) {
          afirmar(c.desde !== c.hasta, 'Un corte no cambia de líder');
        });
        // Al barrer la disponibilidad debe aparecer al menos un corte: con d bajo no hay viables y con d alto sí.
        afirmar(bar.cortes.length > 0, 'Barrer la disponibilidad debería producir al menos un corte');
        // Una variable de opción no se puede barrer.
        afirmar(M.barrido(cfg(), vars(), {}, 'contarSaltos', 10) === null, 'Las variables de opción no se barren');
      }
    },
    {
      nombre: 'Crédito disponible en todos los requisitos, para los gráficos',
      que: 'El radar necesita un valor entre 0 y 1 en cada requisito, también en los obligatorios. El puntaje, en cambio, solo puede usar los deseables.',
      fn: function () {
        var r = ev(cfg(), vars());
        r.forEach(function (a) {
          a.reqs.forEach(function (q) {
            if (!q.evaluable) return;
            afirmar(typeof q.credito === 'number' && q.credito >= 0 && q.credito <= 1, a.alt.id + ': el requisito ' + q.id + ' no tiene crédito entre 0 y 1');
            if (q.cumple) afirmar(cerca(q.credito, 1), a.alt.id + ': ' + q.id + ' cumple pero su crédito no es 1');
            if (q.tipo === 'obligatorio') afirmar(q.peso === undefined, 'Un obligatorio no debe tener peso: no entra al puntaje');
          });
        });
      }
    }
  ];

  function ejecutar() {
    var res = PRUEBAS.map(function (p, i) {
      try { p.fn(); return { n: i + 1, nombre: p.nombre, que: p.que, ok: true }; }
      catch (err) { return { n: i + 1, nombre: p.nombre, que: p.que, ok: false, error: err.message }; }
    });
    var pasan = res.filter(function (r) { return r.ok; }).length;
    window.__pruebas = { total: res.length, pasan: pasan, fallan: res.length - pasan, resultados: res };
    return window.__pruebas;
  }

  function pintar() {
    var r = ejecutar();
    var cont = document.getElementById('pruebas');
    var resumen = document.getElementById('resumen-pruebas');
    function e(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var texto = r.fallan ? r.fallan + ' de ' + r.total + ' pruebas fallan' : r.total + ' de ' + r.total + ' pruebas pasan';
    resumen.innerHTML = '<span class="chip ' + (r.fallan ? 'malo' : 'bueno') + '">' + texto + '</span>';
    var barra = document.getElementById('pr-barra');
    barra.setAttribute('aria-label', texto);
    barra.innerHTML = r.resultados.map(function (x) {
      return '<span class="' + (x.ok ? 'ok' : 'falla') + '" title="' + x.n + '. ' + (x.ok ? 'Pasa' : 'Falla') + '"></span>';
    }).join('');
    cont.innerHTML = r.resultados.map(function (x) {
      return '<li><details class="pr ' + (x.ok ? 'ok' : 'falla') + '"' + (x.ok ? '' : ' open') + '><summary>' +
        '<span class="pr-n" aria-hidden="true">' + x.n + '</span>' +
        '<span class="pr-t"><span class="vh">Prueba ' + x.n + ': </span>' + e(x.nombre) + '</span>' +
        '<span class="marca ' + (x.ok ? 'si' : 'no') + '">' + (x.ok ? 'Pasa' : 'Falla') + '</span>' +
        '<span class="chev" aria-hidden="true"></span></summary>' +
        '<div class="pr-cuerpo"><p>' + e(x.que) + '</p>' + (x.ok ? '' : '<p class="err">' + e(x.error) + '</p>') + '</div></details></li>';
    }).join('');

    var btn = document.getElementById('btn-todo');
    function actualizarBoton() {
      var det = cont.querySelectorAll('details');
      var abiertas = cont.querySelectorAll('details[open]').length;
      var todas = abiertas === det.length;
      btn.textContent = todas ? 'Ocultar detalles' : 'Ver detalles';
      btn.setAttribute('aria-pressed', todas ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      var abrir = btn.getAttribute('aria-pressed') !== 'true';
      cont.querySelectorAll('details').forEach(function (d) { d.open = abrir; });
      actualizarBoton();
    });
    cont.addEventListener('toggle', actualizarBoton, true);
    actualizarBoton();
  }

  window.addEventListener('DOMContentLoaded', pintar);
})();
