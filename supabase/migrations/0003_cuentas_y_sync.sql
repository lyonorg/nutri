-- Aplicada en el proyecto Supabase "mision-diaria" (16 nov 2026). No toca las tablas md_*.
-- Cuentas compartidas (usuario -> cuenta de Supabase Auth) y datos de nutri como filas JSON sincronizables.
-- El enlace iCal del calendario NO está aquí: se guardó directo en la base (nutri_secretos), nunca en el repo.

create table if not exists public.app_usuarios (
  usuario text primary key check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table public.app_usuarios enable row level security;
create policy "ver mi usuario" on public.app_usuarios for select to authenticated using (user_id = auth.uid());
create policy "crear mi usuario" on public.app_usuarios for insert to authenticated with check (user_id = auth.uid());

create or replace function public.email_de_usuario(p_usuario text)
returns text language sql security definer set search_path = public, auth stable as $$
  select u.email from public.app_usuarios a join auth.users u on u.id = a.user_id where a.usuario = lower(p_usuario)
$$;
revoke all on function public.email_de_usuario(text) from public;
grant execute on function public.email_de_usuario(text) to anon, authenticated;

create table if not exists public.nutri_filas (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tabla text not null,
  llave text not null,
  datos jsonb,
  borrado boolean not null default false,
  actualizado_en timestamptz not null default now(),   -- cuándo cambió en el teléfono
  recibido_en timestamptz not null default now(),      -- cuándo llegó a la nube (lo pone el trigger)
  primary key (user_id, tabla, llave)
);
create index if not exists nutri_filas_recibido on public.nutri_filas (user_id, recibido_en);
alter table public.nutri_filas enable row level security;
create policy "mis filas" on public.nutri_filas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public.nutri_marcar_recibido() returns trigger language plpgsql set search_path = public as $$
begin new.recibido_en := clock_timestamp(); return new; end $$;
create trigger nutri_marcar_recibido before insert or update on public.nutri_filas for each row execute function public.nutri_marcar_recibido();

-- Enlace privado del calendario por usuario. Sin políticas: solo lo lee la función nutri-turnos.
create table if not exists public.nutri_secretos (user_id uuid primary key references auth.users(id) on delete cascade, ical_url text);
alter table public.nutri_secretos enable row level security;
-- Enlace guardado antes de crear la cuenta; se entrega solo a la cuenta con el correo del dueño.
create table if not exists public.nutri_secreto_pendiente (id int primary key default 1 check (id = 1), ical_url text not null, email text);
alter table public.nutri_secreto_pendiente enable row level security;
-- (trigger nutri_asignar_secreto en app_usuarios: copia el enlace a nutri_secretos si el correo coincide)
