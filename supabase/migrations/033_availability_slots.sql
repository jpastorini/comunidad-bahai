-- ═════════════════════════════════════════════════════════════════
-- Disponibilidad horaria de la Asamblea (para coordinar reuniones).
--
-- Cada miembro de la Asamblea Local (role='admin') marca en qué
-- franjas de la semana puede reunirse. Luego la Secretaría ve un
-- consolidado (heatmap) para elegir el mejor horario de convocatoria.
--
-- Modelo de datos: UNA fila por celda marcada (día × hora). La ausencia
-- de fila = "No puedo", así que la tabla queda rala. Solo guardamos los
-- dos niveles "positivos":
--   level = 2  → Disponible
--   level = 1  → A veces puedo
--
-- weekday: 0=Lunes … 6=Domingo (semana arranca en lunes, es-UY).
-- hour:    bloque de 1 h identificado por su hora de inicio (8 = 08:00–09:00).
--
-- event_date:
--   NULL        → patrón SEMANAL RECURRENTE (Fase 1, lo que se usa hoy).
--   fecha       → ajuste para una reunión PUNTUAL (Fase 2, sin UI todavía).
-- La columna ya queda en el esquema para no migrar de nuevo en Fase 2.
--
-- CONFIDENCIALIDAD: igual que assembly_tasks — solo los admins de la
-- propia localidad ven/gestionan; el admin nacional tiene SELECT de
-- supervisión (solo lectura). Los miembros comunes NO acceden.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.availability_slots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  locality_id uuid references public.localities(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  hour smallint not null check (hour between 0 and 23),
  level smallint not null check (level in (1, 2)),
  event_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una sola marca por (usuario, día, hora) en el patrón recurrente…
create unique index if not exists availability_recurring_uniq
  on public.availability_slots (user_id, weekday, hour)
  where event_date is null;

-- …y una sola por (usuario, fecha, hora) en los ajustes puntuales.
create unique index if not exists availability_override_uniq
  on public.availability_slots (user_id, event_date, hour)
  where event_date is not null;

-- El consolidado barre por localidad + tipo (recurrente / por fecha).
create index if not exists availability_locality_idx
  on public.availability_slots (locality_id, event_date);

-- ─── Auto-relleno de locality_id desde el perfil del usuario ──────
-- Mismo patrón que el resto de las tablas multi-tenant: si la fila se
-- inserta sin locality_id, lo toma del perfil del autor.
create or replace function public.set_availability_locality()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.locality_id is null then
    select locality_id into new.locality_id
    from public.profiles
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_availability_locality_trg on public.availability_slots;
create trigger set_availability_locality_trg
  before insert on public.availability_slots
  for each row execute function public.set_availability_locality();

-- ─── RLS ──────────────────────────────────────────────────────────
alter table public.availability_slots enable row level security;

-- Ver: admins de la propia localidad (para el consolidado del equipo) +
-- admin nacional (supervisión, solo lectura).
drop policy if exists "availability_select" on public.availability_slots;
create policy "availability_select" on public.availability_slots
  for select using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- Escribir: cada admin gestiona SOLO sus propias franjas, en su localidad.
drop policy if exists "availability_write" on public.availability_slots;
create policy "availability_write" on public.availability_slots
  for all
  using (
    user_id = auth.uid()
    and public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    user_id = auth.uid()
    and public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  );
