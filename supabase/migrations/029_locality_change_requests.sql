-- ═════════════════════════════════════════════════════════════════
-- Solicitudes de cambio de localidad.
--
-- Flujo:
--   - Primer ingreso (sin localidad): directo, sin aprobación.
--   - Cambio (ya tiene localidad A → quiere B): crea una solicitud
--     'pending'. El usuario sigue viendo A hasta que la Asamblea de B
--     aprueba. La Asamblea DESTINO (B) decide.
--
-- Estados: pending → approved | rejected | cancelled
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.locality_change_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalizamos nombre/email para que la Asamblea destino los vea
  -- aunque el perfil todavía pertenezca a la localidad de origen.
  user_name text not null,
  user_email text,
  from_locality_id uuid references public.localities(id) on delete set null,
  to_locality_id uuid not null references public.localities(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lcr_to_locality_status_idx
  on public.locality_change_requests (to_locality_id, status);
create index if not exists lcr_user_idx
  on public.locality_change_requests (user_id, created_at desc);

-- Como máximo una solicitud pendiente por usuario.
create unique index if not exists lcr_one_pending_per_user
  on public.locality_change_requests (user_id)
  where status = 'pending';

alter table public.locality_change_requests enable row level security;

-- El usuario ve sus propias solicitudes.
drop policy if exists "lcr_select_own" on public.locality_change_requests;
create policy "lcr_select_own" on public.locality_change_requests
  for select using (user_id = auth.uid());

-- La Asamblea DESTINO ve las solicitudes dirigidas a su localidad.
drop policy if exists "lcr_select_dest_admin" on public.locality_change_requests;
create policy "lcr_select_dest_admin" on public.locality_change_requests
  for select using (
    public.is_admin(auth.uid())
    and to_locality_id = public.current_locality_id()
  );

-- Admin nacional ve todo.
drop policy if exists "lcr_select_national" on public.locality_change_requests;
create policy "lcr_select_national" on public.locality_change_requests
  for select using (public.is_national_admin(auth.uid()));

-- El usuario crea su propia solicitud.
drop policy if exists "lcr_insert_own" on public.locality_change_requests;
create policy "lcr_insert_own" on public.locality_change_requests
  for insert with check (user_id = auth.uid());

-- El usuario actualiza su propia solicitud (para cancelarla).
drop policy if exists "lcr_update_own" on public.locality_change_requests;
create policy "lcr_update_own" on public.locality_change_requests
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- La Asamblea DESTINO decide (aprobar / rechazar).
drop policy if exists "lcr_update_dest_admin" on public.locality_change_requests;
create policy "lcr_update_dest_admin" on public.locality_change_requests
  for update using (
    public.is_admin(auth.uid())
    and to_locality_id = public.current_locality_id()
  )
  with check (
    public.is_admin(auth.uid())
    and to_locality_id = public.current_locality_id()
  );
