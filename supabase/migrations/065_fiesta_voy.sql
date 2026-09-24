-- 065 · "Voy" en la Fiesta de los 19 Días, y su recordatorio
--
-- Decidido con el usuario el 2026-09-24:
--   · La persona solo dice "Voy" (y lo puede deshacer). No hay "No puedo".
--   · Quién va y cuántos son lo ve SOLO la Asamblea. El creyente ve su
--     propia respuesta y nada más; ni siquiera el total.
--   · Se confirma mientras la Fiesta está publicada y todavía no empezó.
--   · El día de la celebración, a las 8:00, sale un recordatorio a toda la
--     comunidad de creyentes, confirmada o no.
--
-- Una Fiesta puede tener varios lugares (feast_locations): con más de uno,
-- la persona elige adónde va. Sin lugares cargados, location_id queda NULL.

create table if not exists public.feast_rsvps (
  feast_id uuid not null references public.feasts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Si la Asamblea borra ese lugar, la confirmación sigue valiendo para la
  -- Fiesta; solo pierde a qué casa.
  location_id uuid references public.feast_locations(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (feast_id, user_id)
);

create index if not exists feast_rsvps_feast_idx on public.feast_rsvps (feast_id);

alter table public.feast_rsvps enable row level security;

-- Leer: la propia fila, o la Asamblea las de las Fiestas de su localidad.
drop policy if exists "feast_rsvps_select_scope" on public.feast_rsvps;
create policy "feast_rsvps_select_scope" on public.feast_rsvps
  for select using (
    user_id = auth.uid()
    or (
      public.is_admin(auth.uid())
      and exists (
        select 1 from public.feasts f
        where f.id = feast_id
          and f.locality_id = public.current_locality_id()
      )
    )
  );

-- Escribir: solo la propia fila, solo un creyente (un Amigo/a de la Fe no
-- tiene Fiesta, 047), solo sobre una Fiesta PUBLICADA que puede ver (el
-- exists corre con la RLS de feasts, que ya acota localidad y condición),
-- y con un lugar que sea de esa misma Fiesta. Una vez iniciada, la lista
-- queda congelada: ya no se confirma, cambia ni retira.
drop policy if exists "feast_rsvps_insert_self" on public.feast_rsvps;
create policy "feast_rsvps_insert_self" on public.feast_rsvps
  for insert with check (
    user_id = auth.uid()
    and public.is_bahai(auth.uid())
    and exists (
      select 1 from public.feasts f
      where f.id = feast_id and f.status = 'published'
    )
    and (
      location_id is null
      or exists (
        select 1 from public.feast_locations l
        where l.id = location_id and l.feast_id = feast_rsvps.feast_id
      )
    )
  );

drop policy if exists "feast_rsvps_update_self" on public.feast_rsvps;
create policy "feast_rsvps_update_self" on public.feast_rsvps
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.feasts f
      where f.id = feast_id and f.status = 'published'
    )
    and (
      location_id is null
      or exists (
        select 1 from public.feast_locations l
        where l.id = location_id and l.feast_id = feast_rsvps.feast_id
      )
    )
  );

drop policy if exists "feast_rsvps_delete_self" on public.feast_rsvps;
create policy "feast_rsvps_delete_self" on public.feast_rsvps
  for delete using (
    user_id = auth.uid()
    and exists (
      select 1 from public.feasts f
      where f.id = feast_id and f.status = 'published'
    )
  );

-- El recordatorio del día sale una sola vez por Fiesta, aunque el cron se
-- reintente. Mismo molde que calendar_events.reminder_sent_at (030).
alter table public.feasts
  add column if not exists reminder_sent_at timestamptz;
