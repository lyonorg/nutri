// Nutri — la app. Toda la matemática vive en ../motor; aquí solo hay pantallas y guardado.
import * as M from '../motor/index.js';
import * as db from './db.js';

/* ------------------------------------------------------------------ estado */
const S = {
  alimentos: [], indice: null, recetasBase: [], recetas: [],
  perfil: null, tema: null, rapidos: null,
  dia: null, registros: [], vista: 'hoy',
};

const PERFIL_INICIAL = {
  id: 'perfil', nombre: 'Michael', fechaNac: '1998-07-30', cm: 174, sexo: 'm', kgInicial: 86,
  etapa: 0, meta: { kcal: 1500, proteina: 140 }, batidoFijo: true, batido: null,
};
const TEMA_INICIAL = { id: 'tema', paleta: 'menta', modo: 'oscuro' };
const RAPIDOS_INICIALES = [
  { id: 'batido', nombre: 'Batido', det: '2 scoops', ico: 'vaso', batido: true },
  { id: 'yogur', nombre: 'Yogur griego', det: '1 taza', kcal: 148, proteina: 25.5, fibra: 0, ico: 'yogur' },
  { id: 'huevos', nombre: '2 huevos duros', det: '2 unidades', kcal: 143, proteina: 12.6, fibra: 0, ico: 'huevo' },
  { id: 'cafe', nombre: 'Café negro', det: '1 taza', kcal: 2, proteina: 0.3, fibra: 0, ico: 'cafe' },
  { id: 'coca-zero', nombre: 'Coca-Cola Zero', det: '1 lata', kcal: 1, proteina: 0, fibra: 0, ico: 'lata' },
  { id: 'redbull-zero', nombre: 'Red Bull Zero', det: '1 lata · revisa la etiqueta', kcal: 5, proteina: 0, fibra: 0, ico: 'lata' },
];
const TIPOS = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', snack: 'Snack', cena: 'Cena' };
const TURNOS = {
  manana: ['Turno de mañana', '07:00–13:00 · sales ~13:40', 'sol'],
  tarde: ['Turno de tarde', '13:00–19:00 · sales ~19:40', 'tarde'],
  noche: ['Turno de noche', '19:00–07:00 · nada de 01 a 06 h', 'luna'],
  'post-noche': ['Post-noche', 'Duermes en la mañana', 'cama'],
  libre: ['Día libre', 'Buen día para cocinar en lote', 'libre'],
};
const TURNO_CORTO = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', 'post-noche': 'Post-noche', libre: 'Libre' };
const HAMBRE = [
  { nombre: 'Caldo o consomé de pollo desgrasado', det: '1 taza', kcal: 30, proteina: 3 },
  { nombre: 'Pepino, rábano o tomate cherry con limón', det: '1 taza', kcal: 25, proteina: 1 },
  { nombre: 'Gelatina sin azúcar', det: '1 vaso', kcal: 10, proteina: 1 },
  { nombre: 'Yogur griego natural', det: '½ taza', kcal: 71, proteina: 12 },
  { nombre: 'Atún en agua', det: '1 lata pequeña', kcal: 86, proteina: 19 },
  { nombre: 'Café, té o aromática', det: '1 taza', kcal: 2, proteina: 0 },
];
const PROMPT_GEMINI = `Analiza lo que comí (foto o descripción) y responde SOLO con este JSON, sin texto extra:
{"items":[{"nombre":"alimento","gramos":0,"kcal":0,"proteina_g":0,"fibra_g":0}]}
Usa gramos de lo que realmente comí y valores realistas para Colombia.`;
const PROMPT_ETIQUETA = `Lee esta tabla nutricional y responde SOLO con este JSON, sin texto extra. Usa null si un dato no aparece.
{"producto":"","porcion":{"cantidad":0,"unidad":"","gramos":0},"por_porcion":{"kcal":0,"proteina_g":0,"carbohidratos_g":0,"grasa_g":0,"fibra_g":0}}`;

/* ------------------------------------------------------------------ utilidades */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('es-CO');
const dec = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const hoyFecha = () => M.fechaLocal(Date.now());
const sumarDias = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const diaSemana = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 = domingo
const lunesDe = (fecha) => sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
const nombreDia = (fecha, largo = false) => new Intl.DateTimeFormat('es-CO', { weekday: largo ? 'long' : 'short', day: 'numeric', month: largo ? 'long' : undefined, timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`));
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const horaAhora = () => new Date(Date.now() + M.UTC_OFFSET_COLOMBIA_MIN * 60_000).toISOString().slice(11, 16);
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function toast(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}

const st = 'fill="none" stroke="var(--acento)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  sol: `<svg width="20" height="20" viewBox="0 0 24 24" ${st}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>`,
  tarde: `<svg width="20" height="20" viewBox="0 0 24 24" ${st}><path d="M17 18a5 5 0 0 0-10 0M12 9V3M4.2 10.2l1.4 1.4M18.4 11.6l1.4-1.4M2 18h20"/></svg>`,
  luna: `<svg width="20" height="20" viewBox="0 0 24 24" ${st}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`,
  cama: `<svg width="20" height="20" viewBox="0 0 24 24" ${st}><path d="M3 7v12M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/></svg>`,
  libre: `<svg width="20" height="20" viewBox="0 0 24 24" ${st}><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg>`,
  vaso: `<svg width="18" height="18" viewBox="0 0 24 24" ${st}><path d="M7 3h10l-1.5 18h-7z M6 8h12"/></svg>`,
  yogur: `<svg width="18" height="18" viewBox="0 0 24 24" ${st}><path d="M5 9h14l-2 11H7z M8 9V6a4 4 0 0 1 8 0v3"/></svg>`,
  huevo: `<svg width="18" height="18" viewBox="0 0 24 24" ${st}><path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/></svg>`,
  cafe: `<svg width="18" height="18" viewBox="0 0 24 24" ${st}><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M17 10h2a2 2 0 0 1 0 4h-2 M8 3v3M12 3v3"/></svg>`,
  lata: `<svg width="18" height="18" viewBox="0 0 24 24" ${st}><path d="M7 5h10v15a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z M8 2h8l1 3H7z M7 10h10"/></svg>`,
  fruta: `<svg width="18" height="18" viewBox="0 0 24 24" ${st}><path d="M12 8c-4-3-9 0-8 5s4 8 8 7c4 1 7-2 8-7s-4-8-8-5z M12 8c0-2 1-4 3-5"/></svg>`,
  plato: `<svg width="18" height="18" viewBox="0 0 24 24" ${st}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>`,
};

/* ------------------------------------------------------------------ temas */
function aplicarTema() {
  const modo = S.tema.modo === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro') : S.tema.modo;
  document.documentElement.dataset.paleta = S.tema.paleta;
  document.documentElement.dataset.modo = modo;
  document.body.dataset.paleta = S.tema.paleta;
  document.body.dataset.modo = modo;
  const fondo = getComputedStyle(document.body).getPropertyValue('--fondo').trim();
  $('meta[name=theme-color]')?.setAttribute('content', fondo || '#0b0d0e');
}

/* ------------------------------------------------------------------ recetas y batido */
function recalcularRecetas() {
  S.recetas = M.calcularRecetas(S.recetasBase, S.indice);
  const b = S.perfil.batido;
  if (b) {
    const r = S.recetas.find((x) => x.id === 'batido-proteina');
    Object.assign(r, { kcal: b.kcal, proteina_g: b.proteina, fibra_g: b.fibra ?? 0, provisionales: [] });
  }
}
const receta = (id) => S.recetas.find((r) => r.id === id);
const datosBatido = () => { const r = receta('batido-proteina'); return { kcal: r.kcal, proteina: r.proteina_g, fibra: r.fibra_g }; };

/** Recetas que el planificador puede usar. Con el batido fijo, el snack es siempre el batido. */
function recetasPlan() {
  if (!S.perfil.batidoFijo) return S.recetas;
  return S.recetas.filter((r) => !(r.tipos.includes('snack') && r.id !== 'batido-proteina' && r.tipos.length === 1));
}

/* ------------------------------------------------------------------ registros del día */
function totalesDe(registros) {
  return registros.reduce((t, r) => ({ kcal: t.kcal + r.kcal, proteina: t.proteina + r.proteina, fibra: t.fibra + (r.fibra ?? 0) }), { kcal: 0, proteina: 0, fibra: 0 });
}

async function cargarDia() {
  const dias = await db.todos('dias');
  S.dia = M.asignarDia(Date.now(), dias) ?? null;
  const regs = await db.todos('registros');
  S.registros = S.dia ? regs.filter((r) => r.fecha === S.dia.fecha).sort((a, b) => a.momento - b.momento) : [];
}

function comidaDesdeReceta(slot, recetaId, factor) {
  const r = receta(recetaId);
  return {
    slot: slot.id, tipo: slot.tipo, hora: slot.hora, peso: slot.peso, enClinica: !!slot.enClinica,
    recetaId, nombre: r.nombre, factor, factorPlan: factor,
    kcal: Math.round(r.kcal * factor), proteina: Math.round(r.proteina_g * factor), fibra: Math.round(r.fibra_g * factor),
    fijo: recetaId === 'batido-proteina' && S.perfil.batidoFijo, estado: 'planeada', registroId: null,
  };
}

async function historialReciente(desde) {
  const planes = await db.todos('plan');
  return planes.filter((p) => p.fecha < desde && p.fecha >= sumarDias(desde, -14))
    .flatMap((p) => p.comidas.map((c) => ({ fecha: p.fecha, recetaId: c.recetaId })));
}

async function abrirDiaNuevo(turno) {
  const base = M.abrirDia({ turno, inicio: Date.now() });
  const presupuesto = M.presupuestoDia({ turno, metaKcal: S.perfil.meta.kcal, metaProteina: S.perfil.meta.proteina });
  const plan = await db.leer('plan', base.fecha);
  let comidas;
  if (plan && plan.turno === turno) {
    comidas = plan.comidas.map((c) => comidaDesdeReceta(M.PLANTILLAS[turno].find((s) => s.id === c.slot), c.recetaId, c.factor));
  } else {
    const p = M.planificarSemana({ dias: [{ fecha: base.fecha, turno }], meta: S.perfil.meta, recetas: recetasPlan(), historial: await historialReciente(base.fecha) });
    comidas = p.dias[0].comidas.map((c) => comidaDesdeReceta(M.PLANTILLAS[turno].find((s) => s.id === c.slot), c.recetaId, c.factor));
    await db.guardar('plan', { fecha: base.fecha, turno, comidas: comidas.map(({ slot, recetaId, factor }) => ({ slot, recetaId, factor })) });
  }
  S.dia = { ...base, presupuesto, comidas, hambre: false, esComidaLibre: false };
  delete S.dia.comidas_ts;
  await db.guardar('dias', S.dia);
  S.registros = [];
  toast(`${TURNOS[turno][0]} · día abierto`);
}

/**
 * Recálculo del día. Si lo comido se desvía del plan, reescala las comidas que faltan
 * (sin tocar el batido fijo) para llegar a lo que el motor dice que queda. Proteína primero.
 */
function recalcularDia() {
  const d = S.dia;
  if (!d) return null;
  const consumido = totalesDe(S.registros);
  const pendientes = d.comidas.filter((c) => c.estado === 'planeada');
  const r = M.recalcular({ presupuesto: d.presupuesto, consumido, restantes: pendientes.map((c) => ({ id: c.slot, peso: c.peso })) });
  const ajustables = pendientes.filter((c) => !c.fijo);
  const fijos = pendientes.filter((c) => c.fijo).reduce((s, c) => s + c.kcal, 0);
  const planeado = ajustables.reduce((s, c) => s + receta(c.recetaId).kcal * c.factorPlan, 0);
  const objetivo = Math.max(r.kcal - fijos, 0);
  const desvio = Math.abs(planeado - objetivo) > d.presupuesto.kcal * 0.06;
  for (const c of ajustables) {
    const rec = receta(c.recetaId);
    const factor = desvio && planeado > 0 ? M.ajustarPorcion(c.factorPlan * objetivo / planeado) : c.factorPlan;
    Object.assign(c, { factor, kcal: Math.round(rec.kcal * factor), proteina: Math.round(rec.proteina_g * factor), fibra: Math.round(rec.fibra_g * factor), recalculada: factor !== c.factorPlan });
  }
  return r;
}

async function guardarDia() { recalcularDia(); await db.guardar('dias', S.dia); }

async function registrar({ nombre, kcal, proteina, fibra = 0, origen, comida = 'extra', recetaId = null, factor = null, gramos = null, incertidumbre = 10 }) {
  const fila = { id: db.uuid(), fecha: S.dia.fecha, momento: Date.now(), hora: horaAhora(), comida, nombre, kcal: Math.round(kcal), proteina: Math.round(proteina * 10) / 10, fibra: Math.round((fibra ?? 0) * 10) / 10, origen, recetaId, factor, gramos, incertidumbre_pct: incertidumbre };
  await db.guardar('registros', fila);
  S.registros.push(fila);
  return fila;
}

async function marcarComida(slot, comer = true) {
  const c = S.dia.comidas.find((x) => x.slot === slot);
  if (comer && c.estado !== 'comida') {
    const fila = await registrar({ nombre: c.nombre, kcal: c.kcal, proteina: c.proteina, fibra: c.fibra, origen: 'plan', comida: c.slot, recetaId: c.recetaId, factor: c.factor });
    Object.assign(c, { estado: 'comida', registroId: fila.id });
  } else if (!comer) {
    if (c.registroId) { await db.borrar('registros', c.registroId); S.registros = S.registros.filter((r) => r.id !== c.registroId); }
    Object.assign(c, { estado: 'planeada', registroId: null });
  }
  await guardarDia();
}

async function necesitaDia() {
  if (S.dia) return true;
  await hojaAbrirDia();
  return false;
}

/* ------------------------------------------------------------------ vista: HOY */
function semanaHTML() {
  const hoy = hoyFecha();
  const lunes = lunesDe(hoy);
  const letras = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return letras.map((l, i) => {
    const f = sumarDias(lunes, i);
    const cls = f === hoy ? 'hoy' : f < hoy ? 'pasado' : '';
    return `<div class="dia ${cls}" data-fecha="${f}">${l}<span class="n">${Number(f.slice(8))}</span><span class="t"></span></div>`;
  }).join('');
}

async function marcarSemanaCumplida() {
  const dias = await db.todos('dias');
  const regs = await db.todos('registros');
  for (const d of dias) {
    if (!d.completo || !d.cierre) continue;
    const t = totalesDe(regs.filter((r) => r.fecha === d.fecha));
    if (Math.abs(t.kcal - d.presupuesto.kcal) <= d.presupuesto.kcal * 0.1) document.querySelector(`.dia[data-fecha="${d.fecha}"]`)?.classList.add('cumplido');
  }
}

function rapidosHTML() {
  const regsHoy = S.registros;
  return S.rapidos.items.map((r) => {
    const valores = r.batido ? datosBatido() : r;
    const n = regsHoy.filter((x) => x.rapidoId === r.id || (r.batido && x.recetaId === 'batido-proteina')).length;
    return `<button class="ficha ${n ? 'hecho' : ''}" data-rapido="${r.id}"><span class="ic"><i class="rombos"></i>${ICON[r.ico] ?? ICON.plato}</span>
      <span><b>${esc(r.nombre)}${r.batido && S.perfil.batidoFijo ? '<span class="tag">fijo</span>' : ''}</b><small>${n ? `×${n} hoy` : `${esc(r.det ?? '')} · ${fmt(valores.kcal)} kcal`}</small></span></button>`;
  }).join('') + `<button class="ficha mas-ficha" data-accion="editar-rapidos"><span class="ic">${ICON.plato}</span><span><b>Editar</b><small>agregar o quitar</small></span></button>`;
}

async function vistaHoy() {
  const v = $('#vista');
  if (!S.dia) {
    const plan = await db.leer('plan', hoyFecha());
    v.innerHTML = `
      <div class="semana">${semanaHTML()}</div>
      <section class="card">
        <i class="escalon esquina"></i>
        <div class="etq">Empieza tu día</div>
        <h2 class="titulo-vista" style="margin-top:10px">¿En qué turno estás hoy?</h2>
        <p class="sub">Define los horarios de comida, tus calorías del día y hasta cuándo cuenta el día.${plan ? ` Tu plan dice: <b>${TURNO_CORTO[plan.turno]}</b>.` : ''}</p>
        <div style="display:grid;gap:8px;margin-top:14px">
          ${Object.entries(TURNOS).map(([k, [n, h, ico]]) => `<button class="op ${plan?.turno === k ? 'sel' : ''}" data-abrir="${k}"><span style="display:flex;gap:12px;align-items:center">${ICON[ico]}<span><b>${n}</b><small>${h}</small></span></span></button>`).join('')}
        </div>
      </section>`;
    marcarSemanaCumplida();
    return;
  }

  const d = S.dia;
  const r = recalcularDia();
  const t = totalesDe(S.registros);
  const meta = d.presupuesto;
  const quedan = meta.kcal - t.kcal;
  const s = d.comidas.find((c) => c.estado === 'planeada');
  const [tn, th, ti] = TURNOS[d.turno];
  const comidasHechas = d.comidas.filter((c) => c.estado === 'comida').length;
  const extras = S.registros.filter((x) => x.comida === 'extra');
  const alerta = await alertaPocaComida();
  const fibraMeta = M.metaFibra(meta.kcal);

  v.innerHTML = `
    <div class="semana">${semanaHTML()}</div>
    <button class="turno" data-accion="turno">
      <i class="escalon fondo-pat"></i>
      <span class="izq"><span class="ico">${ICON[ti]}</span><span><b>${tn}</b><small>${th}</small></span></span>
      <svg width="18" height="18" viewBox="0 0 18 18" style="position:relative"><path d="M5 7l4 4 4-4" fill="none" stroke="var(--suave)" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <div class="pila">
      <section class="card resumen">
        <i class="escalon esquina"></i>
        <div class="arriba">
          <div>
            <div class="etq">${quedan >= 0 ? 'Te quedan' : 'Te pasaste'}</div>
            <div class="restan f ${quedan < 0 ? 'pasado' : ''}">${fmt(Math.abs(quedan))}<small>kcal</small></div>
            <div class="de">llevas ${fmt(t.kcal)} de ${fmt(meta.kcal)} kcal${d.turno === 'noche' || d.turno === 'post-noche' ? ` · ${d.turno === 'noche' ? '115' : '85'} % por el turno` : ''}</div>
          </div>
          <span class="pct">${Math.round(t.kcal / meta.kcal * 100)} %</span>
        </div>
        <div class="segmentos">${d.comidas.map((c, i) => `${i ? `<b class="${d.comidas[i - 1].estado === 'comida' ? 'on' : ''}"></b>` : ''}<i class="${c.estado === 'saltada' ? 'saltada' : ''}" style="flex:${Math.max(c.kcal, 60)};--p:${c.estado === 'comida' ? 1 : 0}"></i>`).join('')}</div>
        <div class="macros">
          <div class="macro"><div class="etq">Proteína</div><div class="v">${fmt(t.proteina)}<span> / ${meta.proteina} g</span></div><div class="mbar"><i style="width:${Math.min(100, t.proteina / meta.proteina * 100)}%;background:var(--prot)"></i></div></div>
          <div class="macro"><div class="etq">Fibra</div><div class="v">${fmt(t.fibra)}<span> / ${fibraMeta} g</span></div><div class="mbar"><i style="width:${Math.min(100, t.fibra / fibraMeta * 100)}%;background:var(--fibra)"></i></div></div>
          <div class="macro"><div class="etq">Comidas</div><div class="v">${comidasHechas}<span> / ${d.comidas.length}</span></div><div class="mbar"><i style="width:${comidasHechas / d.comidas.length * 100}%;background:var(--ok)"></i></div></div>
        </div>
        ${r?.aviso === 'proteina_prioritaria' ? `<div class="aviso">Para llegar a la proteína las comidas que faltan se pasan un poco de calorías (${fmt(r.exceso)} kcal). Es a propósito: la proteína va primero.</div>` : ''}
        ${quedan < -50 ? `<div class="aviso">Te pasaste ${fmt(-quedan)} kcal. No pasa nada: se reparte en los próximos días, máximo 200 kcal por día.</div>` : ''}
        ${alerta ? `<div class="aviso">${alerta}</div>` : ''}
      </section>

      <div>
        <div class="etq" style="margin:4px 2px 10px">Registro rápido</div>
        <div class="rapido">${rapidosHTML()}</div>
      </div>

      ${s ? `
      <section class="card sig">
        <div class="tejido"><i class="rombos"></i></div>
        <div class="cuerpo">
          <span class="badge">${s.hora} · ${TIPOS[s.tipo]}</span>${s.fijo ? ' <span class="badge sec">fijo todos los días</span>' : ''}${s.recalculada ? ' <span class="badge sec">porción ajustada</span>' : ''}
          <h2>${esc(s.nombre)}</h2>
          <div class="ing">${s.fijo ? 'Tu proteína en polvo · 2 scoops con agua fría' : receta(s.recetaId).ingredientes.slice(0, 4).map((i) => esc(S.indice.get(i.alimentoId)?.nombre)).join(' · ')}</div>
          <div class="datos">
            <div><b>${fmt(s.kcal)}</b>kcal</div><div><b>${s.proteina} g</b>proteína</div><div><b>${s.fibra} g</b>fibra</div>
            ${s.factor !== 1 ? `<div><b>×${dec(s.factor)}</b>porción</div>` : ''}
            ${receta(s.recetaId).portatil ? '<div><b>✓</b>para llevar</div>' : ''}
          </div>
          <div class="acc">
            <button class="btn pri" data-comer="${s.slot}"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 9.5 7 13.5 15 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>${s.fijo ? 'Me tomé el batido' : 'Comí lo planeado'}</button>
            <button class="btn sec cuad" data-receta="${s.slot}" aria-label="Ver receta"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16M4 12h16M4 19h10"/></svg></button>
            <button class="btn sec cuad" data-cambiar="${s.slot}" aria-label="Cambiar plato"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg></button>
          </div>
          ${s.fijo && !S.perfil.batido ? '<div class="prov">◆ Valores genéricos de USDA. Registra la etiqueta de tu proteína en Ajustes → Mi batido.</div>' : ''}
        </div>
      </section>` : `
      <section class="card sig">
        <div class="tejido"><i class="rombos"></i></div>
        <div class="cuerpo"><span class="badge">Listo</span><h2>Terminaste el plan de hoy</h2>
        <div class="ing">${fmt(t.kcal)} kcal · ${fmt(t.proteina)} g de proteína · ${fmt(t.fibra)} g de fibra. Cuando te vayas a dormir, cierra el día.</div></div>
      </section>`}

      <section class="card">
        <div class="etq">Tu día</div>
        <div class="tl">
          ${d.comidas.map((c) => `
          <button class="paso ${c.estado === 'comida' ? 'hecha' : ''} ${c.estado === 'saltada' ? 'saltada' : ''} ${s && c.slot === s.slot ? 'actual' : ''}" data-paso="${c.slot}">
            <span class="h f">${c.hora}</span><span class="p"></span>
            <span><span class="nm">${esc(c.nombre)}${c.fijo ? '<span class="tag">fijo</span>' : ''}${c.recalculada && c.estado === 'planeada' ? '<span class="tag">ajustada</span>' : ''}</span><span class="mt">${TIPOS[c.tipo]} · ${c.proteina} g proteína${c.factor !== 1 ? ` · ×${dec(c.factor)}` : ''}</span></span>
            <span class="kc">${fmt(c.kcal)}</span>
          </button>`).join('')}
          ${extras.map((x) => `
          <button class="paso hecha" data-extra="${x.id}"><span class="h f">${x.hora}</span><span class="p"></span>
            <span><span class="nm">${esc(x.nombre)}</span><span class="mt">Extra · ${dec(x.proteina)} g proteína</span></span><span class="kc">${fmt(x.kcal)}</span></button>`).join('')}
        </div>
      </section>

      <div class="duo">
        <button class="card mini" data-ir="progreso">${await miniPeso()}</button>
        <section class="card mini">${await miniBanco()}</section>
      </div>

      <div class="duo">
        <button class="card mini hambre" data-accion="hambre"><i class="rombos"></i><div class="etq">¿Hambre?</div><div class="g">Algo que llene sin sumar</div></button>
        <button class="card mini dormir" data-accion="dormir"><i class="escalon"></i><div class="etq">Cerrar el día</div><div class="g">Me voy a dormir</div><div class="pie">guarda el día</div></button>
      </div>
    </div>`;
  marcarSemanaCumplida();
}

async function miniPeso() {
  const pesos = (await db.todos('peso')).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!pesos.length) return `<div class="etq">Peso</div><div class="g">—</div><div class="pie">Toca para registrar tu peso</div>`;
  const ult = pesos[pesos.length - 1];
  const tend = M.tendencia(pesos.slice(-30));
  const semana = pesos.filter((p) => p.fecha >= sumarDias(hoyFecha(), -7));
  const cambio = semana.length >= 2 ? tend[tend.length - 1].tendencia - (M.tendencia(pesos.filter((p) => p.fecha < sumarDias(hoyFecha(), -6)).slice(-30)).pop()?.tendencia ?? tend[0].tendencia) : null;
  const pts = tend.slice(-10);
  const min = Math.min(...pts.map((p) => p.tendencia)) - 0.3; const max = Math.max(...pts.map((p) => p.tendencia)) + 0.3;
  const xy = pts.map((p, i) => `${pts.length > 1 ? (i / (pts.length - 1)) * 120 : 60},${(1 - (p.tendencia - min) / (max - min || 1)) * 32 + 2}`).join(' ');
  return `<div class="etq">Peso</div><div class="g">${dec(ult.kg)}<span> kg</span></div>
    <div class="pie">${cambio !== null ? `${cambio <= 0 ? '−' : '+'}${dec(Math.abs(cambio))} kg en 7 días` : 'registra varios días'}</div>
    <svg width="100%" height="36" viewBox="0 0 120 36" preserveAspectRatio="none" style="margin-top:10px;display:block"><polyline points="${xy}" fill="none" stroke="var(--ok)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

async function miniBanco() {
  const lunes = lunesDe(hoyFecha());
  const dias = (await db.todos('dias')).filter((d) => d.fecha >= lunes && d.fecha < hoyFecha() && d.completo);
  const regs = await db.todos('registros');
  const ahorrados = dias.filter((d) => totalesDe(regs.filter((r) => r.fecha === d.fecha)).kcal <= d.presupuesto.kcal - 50).length;
  const banco = M.bancoComidaLibre(ahorrados);
  return `<div class="etq">Comida libre</div><div class="g">${banco}<span> / 450</span></div>
    <div class="pie">kcal guardadas esta semana</div>
    <div style="display:flex;gap:4px;margin-top:14px">${Array.from({ length: 6 }, (_, i) => `<i style="flex:1;height:8px;border-radius:2px;background:${i < ahorrados ? 'var(--acento2)' : 'var(--linea)'}"></i>`).join('')}</div>`;
}

async function alertaPocaComida() {
  const dias = (await db.todos('dias')).filter((d) => d.cierre && d.fecha < (S.dia?.fecha ?? hoyFecha())).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const regs = await db.todos('registros');
  const conTotales = dias.map((d) => { const t = totalesDe(regs.filter((r) => r.fecha === d.fecha)); return { fecha: d.fecha, kcal: t.kcal, proteina: t.proteina, completo: d.completo }; });
  const a = M.alertaIngestaBaja({ dias: conTotales, metaKcal: S.perfil.meta.kcal, metaProteina: S.perfil.meta.proteina });
  if (!a) return null;
  return `Los últimos 3 días comiste en promedio ${fmt(a.kcalMedia)} kcal y ${fmt(a.proteinaMedia)} g de proteína. Quedarte corto varios días cuesta músculo: hoy intenta cumplir el plan completo.`;
}

/* ------------------------------------------------------------------ vista: PLAN */
async function vistaPlan() {
  const hoy = hoyFecha();
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i));
  const planes = Object.fromEntries((await db.todos('plan')).map((p) => [p.fecha, p]));
  const turnos = fechas.map((f) => planes[f]?.turno ?? (S.dia?.fecha === f ? S.dia.turno : 'libre'));
  S.turnosPlan = turnos;
  $('#vista').innerHTML = `
    <div style="margin-bottom:14px"><div class="etq">Próximos 7 días</div><h2 class="titulo-vista" style="margin-top:6px">Plan de comidas</h2>
    <p class="sub">Elige el turno de cada día y genera el plan. Respeta tu lista de alimentos, no repite un plato principal más de 2 veces y el batido va fijo.</p></div>
    <button class="btn pri ancho" data-accion="generar-plan" style="margin-bottom:12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 0 0 6 5L4 10M4 15a8 8 0 0 0 14 4l2-5"/></svg>Generar plan de la semana</button>
    <div class="pila">
      ${fechas.map((f, i) => {
        const p = planes[f];
        const abierto = S.dia?.fecha === f;
        const tot = p ? p.comidas.reduce((s, c) => { const r = receta(c.recetaId); return { k: s.k + r.kcal * c.factor, p: s.p + r.proteina_g * c.factor }; }, { k: 0, p: 0 }) : null;
        return `<section class="card dia-plan">
          <div class="cab"><span class="fecha">${capital(nombreDia(f))}${f === hoy ? ' · hoy' : ''}</span>${p ? `<button class="badge sec" data-cocina="${f}">Menú para la cocina</button>` : ''}</div>
          ${abierto ? `<div class="sub">Día abierto: ${TURNO_CORTO[S.dia.turno]}. Los cambios del día se hacen en Hoy.</div>` : `
          <div class="turnos-mini">${Object.keys(TURNOS).map((k) => `<button class="tm" data-plan-turno="${i}:${k}" aria-pressed="${turnos[i] === k}">${TURNO_CORTO[k]}</button>`).join('')}</div>`}
          ${p ? p.comidas.map((c) => { const r = receta(c.recetaId); const slot = M.PLANTILLAS[p.turno].find((s) => s.id === c.slot); return `
            <button class="comida-plan" data-plan-comida="${f}:${c.slot}"><span class="h">${slot?.hora ?? ''}</span><span><span class="nm">${esc(r.nombre)}</span>${c.factor !== 1 ? `<span class="tag">×${dec(c.factor)}</span>` : ''}</span><span class="kc">${fmt(r.kcal * c.factor)}</span></button>`; }).join('')
            + `<div class="totales"><span>${fmt(tot.k)} kcal</span><span>${fmt(tot.p)} g proteína</span></div>`
            : '<div class="vacio">Sin plan todavía</div>'}
        </section>`;
      }).join('')}
    </div>`;
}

async function generarPlan() {
  const hoy = hoyFecha();
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i)).filter((f) => S.dia?.fecha !== f);
  const dias = fechas.map((f) => ({ fecha: f, turno: S.turnosPlan[Math.round((Date.parse(f) - Date.parse(hoy)) / 86_400_000)] }));
  const historial = await historialReciente(fechas[0]);
  if (S.dia) historial.push(...S.dia.comidas.map((c) => ({ fecha: S.dia.fecha, recetaId: c.recetaId })));
  const plan = M.planificarSemana({ dias, meta: S.perfil.meta, recetas: recetasPlan(), historial });
  for (const d of plan.dias) {
    await db.guardar('plan', { fecha: d.fecha, turno: d.turno, comidas: d.comidas.map((c) => ({ slot: c.slot, recetaId: c.recetaId, factor: c.factor })) });
  }
  toast(plan.avisos.length ? 'Plan listo, con algunos avisos' : 'Plan de la semana listo');
  await vistaPlan();
}

/* ------------------------------------------------------------------ vista: COMPRAS */
async function planesDesdeHoy() {
  const hoy = hoyFecha();
  const planes = (await db.todos('plan')).filter((p) => p.fecha >= hoy && p.fecha <= sumarDias(hoy, 6)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return planes;
}

async function vistaCompras() {
  const planes = await planesDesdeHoy();
  const v = $('#vista');
  if (!planes.length) {
    v.innerHTML = `<div class="etq">Lista de compras</div><h2 class="titulo-vista" style="margin-top:6px">Compras</h2>
      <section class="card" style="margin-top:14px"><div class="vacio">Primero genera el plan de la semana. La lista sale de ahí.</div>
      <button class="btn pri ancho" data-ir="plan">Ir al plan</button></section>`;
    return;
  }
  const lista = M.listaCompras({ dias: planes }, S.recetas, {}, S.indice);
  const marcados = new Set((await db.todos('compras')).filter((c) => c.semana === planes[0].fecha && c.comprado).map((c) => c.alimentoId));
  const grupos = {};
  for (const it of lista) (grupos[it.tienda ?? 'Otros'] ??= []).push(it);
  const pendientes = lista.filter((x) => !marcados.has(x.alimentoId)).length;
  S.compras = { lista, semana: planes[0].fecha, dias: planes.length };
  v.innerHTML = `
    <div style="margin-bottom:14px"><div class="etq">${planes.length} días de plan</div><h2 class="titulo-vista" style="margin-top:6px">Compras</h2>
    <p class="sub">${pendientes} de ${lista.length} por comprar. Las cantidades ya incluyen cáscara y hueso. La libra es de 500 g.</p></div>
    <div class="duo" style="margin-bottom:12px">
      <a class="btn pri" id="wa-compras" href="#" target="_blank" rel="noopener">WhatsApp</a>
      <button class="btn sec" data-accion="copiar-compras">Copiar lista</button>
    </div>
    <div class="pila">
      ${Object.entries(grupos).map(([tienda, items]) => `
        <section class="card tienda"><div class="etq">${esc(tienda)}</div>
          ${items.map((it) => `<button class="item ${marcados.has(it.alimentoId) ? 'ok' : ''}" data-compra="${it.alimentoId}"><span class="caja"></span><span class="nm">${esc(it.nombre)}</span><span class="cant">${cantidad(it)}</span></button>`).join('')}
        </section>`).join('')}
    </div>`;
  $('#wa-compras').href = `https://wa.me/?text=${encodeURIComponent(textoCompras(lista, marcados))}`;
}

function cantidad(it) {
  const a = S.indice.get(it.alimentoId);
  const g = it.gramos;
  if (['Carnicería', 'Carnicería / Cadena', 'Plaza', 'Plaza / Cadena'].some((t) => a?.tienda?.startsWith(t.split(' ')[0])) && g >= 250) return `${dec(M.aLibras(g))} lb`;
  return g >= 1000 ? `${dec(g / 1000)} kg` : `${fmt(g)} g`;
}

function textoCompras(lista, marcados = new Set()) {
  const grupos = {};
  for (const it of lista) if (!marcados.has(it.alimentoId)) (grupos[it.tienda ?? 'Otros'] ??= []).push(it);
  return `🛒 Mercado (${S.compras?.dias ?? 7} días)\n` + Object.entries(grupos).map(([t, items]) => `\n*${t}*\n` + items.map((it) => `- ${it.nombre}: ${cantidad(it)}`).join('\n')).join('\n');
}

/* ------------------------------------------------------------------ vista: PROGRESO */
async function datosGasto() {
  const dias = (await db.todos('dias')).filter((d) => d.cierre);
  const regs = await db.todos('registros');
  const diasT = dias.map((d) => {
    const rs = regs.filter((r) => r.fecha === d.fecha);
    const t = totalesDe(rs);
    const foto = rs.filter((r) => r.origen === 'foto' || r.origen === 'texto').reduce((s, r) => s + r.kcal, 0);
    return { fecha: d.fecha, kcal: t.kcal, proteina: t.proteina, completo: d.completo, peso: t.kcal && foto / t.kcal > 0.5 ? 0.5 : 1 };
  });
  const pesajes = (await db.todos('peso')).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { diasT, pesajes };
}

async function vistaProgreso() {
  const { diasT, pesajes } = await datosGasto();
  const kg = pesajes.at(-1)?.kg ?? S.perfil.kgInicial;
  const perfil = { sexo: S.perfil.sexo, kg, cm: S.perfil.cm, edad: M.edadEn(S.perfil.fechaNac, hoyFecha()) };
  const prior = M.gastoInicial(perfil);
  const e = M.estimarGasto({ dias: diasT, pesajes, prior, hoy: hoyFecha() });
  const ritmos = [];
  const sug = M.metaSemanal({ gasto: e.gasto, kg, metaAnterior: S.perfil.meta.kcal, ritmosRecientes: ritmos });
  const protSug = M.metaProteina(kg, S.perfil.etapa);
  S.sugerencia = { kcal: sug.kcal, proteina: protSug };
  const motivo = { pocos_datos: 'todavía hay pocos datos: manda la fórmula', pocos_dias: 'todavía hay pocos días: manda la fórmula', ok: `con ${e.diasUsados} días y ${e.pesajesUsados} pesajes (confianza ${Math.round(e.confianza * 100)} %)` }[e.motivo];
  const cambio = sug.kcal !== S.perfil.meta.kcal || protSug !== S.perfil.meta.proteina;
  const ultimo = pesajes.at(-1);
  const hoyPeso = pesajes.find((p) => p.fecha === hoyFecha());
  const ruidoso = S.dia?.turno === 'post-noche';

  $('#vista').innerHTML = `
    <div style="margin-bottom:14px"><div class="etq">Tu progreso</div><h2 class="titulo-vista" style="margin-top:6px">Peso y meta</h2></div>
    <div class="pila">
      <section class="card">
        <i class="escalon esquina"></i>
        <div class="etq">Registrar peso de hoy</div>
        <p class="sub">Al levantarte, después de orinar y antes de comer.</p>
        <div class="par" style="margin-top:12px;align-items:end">
          <div class="campo" style="margin:0"><label for="kg">Kilos</label><input class="entrada f" id="kg" type="number" inputmode="decimal" step="0.1" min="30" max="250" value="${hoyPeso?.kg ?? ultimo?.kg ?? ''}" placeholder="85,6"></div>
          <button class="btn pri" data-accion="guardar-peso">${hoyPeso ? 'Actualizar' : 'Guardar'}</button>
        </div>
        <button class="interruptor" id="ruidoso" aria-pressed="${hoyPeso ? !hoyPeso.valido : ruidoso}"><span><b style="font-weight:500;font-size:14px">Pesaje ruidoso</b><br><small style="color:var(--suave);font-size:12px">Post-noche o el día después de la comida libre: se guarda pero no cuenta para la meta</small></span><span class="sw"></span></button>
      </section>

      <section class="card">
        <div class="etq">Tendencia</div>
        ${pesajes.length ? graficaPeso(pesajes) : '<div class="vacio">Registra tu peso unos días para ver la tendencia.</div>'}
      </section>

      <section class="card">
        <div class="etq">Meta de la semana</div>
        <div class="fila-meta"><span class="sub" style="margin:0">Gasto estimado</span><b class="f" style="font-size:20px">${fmt(e.gasto)} kcal</b></div>
        <p class="sub">${motivo}.${e.kgPorSemana !== undefined ? ` Vas a ${dec(Math.abs(e.kgPorSemana))} kg por semana.` : ''}</p>
        <div class="duo" style="margin-top:12px">
          <div class="macro"><div class="etq">Meta actual</div><div class="v">${fmt(S.perfil.meta.kcal)}<span> kcal · ${S.perfil.meta.proteina} g</span></div></div>
          <div class="macro"><div class="etq">Sugerida</div><div class="v">${fmt(sug.kcal)}<span> kcal · ${protSug} g</span></div></div>
        </div>
        ${cambio ? `<button class="btn pri ancho" style="margin-top:12px" data-accion="aplicar-meta">Usar la meta sugerida</button>` : '<p class="sub" style="margin-top:10px">Tu meta ya está al día.</p>'}
      </section>

      <section class="card">
        <div class="etq">Últimos pesajes</div>
        ${pesajes.slice(-8).reverse().map((p) => `<div class="fila"><span><span class="nm">${capital(nombreDia(p.fecha))}</span>${p.valido === false ? '<span class="tag">ruidoso</span>' : ''}</span><span class="der">${dec(p.kg)} kg</span></div>`).join('') || '<div class="vacio">Sin pesajes todavía</div>'}
      </section>
    </div>`;
}

function graficaPeso(pesajes) {
  const pts = pesajes.slice(-45);
  const tend = M.tendencia(pts);
  const ys = pts.map((p) => p.kg).concat(tend.map((t) => t.tendencia));
  const min = Math.min(...ys) - 0.4; const max = Math.max(...ys) + 0.4;
  const W = 320; const H = 160;
  const x = (i) => (pts.length > 1 ? 10 + (i / (pts.length - 1)) * (W - 20) : W / 2);
  const y = (v) => 10 + (1 - (v - min) / (max - min || 1)) * (H - 30);
  const linea = tend.map((t, i) => `${x(i)},${y(t.tendencia)}`).join(' ');
  return `<svg class="grafica" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <text x="10" y="${H - 4}" fill="var(--tenue)" font-size="10">${esc(capital(nombreDia(pts[0].fecha)))}</text>
    <text x="${W - 10}" y="${H - 4}" fill="var(--tenue)" font-size="10" text-anchor="end">${esc(capital(nombreDia(pts.at(-1).fecha)))}</text>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.kg)}" r="3" fill="${p.valido === false ? 'var(--tenue)' : 'var(--suave)'}" opacity=".7"/>`).join('')}
    <polyline points="${linea}" fill="none" stroke="var(--ok)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg><div class="totales"><span>● pesaje</span><span style="color:var(--ok)">— tendencia</span><span>${dec(min + 0.4)}–${dec(max - 0.4)} kg</span></div>`;
}

/* ------------------------------------------------------------------ hojas */
function hoja(html) {
  $('#hoja').innerHTML = '<div class="greca"></div><div class="asa"></div><button class="cerrar-hoja" data-accion="cerrar-hoja" aria-label="Cerrar">×</button>' + html;
  $('#hoja').classList.add('on'); $('#velo').classList.add('on');
  $('#hoja').scrollTop = 0;
}
function cerrarHoja() { $('#hoja').classList.remove('on'); $('#velo').classList.remove('on'); }

async function hojaAbrirDia() {
  const plan = await db.leer('plan', hoyFecha());
  hoja(`<h3>Hoy estoy en…</h3><p class="t">Define los horarios de comida y hasta cuándo cuenta el día.</p>
    ${Object.entries(TURNOS).map(([k, [n, h, ico]]) => `<button class="op ${plan?.turno === k ? 'sel' : ''}" data-abrir="${k}"><span style="display:flex;gap:12px;align-items:center">${ICON[ico]}<span><b>${n}</b><small>${h}</small></span></span></button>`).join('')}`);
}

function hojaTurno() {
  hoja(`<h3>Cambiar el turno de hoy</h3><p class="t">Se rehacen los horarios y las comidas que faltan. Lo que ya registraste se queda.</p>
    ${Object.entries(TURNOS).map(([k, [n, h, ico]]) => `<button class="op ${S.dia.turno === k ? 'sel' : ''}" data-cambiar-turno="${k}"><span style="display:flex;gap:12px;align-items:center">${ICON[ico]}<span><b>${n}</b><small>${h}</small></span></span></button>`).join('')}`);
}

async function cambiarTurno(turno) {
  if (turno === S.dia.turno) return cerrarHoja();
  const hechas = S.dia.comidas.filter((c) => c.estado !== 'planeada');
  const p = M.planificarSemana({ dias: [{ fecha: S.dia.fecha, turno }], meta: S.perfil.meta, recetas: recetasPlan(), historial: await historialReciente(S.dia.fecha) });
  const nuevas = p.dias[0].comidas.map((c) => comidaDesdeReceta(M.PLANTILLAS[turno].find((s) => s.id === c.slot), c.recetaId, c.factor));
  const base = M.abrirDia({ turno, inicio: S.dia.inicio });
  S.dia.turno = turno;
  S.dia.cierreAuto = base.cierreAuto;
  S.dia.presupuesto = M.presupuestoDia({ turno, metaKcal: S.perfil.meta.kcal, metaProteina: S.perfil.meta.proteina });
  S.dia.comidas = nuevas.map((n) => hechas.find((h) => h.slot === n.slot && h.tipo === n.tipo) ?? n);
  await guardarDia();
  await db.guardar('plan', { fecha: S.dia.fecha, turno, comidas: S.dia.comidas.map(({ slot, recetaId, factorPlan }) => ({ slot, recetaId, factor: factorPlan })) });
  cerrarHoja(); toast(TURNOS[turno][0]); render();
}

function hojaCambiar(slot) {
  const c = S.dia.comidas.find((x) => x.slot === slot);
  if (c.fijo) {
    hoja(`<h3>El batido es fijo</h3><p class="t">Está en tu plan todos los días por la proteína. Si hoy no lo tomas, sáltalo y las comidas que faltan se ajustan para buscar esos gramos.</p>
      <button class="op" data-saltar="${slot}"><span><b>Hoy no me lo tomo</b><small>Recalcular el resto del día</small></span></button>`);
    return;
  }
  const ops = M.elegirOpciones({ objetivo: { kcal: c.kcal, proteina: c.proteina }, recetas: recetasPlan().filter((r) => r.tipos.includes(c.tipo) && r.id !== c.recetaId && r.id !== 'batido-proteina'), n: 4 });
  hoja(`<h3>Cambiar ${TIPOS[c.tipo].toLowerCase()}</h3><p class="t">Mismas calorías y proteína, otro plato.</p>
    ${ops.map((o) => `<button class="op" data-elegir="${slot}:${o.recetaId}:${o.factor}"><span><b>${esc(o.nombre)}</b><small>${o.factor !== 1 ? `porción ×${dec(o.factor)} · ` : ''}${o.kcal} kcal · ${o.proteina} g proteína</small></span><svg width="18" height="18" viewBox="0 0 18 18"><path d="M7 4l5 5-5 5" fill="none" stroke="var(--suave)" stroke-width="2" stroke-linecap="round"/></svg></button>`).join('')}
    <button class="op" data-saltar="${slot}"><span><b>Saltar esta comida</b><small>Las que faltan se ajustan</small></span></button>`);
}

function hojaPaso(slot) {
  const c = S.dia.comidas.find((x) => x.slot === slot);
  hoja(`<h3>${esc(c.nombre)}</h3><p class="t">${c.hora} · ${TIPOS[c.tipo]} · ${fmt(c.kcal)} kcal · ${c.proteina} g proteína</p>
    ${c.estado === 'planeada' ? `<button class="op" data-comer="${slot}"><span><b>${c.fijo ? 'Me tomé el batido' : 'Comí lo planeado'}</b><small>Se registra tal cual</small></span></button>
      <button class="op" data-receta="${slot}"><span><b>Ver la receta</b><small>Ingredientes y pasos</small></span></button>
      <button class="op" data-cambiar="${slot}"><span><b>Cambiar o saltar</b><small>Otro plato con calorías parecidas</small></span></button>`
    : `<button class="op" data-descomer="${slot}"><span><b>${c.estado === 'saltada' ? 'Volver a planear esta comida' : 'No me la comí'}</b><small>Deshacer</small></span></button>`}`);
}

function hojaReceta(recetaId, factor = 1) {
  const r = receta(recetaId);
  const texto = M.fichaCocina(r, S.indice, factor);
  hoja(`<h3>${esc(r.nombre)}</h3><p class="t">${fmt(r.kcal * factor)} kcal · ${Math.round(r.proteina_g * factor)} g proteína · dificultad ${r.dificultad}/3${r.lote ? ' · se puede hacer en lote' : ''}</p>
    <div class="ficha-cocina">${esc(texto.split('\n').slice(2).join('\n'))}</div>
    ${r.tip ? `<div class="aviso" style="margin-bottom:12px">${esc(r.tip)}</div>` : ''}
    <div class="duo"><a class="btn pri" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">WhatsApp</a><button class="btn sec" data-copiar="${encodeURIComponent(texto)}">Copiar</button></div>`);
}

async function hojaCocina(fecha) {
  const p = await db.leer('plan', fecha);
  const texto = `Menú del ${nombreDia(fecha, true)}\n(porciones de Michael)\n\n` + p.comidas.map((c) => {
    const slot = M.PLANTILLAS[p.turno].find((s) => s.id === c.slot);
    return `— ${slot?.hora ?? ''} ${TIPOS[slot?.tipo ?? 'snack']} —\n` + M.fichaCocina(receta(c.recetaId), S.indice, c.factor);
  }).join('\n\n');
  hoja(`<h3>Menú para la cocina</h3><p class="t">Para mandarle a quien cocina. Las cantidades son para tu porción; para tu papá, igual.</p>
    <div class="ficha-cocina">${esc(texto)}</div>
    <div class="duo"><a class="btn pri" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">WhatsApp</a><button class="btn sec" data-copiar="${encodeURIComponent(texto)}">Copiar</button></div>`);
}

async function hojaPlanComida(fecha, slot) {
  const p = await db.leer('plan', fecha);
  const c = p.comidas.find((x) => x.slot === slot);
  const r = receta(c.recetaId);
  const ops = M.elegirOpciones({ objetivo: { kcal: r.kcal * c.factor, proteina: r.proteina_g * c.factor }, recetas: recetasPlan().filter((x) => x.tipos.some((t) => r.tipos.includes(t)) && x.id !== r.id && x.id !== 'batido-proteina'), n: 3 });
  hoja(`<h3>${esc(r.nombre)}</h3><p class="t">${capital(nombreDia(fecha))} · ${fmt(r.kcal * c.factor)} kcal · ${Math.round(r.proteina_g * c.factor)} g proteína</p>
    <button class="op" data-ver-receta="${r.id}:${c.factor}"><span><b>Ver la receta</b><small>Ingredientes y pasos</small></span></button>
    ${r.id === 'batido-proteina' ? '' : ops.map((o) => `<button class="op" data-plan-elegir="${fecha}:${slot}:${o.recetaId}:${o.factor}"><span><b>Cambiar por ${esc(o.nombre)}</b><small>${o.factor !== 1 ? `×${dec(o.factor)} · ` : ''}${o.kcal} kcal · ${o.proteina} g</small></span></button>`).join('')}`);
}

/* registrar (+) */
let pestanaReg = 'rapido';
function hojaRegistrar(pestana = pestanaReg) {
  pestanaReg = pestana;
  const tabs = `<div class="segmentado" style="margin:4px 0 12px">${[['rapido', 'Rápido'], ['buscar', 'Buscar'], ['gemini', 'Gemini']].map(([k, n]) => `<button aria-pressed="${k === pestana}" data-reg-tab="${k}">${n}</button>`).join('')}</div>`;
  let cuerpo = '';
  if (pestana === 'rapido') {
    cuerpo = `<p class="t">Un toque y queda registrado. Puedes repetir: dos batidos son dos toques.</p>
      ${S.rapidos.items.map((r) => { const v = r.batido ? datosBatido() : r; return `<button class="op" data-rapido="${r.id}"><span style="display:flex;gap:12px;align-items:center"><span class="ico">${ICON[r.ico] ?? ICON.plato}</span><span><b>${esc(r.nombre)}</b><small>${esc(r.det ?? '')} · ${fmt(v.kcal)} kcal · ${dec(v.proteina)} g proteína</small></span></span></button>`; }).join('')}
      <button class="btn sec ancho" style="margin-top:12px" data-accion="editar-rapidos">Editar registro rápido</button>`;
  } else if (pestana === 'buscar') {
    cuerpo = `<p class="t">Busca un alimento o una receta y escribe cuánto comiste.</p>
      <input class="entrada" id="buscar" placeholder="pollo, arepa, lentejas…" autocomplete="off">
      <div class="resultados" id="resultados"></div><div id="detalle"></div>`;
  } else {
    cuerpo = `<p class="t">1. Copia este prompt y pégalo en Gemini con la foto o la descripción de lo que comiste. 2. Pega aquí lo que responde.</p>
      <div class="ficha-cocina" style="font-size:12px">${esc(PROMPT_GEMINI)}</div>
      <button class="btn sec ancho chico" data-copiar="${encodeURIComponent(PROMPT_GEMINI)}">Copiar prompt</button>
      <div class="campo"><label for="json">Respuesta de Gemini</label><textarea class="entrada" id="json" placeholder='{"items":[…]}'></textarea></div>
      <div id="previa"></div>
      <button class="btn pri ancho" style="margin-top:12px" data-accion="registrar-json">Registrar</button>`;
  }
  hoja(`<h3>Registrar</h3>${tabs}${cuerpo}`);
  if (pestana === 'buscar') { $('#buscar').addEventListener('input', buscar); setTimeout(() => $('#buscar')?.focus(), 350); }
  if (pestana === 'gemini') $('#json').addEventListener('input', previaJSON);
}

function buscar() {
  const q = sinTildes($('#buscar').value.trim());
  if (q.length < 2) { $('#resultados').innerHTML = ''; return; }
  const al = S.alimentos.filter((a) => sinTildes(a.nombre).includes(q)).slice(0, 8).map((a) => ({ tipo: 'a', id: a.id, nombre: a.nombre, det: `${fmt(a.kcal)} kcal · ${dec(a.proteina_g)} g proteína por 100 g` }));
  const re = S.recetas.filter((r) => sinTildes(r.nombre).includes(q)).slice(0, 5).map((r) => ({ tipo: 'r', id: r.id, nombre: r.nombre, det: `receta · ${fmt(r.kcal)} kcal · ${dec(r.proteina_g)} g por porción` }));
  $('#resultados').innerHTML = [...re, ...al].map((x) => `<button class="op" data-elegir-buscado="${x.tipo}:${x.id}"><span><b>${esc(x.nombre)}</b><small>${x.det}</small></span></button>`).join('') || '<div class="vacio">Nada con ese nombre. Prueba en la pestaña Gemini.</div>';
}

function detalleBuscado(tipo, id) {
  $('#resultados').innerHTML = '';
  if (tipo === 'r') {
    const r = receta(id);
    $('#detalle').innerHTML = `<div class="op sel" style="display:block"><b>${esc(r.nombre)}</b><small>${fmt(r.kcal)} kcal · ${dec(r.proteina_g)} g por porción</small>
      <div class="campo"><label>Porción</label><div class="segmentado">${[0.5, 0.75, 1, 1.25, 1.5].map((f) => `<button aria-pressed="${f === 1}" data-porcion="${f}">×${dec(f)}</button>`).join('')}</div></div>
      <button class="btn pri ancho" style="margin-top:12px" data-registrar-receta="${id}">Registrar</button></div>`;
  } else {
    const a = S.indice.get(id);
    const medidas = (a.medidas_usda ?? []).slice(0, 2);
    $('#detalle').innerHTML = `<div class="op sel" style="display:block"><b>${esc(a.nombre)}</b><small>${a.estado === 'crudo' ? 'Gramos en crudo' : 'Gramos tal como se come'}${medidas.length ? ` · ${medidas.map((m) => `${esc(m.medida)} = ${fmt(m.gramos)} g`).join(' · ')}` : ''}</small>
      <div class="campo"><label for="gramos">Gramos</label><input class="entrada f" id="gramos" type="number" inputmode="decimal" value="100" min="1"></div>
      <div class="sub" id="calc"></div>
      <button class="btn pri ancho" style="margin-top:12px" data-registrar-alimento="${id}">Registrar</button></div>`;
    const calc = () => { const g = +$('#gramos').value || 0; $('#calc').textContent = `${fmt(a.kcal * g / 100)} kcal · ${dec(a.proteina_g * g / 100)} g proteína · ${dec((a.fibra_g ?? 0) * g / 100)} g fibra`; };
    $('#gramos').addEventListener('input', calc); calc();
  }
}

function leerJSON(texto) {
  const limpio = texto.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const j = JSON.parse(limpio);
  if (j.por_porcion) return { etiqueta: j };
  const items = Array.isArray(j) ? j : j.items ?? [];
  return {
    items: items.map((x) => ({
      nombre: String(x.nombre ?? x.alimento ?? 'Comida'), gramos: Number(x.gramos) || null,
      kcal: Number(x.kcal ?? x.calorias) || 0, proteina: Number(x.proteina_g ?? x.proteina) || 0, fibra: Number(x.fibra_g ?? x.fibra) || 0,
    })),
  };
}

function previaJSON() {
  const el = $('#previa');
  try {
    const r = leerJSON($('#json').value);
    if (r.etiqueta) {
      const p = r.etiqueta.por_porcion;
      el.innerHTML = `<div class="aviso">Es una etiqueta: ${esc(r.etiqueta.producto)} · ${fmt(p.kcal)} kcal · ${dec(p.proteina_g)} g proteína por porción. Al registrar se guarda como botón de registro rápido.</div>`;
    } else {
      const t = r.items.reduce((s, x) => ({ k: s.k + x.kcal, p: s.p + x.proteina }), { k: 0, p: 0 });
      el.innerHTML = r.items.map((x) => `<div class="fila"><span class="nm">${esc(x.nombre)}${x.gramos ? ` · ${fmt(x.gramos)} g` : ''}</span><span class="der">${fmt(x.kcal)} kcal · ${dec(x.proteina)} g</span></div>`).join('') + `<div class="totales"><span>Total ${fmt(t.k)} kcal</span><span>${dec(t.p)} g proteína</span></div>`;
    }
  } catch { el.innerHTML = $('#json').value.trim() ? '<div class="aviso">Todavía no es un JSON válido.</div>' : ''; }
}

function hojaRapidos() {
  hoja(`<h3>Registro rápido</h3><p class="t">Tus botones de un toque. Para bebidas y cosas de paquete, usa la etiqueta.</p>
    ${S.rapidos.items.map((r, i) => `<div class="fila"><span><span class="nm">${esc(r.nombre)}</span><div class="mt">${r.batido ? 'tu batido · se edita en Ajustes' : `${fmt(r.kcal)} kcal · ${dec(r.proteina)} g proteína`}</div></span>
      ${r.batido ? '' : `<button class="btn sec chico" data-quitar-rapido="${i}">Quitar</button>`}</div>`).join('')}
    <div class="etq" style="margin-top:18px">Agregar</div>
    <div class="campo"><label for="rn">Nombre</label><input class="entrada" id="rn" placeholder="Coca-Cola Zero"></div>
    <div class="campo"><label for="rd">Porción</label><input class="entrada" id="rd" placeholder="1 lata"></div>
    <div class="trio"><div class="campo"><label for="rk">kcal</label><input class="entrada f" id="rk" type="number" inputmode="decimal" value="0"></div>
      <div class="campo"><label for="rp">Proteína g</label><input class="entrada f" id="rp" type="number" inputmode="decimal" value="0"></div>
      <div class="campo"><label for="rf">Fibra g</label><input class="entrada f" id="rf" type="number" inputmode="decimal" value="0"></div></div>
    <div class="campo"><label>Ícono</label><div class="segmentado">${['lata', 'vaso', 'cafe', 'yogur', 'huevo', 'fruta', 'plato'].map((k, i) => `<button aria-pressed="${i === 0}" data-icono="${k}">${ICON[k]}</button>`).join('')}</div></div>
    <button class="btn pri ancho" style="margin-top:14px" data-accion="agregar-rapido">Agregar botón</button>`);
}

function hojaHambre() {
  hoja(`<h3>Algo que llene sin sumar</h3><p class="t">Mucho volumen, pocas calorías. Tócalo y queda registrado.</p>
    ${HAMBRE.map((h, i) => `<button class="op" data-hambre="${i}"><span><b>${esc(h.nombre)}</b><small>${h.det} · ~${h.kcal} kcal${h.proteina >= 10 ? `, ${h.proteina} g proteína` : ''}</small></span></button>`).join('')}
    <div class="aviso" style="margin-top:12px">Si tienes hambre casi todos los días de una semana, no es falta de voluntad: el déficit puede estar muy agresivo. En Progreso la meta se puede subir.</div>`);
}

function hojaDormir() {
  const t = totalesDe(S.registros);
  hoja(`<h3>Cerrar el día</h3><p class="t">Comiste ${fmt(t.kcal)} kcal y ${fmt(t.proteina)} g de proteína. ¿Registraste todo lo que comiste hoy?</p>
    <button class="op" data-cerrar="1"><span><b>Sí, está completo</b><small>Cuenta para ajustar tu meta</small></span></button>
    <button class="op" data-cerrar="0"><span><b>Me faltó registrar algo</b><small>Se guarda, pero no cuenta para el cálculo del gasto</small></span></button>`);
}

function hojaAjustes() {
  const p = S.perfil; const b = datosBatido();
  hoja(`<h3>Ajustes</h3>
    <div class="etq" style="margin-top:12px">Apariencia</div>
    <div class="campo"><label>Paleta</label><div class="segmentado">${[['menta', 'Menta'], ['cacao', 'Cacao']].map(([k, n]) => `<button aria-pressed="${S.tema.paleta === k}" data-paleta="${k}">${n}</button>`).join('')}</div></div>
    <div class="campo"><label>Modo</label><div class="segmentado">${[['oscuro', 'Noche'], ['claro', 'Día'], ['auto', 'Automático']].map(([k, n]) => `<button aria-pressed="${S.tema.modo === k}" data-modo="${k}">${n}</button>`).join('')}</div></div>

    <div class="etq" style="margin-top:20px">Metas</div>
    <div class="par"><div class="campo"><label for="mk">Calorías al día</label><input class="entrada f" id="mk" type="number" inputmode="numeric" value="${p.meta.kcal}" min="1400"></div>
      <div class="campo"><label for="mp">Proteína g</label><input class="entrada f" id="mp" type="number" inputmode="numeric" value="${p.meta.proteina}"></div></div>
    <div class="campo"><label>Etapa de actividad</label><div class="segmentado">${[0, 1, 2, 3, 4].map((e) => `<button aria-pressed="${p.etapa === e}" data-etapa="${e}">${e}</button>`).join('')}</div>
      <small style="color:var(--suave);font-size:12px">0 sedentario · 1 caminar · 2 fuerza asistida · 3 peso corporal · 4 gimnasio</small></div>

    <div class="etq" style="margin-top:20px">Mi batido</div>
    <button class="interruptor" id="batidoFijo" aria-pressed="${p.batidoFijo}"><span><b style="font-weight:500;font-size:14px">Batido fijo en el snack</b><br><small style="color:var(--suave);font-size:12px">El plan lo pone todos los días</small></span><span class="sw"></span></button>
    <div class="trio"><div class="campo"><label for="bk">kcal</label><input class="entrada f" id="bk" type="number" inputmode="decimal" value="${b.kcal}"></div>
      <div class="campo"><label for="bp">Proteína g</label><input class="entrada f" id="bp" type="number" inputmode="decimal" value="${dec(b.proteina).replace(',', '.')}"></div>
      <div class="campo"><label for="bf">Fibra g</label><input class="entrada f" id="bf" type="number" inputmode="decimal" value="${b.fibra}"></div></div>
    <small style="color:var(--suave);font-size:12px;display:block;margin-top:6px">${p.batido ? 'Valores de tu etiqueta.' : 'Ahora son genéricos. Pon los de tu etiqueta (2 scoops) o pégala en Registrar → Gemini.'}</small>
    <button class="btn sec ancho chico" style="margin-top:10px" data-copiar="${encodeURIComponent(PROMPT_ETIQUETA)}">Copiar prompt para leer la etiqueta</button>
    <button class="btn pri ancho" style="margin-top:14px" data-accion="guardar-ajustes">Guardar</button>

    <div class="etq" style="margin-top:22px">Tus datos</div>
    <p class="t" style="margin-top:6px">${db.persistente ? 'Todo se guarda en este teléfono.' : 'Este navegador no deja guardar: los datos se pierden al cerrar.'} La cuenta para sincronizar con tus otras apps viene después.</p>
    <div class="duo"><button class="btn sec chico" data-accion="exportar">Copiar respaldo</button><button class="btn sec chico" data-accion="importar">Restaurar</button></div>`);
}

/* ------------------------------------------------------------------ eventos */
async function onClick(e) {
  const b = e.target.closest('button, a[data-ir]');
  if (!b) return;
  const d = b.dataset;
  if (b.tagName === 'A' && !d.ir) return;

  if (d.accion === 'cerrar-hoja') return cerrarHoja();
  if (d.ir) { e.preventDefault(); return ir(d.ir); }
  if (d.tab) return ir(d.tab);
  if (d.abrir) { await abrirDiaNuevo(d.abrir); cerrarHoja(); return render(); }
  if (d.accion === 'turno') return hojaTurno();
  if (d.cambiarTurno) return cambiarTurno(d.cambiarTurno);

  if (d.comer) { await marcarComida(d.comer, true); cerrarHoja(); toast('Registrado'); return render(); }
  if (d.descomer) {
    const c = S.dia.comidas.find((x) => x.slot === d.descomer);
    if (c.estado === 'saltada') c.estado = 'planeada'; else await marcarComida(d.descomer, false);
    await guardarDia(); cerrarHoja(); return render();
  }
  if (d.paso) { const c = S.dia.comidas.find((x) => x.slot === d.paso); if (c.estado === 'planeada') { await marcarComida(d.paso, true); toast('Registrado'); return render(); } return hojaPaso(d.paso); }
  if (d.extra) {
    const x = S.registros.find((r) => r.id === d.extra);
    hoja(`<h3>${esc(x.nombre)}</h3><p class="t">${x.hora} · ${fmt(x.kcal)} kcal · ${dec(x.proteina)} g proteína</p><button class="op" data-borrar-registro="${x.id}"><span><b>Borrar este registro</b><small>Las comidas que faltan se reajustan</small></span></button>`);
    return;
  }
  if (d.borrarRegistro) { await db.borrar('registros', d.borrarRegistro); S.registros = S.registros.filter((r) => r.id !== d.borrarRegistro); await guardarDia(); cerrarHoja(); return render(); }
  if (d.cambiar) return hojaCambiar(d.cambiar);
  if (d.receta) { const c = S.dia.comidas.find((x) => x.slot === d.receta); return hojaReceta(c.recetaId, c.factor); }
  if (d.verReceta) { const [id, f] = d.verReceta.split(':'); return hojaReceta(id, +f); }
  if (d.elegir) {
    const [slot, recetaId, factor] = d.elegir.split(':');
    const i = S.dia.comidas.findIndex((x) => x.slot === slot);
    const slotP = M.PLANTILLAS[S.dia.turno].find((s) => s.id === slot);
    S.dia.comidas[i] = comidaDesdeReceta(slotP, recetaId, +factor);
    await guardarDia(); cerrarHoja(); toast('Plato cambiado'); return render();
  }
  if (d.saltar) { S.dia.comidas.find((x) => x.slot === d.saltar).estado = 'saltada'; await guardarDia(); cerrarHoja(); toast('Saltada · el día se recalculó'); return render(); }

  if (d.rapido) {
    if (!(await necesitaDia())) return;
    const r = S.rapidos.items.find((x) => x.id === d.rapido);
    if (r.batido) {
      const fijo = S.dia.comidas.find((c) => c.recetaId === 'batido-proteina' && c.estado === 'planeada');
      if (fijo) await marcarComida(fijo.slot, true);
      else { const v = datosBatido(); await registrar({ nombre: 'Batido de proteína', kcal: v.kcal, proteina: v.proteina, fibra: v.fibra, origen: 'favorito', recetaId: 'batido-proteina' }); await guardarDia(); }
    } else {
      const fila = await registrar({ nombre: r.nombre, kcal: r.kcal, proteina: r.proteina, fibra: r.fibra, origen: 'favorito' });
      fila.rapidoId = r.id; await db.guardar('registros', fila); await guardarDia();
    }
    toast(`${r.nombre} registrado`); if ($('#hoja').classList.contains('on')) cerrarHoja();
    return render();
  }
  if (d.accion === 'editar-rapidos') return hojaRapidos();
  if (d.icono) { b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); return; }
  if (d.accion === 'agregar-rapido') {
    const nombre = $('#rn').value.trim(); if (!nombre) return toast('Ponle un nombre');
    const ico = $('[data-icono][aria-pressed=true]')?.dataset.icono ?? 'plato';
    S.rapidos.items.push({ id: db.uuid(), nombre, det: $('#rd').value.trim() || '1 porción', kcal: +$('#rk').value || 0, proteina: +$('#rp').value || 0, fibra: +$('#rf').value || 0, ico });
    await db.guardar('ajustes', S.rapidos); toast('Botón agregado'); hojaRapidos(); return render();
  }
  if (d.quitarRapido) { S.rapidos.items.splice(+d.quitarRapido, 1); await db.guardar('ajustes', S.rapidos); hojaRapidos(); return render(); }

  if (d.accion === 'registrar') { if (!(await necesitaDia())) return; return hojaRegistrar(); }
  if (d.regTab) return hojaRegistrar(d.regTab);
  if (d.elegirBuscado) { const [t, id] = d.elegirBuscado.split(':'); return detalleBuscado(t, id); }
  if (d.porcion) { b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); return; }
  if (d.registrarReceta) {
    const r = receta(d.registrarReceta); const f = +($('[data-porcion][aria-pressed=true]')?.dataset.porcion ?? 1);
    await registrar({ nombre: r.nombre + (f !== 1 ? ` ×${dec(f)}` : ''), kcal: r.kcal * f, proteina: r.proteina_g * f, fibra: r.fibra_g * f, origen: 'manual', recetaId: r.id, factor: f });
    await guardarDia(); cerrarHoja(); toast('Registrado'); return render();
  }
  if (d.registrarAlimento) {
    const a = S.indice.get(d.registrarAlimento); const g = +$('#gramos').value || 0; if (!g) return toast('Escribe los gramos');
    await registrar({ nombre: `${a.nombre} · ${fmt(g)} g`, kcal: a.kcal * g / 100, proteina: a.proteina_g * g / 100, fibra: (a.fibra_g ?? 0) * g / 100, origen: 'manual', gramos: g, incertidumbre: 5 });
    await guardarDia(); cerrarHoja(); toast('Registrado'); return render();
  }
  if (d.accion === 'registrar-json') {
    let r; try { r = leerJSON($('#json').value); } catch { return toast('El JSON no es válido'); }
    if (r.etiqueta) {
      const p = r.etiqueta.por_porcion;
      S.rapidos.items.push({ id: db.uuid(), nombre: r.etiqueta.producto || 'Producto', det: r.etiqueta.porcion?.cantidad ? `${r.etiqueta.porcion.cantidad} ${r.etiqueta.porcion.unidad ?? ''}`.trim() : '1 porción', kcal: +p.kcal || 0, proteina: +p.proteina_g || 0, fibra: +p.fibra_g || 0, ico: 'lata' });
      await db.guardar('ajustes', S.rapidos); cerrarHoja(); toast('Guardado en registro rápido'); return render();
    }
    if (!r.items.length) return toast('No encontré comidas en el JSON');
    for (const x of r.items) await registrar({ nombre: x.nombre + (x.gramos ? ` · ${fmt(x.gramos)} g` : ''), kcal: x.kcal, proteina: x.proteina, fibra: x.fibra, origen: 'texto', gramos: x.gramos, incertidumbre: 20 });
    await guardarDia(); cerrarHoja(); toast(`${r.items.length} registrado${r.items.length > 1 ? 's' : ''}`); return render();
  }

  if (d.accion === 'hambre') { if (!(await necesitaDia())) return; return hojaHambre(); }
  if (d.hambre) {
    const h = HAMBRE[+d.hambre];
    await registrar({ nombre: h.nombre, kcal: h.kcal, proteina: h.proteina, origen: 'favorito' });
    S.dia.hambre = true; await guardarDia(); cerrarHoja(); toast('Registrado'); return render();
  }
  if (d.accion === 'dormir') return hojaDormir();
  if (d.cerrar !== undefined) {
    S.dia.cierre = Date.now(); S.dia.completo = d.cerrar === '1';
    await guardarDia(); cerrarHoja(); toast('Día cerrado · buenas noches');
    S.dia = null; S.registros = []; return render();
  }

  if (d.planTurno) { const [i, k] = d.planTurno.split(':'); S.turnosPlan[+i] = k; b.parentElement.querySelectorAll('.tm').forEach((x) => x.setAttribute('aria-pressed', x === b)); return; }
  if (d.accion === 'generar-plan') return generarPlan();
  if (d.planComida) { const [f, s] = d.planComida.split(':'); return hojaPlanComida(f, s); }
  if (d.planElegir) {
    const [f, s, id, fac] = d.planElegir.split(':');
    const p = await db.leer('plan', f); Object.assign(p.comidas.find((c) => c.slot === s), { recetaId: id, factor: +fac });
    await db.guardar('plan', p); cerrarHoja(); toast('Plato cambiado'); return vistaPlan();
  }
  if (d.cocina) return hojaCocina(d.cocina);

  if (d.compra) {
    const clave = `${S.compras.semana}:${d.compra}`; const actual = await db.leer('compras', clave);
    await db.guardar('compras', { clave, semana: S.compras.semana, alimentoId: d.compra, comprado: !actual?.comprado });
    return vistaCompras();
  }
  if (d.accion === 'copiar-compras') return copiar(textoCompras(S.compras.lista, new Set((await db.todos('compras')).filter((c) => c.semana === S.compras.semana && c.comprado).map((c) => c.alimentoId))));

  if (b.id === 'ruidoso' || b.id === 'batidoFijo') { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); return; }
  if (d.accion === 'guardar-peso') {
    const kg = parseFloat(String($('#kg').value).replace(',', '.'));
    if (!(kg > 30 && kg < 250)) return toast('Revisa el peso');
    await db.guardar('peso', { fecha: hoyFecha(), kg, valido: $('#ruidoso').getAttribute('aria-pressed') !== 'true' });
    toast('Peso guardado'); return vistaProgreso();
  }
  if (d.accion === 'aplicar-meta') {
    S.perfil.meta = { ...S.sugerencia }; await db.guardar('ajustes', S.perfil);
    if (S.dia) { S.dia.presupuesto = M.presupuestoDia({ turno: S.dia.turno, metaKcal: S.perfil.meta.kcal, metaProteina: S.perfil.meta.proteina }); await guardarDia(); }
    toast('Meta actualizada'); return vistaProgreso();
  }

  if (d.accion === 'ajustes') return hojaAjustes();
  if (d.paleta) { S.tema.paleta = d.paleta; await db.guardar('ajustes', S.tema); aplicarTema(); return hojaAjustes(); }
  if (d.modo) { S.tema.modo = d.modo; await db.guardar('ajustes', S.tema); aplicarTema(); return hojaAjustes(); }
  if (d.etapa) { b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); return; }
  if (d.accion === 'guardar-ajustes') {
    const kcal = Math.max(1400, Math.round(+$('#mk').value || S.perfil.meta.kcal));
    S.perfil.meta = { kcal, proteina: Math.round(+$('#mp').value || S.perfil.meta.proteina) };
    S.perfil.etapa = +($('[data-etapa][aria-pressed=true]')?.dataset.etapa ?? S.perfil.etapa);
    S.perfil.batidoFijo = $('#batidoFijo').getAttribute('aria-pressed') === 'true';
    const bk = +$('#bk').value; const bp = +$('#bp').value; const bf = +$('#bf').value;
    const gen = M.calcularReceta(S.recetasBase.find((r) => r.id === 'batido-proteina'), S.indice);
    if (bk !== gen.kcal || bp !== gen.proteina_g || bf !== gen.fibra_g) S.perfil.batido = { kcal: bk, proteina: bp, fibra: bf };
    await db.guardar('ajustes', S.perfil);
    recalcularRecetas();
    if (S.dia) {
      S.dia.presupuesto = M.presupuestoDia({ turno: S.dia.turno, metaKcal: kcal, metaProteina: S.perfil.meta.proteina });
      for (const c of S.dia.comidas) if (c.recetaId === 'batido-proteina' && c.estado === 'planeada') Object.assign(c, comidaDesdeReceta(M.PLANTILLAS[S.dia.turno].find((s) => s.id === c.slot), c.recetaId, c.factor));
      await guardarDia();
    }
    cerrarHoja(); toast('Ajustes guardados'); return render();
  }
  if (d.accion === 'exportar') return copiar(JSON.stringify(await db.exportar()));
  if (d.accion === 'importar') {
    hoja(`<h3>Restaurar respaldo</h3><p class="t">Pega aquí el respaldo que copiaste. Se suma a lo que ya hay.</p><textarea class="entrada" id="respaldo"></textarea><button class="btn pri ancho" style="margin-top:12px" data-accion="importar-ok">Restaurar</button>`);
    return;
  }
  if (d.accion === 'importar-ok') {
    try { await db.importar(JSON.parse($('#respaldo').value)); await iniciarDatos(); cerrarHoja(); toast('Respaldo restaurado'); return render(); } catch { return toast('Ese respaldo no es válido'); }
  }
  if (d.copiar) return copiar(decodeURIComponent(d.copiar));
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); toast('Copiado'); } catch { toast('No se pudo copiar'); }
}

/* ------------------------------------------------------------------ navegación */
function ir(vista) {
  S.vista = vista;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === vista));
  cerrarHoja();
  window.scrollTo({ top: 0 });
  return render();
}

async function render() {
  const f = hoyFecha();
  $('#fecha').textContent = capital(nombreDia(S.dia?.fecha ?? f, true));
  if (S.vista === 'hoy') return vistaHoy();
  if (S.vista === 'plan') return vistaPlan();
  if (S.vista === 'compras') return vistaCompras();
  if (S.vista === 'progreso') return vistaProgreso();
}

async function iniciarDatos() {
  S.perfil = (await db.leer('ajustes', 'perfil')) ?? (await db.guardar('ajustes', PERFIL_INICIAL));
  S.tema = (await db.leer('ajustes', 'tema')) ?? (await db.guardar('ajustes', TEMA_INICIAL));
  S.rapidos = (await db.leer('ajustes', 'rapidos')) ?? (await db.guardar('ajustes', { id: 'rapidos', items: RAPIDOS_INICIALES }));
  recalcularRecetas();
  aplicarTema();
  await cargarDia();
}

async function iniciar() {
  const [a, r] = await Promise.all([fetch('datos/alimentos.json').then((x) => x.json()), fetch('datos/recetas.json').then((x) => x.json())]);
  S.alimentos = a.alimentos; S.indice = M.indiceAlimentos(S.alimentos); S.recetasBase = r.recetas;
  await db.abrir();
  await iniciarDatos();
  document.addEventListener('click', (e) => onClick(e).catch((err) => { console.error(err); toast('Algo falló: ' + err.message); }));
  $('#velo').addEventListener('click', cerrarHoja);
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', aplicarTema);
  document.addEventListener('visibilitychange', async () => { if (!document.hidden) { await cargarDia(); render(); } });
  await render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

iniciar().catch((e) => { console.error(e); document.getElementById('vista').innerHTML = `<div class="vacio">No se pudo cargar la app: ${esc(e.message)}</div>`; });
