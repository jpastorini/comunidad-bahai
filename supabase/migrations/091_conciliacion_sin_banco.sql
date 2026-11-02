-- 091 · Conciliación: movimientos del libro que no pasan por el banco
--
-- La 061 permite descartar una LÍNEA del extracto que no lleva asiento
-- (una devolución, un movimiento de otra cuenta). Faltaba lo simétrico: un
-- MOVIMIENTO del libro que no tiene ni va a tener línea en el extracto. El
-- caso que lo pidió (2026-11-02): corregir el saldo de apertura de Cuenta
-- Prex, que estaba $ 285,12 de más. Con los meses cerrados (054) la
-- corrección va con fecha de hoy, y como no es plata que entró ni salió,
-- la conciliación del mes la reclamaba para siempre como "está en el libro
-- y no en el banco".
--
-- Tabla aparte y no columnas en `treasury_entries` a propósito: el guardián
-- de la 054 congela los movimientos de un mes cerrado, y marcar uno de esos
-- (una comisión que el banco nunca cobró, ya revertida) no cambia el libro.
-- El motivo es obligatorio: lo va a leer el auditor.

create table if not exists public.treasury_statement_offbank (
  entry_id uuid primary key references public.treasury_entries(id) on delete cascade,
  locality_id uuid not null references public.localities(id) on delete cascade,
  reason text not null check (length(trim(reason)) > 0),
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz not null default now()
);

drop trigger if exists set_locality_treasury_statement_offbank on public.treasury_statement_offbank;
create trigger set_locality_treasury_statement_offbank
  before insert on public.treasury_statement_offbank
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_statement_offbank enable row level security;

drop policy if exists "treasury_statement_offbank_tag_all" on public.treasury_statement_offbank;
create policy "treasury_statement_offbank_tag_all" on public.treasury_statement_offbank
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );
