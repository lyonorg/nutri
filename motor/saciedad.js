// Puntaje de saciedad 0-100 de un alimento o receta.
// Los factores (proteína, fibra, agua/densidad energética, grasa) vienen del índice de saciedad
// de Holt 1995. Los pesos son una decisión de diseño, no un valor validado: sirven para ordenar.

const acotar = (x) => Math.min(Math.max(x, 0), 1);

/**
 * @param kcal, proteina_g, fibra_g  de la porción
 * @param gramos                     peso de la porción ya preparada
 * @param nova                       1 sin procesar … 4 ultraprocesado
 */
export function puntajeSaciedad({ kcal, proteina_g = 0, fibra_g = 0, gramos, nova = 1 }) {
  if (!kcal || !gramos) return 0;
  const proteina = acotar((proteina_g / kcal) * 100 / 10);   // tope: 10 g por 100 kcal
  const fibra = acotar((fibra_g / kcal) * 100 / 3);          // tope: 3 g por 100 kcal
  const densidad = acotar((4 - kcal / gramos) / 3.5);        // 0 a ≥4 kcal/g, máximo a ≤0,5 kcal/g
  const proceso = acotar((4 - nova) / 3);
  return Math.round(100 * (0.35 * proteina + 0.25 * fibra + 0.30 * densidad + 0.10 * proceso));
}
