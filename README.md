# nutri

App de calorías y recetas de Michael: planea comidas con los alimentos que sí come, recalcula el
día cuando algo cambia y ajusta la meta con el peso real. Hecha para turnos rotativos.

Este repositorio tiene por ahora el **núcleo**: el motor de cálculo y el esquema de datos.
La interfaz (PWA) viene después.

**Regla de oro:** las calorías y los macros los calcula este código con una base de datos de
alimentos. La IA solo interpreta texto o fotos y propone recetas; nunca pone los números.

## Qué hay

| Carpeta | Contenido |
| --- | --- |
| `motor/` | JavaScript puro, sin dependencias. Corre igual en el navegador y en Node |
| `datos/` | 75 alimentos con valores de USDA, 35 recetas con gramos y pasos, y la lista de lo que Michael no come |
| `herramientas/` | Script que genera los alimentos desde la base de USDA |
| `tests/` | 31 pruebas (`npm test`) |
| `supabase/migrations/` | Esquema SQL con RLS. **No está aplicado a ningún proyecto** |
| `docs/PARA-OPUS.md` | Qué falta construir y cómo usar el motor |

### El motor

| Archivo | Qué resuelve |
| --- | --- |
| `constantes.js` | Todas las reglas numéricas en un solo lugar, con su porqué |
| `dia.js` | Día nutricional (de levantarse a acostarse), plantillas por turno, presupuesto del día |
| `tdee.js` | Gasto inicial (Mifflin), gasto adaptativo, meta semanal, proteína, fibra |
| `recalculo.js` | Recálculo del día, arrastre de excesos, banco de comida libre, alerta de comer muy poco |
| `recetas.js` | Calcula calorías y macros de cada receta desde los alimentos; ficha para quien cocina |
| `planificador.js` | Plan semanal y lista de compras |
| `saciedad.js` | Puntaje de saciedad 0-100 |
| `actividad.js` | Ejercicio por lista (MET) |

### Resultado con datos reales

Con las 35 recetas y dos semanas de turnos rotativos, el planificador da en promedio unas
1.500 kcal, 153 g de proteína y 22 g de fibra al día, sin repetir un plato principal más de dos
veces por semana. La meta de 1.500 kcal y 140 g de proteína es factible con esta comida.

## Probar

```
npm test
```

Necesita Node 20 o superior. No hay nada que instalar.

## Pendiente

Ver `docs/PARA-OPUS.md`. En corto: la interfaz, el login y la sincronización, pasar la lista
completa de alimentos, los alimentos locales del ICBF y verificar los valores MET.

Los datos de alimentos vienen de USDA National Nutrient Database for Standard Reference,
Release 28 (dominio público).
