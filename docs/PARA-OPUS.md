# Relevo para Opus

Fable dejó listo el núcleo (datos + motor + pruebas). Falta la app que Michael va a tocar.
Este archivo dice qué hay, cómo usarlo y qué construir, en orden.

La especificación completa está en el documento "App de calorías y recetas — Documento de
diseño" (pestañas: principal, Lista de alimentos, Brief para Fable, Revisión de Fable).
Si este archivo y el documento se contradicen, manda la pestaña **Revisión de Fable**.

## Reglas que no se negocian

1. Las calorías y macros los calcula `motor/` con `datos/alimentos.json`. La IA nunca pone números.
2. Todo gratis: GitHub Pages, Supabase (plan gratis), sin servicios de pago.
3. No tocar los proyectos de Misión Diaria ni medresidencia sin permiso explícito de Michael.
4. El repo es público: ninguna clave de IA ni `service_role` en el código del cliente.
5. No cambiar las reglas numéricas de `motor/constantes.js` sin correr `npm test` y explicar por qué.

## Qué hay

| Ruta | Qué es |
| --- | --- |
| `motor/` | Motor de cálculo. JavaScript puro (módulos ES), sin dependencias; se importa tal cual desde el navegador |
| `datos/alimentos.json` | 75 alimentos con valores reales de USDA SR28. Generado; no editar a mano |
| `datos/seleccion-usda.json` | Qué registro de USDA representa a cada alimento. Para agregar uno: añadirlo aquí y correr el script |
| `datos/recetas.json` | 35 recetas (8 desayunos, 21 platos principales, 6 snacks) con gramos, medidas caseras y pasos |
| `datos/no-como.json` | Lo que Michael no come. El planificador lo respeta como regla dura |
| `herramientas/sembrar-alimentos.mjs` | Regenera `alimentos.json` desde la base SR28 (paquete npm `fda-nutrient-database`, carpeta `data/`) |
| `supabase/migrations/` | Esquema con RLS. Sintaxis verificada; **nunca se ha aplicado** a un proyecto |
| `tests/` | 31 pruebas. `npm test` |

## Cómo se usa el motor

Todo se exporta desde `motor/index.js`.

```js
import {
  indiceAlimentos, calcularRecetas,            // recetas.js
  abrirDia, asignarDia, presupuestoDia,        // dia.js
  gastoInicial, estimarGasto, metaSemanal, metaProteina, tendencia,   // tdee.js
  planificarSemana, listaCompras,              // planificador.js
  recalcular, repartirExceso, elegirOpciones, bancoComidaLibre, alertaIngestaBaja,  // recalculo.js
  kcalEjercicio, fichaCocina,
} from './motor/index.js';

const indice = indiceAlimentos(alimentos);          // Map id -> alimento
const recetas = calcularRecetas(recetasCrudas, indice);   // agrega kcal, proteína, fibra, etc.

// Al tocar "Hoy estoy en… noche":
const dia = abrirDia({ turno: 'noche', inicio: Date.now() });
const presupuesto = presupuestoDia({ turno: 'noche', metaKcal: 1500, metaProteina: 140 });

// Plan de la semana:
const plan = planificarSemana({ dias: [{ fecha: '2026-11-23', turno: 'manana' }, /* … */], meta: { kcal: 1500, proteina: 140 }, recetas, historial });

// Registró algo fuera del plan:
const nuevo = recalcular({ presupuesto, consumido: { kcal: 1100, proteina: 80 }, restantes: [{ id: 'snack', peso: 0.13 }, { id: 'cena', peso: 0.30 }] });
const opciones = elegirOpciones({ objetivo: nuevo.comidas[1], recetas: recetas.filter((r) => r.tipos.includes('cena')) });
```

Detalles que importan:

- **Tiempo:** el motor usa instantes en milisegundos y un desfase fijo (`-300` min, Colombia). No usar la zona horaria del teléfono para decidir a qué día pertenece un registro; usar `asignarDia`.
- **Un día nutricional por fecha de inicio.** Si `asignarDia` devuelve `null`, la app pide tocar "Hoy estoy en…".
- **Turnos:** `manana`, `tarde`, `noche`, `post-noche`, `libre` (sin tildes ni eñes en los ids).
- **Gasto adaptativo:** correr `estimarGasto` y `metaSemanal` una vez por semana y guardar el resultado en `nutri_metas`. Antes de 14 días y 8 pesajes devuelve la fórmula; es lo esperado.
- **Pesajes ruidosos:** el de post-noche y el del día después de la comida libre se guardan con `valido: false`.
- **Proteína en polvo:** el alimento `proteina-polvo` es un valor genérico marcado `provisional`. Lo primero que debe hacer la app es dejar que Michael registre su producto con la etiqueta (documento, §3.13) y reemplazarlo.

## Qué construir (fase 1, en este orden)

La fase 1 es lo que se usa a diario. Nada de lo que está en "fase 2" de la Revisión entra todavía.

1. **Esqueleto de la PWA** en la raíz del repo (HTML + módulos ES, sin paso de compilación): `index.html`, `manifest.webmanifest`, service worker que guarda la app, `motor/` y `datos/` para funcionar sin internet. Publicar con GitHub Pages desde `main`.
2. **Guardado local primero:** IndexedDB con las mismas tablas del esquema; ids `crypto.randomUUID()`. La app debe ser usable sin Supabase. La sincronización se conecta después (paso 8).
3. **Hoy:** botón "Hoy estoy en…", comidas del día con su hora, barra de calorías y proteína, "comí lo planeado" con un toque, "cambiar este plato" (3 opciones), "me voy a dormir".
4. **Registrar:** favoritos, buscar alimento + gramos, y pegar el JSON de Gemini (formato en el documento §3.6 y §3.13). Tras cada registro, `recalcular`.
5. **Plan semanal:** elegir el turno de cada día, generar, ver y cambiar platos. Ficha de cocina (`fichaCocina`) con botón para compartir por WhatsApp.
6. **Lista de compras** desde el plan (`listaCompras` con el índice, agrupada por tienda, en libras de 500 g con `aLibras`), compartible como texto.
7. **Peso:** registro diario, gráfica con puntos y línea de tendencia (`tendencia`), y la meta semanal con su motivo.
8. **Login y sincronización** con Supabase: enlace mágico al correo, aplicar la migración `0001`, cola de sincronización con upsert. Requiere el visto bueno de Michael sobre en qué proyecto.
9. **Botón "Tengo hambre"** con la lista fija del documento (§3.16) y **alerta de comer muy poco** (`alertaIngestaBaja`).

Estética: fusión Bento × Barniz de Pasto, modo oscuro por defecto (documento §6). Hacer primero una pantalla de prueba y mostrársela a Michael antes de construir el resto.

## Pendientes de datos

- Pasar la lista completa de alimentos (pestaña "Lista de alimentos", ~390 filas) a `nutri_alimento_usuario`. Hoy solo están sembrados los 75 que usan las recetas, y la lista de "No" en `datos/no-como.json`.
- Alimentos locales sin registro en USDA (quesillo, cuajada, lulo, curuba, panela, envueltos): transcribir del PDF del ICBF con `fuente: 'icbf'`. No inventar valores.
- Verificar los MET de `motor/actividad.js` contra el Compendio de Actividades Físicas.
- El planificador da ~1,3 frutas al día; la meta es 2-3. Opciones: más snacks con fruta o una "fruta extra" cuando sobren calorías.

## Decisiones abiertas de Michael

- En qué proyecto de Supabase vive nutri. Misión Diaria no tiene login; nutri sí lo necesita. Las tablas `nutri_` con RLS pueden convivir en ese proyecto sin tocar las de Misión Diaria.
- Recordatorios: Telegram primero, push después.
- Pasar la rama `fable/nucleo` a `main`.
