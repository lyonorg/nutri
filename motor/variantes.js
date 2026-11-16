// Variantes de receta: una receta base con cambios pequeños (otra proteína, otro carbohidrato,
// otra fruta) se vuelve varias recetas distintas para el planificador. Así hay muchas opciones
// sin escribir 150 recetas a mano, y cada variante sigue calculándose desde USDA.
//
// En datos/recetas.json una receta puede traer:
//   "variantes": [{ "id": "pan", "nombre": "…", "cambia": { "arepa": { "a": "pan-integral", "g": 60, "casera": "2 tajadas" } },
//                   "agrega": [{ a, g, casera }], "quita": ["queso-campesino"], "pasos": [...], "proteinaPrincipal": "res" }]

/** Devuelve la lista de recetas con cada variante como receta propia (id `base--variante`). */
export function expandirVariantes(recetas) {
  const salida = [];
  for (const r of recetas) {
    const { variantes = [], ...base } = r;
    salida.push({ ...base, base: r.id });
    for (const v of variantes) {
      let ingredientes = base.ingredientes
        .filter((ing) => !(v.quita ?? []).includes(ing.a))
        .map((ing) => (v.cambia?.[ing.a] ? { ...ing, casera: null, ...v.cambia[ing.a] } : ing));
      ingredientes = ingredientes.concat(v.agrega ?? []);
      salida.push({
        ...base,
        id: `${r.id}--${v.id}`,
        base: r.id,
        nombre: v.nombre,
        ingredientes,
        pasos: v.pasos ?? base.pasos,
        proteinaPrincipal: v.proteinaPrincipal ?? base.proteinaPrincipal,
        tipos: v.tipos ?? base.tipos,
        portatil: v.portatil ?? base.portatil,
        tip: v.tip ?? base.tip,
      });
    }
  }
  return salida;
}
