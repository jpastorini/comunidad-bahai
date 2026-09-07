-- ═════════════════════════════════════════════════════════════════
-- 048 · Lectura de comunicados: quién vio y quién confirmó cada uno.
--
-- La Asamblea necesita saber, por comunicado, a quién NO le llegó,
-- para contactarlo por otro medio. Hasta ahora lo único que existía
-- era `profiles.comunicados_seen_at` (abrió la pantalla Comunicados),
-- que apaga el punto rojo pero no dice nada de un comunicado puntual.
--
-- Dos marcas por (persona, comunicado), con significado distinto:
--   · seen_at      → automática. La tarjeta estuvo en pantalla un par
--                    de segundos. Cobertura sin esfuerzo.
--   · confirmed_at → explícita. Tocó "Enterado/a". La Asamblea decide
--                    por comunicado si lo pide (`ask_confirmation`).
-- El error caro es el falso positivo (el informe dice que leyó y no
-- leyó: nadie lo llama). Por eso el "visto" no se disfraza de leído y
-- lo importante lleva confirmación.
--
-- Además `profiles.last_seen_at`: la última vez que la persona abrió la
-- app, escrita como máximo una vez por día. En la lista de "no vieron"
-- separa a quien no entra nunca (un llamado) de quien entró ayer y no
-- llegó (un recordatorio).
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. El comunicado declara si pide confirmación ─────────────────

alter table public.messages
  add column if not exists ask_confirmation boolean not null default false;

-- ─── 2. Última vez en la app ───────────────────────────────────────
--
-- Preferencia/telemetría personal: no es privilegiada, así que
-- `profiles_update_self` (039/047) ya la deja escribir al propio
-- usuario sin tocar la policy.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- ─── 3. Lecturas ───────────────────────────────────────────────────

create table if not exists public.message_reads (
  message_id   uuid not null references public.messages(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  locality_id  uuid references public.localities(id) on delete cascade,
  seen_at      timestamptz not null default now(),
  confirmed_at timestamptz,
  primary key (message_id, profile_id)
);

create index if not exists message_reads_profile_idx
  on public.message_reads (profile_id);

-- La localidad la fija el trigger compartido (012) a partir del perfil
-- de quien escribe; el cliente no la manda.
drop trigger if exists set_locality_message_reads on public.message_reads;
create trigger set_locality_message_reads
  before insert on public.message_reads
  for each row execute function public.set_locality_from_auth();

alter table public.message_reads enable row level security;

-- Cada persona escribe SOLO su fila, y solo sobre un comunicado que
-- puede leer: el `exists` corre con la RLS de `messages` del que
-- escribe, así que un Amigo de la Fe no puede marcar leído un
-- comunicado "solo creyentes" que la base no le muestra.
drop policy if exists "message_reads_insert_self" on public.message_reads;
create policy "message_reads_insert_self" on public.message_reads
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_id)
  );

drop policy if exists "message_reads_update_self" on public.message_reads;
create policy "message_reads_update_self" on public.message_reads
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Lee: la propia persona (para el badge "Nuevo" y el estado del botón)
-- y la Asamblea de su localidad (el informe). El admin nacional ve todo.
drop policy if exists "message_reads_select" on public.message_reads;
create policy "message_reads_select" on public.message_reads
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- ─── 4. Realtime para el informe en vivo ───────────────────────────
--
-- Mismo molde que chat_messages (028): sin la tabla en la publicación
-- no llega ningún evento, y REPLICA IDENTITY FULL deja que la RLS
-- evalúe la fila entera en cada evento.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reads'
  ) then
    alter publication supabase_realtime add table public.message_reads;
  end if;
end
$$;

alter table public.message_reads replica identity full;
