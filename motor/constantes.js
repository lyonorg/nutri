// Reglas numéricas del motor en un solo lugar. Cada una dice de dónde sale.

export const KCAL_POR_KG = 7700;          // equivalencia energética aproximada de 1 kg de peso perdido
export const RITMO_OBJETIVO = 0.007;      // 0,7 % del peso por semana (Garthe 2011)
export const RITMO_MAX = 0.01;            // más de 1 %/semana dos semanas seguidas => subir calorías
export const DEFICIT_MAX = 0.30;          // tope de déficit como fracción del gasto (corrige el 25 % del plan, que chocaba con 1.500 kcal)
export const PISO_PROMEDIO = 1500;        // la meta semanal nunca baja de aquí
export const PISO_DIARIO = 1400;          // un día suelto puede bajar hasta aquí (banco de comida libre o arrastre)
export const AJUSTE_MAX_SEMANAL = 150;    // la meta no cambia más que esto de una semana a otra
export const SUBIDA_SALVAVIDAS = 100;     // lo que sube la meta cuando se pierde demasiado rápido o hay hambre sostenida

export const AHORRO_COMIDA_LIBRE = 75;    // kcal/día que se guardan para la comida libre (6 días => 450)
export const ARRASTRE_MAX_DIA = 200;      // máximo que se descuenta por día para compensar un exceso
export const ARRASTRE_DIAS = 3;           // el exceso se reparte como mucho en estos días; el resto se perdona

export const KCAL_POR_G_PROTEINA_MAGRA = 5; // kcal que cuesta 1 g de proteína con fuentes magras (pechuga, atún, suero)
export const MARGEN_POR_PROTEINA = 150;     // kcal que se permite pasar del presupuesto para no sacrificar proteína

export const PRIOR_DIAS = 14;             // "días de confianza" de la fórmula inicial frente a los datos reales
export const VENTANA_GASTO = 28;          // días que mira el gasto adaptativo
export const MIN_DIAS_DATOS = 14;         // antes de esto manda la fórmula
export const MIN_PESAJES = 8;

// Reparto de calorías según el turno. El día de noche dura ~25 h despierto; el post-noche ~8 h.
// La pareja noche + post-noche suma lo mismo que dos días normales.
export const FACTOR_TURNO = {
  manana: 1,
  tarde: 1,
  noche: 1.15,
  'post-noche': 0.85,
  libre: 1,
};

export const PROTEINA_G_KG_POR_ETAPA = [1.6, 1.6, 1.8, 1.8, 2.0]; // etapas 0-4 del switch de actividad
export const FIBRA_G_POR_1000_KCAL = 14;
