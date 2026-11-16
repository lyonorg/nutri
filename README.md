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
| `tests/` | Pruebas (`npm test`). `datos-de-prueba.js` son números inventados, no valores reales |
| `supabase/migrations/` | Esquema SQL con RLS. **No está aplicado a ningún proyecto** |

### El motor

| Archivo | Qué resuelve |
| --- | --- |
| `constantes.js` | Todas las reglas numéricas en un solo lugar, con su porqué |
| `dia.js` | Día nutricional (de levantarse a acostarse), plantillas por turno, presupuesto del día |
| `tdee.js` | Gasto inicial (Mifflin), gasto adaptativo, meta semanal, proteína, fibra |
| `recalculo.js` | Recálculo del día, arrastre de excesos, banco de comida libre, "cambiar este plato" |
| `planificador.js` | Plan semanal y lista de compras |
| `saciedad.js` | Puntaje de saciedad 0-100 |
| `actividad.js` | Ejercicio por lista (MET) |

## Probar

```
npm test
```

Necesita Node 20 o superior. No hay nada que instalar.

## Pendiente

- Sembrar los alimentos de la lista blanca con valores de USDA FoodData Central (base) y de la
  tabla del ICBF (solo lo local, transcrito a mano del PDF).
- Banco real de 30-40 recetas con gramos.
- Verificar los MET de `actividad.js` contra el Compendio de Actividades Físicas.
- Con 1.500 kcal y 140 g de proteína, cada plato necesita unos 9 g de proteína por cada 100 kcal.
  Las recetas reales tienen que diseñarse con eso en mente.
- El planificador todavía no garantiza 2-3 frutas al día: las favorece, pero depende de las recetas.
- El esquema SQL no se ha ejecutado contra una base real: revisar al aplicarlo.
- Interfaz, login, sincronización sin internet y recordatorios.
