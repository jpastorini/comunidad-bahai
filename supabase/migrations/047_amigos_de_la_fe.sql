-- ═════════════════════════════════════════════════════════════════
-- 047 — Amigos de la Fe: la app también para quien no es bahá'í
--
-- Hasta acá la comunidad tenía un solo tipo de persona: el creyente
-- (role='member'). Esta migración suma un segundo tipo, el "Amigo/a de
-- la Fe", que usa la misma app menos dos zonas:
--
--   1. Tesorería: ni el tablero, ni el chat con el tesorero, ni "Mis
--      aportes", ni los informes.
--   2. La Fiesta de los 19 Días: ni en el calendario, ni la pantalla
--      de Fiestas, ni las fotos de la Fiesta, ni los comunicados que la
--      Asamblea marque "solo creyentes" (la invitación a la Fiesta).
--
-- La regla es de confidencialidad, no de cosmética, así que vive acá:
-- en la RLS. La UI solo esconde lo que la base ya no devolvería.
--
-- El dato es `profiles.is_bahai` (default true: nadie cambia de
-- condición por correr esto). Lo asigna la Asamblea, igual que un tag,
-- así que queda congelado para el propio usuario (policy
-- profiles_update_self, 039) y solo lo escribe un admin o el link de
-- invitación "para amigos" vía service-role.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. La columna y el helper ────────────────────────────────────

alter table public.profiles
  add column if not exists is_bahai boolean not null default true;

-- Un amigo no puede tener cargos: ni Asamblea, ni tags. Que lo diga la
-- base, no solo el formulario.
alter table public.profiles drop constraint if exists profiles_amigo_sin_cargos;
alter table public.profiles add constraint profiles_amigo_sin_cargos check (
  is_bahai
  or (
    role = 'member'
    and not can_respond_chat
    and not can_manage_treasury
    and not can_manage_bulletin
    and not is_national_admin
  )
);

-- Mismo molde que is_admin(). El coalesce importa: sin perfil (o sin
-- sesión) devuelve false, que es el lado seguro.
create or replace function public.is_bahai(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select p.is_bahai from public.profiles p where p.id = uid),
    false
  );
$$;

-- ─── 2. is_bahai queda congelado para el propio usuario ───────────
-- Copia de la policy de la 039 más la línea nueva. Ver esa migración
-- para el porqué de comparar la fila vieja contra la nueva.

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = profiles.role
        and p.can_respond_chat = profiles.can_respond_chat
        and p.can_manage_treasury = profiles.can_manage_treasury
        and p.can_manage_bulletin = profiles.can_manage_bulletin
        and p.is_national_admin = profiles.is_national_admin
        and p.is_bahai = profiles.is_bahai
        and p.email is not distinct from profiles.email
        and p.disabled_at is not distinct from profiles.disabled_at
        and p.disabled_by is not distinct from profiles.disabled_by
        and p.created_at = profiles.created_at
        and (
          p.locality_id is not distinct from profiles.locality_id
          or p.locality_id is null -- primer ingreso: todavía no eligió
        )
    )
  );

-- ─── 3. Fiestas de los 19 Días ────────────────────────────────────

drop policy if exists "feasts_select_locality" on public.feasts;
create policy "feasts_select_locality" on public.feasts
  for select using (
    (
      locality_id = public.current_locality_id()
      and public.is_bahai(auth.uid())
      and (
        status in ('published', 'in_progress')
        or public.is_admin(auth.uid())
      )
    )
    or public.is_national_admin(auth.uid())
  );

-- Lugares y oraciones de la Fiesta: hasta hoy eran `using (true)` (007),
-- o sea legibles por cualquiera de cualquier localidad. Pasan a verse
-- solo si se ve la Fiesta: la subconsulta corre con la RLS de `feasts`
-- del propio usuario, así que hereda todo lo de arriba.
drop policy if exists "feast_locations_select_all" on public.feast_locations;
drop policy if exists "feast_locations_select_visible" on public.feast_locations;
create policy "feast_locations_select_visible" on public.feast_locations
  for select using (
    exists (select 1 from public.feasts f where f.id = feast_locations.feast_id)
  );

drop policy if exists "feast_prayers_select_all" on public.feast_prayers;
drop policy if exists "feast_prayers_select_visible" on public.feast_prayers;
create policy "feast_prayers_select_visible" on public.feast_prayers
  for select using (
    exists (select 1 from public.feasts f where f.id = feast_prayers.feast_id)
  );

drop policy if exists "feast_suggestions_insert_self" on public.feast_suggestions;
create policy "feast_suggestions_insert_self" on public.feast_suggestions
  for insert with check (
    user_id = auth.uid()
    and public.is_bahai(auth.uid())
  );

-- La Asamblea puede crear a mano un evento de tipo Fiesta en el
-- calendario; se esconde igual que las sembradas.
drop policy if exists "calendar_events_select_locality" on public.calendar_events;
create policy "calendar_events_select_locality" on public.calendar_events
  for select using (
    (
      locality_id = public.current_locality_id()
      and (kind <> 'fiesta_19_dias' or public.is_bahai(auth.uid()))
    )
    or public.is_national_admin(auth.uid())
  );

-- Fotos de la Fiesta: revelan la Fiesta igual que el calendario. Las
-- reacciones y comentarios pasan a depender de que la foto se vea.
drop policy if exists "event_photos_select_locality" on public.event_photos;
create policy "event_photos_select_locality" on public.event_photos
  for select using (
    (
      (locality_id = public.current_locality_id() or visibility = 'national')
      and (event_type <> 'feast' or public.is_bahai(auth.uid()))
    )
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "epr_select_locality" on public.event_photo_reactions;
create policy "epr_select_locality" on public.event_photo_reactions
  for select using (
    exists (select 1 from public.event_photos ph where ph.id = event_photo_reactions.photo_id)
  );

drop policy if exists "epc_select_locality" on public.event_photo_comments;
create policy "epc_select_locality" on public.event_photo_comments
  for select using (
    exists (select 1 from public.event_photos ph where ph.id = event_photo_comments.photo_id)
  );

-- ─── 4. Comunicados: audiencia por comunicado ─────────────────────
--
-- Un comunicado puede ser para 'todos' o 'creyentes'. El default de la
-- COLUMNA es 'todos' porque los mensajes de la Casa Universal se
-- insertan sin decir nada y son para todo el mundo. El default del
-- FORMULARIO de la Asamblea es 'creyentes': mandarle la invitación a la
-- Fiesta a un amigo es el error caro; que se pierda un aviso general,
-- el barato. Los comunicados locales que ya existen se escribieron para
-- creyentes, así que se marcan así.

alter table public.messages
  add column if not exists audience text not null default 'todos'
  check (audience in ('todos', 'creyentes'));

update public.messages
   set audience = 'creyentes'
 where source = 'asamblea_local';

drop policy if exists "messages_select_scope" on public.messages;
create policy "messages_select_scope" on public.messages
  for select using (
    (
      (locality_id is null or locality_id = public.current_locality_id())
      and (audience = 'todos' or public.is_bahai(auth.uid()))
    )
    or public.is_national_admin(auth.uid())
  );

-- El Boletín compila eventos y fotos de la localidad, Fiesta incluida,
-- en un snapshot. Se trata como "solo creyentes" (decisión de producto:
-- es más simple y consistente que filtrarlo por lector).
drop policy if exists bulletins_select on public.bulletins;
create policy bulletins_select on public.bulletins
  for select to authenticated
  using (
    (
      status = 'published'
      and locality_id = public.current_locality_id()
      and public.is_bahai(auth.uid())
    )
    or (
      (public.is_admin(auth.uid()) or public.has_bulletin_tag(auth.uid()))
      and locality_id = public.current_locality_id()
    )
    or public.is_national_admin(auth.uid())
  );

-- ─── 5. Tesorería: nada, ni por API directa ───────────────────────

drop policy if exists "treasury_select_locality" on public.treasury;
create policy "treasury_select_locality" on public.treasury
  for select using (
    (locality_id = public.current_locality_id() and public.is_bahai(auth.uid()))
    or public.is_national_admin(auth.uid())
  );

-- Presupuesto: era `using (true)`. Pasa a la propia localidad y solo
-- creyentes (el tesorero y el admin nacional siguen entrando por sus
-- propias policies).
drop policy if exists "treasury_budgets_select_all" on public.treasury_budgets;
drop policy if exists "treasury_budgets_select_bahai" on public.treasury_budgets;
create policy "treasury_budgets_select_bahai" on public.treasury_budgets
  for select using (
    (locality_id = public.current_locality_id() and public.is_bahai(auth.uid()))
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "treasury_budget_items_select_all" on public.treasury_budget_items;
drop policy if exists "treasury_budget_items_select_bahai" on public.treasury_budget_items;
create policy "treasury_budget_items_select_bahai" on public.treasury_budget_items
  for select using (
    exists (select 1 from public.treasury_budgets b where b.id = treasury_budget_items.budget_id)
  );

drop policy if exists treasury_reports_select on public.treasury_reports;
create policy treasury_reports_select on public.treasury_reports
  for select to authenticated
  using (
    (
      status = 'published'
      and audience = 'comunidad'
      and locality_id = public.current_locality_id()
      and public.is_bahai(auth.uid())
    )
    or (
      status = 'published'
      and audience = 'internos'
      and public.is_admin(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or (
      public.has_treasury_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or public.is_national_admin(auth.uid())
  );

drop policy if exists treasury_goals_select on public.treasury_goals;
create policy treasury_goals_select on public.treasury_goals
  for select to authenticated
  using (
    (locality_id = public.current_locality_id() and public.is_bahai(auth.uid()))
    or public.is_national_admin(auth.uid())
  );

-- Compromisos: un amigo no aporta al Fondo, así que no crea ni lee los
-- suyos (no debería tener ninguno).
drop policy if exists "tc_owner_select" on public.treasury_commitments;
create policy "tc_owner_select" on public.treasury_commitments
  for select using (user_id = auth.uid() and public.is_bahai(auth.uid()));

drop policy if exists "tc_owner_insert" on public.treasury_commitments;
create policy "tc_owner_insert" on public.treasury_commitments
  for insert with check (user_id = auth.uid() and public.is_bahai(auth.uid()));

-- Las funciones security definer saltan la RLS: el guard va adentro.
-- my_contributions() y my_receipt() (046) filtran por c.profile_id =
-- auth.uid(); se les suma la condición. treasury_progress() (042) se
-- redefine entera con una línea más en el guard.

create or replace function public.my_contributions()
returns table (
  id uuid,
  entry_date date,
  currency text,
  amount numeric,
  receipt_number int,
  receipt_name text,
  contributor_name text,
  fund_name text,
  subcategory_name text,
  locality_id uuid,
  locality_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id,
         e.entry_date,
         e.currency,
         e.amount,
         e.receipt_number,
         e.receipt_name,
         c.name,
         f.name,
         s.name,
         e.locality_id,
         l.name
  from public.treasury_entries e
  join public.treasury_contributors c on c.id = e.contributor_id
  left join public.treasury_funds f on f.id = e.fund_id
  left join public.treasury_subcategories s on s.id = e.subcategory_id
  left join public.localities l on l.id = e.locality_id
  where auth.uid() is not null
    and public.is_bahai(auth.uid())
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null
  order by e.entry_date desc, e.receipt_number desc nulls last;
$$;

create or replace function public.my_receipt(entry_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'entry_date', e.entry_date,
    'currency', e.currency,
    'amount', e.amount,
    'receipt_number', e.receipt_number,
    'receipt_name', e.receipt_name,
    'contributor_name', c.name,
    'fund_name', f.name,
    'subcategory_name', s.name,
    'locality_name', l.name,
    'treasurer_name', coalesce(
      (select p.full_name from public.profiles p where p.id = e.receipt_issued_by),
      (select p.full_name
         from public.profiles p
        where p.locality_id = e.locality_id
          and p.can_manage_treasury
          and p.disabled_at is null
        order by (p.role = 'admin') desc, p.created_at
        limit 1)
    )
  )
  from public.treasury_entries e
  join public.treasury_contributors c on c.id = e.contributor_id
  left join public.treasury_funds f on f.id = e.fund_id
  left join public.treasury_subcategories s on s.id = e.subcategory_id
  left join public.localities l on l.id = e.locality_id
  where e.id = entry_id
    and auth.uid() is not null
    and public.is_bahai(auth.uid())
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null;
$$;

create or replace function public.treasury_progress(
  loc uuid,
  year_from date,
  as_of date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if loc is null or year_from is null or as_of is null then
    raise exception 'treasury_progress: faltan parámetros';
  end if;

  -- Security definer: la función salta la RLS, así que el control de
  -- acceso se hace acá y a mano. Solo la propia localidad, y solo
  -- creyentes (047). Los coalesce() no son decorativos: ver 042.
  if not coalesce(loc = public.current_locality_id(), false)
     and not coalesce(public.is_national_admin(auth.uid()), false) then
    raise exception 'treasury_progress: esa localidad no es la tuya';
  end if;
  if not coalesce(public.is_bahai(auth.uid()), false)
     and not coalesce(public.is_national_admin(auth.uid()), false) then
    raise exception 'treasury_progress: sin acceso a la Tesorería';
  end if;

  with acumulado as (
    select fund_id, currency, amount
    from public.treasury_entries
    where locality_id = loc
      and entry_date <= as_of
  ),
  flujo as (
    select entry_date, fund_id, category_id, subcategory_id, currency,
           amount, contributions_count
    from public.treasury_entries
    where locality_id = loc
      and entry_date >= year_from
      and entry_date <= as_of
      and not is_opening_balance
      and transfer_group_id is null
  )
  select jsonb_build_object(
    'localityId', loc,
    'yearFrom', year_from,
    'asOf', as_of,
    'contributionsByDate', coalesce((
      select jsonb_agg(jsonb_build_object(
               'd', entry_date, 'c', currency,
               'a', total, 'n', aportes))
      from (
        select entry_date, currency,
               sum(amount) as total,
               sum(greatest(contributions_count, 1)) as aportes
        from flujo
        where amount > 0
        group by entry_date, currency
      ) t
    ), '[]'::jsonb),
    'spentByCategory', coalesce((
      select jsonb_agg(jsonb_build_object('id', category_id, 'c', currency, 'a', total))
      from (
        select category_id, currency, sum(-amount) as total
        from flujo where amount < 0
        group by category_id, currency
      ) t
    ), '[]'::jsonb),
    'spentBySubcategory', coalesce((
      select jsonb_agg(jsonb_build_object('id', subcategory_id, 'c', currency, 'a', total))
      from (
        select subcategory_id, currency, sum(-amount) as total
        from flujo where amount < 0
        group by subcategory_id, currency
      ) t
    ), '[]'::jsonb),
    'spentByFund', coalesce((
      select jsonb_agg(jsonb_build_object('id', fund_id, 'c', currency, 'a', total))
      from (
        select fund_id, currency, sum(-amount) as total
        from flujo where amount < 0 and fund_id is not null
        group by fund_id, currency
      ) t
    ), '[]'::jsonb),
    'receivedByFund', coalesce((
      select jsonb_agg(jsonb_build_object('id', fund_id, 'c', currency, 'a', total))
      from (
        select fund_id, currency, sum(amount) as total
        from flujo where amount > 0 and fund_id is not null
        group by fund_id, currency
      ) t
    ), '[]'::jsonb),
    'balanceByFund', coalesce((
      select jsonb_agg(jsonb_build_object('id', fund_id, 'c', currency, 'a', total))
      from (
        select fund_id, currency, sum(amount) as total
        from acumulado where fund_id is not null
        group by fund_id, currency
        having abs(sum(amount)) >= 0.005
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- ─── 6. Chat: el canal de Tesorería no existe para un amigo ───────

drop policy if exists "chat_select_own" on public.chat_messages;
create policy "chat_select_own" on public.chat_messages
  for select using (
    member_id = auth.uid()
    and (topic <> 'tesoreria' or public.is_bahai(auth.uid()))
  );

drop policy if exists "chat_insert_member" on public.chat_messages;
create policy "chat_insert_member" on public.chat_messages
  for insert with check (
    member_id = auth.uid()
    and from_user_id = auth.uid()
    and is_admin_reply = false
    and from_name is null
    and (topic <> 'tesoreria' or public.is_bahai(auth.uid()))
  );

create or replace function public.mark_chat_seen(
  p_topic text default 'secretaria'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_topic not in ('secretaria', 'tesoreria') then
    return;
  end if;
  if p_topic = 'tesoreria' and not public.is_bahai(auth.uid()) then
    return;
  end if;

  update public.chat_messages
  set read_by_member = true
  where member_id = auth.uid()
    and topic = p_topic
    and is_admin_reply = true
    and read_by_member = false;
end;
$$;

-- ─── 7. Segundo link de invitación: para amigos ───────────────────
-- Quien entra por este token queda incorporado con is_bahai=false. Es
-- una columna más en la misma fila (una invitación por localidad),
-- con el mismo formato de 64 hex. gen_random_uuid() es volátil, así
-- que cada fila existente recibe su propio token al agregar la columna.

alter table public.locality_invites
  add column if not exists friends_token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional). Impersonar a un amigo y comprobar que no ve
-- nada de Tesorería ni de la Fiesta:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UUID-DEL-AMIGO>","role":"authenticated"}';
--   select count(*) from public.feasts;              -- 0
--   select count(*) from public.treasury_budgets;    -- 0
--   select count(*) from public.messages where audience = 'creyentes'; -- 0
--   rollback;
-- ═════════════════════════════════════════════════════════════════
