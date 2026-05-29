-- ═════════════════════════════════════════════════════════════════
-- Tareas de la Asamblea (tablero tipo "tickets", privado de la Asamblea).
--
-- Parte del "espacio de trabajo de la Asamblea": un lugar donde la
-- Asamblea Local lista las tareas que salen de su consulta y sigue el
-- avance. Las tareas se cargan a mano (Fase A) y, más adelante, se
-- importan automáticamente desde el acta de la reunión (Fase B).
--
-- CONFIDENCIALIDAD: las actas y tareas de la Asamblea son internas de
-- sus miembros (role='admin'), NO de toda la comunidad. La RLS exige
-- is_admin() para ver/gestionar, así que un miembro común no las ve.
--
-- El campo `scope` ('local'|'national') queda preparado para la Fase C
-- (tablero Nacional separado). Por ahora solo se usa 'local'.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── Registro del acta de origen (solo metadata: título + fecha) ──
create table if not exists public.assembly_actas (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid references public.localities(id) on delete cascade,
  scope text not null default 'local' check (scope in ('local', 'national')),
  title text not null,
  meeting_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assembly_actas_locality_idx
  on public.assembly_actas (locality_id, meeting_date desc);

-- ─── Tareas ───────────────────────────────────────────────────────
create table if not exists public.assembly_tasks (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid references public.localities(id) on delete cascade,
  scope text not null default 'local' check (scope in ('local', 'national')),
  acta_id uuid references public.assembly_actas(id) on delete set null,
  description text not null,
  assignee text,
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  due_date date,
  status text not null default 'por_hacer'
    check (status in ('por_hacer', 'en_progreso', 'hecha')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assembly_tasks_locality_status_idx
  on public.assembly_tasks (locality_id, status);
create index if not exists assembly_tasks_acta_idx
  on public.assembly_tasks (acta_id);

-- ─── RLS ──────────────────────────────────────────────────────────
-- Modelo Fase A (scope='local'):
--   • Ven/gestionan: admins (role='admin') de la propia localidad.
--   • Admin nacional: SELECT de todas las localidades (supervisión),
--     SIN permiso de escritura (es de solo lectura desde el lado nacional).
--   • Miembros comunes: sin acceso (confidencial).
alter table public.assembly_actas enable row level security;
alter table public.assembly_tasks enable row level security;

-- assembly_actas
drop policy if exists "assembly_actas_select" on public.assembly_actas;
create policy "assembly_actas_select" on public.assembly_actas
  for select using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "assembly_actas_write" on public.assembly_actas;
create policy "assembly_actas_write" on public.assembly_actas
  for all
  using (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
    and scope = 'local'
  )
  with check (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
    and scope = 'local'
  );

-- assembly_tasks
drop policy if exists "assembly_tasks_select" on public.assembly_tasks;
create policy "assembly_tasks_select" on public.assembly_tasks
  for select using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "assembly_tasks_write" on public.assembly_tasks;
create policy "assembly_tasks_write" on public.assembly_tasks
  for all
  using (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
    and scope = 'local'
  )
  with check (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
    and scope = 'local'
  );
