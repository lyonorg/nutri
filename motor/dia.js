// Día nutricional: va de que Michael se levanta a que se acuesta, no de 00:00 a 00:00.
// Así un turno de noche (19:00-07:00) queda en UN solo día.
//
// Decisión: el motor trabaja con instantes en milisegundos (epoch) y un desfase fijo de zona
// horaria (Colombia no tiene horario de verano), para que el resultado no dependa del teléfono.

import { FACTOR_TURNO, PISO_DIARIO } from './constantes.js';

export const UTC_OFFSET_COLOMBIA_MIN = -300;
const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export const TURNOS = ['manana', 'tarde', 'noche', 'post-noche', 'libre'];

// peso = fracción de las calorías del día. offset = 1 si la comida cae al día calendario siguiente.
export const PLANTILLAS = {
  manana: [
    { id: 'desayuno', tipo: 'desayuno', hora: '09:30', peso: 0.22, enClinica: true },
    { id: 'almuerzo', tipo: 'almuerzo', hora: '14:00', peso: 0.35 },
    { id: 'snack', tipo: 'snack', hora: '17:00', peso: 0.13 },
    { id: 'cena', tipo: 'cena', hora: '20:00', peso: 0.30 },
  ],
  tarde: [
    { id: 'desayuno', tipo: 'desayuno', hora: '08:30', peso: 0.22 },
    { id: 'almuerzo', tipo: 'almuerzo', hora: '12:15', peso: 0.35 },
    { id: 'snack', tipo: 'snack', hora: '16:30', peso: 0.13, enClinica: true },
    { id: 'cena', tipo: 'cena', hora: '20:00', peso: 0.30 },
  ],
  noche: [
    { id: 'desayuno', tipo: 'desayuno', hora: '09:00', peso: 0.18 },
    { id: 'almuerzo', tipo: 'almuerzo', hora: '13:00', peso: 0.28 },
    { id: 'cena', tipo: 'cena', hora: '18:00', peso: 0.28 },
    { id: 'snack', tipo: 'snack', hora: '23:00', peso: 0.12, enClinica: true },
    { id: 'desayuno_salida', tipo: 'desayuno', hora: '07:45', offset: 1, peso: 0.14 },
  ],
  'post-noche': [
    { id: 'almuerzo', tipo: 'almuerzo', hora: '14:00', peso: 0.42 },
    { id: 'snack', tipo: 'snack', hora: '17:30', peso: 0.16 },
    { id: 'cena', tipo: 'cena', hora: '20:00', peso: 0.42 },
  ],
  libre: [
    { id: 'desayuno', tipo: 'desayuno', hora: '08:30', peso: 0.22 },
    { id: 'almuerzo', tipo: 'almuerzo', hora: '12:30', peso: 0.35 },
    { id: 'snack', tipo: 'snack', hora: '16:30', peso: 0.13 },
    { id: 'cena', tipo: 'cena', hora: '20:00', peso: 0.30 },
  ],
};

/** Fecha local 'AAAA-MM-DD' de un instante. */
export function fechaLocal(ts, utcOffsetMin = UTC_OFFSET_COLOMBIA_MIN) {
  return new Date(ts + utcOffsetMin * MIN).toISOString().slice(0, 10);
}

/** Instante (ms) de una fecha y hora locales. */
export function instanteLocal(fecha, hora = '00:00', utcOffsetMin = UTC_OFFSET_COLOMBIA_MIN) {
  const [h, m] = hora.split(':').map(Number);
  return Date.parse(`${fecha}T00:00:00Z`) + h * HORA + m * MIN - utcOffsetMin * MIN;
}

/** Minutos desde la medianoche local. */
function minutosDelDia(ts, utcOffsetMin) {
  return Math.floor((((ts + utcOffsetMin * MIN) % DIA) + DIA) % DIA / MIN);
}

/**
 * Abre un día nutricional al tocar "Hoy estoy en…".
 * La fecha del día es la fecha local del momento en que empieza: hay un solo día por fecha.
 */
export function abrirDia({ turno, inicio, utcOffsetMin = UTC_OFFSET_COLOMBIA_MIN }) {
  if (!PLANTILLAS[turno]) throw new Error(`Turno desconocido: ${turno}`);
  const fecha = fechaLocal(inicio, utcOffsetMin);
  const comidas = PLANTILLAS[turno].map((c) => ({
    ...c,
    ts: instanteLocal(fecha, c.hora, utcOffsetMin) + (c.offset ?? 0) * DIA,
  }));
  const ultima = Math.max(...comidas.map((c) => c.ts));
  return {
    fecha,
    turno,
    inicio,
    cierre: null,                    // se llena al tocar "me voy a dormir"
    cierreAuto: ultima + 2 * HORA,   // si no lo toca, cierra 2 h después de la última comida planeada
    completo: true,
    comidas,
  };
}

export function finDelDia(dia) {
  return dia.cierre ?? dia.cierreAuto;
}

/**
 * A qué día nutricional pertenece un registro.
 * Dentro de [inicio, fin) del día; o hasta 6 h después del cierre si todavía no se abrió otro día
 * (el snack tardío cuenta para el día que acaba de terminar). Devuelve null si hay que abrir un día nuevo.
 */
export function asignarDia(ts, dias, graciaHoras = 6) {
  const orden = [...dias].sort((a, b) => a.inicio - b.inicio);
  for (let i = orden.length - 1; i >= 0; i--) {
    const d = orden[i];
    if (ts < d.inicio) continue;
    if (ts < finDelDia(d)) return d;
    if (ts < finDelDia(d) + graciaHoras * HORA) return d;
    return null;
  }
  return null;
}

/** En turno de noche no se come entre la 01:00 y las 06:00 (regla §2.7). */
export function enVentanaSinComer(ts, turno, utcOffsetMin = UTC_OFFSET_COLOMBIA_MIN) {
  if (turno !== 'noche') return false;
  const m = minutosDelDia(ts, utcOffsetMin);
  return m >= 60 && m < 360;
}

/**
 * Calorías y proteína del día según el turno, el ahorro para la comida libre y el arrastre de excesos.
 * Nunca baja del piso diario (escalado por el turno).
 */
export function presupuestoDia({ turno, metaKcal, metaProteina, ahorro = 0, arrastre = 0, extra = 0 }) {
  const factor = FACTOR_TURNO[turno] ?? 1;
  const base = metaKcal * factor;
  const piso = Math.min(base, PISO_DIARIO * factor);
  const kcal = Math.max(base - ahorro - arrastre, piso) + extra;
  return {
    kcal: Math.round(kcal),
    proteina: Math.round(metaProteina * factor),
    descontado: Math.round(base - Math.max(base - ahorro - arrastre, piso)),
  };
}

/** Comidas del día que todavía no han pasado o no se han registrado. */
export function comidasRestantes(dia, idsRegistradas = []) {
  const hechas = new Set(idsRegistradas);
  return dia.comidas.filter((c) => !hechas.has(c.id));
}
