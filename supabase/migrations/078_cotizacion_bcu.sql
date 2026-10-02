-- 078 — La cotización del BCU en las transferencias entre monedas.
--
-- Una transferencia de una cuenta en pesos a una en dólares (o al revés)
-- son dos asientos atados por `transfer_group_id`, y el tipo de cambio
-- quedaba implícito en los dos montos: el que aplicó el banco o Prex.
-- Desde acá cada pata guarda además la cotización de referencia del Banco
-- Central del Uruguay (dólar billete, último cierre en o antes de la fecha
-- del movimiento), que el formulario trae sola.
--
-- Los montos siguen siendo los que pasaron de verdad (los que muestra el
-- extracto y concilian, 061): la cotización BCU es el dato oficial con
-- que se compara y con que se expresa en pesos, no reemplaza al monto.
--
-- Columnas nuevas, nullable: los movimientos viejos y los de una sola
-- moneda quedan en NULL. El guardián de la 054 congela un mes cerrado
-- igual que antes; acá no hay nada que tocar.
--
-- Correr una vez en el SQL Editor de Supabase.

alter table public.treasury_entries
  add column if not exists bcu_rate numeric(12, 4)
    check (bcu_rate is null or bcu_rate > 0),
  add column if not exists bcu_rate_date date;

comment on column public.treasury_entries.bcu_rate is
  'Pesos por dólar, dólar billete del BCU (código 2225) al cierre de bcu_rate_date. Solo en transferencias entre monedas.';
comment on column public.treasury_entries.bcu_rate_date is
  'Fecha del cierre del BCU usado: el último día hábil en o antes de entry_date.';
