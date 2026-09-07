-- ═════════════════════════════════════════════════════════════════
-- 051 · Encuestas: un comunicado puede llevar una pregunta para votar.
--
-- Como las encuestas de WhatsApp: una pregunta, de 2 a 10 opciones,
-- se vota tocando. La encuesta NO es una entidad aparte del comunicado:
-- cuelga de `messages` y hereda todo lo que ya existe —audiencia ("solo
-- creyentes" o toda la comunidad), push al publicar, el "visto" de la
-- 048 y el informe de lectura—. Una pregunta por comunicado.
--
-- Tres reglas de producto, decididas con el usuario:
--
--   · Se vota UNA sola vez y no se cambia. Por eso el voto va por la
--     RPC `cast_vote()` y no por INSERT directo: la función es la única
--     que escribe, comprueba que la encuesta esté abierta y que la
--     persona no haya votado, y lo hace en una transacción.
--   · El anonimato es una GARANTÍA, no una policy. En una encuesta
--     anónima el voto se guarda sin `profile_id` y sin hora, y en una
--     tabla aparte (`poll_participants`) se anota solamente QUE la
--     persona votó, para impedir el doble voto. No hay fila que una a
--     la persona con su opción, así que nadie —ni con acceso directo a
--     la base— puede reconstruirlo. Sacar el voto de la tabla de
--     participantes es justamente lo que se pierde al no poder cambiar
--     el voto, y es el precio del anonimato.
--   · Los totales los ve todo el que puede leer el comunicado, después
--     de votar o al cierre; los NOMBRES de quién votó qué los ve solo
--     la Asamblea, y solo en encuestas no anónimas.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. La pregunta ────────────────────────────────────────────────

create table if not exists public.message_polls (
  id             uuid primary key default gen_random_uuid(),
  message_id     uuid not null unique references public.messages(id) on delete cascade,
  locality_id    uuid references public.localities(id) on delete cascade,
  question       text not null,
  allow_multiple boolean not null default false,
  anonymous      boolean not null default false,
  -- Cierre automático (opcional) y cierre a mano por la Asamblea. La
  -- encuesta está abierta si `closed_at` es null y `closes_at` no pasó.
  closes_at      timestamptz,
  closed_at      timestamptz,
  created_at     timestamptz not null default now()
);

drop trigger if exists set_locality_message_polls on public.message_polls;
create trigger set_locality_message_polls
  before insert on public.message_polls
  for each row execute function public.set_locality_from_auth();

create table if not exists public.poll_options (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.message_polls(id) on delete cascade,
  position  int  not null default 0,
  label     text not null
);

create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

-- ─── 2. Quién votó (sin qué) ───────────────────────────────────────

create table if not exists public.poll_participants (
  poll_id     uuid not null references public.message_polls(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  locality_id uuid references public.localities(id) on delete cascade,
  voted_at    timestamptz not null default now(),
  primary key (poll_id, profile_id)
);

-- ─── 3. Los votos ──────────────────────────────────────────────────
--
-- `profile_id` es NULL en las encuestas anónimas. No hay `created_at`
-- a propósito: con la hora se podría cruzar contra `voted_at` de los
-- participantes y deshacer el anonimato.

create table if not exists public.poll_votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.message_polls(id) on delete cascade,
  option_id   uuid not null references public.poll_options(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete cascade,
  locality_id uuid references public.localities(id) on delete cascade
);

create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id, option_id);

-- ─── 4. RLS ────────────────────────────────────────────────────────

alter table public.message_polls     enable row level security;
alter table public.poll_options      enable row level security;
alter table public.poll_participants enable row level security;
alter table public.poll_votes        enable row level security;

-- La pregunta y las opciones existen para quien puede leer el
-- comunicado: el `exists` corre con la RLS de `messages` del lector
-- (localidad + audiencia), igual que `feast_news_items` con `feasts`.
drop policy if exists "message_polls_select" on public.message_polls;
create policy "message_polls_select" on public.message_polls
  for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));

drop policy if exists "message_polls_admin_write" on public.message_polls;
create policy "message_polls_admin_write" on public.message_polls
  for all to authenticated
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "poll_options_select" on public.poll_options;
create policy "poll_options_select" on public.poll_options
  for select to authenticated
  using (exists (select 1 from public.message_polls p where p.id = poll_id));

drop policy if exists "poll_options_admin_write" on public.poll_options;
create policy "poll_options_admin_write" on public.poll_options
  for all to authenticated
  using (
    exists (
      select 1 from public.message_polls p
      where p.id = poll_id
        and (
          (public.is_admin(auth.uid()) and p.locality_id = public.current_locality_id())
          or public.is_national_admin(auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.message_polls p
      where p.id = poll_id
        and (
          (public.is_admin(auth.uid()) and p.locality_id = public.current_locality_id())
          or public.is_national_admin(auth.uid())
        )
    )
  );

-- Participantes: la propia persona (para saber que ya votó) y la
-- Asamblea de la localidad. Sin policy de insert: solo escribe la RPC.
drop policy if exists "poll_participants_select" on public.poll_participants;
create policy "poll_participants_select" on public.poll_participants
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- Votos: la propia persona ve los suyos (solo existen con nombre en las
-- encuestas no anónimas) y la Asamblea ve las filas de su localidad
-- —que en una encuesta anónima no traen a nadie—. Los totales para la
-- comunidad salen por `poll_results()`, no por acá. Sin insert directo.
drop policy if exists "poll_votes_select" on public.poll_votes;
create policy "poll_votes_select" on public.poll_votes
  for select to authenticated
  using (
    (profile_id is not null and profile_id = auth.uid())
    or (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- ─── 5. ¿Puede esta persona leer esta encuesta? ────────────────────
--
-- Las dos funciones de abajo son security definer y saltan la RLS, así
-- que la regla de `messages_select_scope` (047) se repite acá tal cual:
-- misma localidad y, si el comunicado es "solo creyentes", ser bahá'í.

create or replace function public.can_read_poll(p_poll_id uuid, p_uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from public.message_polls p
    join public.messages m on m.id = p.message_id
    where p.id = p_poll_id
      and (
        (
          (m.locality_id is null or m.locality_id = (select locality_id from public.profiles where id = p_uid))
          and (m.audience = 'todos' or public.is_bahai(p_uid))
        )
        or public.is_national_admin(p_uid)
      )
  );
$$;

-- ─── 6. Totales ────────────────────────────────────────────────────
--
-- Una fila por (encuesta, opción) con su conteo, y cuántas personas
-- votaron. Solo números: nunca un nombre. Las encuestas que la persona
-- no puede leer no devuelven nada.

create or replace function public.poll_results(p_poll_ids uuid[])
returns table (
  poll_id      uuid,
  option_id    uuid,
  votes        int,
  participants int
)
language sql security definer stable
set search_path = public
as $$
  select
    o.poll_id,
    o.id as option_id,
    (select count(*)::int from public.poll_votes v where v.option_id = o.id) as votes,
    (select count(*)::int from public.poll_participants pp where pp.poll_id = o.poll_id) as participants
  from public.poll_options o
  where o.poll_id = any (p_poll_ids)
    and public.can_read_poll(o.poll_id, auth.uid());
$$;

grant execute on function public.poll_results(uuid[]) to authenticated;

-- ─── 7. Votar ──────────────────────────────────────────────────────
--
-- La única puerta de escritura. Todo o nada:
--   1. la encuesta existe y la persona puede leerla;
--   2. está abierta;
--   3. las opciones son de esta encuesta, hay al menos una y, si no
--      admite varias, es exactamente una;
--   4. la persona no votó (la PK de participantes es el candado: dos
--      toques simultáneos no pasan los dos);
--   5. se anota la participación y los votos —sin nombre si es anónima—
--   6. y votar cuenta como haber visto el comunicado (048).

create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_poll public.message_polls%rowtype;
  v_loc  uuid;
  v_n    int;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if not public.can_read_poll(p_poll_id, v_uid) then
    raise exception 'Encuesta no disponible' using errcode = '42501';
  end if;

  select * into v_poll from public.message_polls where id = p_poll_id for update;

  if v_poll.closed_at is not null or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'La votación está cerrada' using errcode = 'P0001';
  end if;

  -- Sin repetidos.
  select count(distinct x) into v_n from unnest(p_option_ids) as x;
  if v_n = 0 then
    raise exception 'Elegí al menos una opción' using errcode = 'P0001';
  end if;
  if not v_poll.allow_multiple and v_n <> 1 then
    raise exception 'Esta encuesta admite una sola opción' using errcode = 'P0001';
  end if;
  if v_n <> (
    select count(*) from public.poll_options o
    where o.poll_id = p_poll_id and o.id = any (p_option_ids)
  ) then
    raise exception 'Opción inválida' using errcode = 'P0001';
  end if;

  select locality_id into v_loc from public.profiles where id = v_uid;

  begin
    insert into public.poll_participants (poll_id, profile_id, locality_id)
    values (p_poll_id, v_uid, v_loc);
  exception when unique_violation then
    raise exception 'Ya votaste en esta encuesta' using errcode = '23505';
  end;

  insert into public.poll_votes (poll_id, option_id, profile_id, locality_id)
  select p_poll_id, x, case when v_poll.anonymous then null else v_uid end, v_loc
  from unnest(p_option_ids) as x
  group by x;

  insert into public.message_reads (message_id, profile_id, locality_id)
  values (v_poll.message_id, v_uid, v_loc)
  on conflict (message_id, profile_id) do nothing;
end;
$$;

grant execute on function public.cast_vote(uuid, uuid[]) to authenticated;

-- ─── 8. Realtime para el informe en vivo ───────────────────────────
--
-- Mismo molde que `message_reads` (048). Los eventos de `poll_votes`
-- llegan a la Asamblea de la localidad (su policy de select); en una
-- encuesta anónima la fila no trae a nadie, así que no cuenta nada
-- que la pantalla no muestre igual.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_votes'
  ) then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
end
$$;

alter table public.poll_votes replica identity full;
