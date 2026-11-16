// Planificador semanal: heurística voraz + ajuste de porciones.
// Decisión: no se usa programación lineal. Son ~28 comidas por ~40 recetas; esto corre en
// milisegundos en un iPhone y cada elección se puede explicar ("por qué me tocó esto").
//
// Reglas duras: nunca un alimento marcado "No"; nunca un alimento prohibido (calabazas);
// un plato principal máximo 2 veces por semana.
// Reglas blandas (puntaje): cuadrar kcal y proteína, saciedad, variedad, usar primero lo que
// se vence, fríjol o lenteja 3-4 veces/semana, 2-3 frutas al día, preferir integral y alto en
// proteína, portátil cuando la comida es en la clínica.

import { PLANTILLAS, presupuestoDia } from './dia.js';
import { puntajeSaciedad } from './saciedad.js';
import { ajustarPorcion } from './recalculo.js';

const DIA_MS = 86_400_000;
const numDia = (fecha) => Math.round(Date.parse(`${fecha}T00:00:00Z`) / DIA_MS);

export const PROHIBIDOS_FIJOS = ['ahuyama', 'calabacin', 'zapallo', 'calabaza'];

/** Una receta se puede usar si ningún ingrediente está marcado "No" ni prohibido. */
export function recetaPermitida(receta, alimentos, prohibidos = PROHIBIDOS_FIJOS) {
  return receta.ingredientes.every((ing) => {
    if (prohibidos.includes(ing.alimentoId)) return false;
    const a = alimentos[ing.alimentoId];
    return !(a && a.loComo === false);
  });
}

const esPrincipal = (r) => r.principal ?? r.tipos.some((t) => t === 'almuerzo' || t === 'cena');

/**
 * @param dias       [{ fecha, turno, ahorro?, arrastre? }] en orden
 * @param meta       { kcal, proteina }
 * @param recetas    banco de recetas (kcal, proteina_g, fibra_g, gramos por porción base)
 * @param alimentos  { [id]: { loComo, venceEnDias? } }
 * @param historial  [{ fecha, recetaId }] de los últimos 14 días
 */
export function planificarSemana({ dias, meta, recetas, alimentos = {}, historial = [], opciones = {} }) {
  const { maxRepeticiones = 2, prohibidos = PROHIBIDOS_FIJOS, legumbresMin = 3, legumbresMax = 4 } = opciones;
  const banco = recetas.filter((r) => recetaPermitida(r, alimentos, prohibidos));
  const usos = [...historial];                 // historial + lo que se va planeando
  const usosSemana = new Map();                // recetaId -> veces en este plan
  let legumbres = 0;
  let proteinaPrincipalAnterior = null;
  const avisos = [];
  const plan = [];

  for (const d of dias) {
    const presupuesto = presupuestoDia({ turno: d.turno, metaKcal: meta.kcal, metaProteina: meta.proteina, ahorro: d.ahorro, arrastre: d.arrastre });
    const hoy = numDia(d.fecha);
    let frutasHoy = 0;
    const comidas = [];

    // Si después de cuadrar las calorías falta proteína, cambia la comida que más proteína aporte
    // por las mismas calorías (típicamente el snack por un batido o atún). Hasta 3 cambios por día.
    const repararProteina = () => {
      for (let intento = 0; intento < 3; intento++) {
        const t = sumar(comidas);
        if (t.proteina >= presupuesto.proteina * 0.95) return;
        let mejor = null;
        for (const c of comidas) {
          const slot = PLANTILLAS[d.turno].find((x) => x.id === c.slot);
          for (const r of banco) {
            if (!r.tipos.includes(c.tipo) || comidas.some((x) => x.recetaId === r.id)) continue;
            if (slot.enClinica && !r.portatil) continue;
            if ((usosSemana.get(r.id) ?? 0) >= (esPrincipal(r) ? maxRepeticiones : maxRepeticiones * 2)) continue;
            const factor = ajustarPorcion(c.kcal / r.kcal);
            const nueva = aComida(slot, r, factor);
            if (Math.abs(nueva.kcal - c.kcal) > presupuesto.kcal * 0.04) continue;
            const ganancia = nueva.proteina - c.proteina;
            if (ganancia > 3 && (!mejor || ganancia > mejor.ganancia)) mejor = { c, r, nueva, ganancia };
          }
        }
        if (!mejor) return;
        const anterior = banco.find((x) => x.id === mejor.c.recetaId);
        usosSemana.set(anterior.id, usosSemana.get(anterior.id) - 1);
        usos.splice(usos.findIndex((u) => u.fecha === d.fecha && u.recetaId === anterior.id), 1);
        if (anterior.legumbre) legumbres -= 1;
        frutasHoy += (mejor.r.frutas ?? 0) - (anterior.frutas ?? 0);
        usosSemana.set(mejor.r.id, (usosSemana.get(mejor.r.id) ?? 0) + 1);
        usos.push({ fecha: d.fecha, recetaId: mejor.r.id });
        if (mejor.r.legumbre) legumbres += 1;
        Object.assign(mejor.c, mejor.nueva);
      }
    };

    for (const slot of PLANTILLAS[d.turno]) {
      const objetivo = { kcal: presupuesto.kcal * slot.peso, proteina: presupuesto.proteina * slot.peso };
      let candidatas = banco.filter((r) => r.tipos.includes(slot.tipo) && !comidas.some((c) => c.recetaId === r.id));
      const dentroDelTope = candidatas.filter((r) => (usosSemana.get(r.id) ?? 0) < (esPrincipal(r) ? maxRepeticiones : maxRepeticiones * 2));
      if (dentroDelTope.length > 0) candidatas = dentroDelTope;
      else if (candidatas.length > 0) avisos.push({ fecha: d.fecha, slot: slot.id, aviso: 'tope_repeticion_superado' });
      if (candidatas.length === 0) {
        avisos.push({ fecha: d.fecha, slot: slot.id, aviso: 'sin_recetas' });
        continue;
      }

      const puntuadas = candidatas.map((r) => {
        const factor = ajustarPorcion(objetivo.kcal / r.kcal);
        const kcal = r.kcal * factor;
        const proteina = r.proteina_g * factor;
        let p = puntajeSaciedad(r) / 100;
        p -= 2 * Math.abs(kcal - objetivo.kcal) / objetivo.kcal;
        p -= 2 * Math.max(0, objetivo.proteina - proteina) / objetivo.proteina;
        // variedad: cada uso reciente resta, y la resta decae con los días
        p -= usos.filter((u) => u.recetaId === r.id).reduce((s, u) => s + Math.exp(-Math.max(hoy - numDia(u.fecha), 0) / 3), 0);
        if (esPrincipal(r) && r.proteinaPrincipal && r.proteinaPrincipal === proteinaPrincipalAnterior) p -= 0.4;
        if (r.legumbre) p += legumbres < legumbresMin ? 0.6 : legumbres >= legumbresMax ? -0.6 : 0;
        // no dos platos de legumbre el mismo día
        if (r.legumbre && comidas.some((c) => banco.find((x) => x.id === c.recetaId)?.legumbre)) p -= 1.5;
        if (r.frutas && frutasHoy < 2) p += 0.3 * Math.min(r.frutas, 2 - frutasHoy);
        if (r.integral || r.altaProteina) p += 0.15;
        if (slot.enClinica) p += r.portatil ? 0.3 : -0.5;
        const urgente = r.ingredientes.some((ing) => (alimentos[ing.alimentoId]?.venceEnDias ?? 99) <= 3);
        if (urgente) p += 0.5;
        return { r, factor, puntaje: p };
      }).sort((a, b) => b.puntaje - a.puntaje || a.r.id.localeCompare(b.r.id));

      const { r, factor } = puntuadas[0];
      comidas.push(aComida(slot, r, factor));
      usos.push({ fecha: d.fecha, recetaId: r.id });
      usosSemana.set(r.id, (usosSemana.get(r.id) ?? 0) + 1);
      if (r.legumbre) legumbres += 1;
      frutasHoy += r.frutas ?? 0;
      if (esPrincipal(r) && r.proteinaPrincipal) proteinaPrincipalAnterior = r.proteinaPrincipal;
    }

    cuadrarDia(comidas, presupuesto, banco);
    repararProteina();
    cuadrarDia(comidas, presupuesto, banco);
    const totales = sumar(comidas);
    if (totales.proteina < presupuesto.proteina * 0.9) avisos.push({ fecha: d.fecha, aviso: 'proteina_baja', faltan: Math.round(presupuesto.proteina - totales.proteina) });
    plan.push({ fecha: d.fecha, turno: d.turno, presupuesto, comidas, totales, frutas: frutasHoy });
  }
  return { dias: plan, avisos, legumbres };
}

function aComida(slot, r, factor) {
  return {
    slot: slot.id, tipo: slot.tipo, hora: slot.hora, recetaId: r.id, nombre: r.nombre, factor,
    kcal: Math.round(r.kcal * factor), proteina: Math.round(r.proteina_g * factor), fibra: Math.round((r.fibra_g ?? 0) * factor),
  };
}

function sumar(comidas) {
  return comidas.reduce((s, c) => ({ kcal: s.kcal + c.kcal, proteina: s.proteina + c.proteina, fibra: s.fibra + c.fibra }), { kcal: 0, proteina: 0, fibra: 0 });
}

/** Ajusta porciones en cuartos hasta dejar el día a ±5 % de las calorías; si sobra margen, sube la comida con más proteína. */
function cuadrarDia(comidas, presupuesto, banco) {
  const porId = new Map(banco.map((r) => [r.id, r]));
  for (let i = 0; i < 12; i++) {
    const t = sumar(comidas);
    const dif = presupuesto.kcal - t.kcal;
    if (Math.abs(dif) <= presupuesto.kcal * 0.05) break;
    const paso = dif > 0 ? 0.25 : -0.25;
    // al subir, primero la comida con más proteína por caloría; al bajar, la que menos tiene
    const orden = [...comidas]
      .filter((c) => (paso > 0 ? c.factor < 1.5 : c.factor > 0.5))
      .sort((a, b) => (paso > 0 ? 1 : -1) * (b.proteina / b.kcal - a.proteina / a.kcal));
    const c = orden.find((x) => Math.abs(porId.get(x.recetaId).kcal * 0.25) <= Math.abs(dif) * 1.5);
    if (!c) break;
    const r = porId.get(c.recetaId);
    c.factor += paso;
    c.kcal = Math.round(r.kcal * c.factor);
    c.proteina = Math.round(r.proteina_g * c.factor);
    c.fibra = Math.round((r.fibra_g ?? 0) * c.factor);
  }
}

/**
 * Lista de compras: gramos por alimento que pide el plan, menos lo que ya hay.
 * Las recetas van en gramos limpios; aquí se suma lo que se bota (cáscara, hueso) para comprar lo justo.
 * @param indice  Map id -> alimento (opcional). Si viene, usa parte_comestible y agrupa por tienda.
 */
export function listaCompras(plan, recetas, despensa = {}, indice = null) {
  const porId = new Map(recetas.map((r) => [r.id, r]));
  const total = {};
  for (const d of plan.dias) {
    for (const c of d.comidas) {
      for (const ing of porId.get(c.recetaId).ingredientes) {
        const comestible = indice?.get(ing.alimentoId)?.parte_comestible ?? 1;
        total[ing.alimentoId] = (total[ing.alimentoId] ?? 0) + (ing.gramos * c.factor) / comestible;
      }
    }
  }
  return Object.entries(total)
    .map(([alimentoId, gramos]) => ({
      alimentoId,
      nombre: indice?.get(alimentoId)?.nombre ?? alimentoId,
      tienda: indice?.get(alimentoId)?.tienda ?? null,
      gramos: Math.max(Math.round(gramos - (despensa[alimentoId] ?? 0)), 0),
    }))
    .filter((x) => x.gramos > 0)
    .sort((a, b) => (a.tienda ?? '').localeCompare(b.tienda ?? '') || a.alimentoId.localeCompare(b.alimentoId));
}

/** Gramos a la unidad en que se compra. En Colombia la libra de plaza y carnicería es de 500 g. */
export function aLibras(gramos) {
  return Math.ceil((gramos / 500) * 2) / 2; // se compra de a media libra
}
