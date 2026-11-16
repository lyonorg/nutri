// Ejercicio por lista, sin IA. kcal netas = (MET − 1) × kg × horas.
// Solo se acredita la mitad: las tablas sobreestiman y el cuerpo compensa parte del gasto;
// el gasto adaptativo corrige el resto con el peso real.
//
// Los MET son valores aproximados del Compendio de Actividades Físicas (2011).
// PENDIENTE: verificarlos uno a uno contra el Compendio antes de mostrarlos en la app.

export const ACTIVIDADES = {
  caminar_suave: { nombre: 'Caminar suave', met: 3.0 },
  caminar_rapido: { nombre: 'Caminar rápido', met: 4.3 },
  bicicleta_suave: { nombre: 'Bicicleta suave', met: 4.0 },
  escaleras: { nombre: 'Subir escaleras', met: 4.0 },
  fuerza_asistida: { nombre: 'Fuerza asistida (pared, silla, bandas)', met: 2.8 },
  peso_corporal: { nombre: 'Ejercicios con peso corporal', met: 3.8 },
  pesas: { nombre: 'Pesas', met: 5.0 },
  futbol: { nombre: 'Fútbol recreativo', met: 7.0 },
  baile: { nombre: 'Baile', met: 5.0 },
};

export const FRACCION_ACREDITADA = 0.5;

export function kcalEjercicio({ actividad, minutos, kg }) {
  const a = ACTIVIDADES[actividad];
  if (!a) throw new Error(`Actividad desconocida: ${actividad}`);
  const netas = Math.max(a.met - 1, 0) * kg * (minutos / 60);
  return { netas: Math.round(netas), acreditadas: Math.round(netas * FRACCION_ACREDITADA) };
}
