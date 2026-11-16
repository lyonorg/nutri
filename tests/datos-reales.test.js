// Pruebas con los datos reales: alimentos de USDA y el banco de recetas.
// Responden la pregunta de fondo: ¿son factibles 1.500 kcal y 140 g de proteína con la comida de Michael?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calcularRecetas, indiceAlimentos, fichaCocina, planificarSemana, listaCompras, PLANTILLAS, alertaIngestaBaja,
} from '../motor/index.js';

const leer = (f) => JSON.parse(readFileSync(new URL(`../datos/${f}`, import.meta.url), 'utf8'));
const { alimentos } = leer('alimentos.json');
const { recetas: crudas } = leer('recetas.json');
const noComo = leer('no-como.json');
const indice = indiceAlimentos(alimentos);
const recetas = calcularRecetas(crudas, indice);
const fechaMas = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test('alimentos: todos traen calorías y proteína de USDA, sin valores inventados', () => {
  assert.ok(alimentos.length >= 70);
  const ids = new Set();
  for (const a of alimentos) {
    assert.ok(!ids.has(a.id), `id repetido: ${a.id}`);
    ids.add(a.id);
    assert.equal(a.fuente, 'usda');
    assert.match(a.fuente_id, /^\d{5}$/);
    assert.ok(a.kcal > 0 && a.proteina_g >= 0, a.id);
    // cordura: las calorías deben cuadrar con los macros (4-4-9) dentro de un margen amplio
    const estimado = 4 * a.proteina_g + 4 * (a.carbohidratos_g ?? 0) + 9 * (a.grasa_g ?? 0);
    assert.ok(Math.abs(estimado - a.kcal) <= Math.max(25, a.kcal * 0.2), `${a.id}: ${a.kcal} kcal vs ${Math.round(estimado)} por macros`);
  }
});

test('recetas: ninguna usa un alimento que Michael no come, y todas tienen ficha simple', () => {
  const vetados = new Set([...noComo.no_como, ...noComo.prohibidos_fijos]);
  for (const r of recetas) {
    for (const ing of r.ingredientes) assert.ok(!vetados.has(ing.alimentoId), `${r.id} lleva ${ing.alimentoId}`);
    assert.ok(r.pasos.length >= 1 && r.pasos.length <= 5, `${r.id}: ${r.pasos.length} pasos`);
    assert.ok(fichaCocina(r, indice).includes('1. '), r.id);
  }
});

test('recetas: los platos principales traen la proteína que exige la meta', () => {
  const principales = recetas.filter((r) => r.tipos.includes('almuerzo') || r.tipos.includes('cena'));
  assert.ok(principales.length >= 18);
  for (const r of principales) {
    assert.ok(r.proteinaPor100kcal >= 7.5, `${r.id}: ${r.proteinaPor100kcal} g por 100 kcal`);
    assert.ok(r.kcal >= 400 && r.kcal <= 600, `${r.id}: ${r.kcal} kcal`);
  }
  const media = principales.reduce((s, r) => s + r.proteinaPor100kcal, 0) / principales.length;
  assert.ok(media >= 9.3, `media de los principales: ${media.toFixed(1)}`);
});

test('hay suficientes recetas portátiles para cada comida que cae en la clínica', () => {
  for (const tipo of ['desayuno', 'snack']) {
    const n = recetas.filter((r) => r.tipos.includes(tipo) && r.portatil).length;
    assert.ok(n >= 4, `${tipo} portátiles: ${n}`);
  }
});

test('FACTIBILIDAD: dos semanas de turnos rotativos a 1.500 kcal y 140 g de proteína', () => {
  const rotacion = ['manana', 'manana', 'tarde', 'tarde', 'noche', 'post-noche', 'libre',
    'tarde', 'noche', 'post-noche', 'libre', 'manana', 'manana', 'libre'];
  const meta = { kcal: 1500, proteina: 140 };
  const semana1 = planificarSemana({ dias: rotacion.slice(0, 7).map((turno, i) => ({ fecha: fechaMas('2026-11-23', i), turno })), meta, recetas });
  const historial = semana1.dias.flatMap((d) => d.comidas.map((c) => ({ fecha: d.fecha, recetaId: c.recetaId })));
  const semana2 = planificarSemana({ dias: rotacion.slice(7).map((turno, i) => ({ fecha: fechaMas('2026-11-30', i), turno })), meta, recetas, historial });

  for (const plan of [semana1, semana2]) {
    assert.deepEqual(plan.avisos, []);
    let kcal = 0; let presupuesto = 0; let proteina = 0; let metaProteina = 0; let fibra = 0;
    const usos = new Map();
    for (const d of plan.dias) {
      assert.equal(d.comidas.length, PLANTILLAS[d.turno].length, `${d.fecha}: faltan comidas`);
      assert.ok(Math.abs(d.totales.kcal - d.presupuesto.kcal) / d.presupuesto.kcal <= 0.07, `${d.fecha} ${d.turno}: ${d.totales.kcal} vs ${d.presupuesto.kcal} kcal`);
      assert.ok(d.totales.proteina >= d.presupuesto.proteina * 0.93, `${d.fecha} ${d.turno}: ${d.totales.proteina} vs ${d.presupuesto.proteina} g`);
      kcal += d.totales.kcal; presupuesto += d.presupuesto.kcal; proteina += d.totales.proteina; metaProteina += d.presupuesto.proteina; fibra += d.totales.fibra;
      for (const c of d.comidas) if (c.tipo === 'almuerzo' || c.tipo === 'cena') usos.set(c.recetaId, (usos.get(c.recetaId) ?? 0) + 1);
    }
    assert.ok(Math.abs(kcal - presupuesto) / presupuesto <= 0.02, `semana: ${kcal} vs ${presupuesto} kcal`);
    assert.ok(proteina >= metaProteina * 0.98, `semana: ${proteina} vs ${metaProteina} g de proteína`);
    assert.ok(fibra / 7 >= 18, `fibra media: ${(fibra / 7).toFixed(1)} g`);
    for (const [id, n] of usos) assert.ok(n <= 2, `${id} sale ${n} veces`);
    assert.ok(usos.size >= 9, `solo ${usos.size} platos principales distintos`);
    assert.ok(plan.legumbres >= 3, `legumbres: ${plan.legumbres}`);
  }
});

test('lista de compras real: suma lo que se bota (cáscara, hueso) y agrupa por tienda', () => {
  const dias = ['libre', 'manana', 'tarde'].map((turno, i) => ({ fecha: fechaMas('2026-11-23', i), turno }));
  const plan = planificarSemana({ dias, meta: { kcal: 1500, proteina: 140 }, recetas });
  const limpia = listaCompras(plan, recetas);
  const real = listaCompras(plan, recetas, {}, indice);
  const g = (lista, id) => lista.find((x) => x.alimentoId === id)?.gramos ?? 0;
  const conDesecho = real.find((x) => indice.get(x.alimentoId).parte_comestible < 0.9);
  assert.ok(conDesecho, 'el plan debe incluir algo con cáscara o hueso');
  assert.ok(g(real, conDesecho.alimentoId) > g(limpia, conDesecho.alimentoId));
  assert.ok(real.every((x) => x.nombre && x.tienda));
});

test('alerta de comer muy poco: tres días bajos seguidos', () => {
  const bajos = [1, 2, 3].map((i) => ({ fecha: `2026-11-2${i}`, kcal: 1050, proteina: 80, completo: true }));
  assert.deepEqual(alertaIngestaBaja({ dias: bajos, metaKcal: 1500, metaProteina: 140 }).avisos, ['calorias_bajas', 'proteina_baja']);
  const bien = bajos.map((d) => ({ ...d, kcal: 1480, proteina: 135 }));
  assert.equal(alertaIngestaBaja({ dias: bien, metaKcal: 1500, metaProteina: 140 }), null);
  assert.equal(alertaIngestaBaja({ dias: bajos.slice(0, 2), metaKcal: 1500, metaProteina: 140 }), null);
});
