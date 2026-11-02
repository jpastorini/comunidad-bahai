-- 093 · Conciliación: la diferencia aceptada de un grupo
--
-- Un grupo de la conciliación (089) son líneas del extracto y movimientos
-- del libro atados entre sí. Cuando no suman lo mismo, la pantalla lo deja
-- abierto para siempre, y a veces la diferencia ya está explicada y no hay
-- nada más que cargar ni vincular. El caso que lo pidió (2026-11-02): desde
-- octubre de 2026 el export de Prex dice lo PEDIDO en una transferencia a
-- otro banco, no lo debitado, así que el libro tiene la transferencia más
-- la comisión ($ 44,26) y la línea, solo la transferencia.
--
-- La comisión oculta de Prex la reconoce el código solo (una regla, sin
-- guardar nada). Esto es para el resto: el tesorero acepta la diferencia de
-- un grupo con un motivo, que va a leer el auditor. Se guarda en la primera
-- línea del grupo, y vale mientras la diferencia del grupo siga siendo esa:
-- si después se vincula o desvincula algo y la cuenta cambia, la aceptación
-- deja de valer sola, sin que nadie tenga que acordarse de quitarla.
--
-- Columnas en las líneas y no tabla aparte: las líneas no las congela el
-- guardián de la 054 (son del extracto, no del libro), y la RLS de la 061
-- ya es la correcta.

alter table public.treasury_statement_lines
  add column if not exists accepted_diff numeric(14, 2),
  add column if not exists accept_reason text,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_at timestamptz;

alter table public.treasury_statement_lines
  drop constraint if exists treasury_statement_lines_accept_reason_chk;
alter table public.treasury_statement_lines
  add constraint treasury_statement_lines_accept_reason_chk check (
    (accepted_diff is null and accept_reason is null)
    or (accepted_diff is not null and accepted_diff <> 0 and length(trim(accept_reason)) > 0)
  );
