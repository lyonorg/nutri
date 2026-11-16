// Guardado en el teléfono (IndexedDB). Una tabla por cosa, como el esquema de Supabase,
// para que la sincronización futura sea copiar filas.
// Si IndexedDB no está disponible (modo privado raro), funciona en memoria y avisa.

const NOMBRE = 'nutri';
const VERSION = 2;
const TABLAS = {
  ajustes: 'id',      // perfil, tema, meta, rápidos
  dias: 'fecha',      // día nutricional: turno, inicio, cierre, comidas planeadas con su estado
  registros: 'id',    // todo lo que se comió
  plan: 'fecha',      // plan de la semana
  peso: 'fecha',
  compras: 'clave',   // ítems marcados como comprados, "no había" y cosas agregadas a mano
  despensa: 'alimentoId', // lo que hay en casa: gramos y fecha de compra
};

let db = null;
const memoria = Object.fromEntries(Object.keys(TABLAS).map((t) => [t, new Map()]));
export let persistente = true;

export async function abrir() {
  if (!('indexedDB' in globalThis)) { persistente = false; return; }
  try {
    db = await new Promise((ok, mal) => {
      const req = indexedDB.open(NOMBRE, VERSION);
      req.onupgradeneeded = () => {
        for (const [t, llave] of Object.entries(TABLAS)) {
          if (!req.result.objectStoreNames.contains(t)) req.result.createObjectStore(t, { keyPath: llave });
        }
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => mal(req.error);
    });
  } catch {
    persistente = false;
  }
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
}

function tx(tabla, modo, fn) {
  return new Promise((ok, mal) => {
    const t = db.transaction(tabla, modo);
    const r = fn(t.objectStore(tabla));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => mal(t.error);
  });
}

export async function leer(tabla, llave) {
  if (!db) return structuredClone(memoria[tabla].get(llave));
  return tx(tabla, 'readonly', (s) => s.get(llave));
}

export async function todos(tabla) {
  if (!db) return [...memoria[tabla].values()].map((x) => structuredClone(x));
  return tx(tabla, 'readonly', (s) => s.getAll());
}

export async function guardar(tabla, valor) {
  const fila = { ...valor, actualizado_en: new Date().toISOString() };
  if (!db) { memoria[tabla].set(fila[TABLAS[tabla]], structuredClone(fila)); return fila; }
  await tx(tabla, 'readwrite', (s) => s.put(fila));
  return fila;
}

export async function borrar(tabla, llave) {
  if (!db) { memoria[tabla].delete(llave); return; }
  await tx(tabla, 'readwrite', (s) => s.delete(llave));
}

/** Todo el contenido, para respaldo. */
export async function exportar() {
  const salida = { app: 'nutri', version: VERSION, exportado_en: new Date().toISOString() };
  for (const t of Object.keys(TABLAS)) salida[t] = await todos(t);
  return salida;
}

export async function importar(datos) {
  for (const t of Object.keys(TABLAS)) {
    for (const fila of datos[t] ?? []) await guardar(t, fila);
  }
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
