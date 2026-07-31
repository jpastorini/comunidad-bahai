-- ═════════════════════════════════════════════════════════════════
-- Link de invitación por localidad.
--
-- Cada Asamblea tiene UN link reusable (/invitacion/<token>) que puede
-- imprimir como QR o reenviar por WhatsApp. Quien lo abre ve una
-- bienvenida con el nombre de la comunidad y, al ingresar por primera
-- vez, queda incorporado a esa localidad AUTOMÁTICAMENTE (sin pasar por
-- /seleccionar-localidad ni aprobación manual: el link lo generó la
-- propia Asamblea, abrirlo equivale a estar invitado).
--
-- El token vive en tabla propia (no como columna de `localities`)
-- porque las localidades son legibles por cualquier usuario autenticado
-- y el token NO debe serlo: con él cualquiera se auto-incorpora. La RLS
-- lo limita a los admins de la propia localidad; la página pública de
-- invitación lo resuelve server-side con la service-role key.
--
-- Regenerar el link = nuevo token (el anterior deja de funcionar).
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.locality_invites (
  locality_id uuid primary key references public.localities(id) on delete cascade,
  -- 64 hex chars aleatorios (dos uuid v4 sin guiones).
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  regenerated_at timestamptz,
  regenerated_by uuid references auth.users(id) on delete set null
);

alter table public.locality_invites enable row level security;

-- Solo los admins locales de ESA localidad ven/gestionan su invitación.
drop policy if exists locality_invites_select on public.locality_invites;
create policy locality_invites_select on public.locality_invites
  for select to authenticated
  using (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  );

drop policy if exists locality_invites_insert on public.locality_invites;
create policy locality_invites_insert on public.locality_invites
  for insert to authenticated
  with check (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  );

drop policy if exists locality_invites_update on public.locality_invites;
create policy locality_invites_update on public.locality_invites
  for update to authenticated
  using (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- Sembrar la invitación de las localidades existentes (las nuevas se
-- crean lazy desde el panel al abrir /admin/miembros).
insert into public.locality_invites (locality_id)
select id from public.localities
on conflict (locality_id) do nothing;
