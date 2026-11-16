// Genera datos/alimentos.json a partir de la base USDA SR28 (dominio público).
//
// Uso:  node herramientas/sembrar-alimentos.mjs <carpeta con ABBREV.txt y FOOD_DES.txt>
// La base viene, por ejemplo, del paquete npm "fda-nutrient-database" (carpeta data/).
//
// Ningún valor nutricional se escribe a mano: todos salen de la base. La selección de qué
// registro representa a cada alimento está en datos/seleccion-usda.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = process.argv[2];
if (!carpeta) { console.error('Falta la carpeta de SR28'); process.exit(1); }
const raiz = new URL('..', import.meta.url).pathname;

const COLS = ['ndb', 'desc', 'agua', 'kcal', 'proteina', 'grasa', 'ceniza', 'carbos', 'fibra', 'azucar', 'calcio', 'hierro', 'magnesio',
  'fosforo', 'potasio', 'sodio', 'zinc', 'cobre', 'manganeso', 'selenio', 'vitC', 'tiamina', 'riboflavina', 'niacina', 'pantotenico', 'b6',
  'folato', 'acidoFolico', 'folatoAlim', 'folatoDFE', 'colina', 'b12', 'vitA_UI', 'vitA_RAE', 'retinol', 'alfaCarot', 'betaCarot', 'betaCript',
  'licopeno', 'lutZea', 'vitE', 'vitD_mcg', 'vitD_UI', 'vitK', 'grasaSat', 'grasaMono', 'grasaPoli', 'colesterol', 'g1', 'm1', 'g2', 'm2', 'desecho'];

const filas = (archivo) => readFileSync(join(carpeta, archivo), 'latin1').split(/\r?\n/).filter(Boolean)
  .map((l) => l.split('^').map((c) => c.replace(/^~|~$/g, '')));
const abrev = new Map(filas('ABBREV.txt').map((f) => [f[0], Object.fromEntries(COLS.map((c, i) => [c, f[i]]))]));
const nombres = new Map(filas('FOOD_DES.txt').map((f) => [f[0], f[2]]));

const num = (v) => (v === '' || v === undefined ? null : Number(v)); // vacío = sin dato, nunca 0
const { alimentos: seleccion } = JSON.parse(readFileSync(join(raiz, 'datos/seleccion-usda.json'), 'utf8'));

const salida = seleccion.map((s) => {
  const r = abrev.get(s.ndb);
  if (!r) throw new Error(`No existe el registro ${s.ndb} (${s.id})`);
  const cocido = s.ndbCocido ? abrev.get(s.ndbCocido) : null;
  if (s.ndbCocido && !cocido) throw new Error(`No existe el registro cocido ${s.ndbCocido} (${s.id})`);
  const medidas = [[r.g1, r.m1], [r.g2, r.m2]].filter(([g, m]) => g && m).map(([g, m]) => ({ medida: m, gramos: Number(g) }));
  return {
    id: s.id,
    nombre: s.nombre,
    grupo: s.grupo,
    estado: s.estado ?? 'crudo',
    kcal: num(r.kcal),
    proteina_g: num(r.proteina),
    carbohidratos_g: num(r.carbos),
    grasa_g: num(r.grasa),
    fibra_g: num(r.fibra),
    micros: {
      calcio_mg: num(r.calcio), hierro_mg: num(r.hierro), magnesio_mg: num(r.magnesio), potasio_mg: num(r.potasio),
      sodio_mg: num(r.sodio), zinc_mg: num(r.zinc), vitamina_c_mg: num(r.vitC), folato_mcg: num(r.folatoDFE),
      vitamina_a_mcg: num(r.vitA_RAE), vitamina_b12_mcg: num(r.b12), vitamina_d_mcg: num(r.vitD_mcg),
    },
    // gramos cocidos por gramo crudo, deducido de las calorías del registro cocido sin grasa añadida
    factor_coccion: cocido ? Math.round((num(r.kcal) / num(cocido.kcal)) * 100) / 100 : null,
    parte_comestible: Math.round((1 - (num(r.desecho) ?? 0) / 100) * 100) / 100,
    medidas_usda: medidas,
    nova: s.nova ?? null,
    perecedero: s.perecedero ?? false,
    integral: s.integral ?? false,
    legumbre: s.legumbre ?? false,
    fruta: s.fruta ?? false,
    alta_proteina: s.altaProteina ?? false,
    tienda: s.tienda ?? null,
    fuente: 'usda',
    fuente_id: s.ndb,
    fuente_nombre: nombres.get(s.ndb),
    ...(s.provisional ? { provisional: s.provisional } : {}),
  };
});

writeFileSync(join(raiz, 'datos/alimentos.json'), JSON.stringify({
  _fuente: 'USDA National Nutrient Database for Standard Reference, Release 28 (2015). Dominio público. Valores por 100 g de parte comestible.',
  _generado_por: 'herramientas/sembrar-alimentos.mjs — no editar a mano',
  alimentos: salida,
}, null, 1) + '\n');
console.log(`${salida.length} alimentos escritos en datos/alimentos.json`);
