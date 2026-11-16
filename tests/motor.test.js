// Pruebas adicionales: las reglas que corrigen contradicciones del plan original.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gastoInicial, metaSemanal, metaProteina, metaFibra, semanasHasta, estimarGasto, tendencia, edadEn,
  presupuestoDia, abrirDia, instanteLocal, enVentanaSinComer, asignarDia,
  recalcular, repartirExceso, bancoComidaLibre, elegirOpciones,
  puntajeSaciedad, kcalEjercicio, planificarSemana, listaCompras, aLibras,
  PISO_PROMEDIO, PISO_DIARIO,
} from '../motor/index.js';
import { recetas, alimentos, perfil } from './datos-de-prueba.js';

const fechaMas = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test('meta de arranque de Michael: ~2.175 de gasto, ~1.500 kcal, 140 g de proteína', () => {
  assert.equal(edadEn('1998-07-30', '2026-11-16'), 28);
  const gasto = gastoInicial(perfil);
  assert.equal(gasto, 2175);
  const meta = metaSemanal({ gasto, kg: 86 });
  assert.ok(meta.kcal >= PISO_PROMEDIO && meta.kcal <= 1530, `meta ${meta.kcal}`);
  assert.ok(meta.deficit / gasto <= 0.31, 'el déficit respeta el tope de 30 %');
  assert.equal(metaProteina(86, 0), 140);
  assert.equal(metaFibra(1500), 21);
});

test('la meta nunca baja de 1.500 ni cambia más de 150 por semana', () => {
  assert.equal(metaSemanal({ gasto: 1800, kg: 75 }).kcal, 1500);
  assert.equal(metaSemanal({ gasto: 2600, kg: 86, metaAnterior: 1500 }).kcal, 1650);
});

test('salvavidas: dos semanas por encima de 1 %/semana, o hambre sostenida, suben la meta', () => {
  const base = { gasto: 2175, kg: 86, metaAnterior: 1520 };
  assert.equal(metaSemanal({ ...base, ritmosRecientes: [0.012, 0.011] }).kcal, 1620);
  assert.equal(metaSemanal({ ...base, ritmosRecientes: [0.012, 0.006] }).kcal, 1520);
  assert.equal(metaSemanal({ ...base, hambreSostenida: true }).kcal, 1620);
  assert.equal(metaSemanal({ ...base, enPausa: true }).kcal, 2180);
});

test('antes de 14 días y 8 pesajes manda la fórmula', () => {
  const dias = Array.from({ length: 9 }, (_, i) => ({ fecha: fechaMas('2026-11-16', i), kcal: 1500, completo: true }));
  const pesajes = dias.map((d, i) => ({ fecha: d.fecha, kg: 86 - 0.3 * i }));
  const e = estimarGasto({ dias, pesajes, prior: 2175, hoy: '2026-11-24' });
  assert.equal(e.gasto, 2175);
  assert.notEqual(e.motivo, 'ok');
});

test('si el gasto real es mayor que la fórmula, el estimado se mueve hacia él y los pesajes ruidosos no cuentan', () => {
  // gasto real 2.500: come 1.500 y baja 0,91 kg/semana
  const dias = [];
  const pesajes = [];
  for (let i = 0; i < 28; i++) {
    const fecha = fechaMas('2026-11-16', i);
    dias.push({ fecha, kcal: 1500, completo: true });
    pesajes.push({ fecha, kg: 86 - (1000 / 7700) * i });
  }
  const limpio = estimarGasto({ dias, pesajes, prior: 2175, hoy: '2026-12-13' });
  assert.ok(limpio.gasto > 2350 && limpio.gasto < 2500, `estimado ${limpio.gasto}`);

  // un pesaje post-noche con 1,5 kg de agua, marcado como no válido, no cambia nada
  const conRuido = pesajes.map((p, i) => (i === 27 ? { ...p, kg: p.kg + 1.5, valido: false } : p));
  const e = estimarGasto({ dias, pesajes: conRuido, prior: 2175, hoy: '2026-12-13' });
  assert.ok(Math.abs(e.gasto - limpio.gasto) <= 15);
});

test('tendencia: suaviza el ruido para la gráfica', () => {
  const t = tendencia([{ fecha: '2026-11-16', kg: 86 }, { fecha: '2026-11-17', kg: 87 }, { fecha: '2026-11-18', kg: 85.5 }]);
  assert.equal(t[0].tendencia, 86);
  assert.equal(t[1].tendencia, 86.1);
});

test('72,5 kg desde 86 kg a 0,7 %/semana son unas 25 semanas', () => {
  const s = semanasHasta(86, 72.5);
  assert.ok(s >= 23 && s <= 26, `${s} semanas`);
});

test('presupuesto por turno: noche 115 %, post-noche 85 %, y la pareja suma dos días', () => {
  const meta = { metaKcal: 1500, metaProteina: 140 };
  const noche = presupuestoDia({ turno: 'noche', ...meta });
  const post = presupuestoDia({ turno: 'post-noche', ...meta });
  assert.equal(noche.kcal, 1725);
  assert.equal(post.kcal, 1275);
  assert.equal(noche.kcal + post.kcal, 3000);
  assert.equal(noche.proteina + post.proteina, 280);
});

test('ni el banco de comida libre ni el arrastre bajan un día del piso de 1.400', () => {
  const p = presupuestoDia({ turno: 'libre', metaKcal: 1500, metaProteina: 140, ahorro: 75, arrastre: 200 });
  assert.equal(p.kcal, PISO_DIARIO);
  assert.equal(p.descontado, 100);
  assert.equal(presupuestoDia({ turno: 'libre', metaKcal: 1900, metaProteina: 140, ahorro: 75, arrastre: 200 }).kcal, 1625);
  assert.equal(bancoComidaLibre(6), 450);
});

test('turno de noche: nada entre la 01:00 y las 06:00; el día cierra 2 h después de la última comida', () => {
  assert.equal(enVentanaSinComer(instanteLocal('2026-11-21', '03:00'), 'noche'), true);
  assert.equal(enVentanaSinComer(instanteLocal('2026-11-20', '23:00'), 'noche'), false);
  assert.equal(enVentanaSinComer(instanteLocal('2026-11-21', '03:00'), 'libre'), false);
  const dia = abrirDia({ turno: 'noche', inicio: instanteLocal('2026-11-20', '08:40') });
  assert.equal(dia.cierreAuto, instanteLocal('2026-11-21', '09:45'));
});

test('un registro sin día abierto pide abrir uno nuevo; el snack tardío cae en el día que acaba de cerrar', () => {
  const dia = abrirDia({ turno: 'libre', inicio: instanteLocal('2026-11-18', '08:00') });
  assert.equal(asignarDia(instanteLocal('2026-11-18', '23:30'), [dia]).fecha, '2026-11-18');
  assert.equal(asignarDia(instanteLocal('2026-11-19', '09:00'), [dia]), null);
  assert.equal(asignarDia(instanteLocal('2026-11-18', '07:00'), [dia]), null);
});

test('recálculo: proteína primero, pasándose como mucho 150 kcal', () => {
  const restantes = [{ id: 'snack', peso: 0.13 }, { id: 'cena', peso: 0.30 }];
  const r = recalcular({ presupuesto: { kcal: 1500, proteina: 140 }, consumido: { kcal: 1100, proteina: 40 }, restantes });
  assert.equal(r.aviso, 'proteina_prioritaria');
  assert.equal(r.kcal, 500);
  assert.equal(r.proteina, 100);
  assert.equal(r.exceso, 100);

  const pasado = recalcular({ presupuesto: { kcal: 1500, proteina: 140 }, consumido: { kcal: 1900, proteina: 60 }, restantes: [{ id: 'cena', peso: 0.3 }] });
  assert.equal(pasado.kcal, 150);
  assert.equal(pasado.proteina, 30);
  assert.equal(pasado.exceso, 550);
});

test('el exceso se reparte en máx. 200 kcal por 3 días y el resto se perdona', () => {
  assert.deepEqual(repartirExceso(350), { descuentos: [200, 150], perdonado: 0 });
  assert.deepEqual(repartirExceso(900), { descuentos: [200, 200, 200], perdonado: 300 });
  assert.deepEqual(repartirExceso(0), { descuentos: [], perdonado: 0 });
});

test('"cambiar este plato" devuelve 3 opciones permitidas cerca del objetivo', () => {
  const cenas = recetas.filter((r) => r.tipos.includes('cena'));
  const op = elegirOpciones({ objetivo: { kcal: 450, proteina: 42 }, recetas: cenas });
  assert.equal(op.length, 3);
  for (const o of op) assert.ok(Math.abs(o.kcal - 450) <= 90, `${o.nombre}: ${o.kcal}`);
});

test('saciedad: un caldo con pollo puntúa más que unas galletas de las mismas calorías', () => {
  const caldo = puntajeSaciedad({ kcal: 200, proteina_g: 25, fibra_g: 2, gramos: 450, nova: 1 });
  const galletas = puntajeSaciedad({ kcal: 200, proteina_g: 3, fibra_g: 1, gramos: 42, nova: 4 });
  assert.ok(caldo > 70 && galletas < 20, `caldo ${caldo}, galletas ${galletas}`);
});

test('ejercicio: (MET − 1) × kg × horas, y solo se acredita la mitad', () => {
  const e = kcalEjercicio({ actividad: 'caminar_rapido', minutos: 30, kg: 86 });
  assert.equal(e.netas, 142);
  assert.equal(e.acreditadas, 71);
  assert.throws(() => kcalEjercicio({ actividad: 'volar', minutos: 10, kg: 86 }));
});

test('plan semanal: cuadra calorías y proteína, respeta variedad, legumbres y comidas portátiles', () => {
  const turnos = ['manana', 'tarde', 'noche', 'post-noche', 'libre', 'manana', 'libre'];
  const dias = turnos.map((turno, i) => ({ fecha: fechaMas('2026-11-16', i), turno }));
  const plan = planificarSemana({ dias, meta: { kcal: 1500, proteina: 140 }, recetas, alimentos });
  const porId = new Map(recetas.map((r) => [r.id, r]));

  const usos = new Map();
  for (const d of plan.dias) {
    assert.ok(Math.abs(d.totales.kcal - d.presupuesto.kcal) / d.presupuesto.kcal <= 0.08, `${d.fecha} ${d.turno}: ${d.totales.kcal} vs ${d.presupuesto.kcal}`);
    assert.ok(d.totales.proteina >= d.presupuesto.proteina * 0.9, `${d.fecha} ${d.turno}: proteína ${d.totales.proteina} vs ${d.presupuesto.proteina}`);
    for (const c of d.comidas) {
      usos.set(c.recetaId, (usos.get(c.recetaId) ?? 0) + 1);
      const enClinica = (d.turno === 'manana' && c.slot === 'desayuno') || (d.turno === 'tarde' && c.slot === 'snack') || (d.turno === 'noche' && c.slot === 'snack');
      if (enClinica) assert.ok(porId.get(c.recetaId).portatil, `${c.nombre} no es portátil`);
    }
  }
  for (const [id, n] of usos) {
    const principal = porId.get(id).tipos.some((t) => t === 'almuerzo' || t === 'cena');
    if (principal) assert.ok(n <= 2, `${id} sale ${n} veces`);
  }
  assert.ok(plan.legumbres >= 3 && plan.legumbres <= 4, `legumbres: ${plan.legumbres}`);
  assert.deepEqual(plan.avisos, []);
});

test('lo que se vence primero se usa primero', () => {
  const dias = [{ fecha: '2026-11-16', turno: 'libre' }];
  const base = planificarSemana({ dias, meta: { kcal: 1500, proteina: 140 }, recetas, alimentos });
  const conTrucha = planificarSemana({ dias, meta: { kcal: 1500, proteina: 140 }, recetas, alimentos: { ...alimentos, trucha: { loComo: true, venceEnDias: 1 } } });
  const ids = (p) => p.dias[0].comidas.map((c) => c.recetaId);
  assert.ok(ids(conTrucha).includes('trucha-papa'), `con trucha por vencer: ${ids(conTrucha)}`);
  assert.ok(base.dias[0].comidas.length === 4);
});

test('lista de compras: suma gramos del plan, descuenta la despensa y usa libras de 500 g', () => {
  const dias = [{ fecha: '2026-11-16', turno: 'libre' }, { fecha: '2026-11-17', turno: 'libre' }];
  const plan = planificarSemana({ dias, meta: { kcal: 1500, proteina: 140 }, recetas, alimentos });
  const lista = listaCompras(plan, recetas);
  assert.ok(lista.length > 5);
  const primero = lista[0];
  const menos = listaCompras(plan, recetas, { [primero.alimentoId]: primero.gramos });
  assert.ok(!menos.some((x) => x.alimentoId === primero.alimentoId));
  assert.equal(aLibras(500), 1);
  assert.equal(aLibras(620), 1.5);
});
