/* Datos de las tres alternativas (requisito 2).
   Cada parámetro lleva su base: Verificado (página oficial), Supuesto (del equipo, por medir).
   El modelo (modelo.js) lee estos mismos valores: no hay números duplicados en otro lado.

   Cambios respecto a la versión anterior (documentados a propósito):
   - B: el flujo describe 2 llamadas entre Workers (plantillas y generación), así que
     saltos pasa de 1 a 2. El factor de cuota 3 ya no está escrito a mano: sale de 1 + saltos.
   - C: además de la cuota de Queues, cuentan las peticiones de Workers (entrada, consumidor
     y consultas de estado). Ahora cada alternativa lista todas sus cuotas.
   - Se agregan saltosLigeros y acoplamiento, que el modelo necesita para la latencia ligera. */
(function () {
  'use strict';

  var HORAS_MES = 730;
  var DISP_COMPONENTE = 99.5; // % por componente (valor de referencia). Supuesto: el plan gratuito de Cloudflare no tiene SLA.

  var ALTERNATIVAS = [
    {
      id: 'A',
      nombre: 'Monolito modular',
      lema: 'Un solo Worker con todas las rutas',
      queEs: 'Un único Worker de Cloudflare atiende todas las rutas: mostrador de plantillas, generación con IA, previews y ajustes. El código se organiza en módulos internos, pero se despliega y escala como una sola pieza.',
      flujo: [
        'El navegador pide un preview.',
        'El Worker valida los datos del negocio y arma la petición a la IA.',
        'El Worker espera la respuesta de la IA. Esa espera no cuenta como CPU.',
        'Valida el JSON, guarda el preview y responde al navegador, que estuvo esperando todo el tiempo.'
      ],
      componentes: ['1 Worker con todas las rutas'],
      ventajas: [
        'Un solo componente que desplegar y vigilar.',
        'La mayor disponibilidad en serie de las tres.',
        'Sin latencia entre servicios.'
      ],
      desventajas: [
        'Un fallo afecta todo el servicio.',
        'En un pico, las generaciones compiten con las peticiones ligeras en el mismo Worker.',
        'El navegador mantiene la conexión abierta mientras la IA responde.'
      ],
      riesgo: 'Los 10 ms de CPU del plan gratuito podrían no alcanzar para validar el JSON y rellenar la plantilla. Se mide en el prototipo.',
      hipotesis: 'Con carga baja debería ganar por simplicidad y disponibilidad.',
      parametros: {
        componentes: { valor: 1, base: 'Supuesto', nota: 'Componentes que el equipo debe operar.' },
        enSerie: { valor: 1, base: 'Supuesto', nota: 'Componentes que deben funcionar a la vez para responder.' },
        saltos: { valor: 0, base: 'Supuesto', nota: 'Llamadas entre componentes por petición pesada.' },
        saltosLigeros: { valor: 0, base: 'Supuesto', nota: 'Llamadas entre componentes por petición ligera.' },
        acoplamiento: { valor: 0.5, base: 'Supuesto', nota: 'Cuánto afecta una generación en curso a las peticiones ligeras (0 = nada, 1 = mucho). Alto porque todo corre en el mismo Worker.' },
        asincrona: { valor: false, base: 'Supuesto', nota: 'La respuesta llega por la misma conexión que el navegador mantiene abierta.' },
        usaSondeo: { valor: false, base: 'Supuesto', nota: 'No hay consultas de estado.' },
        costoInfra: { valor: 0, base: 'Verificado', nota: 'Dentro del plan gratuito de Cloudflare.' },
        limite: { texto: '100,000 peticiones de Workers al día', base: 'Verificado' },
        cuotas: [
          { id: 'workers', nombre: 'Peticiones de Workers', limite: 100000, unidad: 'peticiones al día', base: 'Verificado' }
        ]
      }
    },
    {
      id: 'B',
      nombre: 'Microservicios',
      lema: 'Tres Workers conectados entre sí',
      queEs: 'Tres Workers independientes, uno por responsabilidad, conectados por service bindings. El de previews y ajustes actúa como entrada y llama a los otros dos.',
      flujo: [
        'El navegador pide un preview al Worker de previews y ajustes.',
        'Este llama al Worker de plantillas para obtener la plantilla base.',
        'Luego llama al Worker de generación, que consulta la IA y devuelve el JSON.',
        'El Worker de previews guarda el resultado y responde al navegador, que estuvo esperando.'
      ],
      componentes: ['Worker de plantillas', 'Worker de generación con IA', 'Worker de previews y ajustes (entrada)'],
      ventajas: [
        'Cada servicio se cambia o escala por separado.',
        'Un error de código en la generación no rompe el mostrador de plantillas.',
        'El reparto entre tres personas es natural: un servicio por persona.'
      ],
      desventajas: [
        'Tres piezas que operar y vigilar entre tres personas.',
        'Menor disponibilidad en serie: si cae uno, la petición falla.',
        'Más código y más configuración para el mismo MVP.'
      ],
      riesgo: 'No está confirmado si las llamadas entre Workers cuentan contra el límite diario del plan gratuito. La página de precios de Cloudflare indica que no generan cobro adicional por peticiones, pero no habla del límite gratuito. Se usa el peor caso (contarlas) y el Simulador permite cambiarlo.',
      hipotesis: 'Tiene que justificarse por otra vía: en un MVP de 3 personas suele perder por costo de operación.',
      parametros: {
        componentes: { valor: 3, base: 'Supuesto', nota: 'Componentes que el equipo debe operar.' },
        enSerie: { valor: 3, base: 'Supuesto', nota: 'Componentes que deben funcionar a la vez para responder.' },
        saltos: { valor: 2, base: 'Supuesto', nota: 'Llamadas entre componentes por petición pesada: al Worker de plantillas y al de generación (según el flujo).' },
        saltosLigeros: { valor: 1, base: 'Supuesto', nota: 'Ver plantillas pasa por el Worker de plantillas; abrir un preview o guardar ajustes lo resuelve el Worker de entrada.' },
        acoplamiento: { valor: 0.2, base: 'Supuesto', nota: 'Bajo: la generación vive en otro Worker, pero el de entrada mantiene la conexión abierta.' },
        asincrona: { valor: false, base: 'Supuesto', nota: 'La respuesta llega por la misma conexión que el navegador mantiene abierta.' },
        usaSondeo: { valor: false, base: 'Supuesto', nota: 'No hay consultas de estado.' },
        costoInfra: { valor: 0, base: 'Verificado', nota: 'Dentro del plan gratuito de Cloudflare.' },
        limite: { texto: '100,000 peticiones de Workers al día; en el peor caso cada llamada entre Workers cuenta (1 + 2 = 3 por petición pesada)', base: 'Supuesto' },
        cuotas: [
          { id: 'workers', nombre: 'Peticiones de Workers', limite: 100000, unidad: 'peticiones al día', base: 'Verificado' }
        ]
      }
    },
    {
      id: 'C',
      nombre: 'Asíncrona con cola',
      lema: 'La cola absorbe los picos de generación',
      queEs: 'Un Worker de entrada recibe el pedido y lo deja en Cloudflare Queues. Un Worker consumidor lo toma, llama a la IA y guarda el resultado. El navegador consulta el estado hasta que el preview esté listo.',
      flujo: [
        'El navegador pide un preview. El Worker de entrada lo pone en la cola y devuelve un identificador.',
        'El Worker consumidor toma el mensaje y llama a la IA.',
        'Guarda el preview y marca el pedido como listo.',
        'El navegador consulta el estado cada pocos segundos y muestra el preview cuando está listo.'
      ],
      componentes: ['Worker de entrada', 'Cloudflare Queues', 'Worker consumidor (llama a la IA)'],
      ventajas: [
        'La conexión no queda abierta mientras la IA responde.',
        'Absorbe picos: los pedidos esperan en la cola en vez de fallar.',
        'Reintenta si la IA falla. Si el consumidor cae, los mensajes esperan hasta 24 h en el plan gratuito.'
      ],
      desventajas: [
        'Más complejo de programar y de depurar.',
        'El usuario ve una espera con estado, no una respuesta directa.',
        'Añade una consulta de estado por cada preview.'
      ],
      riesgo: 'El tiempo máximo de espera de lote de la cola es de 60 s según los límites oficiales. Si no se configura para entregar de inmediato, podría romper el requisito de 30 s para tener el preview. El CPU del consumidor en el plan gratuito no está confirmado.',
      hipotesis: 'Con picos de generaciones puede ganar, porque la cola absorbe la carga.',
      parametros: {
        componentes: { valor: 3, base: 'Supuesto', nota: 'Componentes que el equipo debe operar.' },
        enSerie: { valor: 2, base: 'Supuesto', nota: 'Entrada y consumidor. Se asume que la cola no añade un fallo independiente y que el consumidor caído solo retrasa el preview.' },
        saltos: { valor: 1, base: 'Supuesto', nota: 'Un paso por la cola: la invocación del consumidor.' },
        saltosLigeros: { valor: 0, base: 'Supuesto', nota: 'Las peticiones ligeras las resuelve el Worker de entrada.' },
        acoplamiento: { valor: 0.1, base: 'Supuesto', nota: 'Muy bajo: la generación ocurre en el consumidor, fuera de la conexión del navegador.' },
        asincrona: { valor: true, base: 'Supuesto', nota: 'El pedido espera en la cola; el navegador no mantiene la conexión abierta.' },
        usaSondeo: { valor: true, base: 'Supuesto', nota: 'El navegador consulta el estado cada cierto número de segundos; cada consulta es una petición al Worker de entrada.' },
        costoInfra: { valor: 0, base: 'Verificado', nota: 'Dentro del plan gratuito de Cloudflare.' },
        limite: { texto: '10,000 operaciones de cola al día (3 por mensaje) y 100,000 peticiones de Workers al día', base: 'Verificado' },
        cuotas: [
          { id: 'workers', nombre: 'Peticiones de Workers', limite: 100000, unidad: 'peticiones al día', base: 'Verificado' },
          { id: 'queues', nombre: 'Operaciones de Cloudflare Queues', limite: 10000, unidad: 'operaciones al día', opsPorMensaje: 3, base: 'Verificado' }
        ]
      }
    }
  ];

  var COMUNES = [
    'La misma carga: los escenarios de referencia, crecimiento y pico se aplican igual a las tres.',
    'El mismo modelo de IA y el mismo costo por preview.',
    'El mismo hosting estático para las landing publicadas: Cloudflare Pages.',
    'Los mismos servicios de datos: D1 y R2.',
    'Los mismos requisitos y restricciones del paso Configuración.',
    'Las mismas fórmulas del modelo para calcular cada indicador.'
  ];

  /* d es opcional: si no se pasa, se usa el valor de referencia. */
  function disponibilidad(alt, d) {
    var dc = typeof d === 'number' && isFinite(d) ? d : DISP_COMPONENTE;
    return 100 * Math.pow(dc / 100, alt.parametros.enSerie.valor);
  }
  function caidaHoras(alt, d) {
    return (1 - disponibilidad(alt, d) / 100) * HORAS_MES;
  }

  window.DATOS = {
    HORAS_MES: HORAS_MES,
    DISP_COMPONENTE: DISP_COMPONENTE,
    ALTERNATIVAS: ALTERNATIVAS,
    COMUNES: COMUNES,
    disponibilidad: disponibilidad,
    caidaHoras: caidaHoras
  };
})();
