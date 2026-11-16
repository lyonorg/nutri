// Cuenta y sincronización con Supabase (proyecto compartido con Misión Diaria).
// La app guarda todo en el teléfono primero; esto sube y baja cambios cuando hay internet y sesión.
// La misma cuenta (usuario + contraseña) sirve para todas las apps.
import * as db from './db.js';

const URL_SUPABASE = 'https://bpwbkoobzkjkjtdfxtxx.supabase.co';
const LLAVE_PUBLICA = 'sb_publishable_aaxRJy8ZfgVJ3G64PvZuIw_98TW8MMI'; // pública por diseño; los datos los protege RLS
const TABLAS = ['ajustes', 'dias', 'registros', 'plan', 'peso', 'compras', 'despensa'];
const MARCA = 'nutri-sync';

let cliente = null;

async function sb() {
  if (cliente) return cliente;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
  cliente = createClient(URL_SUPABASE, LLAVE_PUBLICA, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pianda-apps-sesion' } });
  return cliente;
}

export async function sesion() {
  try { return (await (await sb()).auth.getSession()).data.session; } catch { return null; }
}

export async function usuarioActual() {
  const s = await sesion();
  if (!s) return null;
  const { data } = await (await sb()).from('app_usuarios').select('usuario').eq('user_id', s.user.id).maybeSingle();
  if (!data) {
    // primera entrada tras confirmar el correo: se reserva el usuario que eligió al crear la cuenta
    const pendiente = localStorage.getItem('pianda-usuario-pendiente');
    if (pendiente) {
      await (await sb()).from('app_usuarios').insert({ usuario: pendiente, user_id: s.user.id });
      localStorage.removeItem('pianda-usuario-pendiente');
      return pendiente;
    }
  }
  return data?.usuario ?? s.user.email;
}

export async function entrar(usuarioOEmail, clave) {
  const c = await sb();
  let email = usuarioOEmail.trim();
  if (!email.includes('@')) {
    const { data, error } = await c.rpc('email_de_usuario', { p_usuario: email.toLowerCase() });
    if (error || !data) throw new Error('Ese usuario no existe');
    email = data;
  }
  const { error } = await c.auth.signInWithPassword({ email, password: clave });
  if (error) throw new Error(error.message.includes('confirm') ? 'Falta confirmar el correo (revisa tu Gmail)' : 'Usuario o contraseña incorrectos');
  return usuarioActual();
}

export async function crearCuenta(usuario, email, clave) {
  const c = await sb();
  usuario = usuario.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('El usuario: 3 a 30 letras o números, sin espacios');
  if (clave.length < 8) throw new Error('La contraseña: mínimo 8 caracteres');
  const { data, error } = await c.auth.signUp({ email: email.trim(), password: clave, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw new Error(error.message);
  localStorage.setItem('pianda-usuario-pendiente', usuario);
  if (data.session) { await usuarioActual(); return { listo: true }; }
  return { listo: false }; // hay que confirmar el correo
}

export async function salir() { try { await (await sb()).auth.signOut(); } catch { /* sin red */ } }

/** Sube lo cambiado desde la última vez y baja lo que cambió en la nube. Gana el cambio más reciente. */
export async function sincronizar() {
  const s = await sesion();
  if (!s) return { ok: false, motivo: 'sin sesión' };
  const c = await sb();
  const marca = JSON.parse(localStorage.getItem(MARCA) ?? '{"subida":"1970-01-01","bajada":"1970-01-01"}');
  const inicio = new Date().toISOString();
  let subidas = 0;
  let bajadas = 0;

  // subir
  const filas = [];
  for (const t of TABLAS) {
    for (const f of await db.todos(t)) {
      if ((f.actualizado_en ?? '') > marca.subida) filas.push({ tabla: t, llave: String(f[db.LLAVES[t]]), datos: f, borrado: false, actualizado_en: f.actualizado_en });
    }
  }
  for (const b of db.borradosPendientes()) if (TABLAS.includes(b.tabla)) filas.push({ tabla: b.tabla, llave: b.llave, datos: null, borrado: true, actualizado_en: b.en });
  for (let i = 0; i < filas.length; i += 400) {
    const { error } = await c.from('nutri_filas').upsert(filas.slice(i, i + 400), { onConflict: 'user_id,tabla,llave' });
    if (error) throw new Error(error.message);
  }
  subidas = filas.length;
  db.limpiarBorrados(inicio);

  // bajar: se pide por la hora en que la nube recibió cada cambio (no la del teléfono que lo hizo)
  let desde = marca.bajada;
  for (;;) {
    const { data, error } = await c.from('nutri_filas').select('tabla,llave,datos,borrado,actualizado_en,recibido_en').gt('recibido_en', desde).order('recibido_en').limit(1000);
    if (error) throw new Error(error.message);
    for (const r of data) {
      if (!TABLAS.includes(r.tabla)) continue;
      const local = await db.leer(r.tabla, r.llave);
      if (local && (local.actualizado_en ?? '') >= r.actualizado_en) continue;
      if (r.borrado) await db.borrar(r.tabla, r.llave, { local: true });
      else await db.escribirCrudo(r.tabla, r.datos);
      bajadas += 1;
    }
    if (data.length) desde = data[data.length - 1].recibido_en;
    if (data.length < 1000) break;
  }
  localStorage.setItem(MARCA, JSON.stringify({ subida: inicio, bajada: desde }));
  return { ok: true, subidas, bajadas };
}

/** Turnos del calendario de Google: [{ fecha, turno, inicio, fin, titulo }]. Se guardan para usarlos sin internet. */
export async function turnosCalendario() {
  const s = await sesion();
  if (!s) return null;
  const r = await fetch(`${URL_SUPABASE}/functions/v1/nutri-turnos`, { headers: { Authorization: `Bearer ${s.access_token}`, apikey: LLAVE_PUBLICA } });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error ?? `error ${r.status}`);
  return j.turnos;
}
