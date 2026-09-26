-- =====================================================================
-- App Finanzas — esquema inicial
-- Ejecutar completo en Supabase > SQL Editor (una sola vez).
--
-- Seguridad: la app accede SOLO desde el servidor con la secret key
-- (service_role), que ignora RLS. Por eso RLS queda activado SIN políticas:
-- cualquier acceso con la clave pública (anon/publishable) es rechazado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Personas del hogar (Ratón, Ojitos). En un movimiento, persona NULL = "Ambos".
-- ---------------------------------------------------------------------
create table personas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0
);

-- ---------------------------------------------------------------------
-- Categorías (árbol de 2 niveles: categoría -> subcategoría)
--   type : ingreso | gasto | ahorro | inversion (las subcategorías heredan el del padre)
--   grupo: solo para gastos de primer nivel -> fijo | variable | supervivencia
--          (las subcategorías heredan el grupo del padre)
--   is_salary: marca la categoría "Sueldo"; es la base del % de supervivencia
-- ---------------------------------------------------------------------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references categories(id) on delete restrict,
  type       text not null check (type in ('ingreso', 'gasto', 'ahorro', 'inversion')),
  grupo      text check (grupo in ('fijo', 'variable', 'supervivencia')),
  name       text not null,
  sort_order int  not null default 0,
  is_salary  boolean not null default false,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  constraint categories_nombre_unico unique nulls not distinct (parent_id, name),
  constraint categories_grupo_solo_gastos check (grupo is null or type = 'gasto')
);
create index categories_parent_idx on categories (parent_id);

-- ---------------------------------------------------------------------
-- Movimientos
--   period: mes contable (siempre día 1). Por defecto el mes de la fecha,
--           pero puede diferir (ej. sueldo de agosto pagado el 1 de septiembre).
--   amount: CLP entero. Negativo solo en ahorro/inversión (= retiro / rescate).
-- ---------------------------------------------------------------------
create table transactions (
  id           uuid primary key default gen_random_uuid(),
  date         date   not null,
  period       date   not null check (extract(day from period) = 1),
  amount       bigint not null check (amount <> 0),
  category_id  uuid   not null references categories(id) on delete restrict,
  persona_id   uuid   references personas(id) on delete set null,
  note         text,
  import_batch uuid,               -- no nulo = vino de una importación (permite deshacerla)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index transactions_period_idx   on transactions (period);
create index transactions_category_idx on transactions (category_id, period);
create index transactions_batch_idx    on transactions (import_batch) where import_batch is not null;

-- ---------------------------------------------------------------------
-- Configuración de presupuesto. Cada fila rige DESDE valid_from en adelante,
-- hasta la siguiente fila (igual que cambiar el % mes a mes en el Excel).
--   survival_pct      : % TOTAL de los sueldos destinado a supervivencia
--   survival_split_pct: % de ese total para la persona con sort_order = 1 (Ratón);
--                       el resto va a la otra persona
--   target_*_pct      : modelo 50/20/30 (replica la hoja "Análisis Global")
-- ---------------------------------------------------------------------
create table budget_settings (
  id                  uuid primary key default gen_random_uuid(),
  valid_from          date not null unique check (extract(day from valid_from) = 1),
  survival_pct        numeric(7,3) not null default 20 check (survival_pct between 0 and 100),
  survival_split_pct  numeric(5,2) not null default 50 check (survival_split_pct between 0 and 100),
  target_fixed_pct    numeric(5,2) not null default 50,
  target_variable_pct numeric(5,2) not null default 20,
  target_savings_pct  numeric(5,2) not null default 30,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Meta de ahorro mensual (ahorro + inversiones netos). Rige desde valid_from.
--   kind = 'monto' -> value en CLP; kind = 'porcentaje' -> value en % del ingreso
-- ---------------------------------------------------------------------
create table savings_goals (
  id         uuid primary key default gen_random_uuid(),
  valid_from date not null unique check (extract(day from valid_from) = 1),
  kind       text not null check (kind in ('monto', 'porcentaje')),
  value      numeric(14,2) not null check (value >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Totales mensuales por categoría y persona (para dashboard y tendencias).
-- security_invoker: respeta RLS del usuario que consulta (no la del dueño).
-- ---------------------------------------------------------------------
create view monthly_totals with (security_invoker = true) as
select period, category_id, persona_id, sum(amount)::bigint as total
from transactions
group by period, category_id, persona_id;

-- ---------------------------------------------------------------------
-- Seguridad: RLS sin políticas + sin permisos para roles públicos
-- ---------------------------------------------------------------------
alter table personas        enable row level security;
alter table categories      enable row level security;
alter table transactions    enable row level security;
alter table budget_settings enable row level security;
alter table savings_goals   enable row level security;

revoke all on personas, categories, transactions, budget_settings, savings_goals, monthly_totals
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- Datos base (solo nombres, sin montos)
-- ---------------------------------------------------------------------
insert into personas (name, sort_order) values ('Ratón', 1), ('Ojitos', 2);

insert into budget_settings (valid_from) values ('2020-01-01');

-- Helper temporal para sembrar categorías
create function pg_temp.cat(p_type text, p_grupo text, p_name text, p_order int, p_subs text[], p_salary boolean default false)
returns void language plpgsql as $$
declare
  v_parent uuid;
  i int;
begin
  insert into categories (type, grupo, name, sort_order, is_salary)
  values (p_type, p_grupo, p_name, p_order, p_salary)
  returning id into v_parent;
  if p_subs is not null then
    for i in 1 .. array_length(p_subs, 1) loop
      insert into categories (parent_id, type, name, sort_order)
      values (v_parent, p_type, p_subs[i], i);
    end loop;
  end if;
end $$;

-- Ingresos
select pg_temp.cat('ingreso', null, 'Sueldo', 1, null, true);
select pg_temp.cat('ingreso', null, 'Extras', 2, array['Ingresos variables', 'Bonos']);
select pg_temp.cat('ingreso', null, 'Retorno de inversiones', 3, array['RDH', 'Acciones', 'Ahorros', 'Bitcoin', 'Dropshipping']);
select pg_temp.cat('ingreso', null, 'Otros ingresos', 4, array['Clases', 'Extras', 'Otros bonos']);

-- Gastos fijos
select pg_temp.cat('gasto', 'fijo', 'Departamento', 10,
  array['Teléfono / Wifi', 'Verduras', 'Luz', 'Agua', 'Gastos comunes', 'Arriendo', 'Supermercado']);

-- Gastos variables
select pg_temp.cat('gasto', 'variable', 'TC Ratón', 20,
  array['TC Scotia', 'TC Edwards', 'Líder', 'Dólares', 'Tasa mensual uso', 'Adelanto de cuotas', 'Otro']);
select pg_temp.cat('gasto', 'variable', 'TC Ojitos', 21, array['TC Chile', 'Compras', 'Spotify', 'Dólares', 'Otro']);
select pg_temp.cat('gasto', 'variable', 'Líneas de crédito', 22, array['Ratón', 'Ojitos', 'Intereses', 'Otro']);
select pg_temp.cat('gasto', 'variable', 'Salud', 23, array['Seguro complementario', 'Seguro de salud', 'Otro']);
select pg_temp.cat('gasto', 'variable', 'Auto', 24, array['Bencina', 'Seguro', 'Ahorro', 'Otro']);
select pg_temp.cat('gasto', 'variable', 'Educación', 25, array['Cursos', 'Título', 'Certificados']);
select pg_temp.cat('gasto', 'variable', 'Ocio', 26, array['Comida', 'Compras', 'Netflix + Prime', 'Otro']);
select pg_temp.cat('gasto', 'variable', 'Otros', 27,
  array['Muebles / Casa', 'Netflix', 'Comida pega Ratón', 'Transporte Ojitos', 'Farmacia / Doctor', 'Otro']);

-- Supervivencia: gasto real (solo para comparar; NO suma a egresos)
select pg_temp.cat('gasto', 'supervivencia', 'Supervivencia', 30, array['Comida', 'Gastos personales', 'Otro']);

-- Ahorro e inversiones (subcategoría = instrumento / cuenta)
select pg_temp.cat('ahorro', null, 'Ahorro', 40, array['Mercado Pago', 'General']);
select pg_temp.cat('inversion', null, 'Inversiones', 50, array['Bitcoin', 'Fintual', 'Mach', 'Acciones', 'Dropshipping']);
