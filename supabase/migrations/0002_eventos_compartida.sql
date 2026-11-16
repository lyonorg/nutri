-- Tabla compartida entre apps (Misión Diaria, trivia, nutri…). NO APLICADA.
-- Se aplica solo cuando se conecte el ecosistema, y antes hay que revisar que no exista ya una
-- tabla con este nombre en el proyecto de Misión Diaria.
--
-- Decisiones: solo se agregan filas (nadie edita ni borra); el tipo lleva el prefijo de la app
-- ('nutri.deficit_cumplido'); la clave evita duplicados si la app reintenta sin internet;
-- no hay llaves foráneas hacia tablas de otras apps, para que ninguna rompa a otra.

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  app text not null,
  tipo text not null,
  clave text not null,                 -- p. ej. la fecha del día: un 'deficit_cumplido' por día
  valor jsonb not null default '{}'::jsonb,
  ocurrido_en timestamptz not null default now(),
  unique (user_id, app, tipo, clave)
);

alter table eventos enable row level security;
create policy eventos_leer on eventos for select to authenticated using (user_id = auth.uid());
create policy eventos_agregar on eventos for insert to authenticated with check (user_id = auth.uid());
