// Recálculo del día, arrastre de excesos y banco de la comida libre.
// Regla del brief: proteína primero. Si no cabe en las calorías que quedan, se permite pasarse
// un poco (150 kcal) antes que sacrificar proteína.

import {
  ARRASTRE_MAX_DIA, ARRASTRE_DIAS, AHORRO_COMIDA_LIBRE, KCAL_POR_G_PROTEINA_MAGRA, MARGEN_POR_PROTEINA,
} from './constantes.js';

/**
 * @param presupuesto        { kcal, proteina } del día
 * @param consumido          { kcal, proteina } ya registrado
 * @param restantes          [{ id, peso }] comidas que faltan (peso = fracción del día en la plantilla)
 */
export function recalcular({ presupuesto, consumido, restantes }) {
  const kcalLibres = Math.max(presupuesto.kcal - consumido.kcal, 0);
  const proteinaFalta = Math.max(presupuesto.proteina - consumido.proteina, 0);
  const excesoYa = Math.max(consumido.kcal - presupuesto.kcal, 0);

  if (restantes.length === 0) {
    return { comidas: [], kcal: 0, proteina: 0, proteinaSinCubrir: proteinaFalta, exceso: excesoYa, aviso: excesoYa > 0 ? 'exceso' : null };
  }

  // Calorías mínimas para cubrir la proteína que falta con fuentes magras.
  const kcalParaProteina = proteinaFalta * KCAL_POR_G_PROTEINA_MAGRA;
  let kcal = kcalLibres;
  let aviso = null;
  if (kcalParaProteina > kcalLibres) {
    kcal = Math.min(kcalParaProteina, kcalLibres + MARGEN_POR_PROTEINA);
    aviso = 'proteina_prioritaria';
  }
  const proteina = Math.min(proteinaFalta, kcal / KCAL_POR_G_PROTEINA_MAGRA);

  const pesoTotal = restantes.reduce((s, c) => s + c.peso, 0);
  const comidas = restantes.map((c) => ({
    id: c.id,
    kcal: Math.round((kcal * c.peso) / pesoTotal),
    proteina: Math.round((proteina * c.peso) / pesoTotal),
  }));

  return {
    comidas,
    kcal: Math.round(kcal),
    proteina: Math.round(proteina),
    proteinaSinCubrir: Math.round(proteinaFalta - proteina),
    exceso: Math.round(excesoYa + (kcal - kcalLibres)),
    aviso: aviso ?? (excesoYa > 0 ? 'exceso' : null),
  };
}

/**
 * Reparte un exceso en los días siguientes: máx. 200 kcal/día durante 3 días.
 * Lo que no quepa se perdona; el gasto adaptativo ya lo ve reflejado en el peso.
 */
export function repartirExceso(exceso, { maxDia = ARRASTRE_MAX_DIA, dias = ARRASTRE_DIAS } = {}) {
  const descuentos = [];
  let falta = Math.max(exceso, 0);
  for (let i = 0; i < dias && falta > 0; i++) {
    const d = Math.min(maxDia, falta);
    descuentos.push(Math.round(d));
    falta -= d;
  }
  return { descuentos, perdonado: Math.round(falta) };
}

/** Calorías extra disponibles para la comida libre según los días ahorrados esta semana. */
export function bancoComidaLibre(diasAhorrados, ahorroDiario = AHORRO_COMIDA_LIBRE) {
  return Math.min(diasAhorrados, 6) * ahorroDiario;
}

/**
 * Las mejores opciones de un banco de recetas para un objetivo de kcal y proteína.
 * La porción se ajusta en cuartos (0,5× a 1,5×). Sirve para "cambiar este plato" y para el recálculo.
 */
export function elegirOpciones({ objetivo, recetas, n = 3 }) {
  return recetas
    .map((r) => {
      const factor = ajustarPorcion(objetivo.kcal / r.kcal);
      const kcal = r.kcal * factor;
      const proteina = r.proteina_g * factor;
      const error = Math.abs(kcal - objetivo.kcal) / Math.max(objetivo.kcal, 1)
        + Math.max(0, objetivo.proteina - proteina) / Math.max(objetivo.proteina, 1);
      return { recetaId: r.id, nombre: r.nombre, factor, kcal: Math.round(kcal), proteina: Math.round(proteina), error };
    })
    .sort((a, b) => a.error - b.error || a.recetaId.localeCompare(b.recetaId))
    .slice(0, n);
}

export function ajustarPorcion(f, min = 0.5, max = 1.5) {
  return Math.min(Math.max(Math.round(f * 4) / 4, min), max);
}
