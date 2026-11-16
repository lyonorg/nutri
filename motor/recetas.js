// Calcula los valores nutricionales de una receta a partir de sus ingredientes en gramos.
// Aquí vive la regla de oro: las calorías salen de la base de alimentos, no de la IA ni de la receta.

const r1 = (x) => Math.round(x * 10) / 10;

/** Convierte datos/alimentos.json en un índice por id. */
export function indiceAlimentos(alimentos) {
  return new Map(alimentos.map((a) => [a.id, a]));
}

/**
 * @param receta   { id, nombre, tipos, ingredientes: [{ a, g }] , ... }  gramos crudos y limpios
 * @param indice   Map id -> alimento (valores por 100 g)
 * @returns la receta en el formato que usa el planificador, con todo calculado
 */
export function calcularReceta(receta, indice) {
  const t = { kcal: 0, proteina_g: 0, carbohidratos_g: 0, grasa_g: 0, fibra_g: 0, gramos: 0 };
  let gramosFruta = 0;
  let gramosLegumbre = 0;
  let gramosIntegral = 0;
  let nova = 1;
  const provisionales = [];

  for (const ing of receta.ingredientes) {
    const a = indice.get(ing.a);
    if (!a) throw new Error(`Receta "${receta.id}": no existe el alimento "${ing.a}"`);
    const f = ing.g / 100;
    t.kcal += a.kcal * f;
    t.proteina_g += a.proteina_g * f;
    t.carbohidratos_g += (a.carbohidratos_g ?? 0) * f;
    t.grasa_g += (a.grasa_g ?? 0) * f;
    t.fibra_g += (a.fibra_g ?? 0) * f;
    t.gramos += ing.g * (a.factor_coccion ?? 1);   // peso ya cocido, para la densidad energética
    if (a.fruta) gramosFruta += ing.g;
    if (a.legumbre) gramosLegumbre += ing.g;
    if (a.integral) gramosIntegral += ing.g;
    if (ing.g >= 20 && a.nova) nova = Math.max(nova, a.nova);
    if (a.provisional) provisionales.push(a.id);
  }

  t.gramos += receta.agua_g ?? 0;   // agua que se le agrega (batidos, sopas)

  return {
    id: receta.id,
    nombre: receta.nombre,
    tipos: receta.tipos,
    kcal: Math.round(t.kcal),
    proteina_g: r1(t.proteina_g),
    carbohidratos_g: r1(t.carbohidratos_g),
    grasa_g: r1(t.grasa_g),
    fibra_g: r1(t.fibra_g),
    gramos: Math.round(t.gramos),
    proteinaPor100kcal: r1((t.proteina_g / t.kcal) * 100),
    frutas: gramosFruta >= 60 ? 1 : 0,
    legumbre: gramosLegumbre >= 40,
    integral: gramosIntegral >= 30,
    altaProteina: (t.proteina_g / t.kcal) * 100 >= 12,
    nova,
    portatil: receta.portatil ?? false,
    lote: receta.lote ?? false,
    proteinaPrincipal: receta.proteinaPrincipal ?? null,
    dificultad: receta.dificultad ?? 1,
    ingredientes: receta.ingredientes.map((ing) => ({ alimentoId: ing.a, gramos: ing.g, casera: ing.casera ?? null })),
    pasos: receta.pasos ?? [],
    tip: receta.tip ?? null,
    provisionales,
  };
}

export function calcularRecetas(recetas, alimentos) {
  const indice = alimentos instanceof Map ? alimentos : indiceAlimentos(alimentos);
  return recetas.map((r) => calcularReceta(r, indice));
}

/** Texto de la ficha para quien cocina: ingredientes en medida casera y pasos cortos. */
export function fichaCocina(receta, indice, factor = 1) {
  const lineas = [`${receta.nombre}${factor !== 1 ? ` (porción ×${factor})` : ''}`, ''];
  for (const ing of receta.ingredientes) {
    const nombre = indice.get(ing.alimentoId)?.nombre ?? ing.alimentoId;
    const g = Math.round(ing.gramos * factor);
    lineas.push(`- ${nombre}: ${g} g${ing.casera && factor === 1 ? ` (${ing.casera})` : ''}`);
  }
  lineas.push('');
  receta.pasos.forEach((p, i) => lineas.push(`${i + 1}. ${p}`));
  return lineas.join('\n');
}
