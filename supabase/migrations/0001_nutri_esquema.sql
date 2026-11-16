-- Esquema de la app de calorías y recetas (prefijo nutri_).
-- NO SE HA APLICADO A NINGÚN PROYECTO. Es solo el archivo; se aplica cuando Michael decida en cuál.
--
-- Decisiones:
-- 1. Todas las tablas con datos personales llevan user_id y RLS: cada quien ve solo lo suyo.
--    Requiere login (Supabase Auth). Sin login, la clave pública dejaría leer datos de salud.
-- 2. Los ids son uuid generados en el teléfono: la app funciona sin internet y sincroniza con upsert.
--    actualizado_en decide el conflicto (gana la última edición); borrado_en es borrado suave.
-- 3. Todo se guarda en gramos. Las medidas caseras y la libra (500 g) viven en nutri_medidas.
-- 4. Un nutriente sin dato es NULL, nunca 0.
-- 5. text + check en vez de enum: más fácil de cambiar después.
-- 6. Las calorías de cada registro se guardan ya calculadas por el motor (foto del momento).

create extension if not exists pgcrypto;

create or replace function nutri_tocar_actualizado() returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

-- ---------------------------------------------------------------- perfil y metas
create table nutri_perfil (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  nombre text,
  sexo text not null default 'm' check (sexo in ('m', 'f')),
  fecha_nacimiento date not null,
  talla_cm numeric(5,1) not null,
  etapa_actividad smallint not null default 0 check (etapa_actividad between 0 and 4),
  utc_offset_min smallint not null default -300,
  dia_comida_libre smallint check (dia_comida_libre between 0 and 6),
  actualizado_en timestamptz not null default now()
);

-- Una fila por semana: de dónde salió la meta. Es el historial del algoritmo adaptativo.
create table nutri_metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  desde date not null,
  kcal integer not null check (kcal >= 1400),
  proteina_g integer not null,
  fibra_g integer,
  gasto_estimado integer,
  confianza numeric(3,2),
  motivo text,
  en_pausa boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (user_id, desde)
);

-- ---------------------------------------------------------------- catálogo de alimentos
-- Catálogo compartido (lo siembra el dueño del proyecto). Valores por 100 g de parte comestible.
create table nutri_alimentos (
  id text primary key,                         -- slug estable: 'pechuga-pollo'
  nombre text not null,
  grupo text not null,
  estado_referencia text not null default 'crudo' check (estado_referencia in ('crudo', 'cocido', 'listo')),
  kcal numeric(6,1) not null,
  proteina_g numeric(5,1) not null,
  carbohidratos_g numeric(5,1),
  grasa_g numeric(5,1),
  fibra_g numeric(5,1),
  micros jsonb not null default '{}'::jsonb,   -- { "calcio_mg": 12, "hierro_mg": null } ; null = sin dato
  factor_coccion numeric(4,2),                 -- gramos cocidos por gramo crudo (arroz ~2,5; carne ~0,7)
  parte_comestible numeric(3,2) not null default 1 check (parte_comestible > 0 and parte_comestible <= 1),
  nova smallint check (nova between 1 and 4),
  perecedero boolean not null default false,
  dias_vida_util smallint,
  integral boolean not null default false,
  fuente text not null check (fuente in ('usda', 'icbf', 'off', 'etiqueta', 'manual')),
  fuente_id text,                              -- id en USDA, código ICBF o código de barras
  creado_por uuid references auth.users default auth.uid(),
  actualizado_en timestamptz not null default now()
);

create table nutri_medidas (
  alimento_id text not null references nutri_alimentos on delete cascade,
  medida text not null,                        -- 'taza', 'unidad mediana', 'libra', 'scoop'
  gramos numeric(7,1) not null check (gramos > 0),
  primary key (alimento_id, medida)
);

-- Lo que es de cada persona: la lista blanca y dónde compra.
create table nutri_alimento_usuario (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  alimento_id text not null references nutri_alimentos on delete cascade,
  lo_como boolean not null default true,
  tienda text,
  unidad_compra text,
  favorito boolean not null default false,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, alimento_id)
);

-- ---------------------------------------------------------------- recetas
create table nutri_recetas (
  id text primary key,
  nombre text not null,
  tipos text[] not null,                       -- desayuno, almuerzo, cena, snack
  porciones smallint not null default 1,
  dificultad smallint not null default 1 check (dificultad between 1 and 3),
  portatil boolean not null default false,
  proteina_principal text,
  pasos text[] not null default '{}',          -- máximo 5 pasos simples (modo empleada)
  nota_tecnica text,                           -- un tip por receta (modo aprender)
  estado text not null default 'aprobada' check (estado in ('borrador', 'aprobada')),
  creado_por uuid references auth.users default auth.uid(),
  actualizado_en timestamptz not null default now()
);

create table nutri_receta_ingredientes (
  receta_id text not null references nutri_recetas on delete cascade,
  alimento_id text not null references nutri_alimentos,
  gramos numeric(7,1) not null check (gramos > 0),   -- en el estado de referencia del alimento (crudo)
  medida_casera text,                                 -- "1 taza", "una pechuga mediana"
  primary key (receta_id, alimento_id)
);

-- ---------------------------------------------------------------- el día a día
create table nutri_dias (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  fecha date not null,                         -- fecha local del momento en que empieza el día
  turno text not null check (turno in ('manana', 'tarde', 'noche', 'post-noche', 'libre')),
  inicio timestamptz not null,
  cierre timestamptz,                          -- "me voy a dormir"; null = cierre automático
  completo boolean not null default true,      -- false = no entra al cálculo del gasto
  presupuesto_kcal integer not null,
  presupuesto_proteina_g integer not null,
  es_comida_libre boolean not null default false,
  hambre boolean not null default false,       -- tocó "tengo hambre" ese día
  actualizado_en timestamptz not null default now(),
  unique (user_id, fecha)
);

create table nutri_registros (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  dia_id uuid not null references nutri_dias on delete cascade,
  comida text not null,                        -- id de la comida en la plantilla del turno, o 'extra'
  momento timestamptz not null,
  alimento_id text references nutri_alimentos,
  receta_id text references nutri_recetas,
  descripcion text,                            -- texto libre cuando viene de foto o de Gemini
  gramos numeric(7,1),
  factor_porcion numeric(4,2),
  kcal numeric(7,1) not null,
  proteina_g numeric(6,1) not null default 0,
  carbohidratos_g numeric(6,1),
  grasa_g numeric(6,1),
  fibra_g numeric(6,1),
  origen text not null check (origen in ('plan', 'favorito', 'texto', 'foto', 'etiqueta', 'barras', 'manual')),
  incertidumbre_pct smallint not null default 10,
  actualizado_en timestamptz not null default now(),
  borrado_en timestamptz
);
create index nutri_registros_dia on nutri_registros (dia_id) where borrado_en is null;

create table nutri_plan (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  fecha date not null,
  comida text not null,
  receta_id text not null references nutri_recetas,
  factor_porcion numeric(4,2) not null default 1,
  estado text not null default 'planeada' check (estado in ('planeada', 'comida', 'cambiada', 'saltada')),
  actualizado_en timestamptz not null default now(),
  unique (user_id, fecha, comida)
);

create table nutri_peso (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  fecha date not null,
  kg numeric(5,2) not null check (kg between 30 and 250),
  cintura_cm numeric(5,1),
  valido boolean not null default true,        -- false = pesaje ruidoso (post-noche, día después de comida libre)
  nota text,
  actualizado_en timestamptz not null default now(),
  unique (user_id, fecha)
);

create table nutri_actividad (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  dia_id uuid not null references nutri_dias on delete cascade,
  actividad text not null,
  met numeric(3,1) not null,
  minutos smallint not null check (minutos > 0),
  kcal_netas integer not null,
  kcal_acreditadas integer not null,
  actualizado_en timestamptz not null default now(),
  borrado_en timestamptz
);

-- ---------------------------------------------------------------- compras y despensa (despensa: fase 2)
create table nutri_lista_compras (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  semana date not null,
  alimento_id text not null references nutri_alimentos,
  gramos numeric(8,1) not null,
  tienda text,
  comprado boolean not null default false,
  comprado_en timestamptz,
  actualizado_en timestamptz not null default now(),
  unique (user_id, semana, alimento_id)
);

create table nutri_despensa (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  alimento_id text not null references nutri_alimentos,
  gramos numeric(8,1) not null check (gramos >= 0),
  comprado_en date,
  vence date,
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  -- tablas personales: solo el dueño
  foreach t in array array['nutri_perfil', 'nutri_metas', 'nutri_alimento_usuario', 'nutri_dias', 'nutri_registros',
                           'nutri_plan', 'nutri_peso', 'nutri_actividad', 'nutri_lista_compras', 'nutri_despensa']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_propio', t);
  end loop;

  -- catálogo: lo lee cualquier usuario con sesión; lo edita quien creó la fila
  foreach t in array array['nutri_alimentos', 'nutri_recetas']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_leer', t);
    execute format('create policy %I on %I for all to authenticated using (creado_por = auth.uid()) with check (creado_por = auth.uid())', t || '_editar', t);
  end loop;
end $$;

alter table nutri_medidas enable row level security;
create policy nutri_medidas_leer on nutri_medidas for select to authenticated using (true);
create policy nutri_medidas_editar on nutri_medidas for all to authenticated
  using (exists (select 1 from nutri_alimentos a where a.id = alimento_id and a.creado_por = auth.uid()))
  with check (exists (select 1 from nutri_alimentos a where a.id = alimento_id and a.creado_por = auth.uid()));

alter table nutri_receta_ingredientes enable row level security;
create policy nutri_receta_ingredientes_leer on nutri_receta_ingredientes for select to authenticated using (true);
create policy nutri_receta_ingredientes_editar on nutri_receta_ingredientes for all to authenticated
  using (exists (select 1 from nutri_recetas r where r.id = receta_id and r.creado_por = auth.uid()))
  with check (exists (select 1 from nutri_recetas r where r.id = receta_id and r.creado_por = auth.uid()));

-- ---------------------------------------------------------------- actualizado_en automático
do $$
declare t text;
begin
  foreach t in array array['nutri_perfil', 'nutri_alimentos', 'nutri_alimento_usuario', 'nutri_recetas', 'nutri_dias',
                           'nutri_registros', 'nutri_plan', 'nutri_peso', 'nutri_actividad', 'nutri_lista_compras', 'nutri_despensa']
  loop
    execute format('create trigger %I before update on %I for each row execute function nutri_tocar_actualizado()', t || '_tocar', t);
  end loop;
end $$;
