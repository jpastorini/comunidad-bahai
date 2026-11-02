-- 089 · Conciliación: varios cobros contra un mismo movimiento del libro
--
-- La 061 dijo "un movimiento del libro cierra contra UNA línea del
-- extracto" (`unique (entry_id)`). Con Prex y el BROU es cierto: un giro es
-- una línea. Con el Point de Mercado Pago no: en la Fiesta entran varios
-- cobros con tarjeta, el tesorero los registra como UN aporte (la canasta,
-- un recibo) y una sola comisión del día, y Mercado Pago lista cada cobro
-- aparte con su neto. Ese día cierra como GRUPO: N líneas contra M
-- movimientos que suman lo mismo.
--
-- El par sigue siendo una fila (línea, movimiento); un grupo son todas las
-- combinaciones de sus líneas y sus movimientos, y la pantalla arma el
-- grupo como la componente conexa de esos pares. Lo único que se impide es
-- repetir el mismo par.

alter table public.treasury_statement_matches
  drop constraint if exists treasury_statement_matches_entry_id_key;

alter table public.treasury_statement_matches
  drop constraint if exists treasury_statement_matches_line_entry_key;
alter table public.treasury_statement_matches
  add constraint treasury_statement_matches_line_entry_key unique (line_id, entry_id);

create index if not exists treasury_statement_matches_entry_idx
  on public.treasury_statement_matches (entry_id);

-- Cómo cerró: suma el grupo del día.
alter table public.treasury_statement_matches
  drop constraint if exists treasury_statement_matches_kind_check;
alter table public.treasury_statement_matches
  add constraint treasury_statement_matches_kind_check
  check (kind in ('exacto', 'comision', 'suma', 'grupo', 'manual'));
