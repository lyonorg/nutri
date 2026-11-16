// Las 5 pruebas mínimas del brief.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirDia, asignarDia, instanteLocal, recalcular, planificarSemana, recetaPermitida, estimarGasto,
} from '../motor/index.js';
import { recetas, alimentos } from './datos-de-prueba.js';

const fechaMas = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test('1. Un turno de noche (19:00-07:00) queda en un solo día nutricional', () => {
  const dia = abrirDia({ turno: 'noche', inicio: instanteLocal('2026-11-20', '08:40') });
  const registros = [
    instanteLocal('2026-11-20', '09:05'),  // desayuno
    instanteLocal('2026-11-20', '18:10'),  // comida principal antes del turno
    instanteLocal('2026-11-20', '23:05'),  // snack en la clínica
    instanteLocal('2026-11-21', '07:50'),  // desayuno ligero al salir, ya es otro día calendario
  ];
  for (const ts of registros) assert.equal(asignarDia(ts, [dia])?.fecha, '2026-11-20');

  // al despertar abre el post-noche: es otro día, con otra fecha, y lo nuevo cae ahí
  const post = abrirDia({ turno: 'post-noche', inicio: instanteLocal('2026-11-21', '13:30') });
  assert.equal(post.fecha, '2026-11-21');
  assert.equal(asignarDia(instanteLocal('2026-11-21', '14:05'), [dia, post]).fecha, '2026-11-21');
});

test('2. Con 1.100 kcal registradas a las 14:00, quedan ~400 kcal en 2 comidas y se sigue buscando la proteína', () => {
  const dia = abrirDia({ turno: 'manana', inicio: instanteLocal('2026-11-18', '07:30') });
  const restantes = dia.comidas.filter((c) => ['snack', 'cena'].includes(c.id));
  const r = recalcular({ presupuesto: { kcal: 1500, proteina: 140 }, consumido: { kcal: 1100, proteina: 80 }, restantes });

  assert.equal(r.comidas.length, 2);
  const kcal = r.comidas.reduce((s, c) => s + c.kcal, 0);
  const proteina = r.comidas.reduce((s, c) => s + c.proteina, 0);
  assert.ok(Math.abs(kcal - 400) <= 2, `kcal restantes ${kcal}`);
  assert.ok(Math.abs(proteina - 60) <= 2, `proteína restante ${proteina}`);
  assert.equal(r.proteinaSinCubrir, 0);
  assert.equal(r.exceso, 0);
});

test('3. Ningún plan contiene un alimento marcado "No"', () => {
  const turnos = ['manana', 'tarde', 'noche', 'post-noche', 'libre', 'manana', 'tarde'];
  const dias = turnos.map((turno, i) => ({ fecha: fechaMas('2026-11-16', i), turno }));
  const plan = planificarSemana({ dias, meta: { kcal: 1500, proteina: 140 }, recetas, alimentos });

  const porId = new Map(recetas.map((x) => [x.id, x]));
  const noComo = new Set(Object.entries(alimentos).filter(([, a]) => a.loComo === false).map(([id]) => id));
  let comidas = 0;
  for (const d of plan.dias) {
    for (const c of d.comidas) {
      comidas += 1;
      for (const ing of porId.get(c.recetaId).ingredientes) {
        assert.ok(!noComo.has(ing.alimentoId), `${c.nombre} lleva ${ing.alimentoId}`);
      }
    }
  }
  assert.ok(comidas >= 26, 'el plan debe llenar la semana');
  assert.equal(recetaPermitida(porId.get('crema-ahuyama'), {}), false, 'las calabazas están prohibidas aunque no estén en la lista');
});

function simular({ dias, ingesta, kgInicial, kgPorSemana, ruido = 0 }) {
  const registros = [];
  const pesajes = [];
  for (let i = 0; i < dias; i++) {
    const fecha = fechaMas('2026-11-16', i);
    registros.push({ fecha, kcal: ingesta, completo: true });
    const onda = ruido * Math.sin(i * 2.4) ; // ruido determinista (agua, sal)
    pesajes.push({ fecha, kg: kgInicial - (kgPorSemana / 7) * i + onda });
  }
  return { registros, pesajes, hoy: fechaMas('2026-11-16', dias - 1) };
}

test('4. Con 3 semanas de datos (1.500 kcal, −0,6 kg/sem) el gasto estimado da ~2.160 ± 5 %', () => {
  const { registros, pesajes, hoy } = simular({ dias: 21, ingesta: 1500, kgInicial: 86, kgPorSemana: 0.6 });
  const e = estimarGasto({ dias: registros, pesajes, prior: 2175, hoy });
  assert.equal(e.motivo, 'ok');
  assert.ok(Math.abs(e.gastoDatos - 2160) <= 5, `solo datos: ${e.gastoDatos}`);
  assert.ok(Math.abs(e.gasto - 2160) / 2160 <= 0.05, `mezclado: ${e.gasto}`);

  // con ruido de ±0,4 kg en la báscula sigue dentro del 5 %
  const r = simular({ dias: 21, ingesta: 1500, kgInicial: 86, kgPorSemana: 0.6, ruido: 0.4 });
  const e2 = estimarGasto({ dias: r.registros, pesajes: r.pesajes, prior: 2175, hoy: r.hoy });
  assert.ok(Math.abs(e2.gasto - 2160) / 2160 <= 0.05, `con ruido: ${e2.gasto}`);
});

test('5. Un día marcado incompleto no cambia el gasto', () => {
  const { registros, pesajes, hoy } = simular({ dias: 21, ingesta: 1500, kgInicial: 86, kgPorSemana: 0.6 });
  const antes = estimarGasto({ dias: registros, pesajes, prior: 2175, hoy });

  const conHueco = registros.map((d, i) => (i === 10 ? { ...d, kcal: 350, completo: false } : d));
  const despues = estimarGasto({ dias: conHueco, pesajes, prior: 2175, hoy });
  assert.equal(despues.gasto, antes.gasto);

  // contraprueba: si ese mismo día contara, el gasto sí bajaría
  const contando = registros.map((d, i) => (i === 10 ? { ...d, kcal: 350 } : d));
  assert.ok(estimarGasto({ dias: contando, pesajes, prior: 2175, hoy }).gasto < antes.gasto);
});
