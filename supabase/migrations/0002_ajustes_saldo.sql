-- =====================================================================
-- Ajustes de saldo de ahorro / inversión
-- Ejecutar en Supabase > SQL Editor. Se puede correr más de una vez sin problema.
--
-- Un "ajuste" corrige el saldo acumulado de un instrumento (ej. se usó el ahorro
-- para comprar un auto) SIN alterar el resumen de ningún mes: no suma a ahorro,
-- egresos ni delta. Solo cuenta para el saldo acumulado en la pantalla Ahorro.
-- =====================================================================

alter table transactions add column if not exists is_adjustment boolean not null default false;

-- Los totales mensuales (resumen, tendencias, vista general) excluyen los ajustes
create or replace view monthly_totals with (security_invoker = true) as
select period, category_id, persona_id, sum(amount)::bigint as total
from transactions
where not is_adjustment
group by period, category_id, persona_id;

revoke all on monthly_totals from anon, authenticated;
