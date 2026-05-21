-- Compromisos mensuales de aporte al Fondo Local.
--
-- - Un miembro puede tener un solo compromiso vigente (PK = user_id).
-- - Solo el dueño puede leer/escribir su propio compromiso.
-- - El tesorero (has_treasury_tag) puede leer todos pero no editarlos
--   por respeto a la voluntad del miembro.
-- - "want_reminder" señaliza si el miembro quiere que lo contacten
--   cuando haya un retraso en el aporte.
--
-- Run once in the Supabase SQL Editor.

create table if not exists public.treasury_commitments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  amount numeric not null check (amount > 0),
  want_reminder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treasury_commitments_updated_idx
  on public.treasury_commitments (updated_at desc);

alter table public.treasury_commitments enable row level security;

-- Dueño: lectura/escritura completa de su propio compromiso.
drop policy if exists "tc_owner_select" on public.treasury_commitments;
create policy "tc_owner_select" on public.treasury_commitments
  for select using (user_id = auth.uid());

drop policy if exists "tc_owner_insert" on public.treasury_commitments;
create policy "tc_owner_insert" on public.treasury_commitments
  for insert with check (user_id = auth.uid());

drop policy if exists "tc_owner_update" on public.treasury_commitments;
create policy "tc_owner_update" on public.treasury_commitments
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "tc_owner_delete" on public.treasury_commitments;
create policy "tc_owner_delete" on public.treasury_commitments
  for delete using (user_id = auth.uid());

-- Tesorero (tag): lectura de todos los compromisos.
drop policy if exists "tc_treasurer_select" on public.treasury_commitments;
create policy "tc_treasurer_select" on public.treasury_commitments
  for select using (public.has_treasury_tag(auth.uid()));

-- Trigger para mantener updated_at.
create or replace function public.touch_treasury_commitment_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists treasury_commitments_touch on public.treasury_commitments;
create trigger treasury_commitments_touch
  before update on public.treasury_commitments
  for each row execute function public.touch_treasury_commitment_updated_at();
