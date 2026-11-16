// Gasto energético: fórmula inicial + estimación adaptativa con los datos reales.
//
// Decisiones:
// - La pérdida de peso se mide con regresión lineal sobre los pesajes válidos (la media móvil
//   exponencial va atrasada y subestima la pendiente; queda solo para la gráfica).
// - Los datos reales se mezclan con la fórmula: pesan dias / (dias + 14). Antes de 14 días y
//   8 pesajes manda la fórmula.
// - Solo cuentan los días completos. Un día marcado incompleto no mueve el gasto.

import {
  KCAL_POR_KG, RITMO_OBJETIVO, RITMO_MAX, DEFICIT_MAX, PISO_PROMEDIO, AJUSTE_MAX_SEMANAL,
  SUBIDA_SALVAVIDAS, PRIOR_DIAS, VENTANA_GASTO, MIN_DIAS_DATOS, MIN_PESAJES,
  PROTEINA_G_KG_POR_ETAPA, FIBRA_G_POR_1000_KCAL,
} from './constantes.js';

const DIA_MS = 86_400_000;
const numDia = (fecha) => Math.round(Date.parse(`${fecha}T00:00:00Z`) / DIA_MS);

export function edadEn(fechaNacimiento, fecha) {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
  const [a, m, d] = fecha.split('-').map(Number);
  return a - an - (m < mn || (m === mn && d < dn) ? 1 : 0);
}

/** Metabolismo basal por Mifflin-St Jeor (kcal/día). */
export function mifflin({ sexo = 'm', kg, cm, edad }) {
  return 10 * kg + 6.25 * cm - 5 * edad + (sexo === 'm' ? 5 : -161);
}

/** Gasto de arranque: basal × 1,2 (sedentario). Solo sirve hasta que haya datos. */
export function gastoInicial(perfil, factorActividad = 1.2) {
  return Math.round(mifflin(perfil) * factorActividad);
}

/** Peso de tendencia (media móvil exponencial) para la gráfica. No se usa para calcular el gasto. */
export function tendencia(pesajes, alpha = 0.1) {
  const orden = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let t = null;
  return orden.map((p) => {
    t = t === null ? p.kg : t + alpha * (p.kg - t);
    return { fecha: p.fecha, kg: p.kg, tendencia: Math.round(t * 100) / 100 };
  });
}

/** Pendiente en kg/día por mínimos cuadrados. Ignora pesajes marcados como no válidos (post-noche, etc.). */
export function pendienteKgDia(pesajes) {
  const pts = pesajes.filter((p) => p.valido !== false).map((p) => ({ x: numDia(p.fecha), y: p.kg }));
  if (pts.length < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  return sxy / sxx;
}

/**
 * Gasto adaptativo.
 * @param dias    [{ fecha, kcal, completo, peso? }]  peso = confianza del día (0,5 si más de la mitad fue por foto)
 * @param pesajes [{ fecha, kg, valido? }]
 * @param prior   gasto de la fórmula (o el último estimado)
 * @param hoy     'AAAA-MM-DD'
 */
export function estimarGasto({ dias, pesajes, prior, hoy, ventana = VENTANA_GASTO }) {
  const desde = numDia(hoy) - ventana;
  const enVentana = (f) => numDia(f) > desde && numDia(f) <= numDia(hoy);

  const completos = dias.filter((d) => d.completo !== false && enVentana(d.fecha));
  const validos = pesajes.filter((p) => p.valido !== false && enVentana(p.fecha));
  const base = { gasto: Math.round(prior), gastoDatos: null, confianza: 0, diasUsados: completos.length, pesajesUsados: validos.length };

  if (validos.length < MIN_PESAJES || completos.length < 10) {
    return { ...base, motivo: 'pocos_datos' };
  }
  const xs = validos.map((p) => numDia(p.fecha));
  const tramo = Math.max(...xs) - Math.min(...xs);
  if (tramo < MIN_DIAS_DATOS) return { ...base, motivo: 'pocos_dias' };

  const pesoTotal = completos.reduce((s, d) => s + (d.peso ?? 1), 0);
  const ingesta = completos.reduce((s, d) => s + d.kcal * (d.peso ?? 1), 0) / pesoTotal;
  const pendiente = pendienteKgDia(validos);

  // gasto = lo que comió + lo que sacó de sus reservas
  let gastoDatos = ingesta - pendiente * KCAL_POR_KG;
  // cordura: un estimado fuera de 60-160 % de la fórmula casi siempre es un error de registro
  gastoDatos = Math.min(Math.max(gastoDatos, prior * 0.6), prior * 1.6);

  const confianza = tramo / (tramo + PRIOR_DIAS);
  const gasto = confianza * gastoDatos + (1 - confianza) * prior;
  return {
    gasto: Math.round(gasto),
    gastoDatos: Math.round(gastoDatos),
    confianza: Math.round(confianza * 100) / 100,
    diasUsados: completos.length,
    pesajesUsados: validos.length,
    ingestaMedia: Math.round(ingesta),
    kgPorSemana: Math.round(pendiente * 7 * 100) / 100,
    motivo: 'ok',
  };
}

/**
 * Meta de calorías de la semana.
 * - Déficit para bajar ~0,7 % del peso por semana, con tope de 30 % del gasto.
 * - Nunca menos de 1.500 de promedio.
 * - Cambia como mucho ±150 respecto a la semana anterior.
 * - Salvavidas: si las dos últimas semanas bajó más de 1 %/semana, o hubo hambre casi todos los días, sube 100.
 */
export function metaSemanal({ gasto, kg, metaAnterior = null, ritmosRecientes = [], hambreSostenida = false, enPausa = false }) {
  if (enPausa) return { kcal: redondear10(gasto), deficit: 0, motivo: 'pausa_de_dieta' };

  const deficitRitmo = (RITMO_OBJETIVO * kg * KCAL_POR_KG) / 7;
  const deficit = Math.min(deficitRitmo, DEFICIT_MAX * gasto);
  let kcal = Math.max(gasto - deficit, PISO_PROMEDIO);
  let motivo = deficitRitmo > DEFICIT_MAX * gasto ? 'tope_deficit' : 'ritmo_objetivo';
  if (kcal === PISO_PROMEDIO) motivo = 'piso';

  if (metaAnterior !== null) {
    const muyRapido = ritmosRecientes.length >= 2 && ritmosRecientes.slice(-2).every((r) => r > RITMO_MAX);
    if (muyRapido || hambreSostenida) {
      kcal = Math.max(kcal, metaAnterior + SUBIDA_SALVAVIDAS);
      motivo = muyRapido ? 'salvavidas_ritmo' : 'salvavidas_hambre';
    }
    kcal = Math.min(Math.max(kcal, metaAnterior - AJUSTE_MAX_SEMANAL), metaAnterior + AJUSTE_MAX_SEMANAL);
    kcal = Math.max(kcal, PISO_PROMEDIO);
  }
  kcal = redondear10(kcal);
  return { kcal, deficit: Math.round(gasto - kcal), motivo };
}

export function metaProteina(kg, etapa = 0) {
  const gkg = PROTEINA_G_KG_POR_ETAPA[etapa] ?? PROTEINA_G_KG_POR_ETAPA[0];
  return Math.round((kg * gkg) / 5) * 5;
}

export function metaFibra(kcal) {
  return Math.max(21, Math.round((kcal / 1000) * FIBRA_G_POR_1000_KCAL));
}

/** Semanas para llegar a un peso bajando un porcentaje fijo por semana. */
export function semanasHasta(kgActual, kgMeta, ritmo = RITMO_OBJETIVO) {
  if (kgMeta >= kgActual) return 0;
  return Math.ceil(Math.log(kgActual / kgMeta) / -Math.log(1 - ritmo));
}

const redondear10 = (x) => Math.round(x / 10) * 10;
