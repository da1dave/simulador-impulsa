# Simulador de arquitecturas · Impulsa Digital

Aplicativo web de la Guía Actividad 9 (Ingeniería Aplicada, Universidad Libre, 2026-2). Compara tres
arquitecturas de backend en Cloudflare con un modelo de cálculo explicable. Los resultados son
**estimaciones del modelo, no mediciones de rendimiento**.

## Qué cubre hoy

La interfaz tiene **cuatro pasos**. Los requisitos 5 a 8 de la guía (escenarios, indicadores, comparación y
recomendación) viven juntos en el paso **Simulador**, porque son una sola pregunta: «¿qué conviene en esta situación?».

| Requisito de la guía | Dónde está |
|---|---|
| 1. Configuración del proyecto | Paso **Configuración**: las ocho metas son filas de una línea (nombre, valor, obligatorio o deseable); lo demás está plegado |
| 2. Alternativas de diseño | Paso **Alternativas** (`datos.js`): tabla corta + un detalle a la vez (A, B o C) |
| 3. Variables de entrada | Paso **Simulador**, panel «Ajustar valores»: 9 variables (5 a la vista y 4 en «Ajustes avanzados»), cada una con su pregunta y su justificación detrás de un ⓘ |
| 4. Modelo de simulación | `modelo.js` + paso **Modelo** (parámetros, ecuaciones, supuestos, limitaciones) |
| 5. Ejecución de escenarios | Simulador → situaciones de un clic (los siete `Modelo.ESCENARIOS`) y subpestaña **Escenarios** (tabla de siete × tres) |
| 6. Indicadores | Simulador → subpestaña **Indicadores** (ocho barras con su meta y «Cómo se calcula cada indicador») |
| 7. Comparación | Subpestañas **Por qué** (requisito × alternativa) y **Escenarios** (alternativa × escenario) |
| 8. Recomendación explicable | Simulador → la respuesta de arriba (`Modelo.lectura` y `Modelo.recomendar`), «Riesgos de esta recomendación» y la subpestaña **¿Y si…?** (curva de sensibilidad y puntos de quiebre) |
| 9. Interfaz adaptable a celular | Toda la app (revisada a 360, 390, 768 y 1280 px, en claro y oscuro) |
| 10. Validación y pruebas (parcial) | Controles de entradas inválidas + `pruebas.html` (26 pruebas del modelo) |

Pendientes: 10 (registro de pruebas de interfaz en el informe), 11 (documentación final) y 12 (sustentación).

## Cómo se usa

1. **Configuración**: se fijan las metas del proyecto. Las secciones de caracterización, usuarios y resultados esperados van plegadas.
2. **Alternativas**: se comparan las tres en una tabla; con los botones A, B, C se ve cómo funciona cada una.
3. **Simulador**: se elige una situación (Lanzamiento, Crecimiento, Cuota al límite, Campaña con pico, IA más rápida,
   Plataforma inestable, Plataforma muy fiable) o se mueven los controles. Arriba aparece la respuesta: quién conviene, por qué,
   quién se descarta y en cuántos de los siete escenarios aguanta. Debajo hay cuatro subpestañas que se ven de una en una:
   *Por qué*, *Escenarios*, *¿Y si…?* e *Indicadores*. Pulsar una fila de *Escenarios* carga esa situación (con «Deshacer»).
4. **Modelo**: cuatro subpestañas que se ven de una en una. *Cálculo* (los ocho indicadores, cada uno con una frase en lenguaje llano y su fórmula al tocarlo),
   *Valores* (variables y parámetros con su base), *Decisión* (la regla en tres líneas y los pesos) y *Límites* (supuestos, limitaciones y qué falta validar).
   Cada lista muestra una línea por elemento y despliega el detalle de uno solo a la vez.

Principios de interfaz: una sola respuesta visible, cada dato aparece una vez, el detalle va plegado, un solo aviso a la vez
y sin marcas de chulo ni equis: el estado se dice con palabras y color. La pestaña activa es la única que se colorea.

Las direcciones antiguas siguen funcionando: `#variables` y `#decision` abren el Simulador (subpestaña *Por qué*) y
`#escenarios` abre la subpestaña *Escenarios*.

## Estructura

- `index.html`, `estilos.css`: página y estilos (claro y oscuro).
- `datos.js`: las tres alternativas y sus parámetros, con su base (Verificado / Supuesto).
- `modelo.js`: variables, escenarios (`ESCENARIOS`), parámetros, fórmulas, evaluación contra requisitos, lectura del resultado
  (`lectura`), búsqueda de umbrales (`umbral`), barrido de una variable (`barrido`) y recomendación (`recomendar`). Funciones puras, sin DOM.
- `estado.js`: configuración, variables, pesos, validación, guardado en el navegador, exportar/importar.
- `graficos.js`: gráficos SVG sin librerías (barras por indicador con meta, curva de sensibilidad, medidor). Los colores salen de los tokens del tema.
- `ui.js` (núcleo: rutas, barra de pasos, avisos), `ui-config.js`, `ui-alternativas.js`, `ui-simulador.js` (situaciones, controles y
  respuesta), `ui-paneles.js` (las cuatro subpestañas), `ui-modelo.js`: interfaz.
- `pruebas.html`, `pruebas.js`: 26 pruebas del modelo.

Sin dependencias ni paso de compilación. Funciona abriendo `index.html` o publicado en GitHub Pages.

## Publicar en GitHub Pages

1. Sube estos archivos a la raíz del repositorio (o a la carpeta `docs`).
2. En Settings → Pages, elige la rama y la carpeta.
3. El enlace del simulador queda en `https://<usuario>.github.io/<repositorio>/`.

## Valores de referencia (unificados con el informe del punto 1)

| Variable | Antes | Ahora | Por qué |
|---|---|---|---|
| Negocios activos | 100 | 50 | Es la carga de referencia del informe del equipo. |
| Previews por negocio al mes | 6 | 5 | Igual que el informe. |
| Costo de IA por preview | USD 0,002 | USD 0,00075 | Sale de los precios verificados de Workers AI (USD 0,10 por millón de tokens de entrada y USD 0,30 de salida) con 3.000 tokens de entrada y 1.500 de salida, que es una respuesta JSON. El precio está verificado; el conteo de tokens es un supuesto. |
| Tiempo de respuesta de la IA | 8 s | 15 s | Coherente con esa misma respuesta de 1.500 tokens a 100 tokens por segundo. Con 8 s, el costo y el tiempo describían respuestas de distinto tamaño. |

Con estos valores, el costo mensual de referencia es USD 0,19, el mismo del informe. Las peticiones ligeras
se dejan en 20 por negocio al día, que es el valor del simulador y es más exigente que el del informe.

## Hallazgo del modelo

El requisito **«Pedidos atendidos en el pico»** no llega a descartar ninguna alternativa mientras su meta de
tiempo (30 s) sea menor que la espera máxima de una petición síncrona (`T_c` = 60 s): los pedidos que se
pierden por tiempo de espera solo aparecen cuando «Tiempo hasta el preview» ya rompió su propia meta. El
indicador informa, pero no discrimina. Queda anotado en las limitaciones del paso Modelo.

## Cambios respecto a la versión anterior de los datos

- En B, `saltos` pasa de 1 a 2: el flujo describe dos llamadas (plantillas y generación). El factor de cuota
  ya no está escrito a mano; sale de `1 + saltos`.
- En C se vigilan dos cuotas (peticiones de Workers y operaciones de cola), no solo la de Queues.
- Cada alternativa tiene `saltosLigeros` y `acoplamiento`, que el modelo usa para la latencia ligera.
- Se agregó el requisito «Pedidos atendidos en el pico» (deseable) para reflejar la ventaja de la cola.
- Límites verificados en la documentación oficial de Cloudflare: Workers gratis 100.000 peticiones/día y
  10 ms de CPU; Queues gratis 10.000 operaciones/día, 3 por mensaje, retención de 24 h, espera de lote
  máxima de 60 s; Workers Paid desde USD 5/mes con 10 millones de peticiones incluidas.
- Los precios de Cloudflare indican que las llamadas entre Workers por service binding no cobran peticiones
  adicionales; no aclaran si cuentan en el límite diario gratuito. Por eso es la variable `cs` (peor caso por defecto).

## Rediseño de la interfaz (esta ronda)

- Seis pantallas pasan a cuatro. `ui-variables.js`, `ui-escenarios.js` y `ui-decision.js` se reemplazan por
  `ui-simulador.js` y `ui-paneles.js`; el radar y el mapa de calor se quitan porque repetían lo que ya dicen la matriz y la tabla.
- El paso Modelo pasó de unas 2.300 palabras (con todo abierto) a entre 65 y 215 por subpestaña. Los textos de `modelo.js` (supuestos,
  limitaciones, criterios) empiezan con una frase corta que sirve de titular; el resto se ve al tocar la fila.
- Configuración pasa de unos 3.700 px de alto a unos 1.500 y el Simulador cabe casi entero en dos pantallas.
- En pantallas pequeñas, los controles van plegados en «Ajustar valores» y una barra inferior con los puntajes aparece solo
  cuando la respuesta queda fuera de la vista.
- Rendimiento: `Intl.NumberFormat` se guarda por número de decimales (antes se creaba en cada formato).
  `recomendar()` pasó de unos 500 ms a unos 19 ms, así que los cálculos se hacen al abrir «Riesgos» y «Puntos de quiebre».
- Accesibilidad: subpestañas con roles ARIA y flechas/Inicio/Fin, objetivos táctiles de 44 px, contraste mínimo de 4,8:1
  en claro y 5,3:1 en oscuro, foco visible y `prefers-reduced-motion`.

## Lista para quien hace las pruebas

1. Abrir `pruebas.html`: deben pasar las 26.
2. Recorrer cada paso en claro y oscuro, a 360, 390, 768 y 1280 px: sin desplazamiento horizontal, sin texto cortado.
3. Simulador: pulsar las siete situaciones y comprobar que la respuesta cambia y que «Deshacer» la devuelve.
4. Escribir un valor inválido (por ejemplo, 0 negocios): debe verse el error junto al campo y el aviso rojo en el paso.
5. Configuración: dejar vacío el nombre del proyecto; el aviso de la barra debe llevar al campo.
6. Recargar la página: las metas, las variables y la situación se conservan.
7. Abrir con `#variables`, `#escenarios` y `#decision`: deben llevar al Simulador.

## Para validar con datos reales

Pruebas de carga sobre un prototipo (k6 o JMeter), tiempo y tokens reales de la IA, CPU por petición de cada Worker,
disponibilidad observada durante semanas y pedidos reales de los primeros clientes.
