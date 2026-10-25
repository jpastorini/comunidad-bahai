-- ═════════════════════════════════════════════════════════════════
-- 088 · Ayudantes de la Asamblea: permisos para quien no la integra.
--
-- Decidido con el usuario el 2026-10-25. Las Asambleas nombran ayudantes
-- o asistentes —quien carga las fotos, quien arma la Fiesta, quien
-- atiende el chat de Secretaría— que no son miembros de la Asamblea.
-- Hasta acá la única forma era el tag del Boletín, una excepción escrita
-- a mano en el middleware.
--
--   · Un nombramiento es una fila por (persona, comunidad, permiso), con
--     un "hasta" OPCIONAL: al vencer se apaga solo, porque la fecha se
--     compara al leer (no hay cron). Queda quién lo dio y cuándo.
--   · Se puede encargar Vida comunitaria (calendario, fiestas,
--     actividades, servicio, materiales, fotos), Comunicación
--     (comunicados con encuestas, boletín, contactos) y el chat de
--     Secretaría. La Tesorería, Creyentes, Datos de la Asamblea, Actas y
--     Estructuras NO se delegan.
--   · Solo creyentes: un Amigo/a de la Fe no tiene cargos (047). Y no en
--     una estructura (082), que ya elige a sus integrantes.
--   · Lo que publica un ayudante sale directo, como el Boletín hasta hoy.
--
-- ⚠️ Las policies existentes NO se tocan. A cada tabla delegable se le
-- SUMA una policy para el ayudante: Postgres combina las policies
-- permisivas con OR, así que la Asamblea no pierde nada y lo único nuevo
-- es lo que el ayudante puede. Todas exigen la comunidad puesta.
--
-- El tag `can_manage_bulletin` pasa a ser un nombramiento "boletin" y la
-- columna queda en false (no se borra todavía).
--
-- Idempotente. Correr una vez en el SQL Editor de Supabase.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. La tabla ─────────────────────────────────────────────────

create table if not exists public.delegations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  locality_id uuid not null references public.localities(id) on delete cascade,
  permission text not null check (permission in (
    'calendario', 'fiestas', 'actividades', 'servicio', 'materiales', 'fotos',
    'comunicados', 'boletin', 'contactos', 'secretaria'
  )),
  -- Último día de vigencia (civil de Montevideo). NULL = hasta que lo saquen.
  until date,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (profile_id, locality_id, permission)
);

create index if not exists delegations_locality_idx
  on public.delegations (locality_id);

alter table public.delegations enable row level security;

-- ─── 2. Helpers ──────────────────────────────────────────────────

-- ¿Tiene `uid` este permiso como ayudante, vigente, en la comunidad que
-- tiene PUESTA? Security definer porque lo usan las policies de tablas
-- que el ayudante lee con su propia RLS. No mira el rol: la Asamblea ya
-- tiene sus policies; esta es solo la del ayudante.
create or replace function public.has_perm(uid uuid, perm text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
      from public.delegations d
      join public.profiles p on p.id = d.profile_id
     where d.profile_id = uid
       and d.permission = perm
       and d.locality_id = p.locality_id
       and p.is_bahai
       and p.disabled_at is null
       and (d.until is null
            or d.until >= (now() at time zone 'America/Montevideo')::date)
  );
$$;

-- Los permisos vigentes de quien pregunta en la comunidad puesta. Lo usa
-- el middleware para abrirle el panel a un ayudante.
create or replace function public.my_delegations()
returns setof text
language sql security definer stable
set search_path = public
as $$
  select d.permission
    from public.delegations d
    join public.profiles p on p.id = d.profile_id
   where d.profile_id = auth.uid()
     and d.locality_id = p.locality_id
     and p.is_bahai
     and p.disabled_at is null
     and (d.until is null
          or d.until >= (now() at time zone 'America/Montevideo')::date);
$$;

grant execute on function public.has_perm(uuid, text) to authenticated;
grant execute on function public.my_delegations() to authenticated;

-- ─── 3. RLS de los nombramientos ─────────────────────────────────

drop policy if exists delegations_select on public.delegations;
create policy delegations_select on public.delegations
  for select to authenticated using (
    profile_id = auth.uid()
    or (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- Nombra y saca la Asamblea de la comunidad puesta. A quién: un creyente
-- que pertenece a esta comunidad, en una que no es una estructura.
drop policy if exists delegations_insert on public.delegations;
create policy delegations_insert on public.delegations
  for insert to authenticated with check (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
    and exists (
      select 1 from public.profile_localities pl
       where pl.profile_id = delegations.profile_id
         and pl.locality_id = delegations.locality_id
    )
    and exists (
      select 1 from public.profiles p
       where p.id = delegations.profile_id and p.is_bahai
    )
    and exists (
      select 1 from public.localities l
       where l.id = delegations.locality_id and l.kind <> 'estructura'
    )
  );

drop policy if exists delegations_update on public.delegations;
create policy delegations_update on public.delegations
  for update to authenticated
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());

drop policy if exists delegations_delete on public.delegations;
create policy delegations_delete on public.delegations
  for delete to authenticated
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());

-- Pasar a Amigo/a de la Fe le saca los nombramientos, igual que los
-- cargos (047). Mudarse de comunidad no: son de la comunidad que los dio.
create or replace function public.delegations_drop_for_amigo()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.is_bahai = false and old.is_bahai = true then
    delete from public.delegations where profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_drop_delegations on public.profiles;
create trigger profiles_drop_delegations
  after update of is_bahai on public.profiles
  for each row execute function public.delegations_drop_for_amigo();

-- ─── 4. El Boletín pasa a ser un nombramiento ────────────────────

insert into public.delegations (profile_id, locality_id, permission)
select pl.profile_id, pl.locality_id, 'boletin'
  from public.profile_localities pl
  join public.profiles p on p.id = pl.profile_id
 where pl.can_manage_bulletin and pl.role <> 'admin' and p.is_bahai
on conflict (profile_id, locality_id, permission) do nothing;

update public.profile_localities set can_manage_bulletin = false
 where can_manage_bulletin;
update public.profiles set can_manage_bulletin = false
 where can_manage_bulletin;

-- Las policies de `bulletins` preguntan por este helper: con esto valen
-- también para el ayudante del Boletín, sin reescribirlas.
create or replace function public.has_bulletin_tag(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and can_manage_bulletin
  ) or public.has_perm(uid, 'boletin');
$$;

-- ─── 5. Vida comunitaria ─────────────────────────────────────────

drop policy if exists calendar_events_delegate on public.calendar_events;
create policy calendar_events_delegate on public.calendar_events
  for all to authenticated
  using (public.has_perm(auth.uid(), 'calendario') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'calendario') and locality_id = public.current_locality_id());

-- La Fiesta en borrador la ve solo la Asamblea (047); el ayudante también.
drop policy if exists feasts_delegate on public.feasts;
create policy feasts_delegate on public.feasts
  for all to authenticated
  using (public.has_perm(auth.uid(), 'fiestas') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'fiestas') and locality_id = public.current_locality_id());

drop policy if exists feast_prayers_delegate on public.feast_prayers;
create policy feast_prayers_delegate on public.feast_prayers
  for all to authenticated
  using (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_prayers.feast_id and f.locality_id = public.current_locality_id()))
  with check (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_prayers.feast_id and f.locality_id = public.current_locality_id()));

drop policy if exists feast_locations_delegate on public.feast_locations;
create policy feast_locations_delegate on public.feast_locations
  for all to authenticated
  using (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_locations.feast_id and f.locality_id = public.current_locality_id()))
  with check (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_locations.feast_id and f.locality_id = public.current_locality_id()));

drop policy if exists feast_news_delegate on public.feast_news_items;
create policy feast_news_delegate on public.feast_news_items
  for all to authenticated
  using (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_news_items.feast_id and f.locality_id = public.current_locality_id()))
  with check (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_news_items.feast_id and f.locality_id = public.current_locality_id()));

drop policy if exists feast_suggestions_delegate on public.feast_suggestions;
create policy feast_suggestions_delegate on public.feast_suggestions
  for all to authenticated
  using (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_suggestions.feast_id and f.locality_id = public.current_locality_id()))
  with check (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_suggestions.feast_id and f.locality_id = public.current_locality_id()));

drop policy if exists feast_rsvps_delegate on public.feast_rsvps;
create policy feast_rsvps_delegate on public.feast_rsvps
  for select to authenticated
  using (public.has_perm(auth.uid(), 'fiestas') and exists (
    select 1 from public.feasts f
     where f.id = feast_rsvps.feast_id and f.locality_id = public.current_locality_id()));

drop policy if exists activities_delegate on public.activities;
create policy activities_delegate on public.activities
  for all to authenticated
  using (public.has_perm(auth.uid(), 'actividades') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'actividades') and locality_id = public.current_locality_id());

drop policy if exists service_needs_delegate on public.service_needs;
create policy service_needs_delegate on public.service_needs
  for all to authenticated
  using (public.has_perm(auth.uid(), 'servicio') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'servicio') and locality_id = public.current_locality_id());

drop policy if exists service_volunteers_delegate on public.service_volunteers;
create policy service_volunteers_delegate on public.service_volunteers
  for select to authenticated
  using (public.has_perm(auth.uid(), 'servicio') and exists (
    select 1 from public.service_needs n
     where n.id = service_volunteers.need_id and n.locality_id = public.current_locality_id()));

-- Solo los materiales de la comunidad: los nacionales son de la AEN.
drop policy if exists study_materials_delegate on public.study_materials;
create policy study_materials_delegate on public.study_materials
  for all to authenticated
  using (public.has_perm(auth.uid(), 'materiales') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'materiales') and locality_id = public.current_locality_id());

drop policy if exists event_photos_update_delegate on public.event_photos;
create policy event_photos_update_delegate on public.event_photos
  for update to authenticated
  using (public.has_perm(auth.uid(), 'fotos') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'fotos') and locality_id = public.current_locality_id());

drop policy if exists event_photos_delete_delegate on public.event_photos;
create policy event_photos_delete_delegate on public.event_photos
  for delete to authenticated
  using (public.has_perm(auth.uid(), 'fotos') and locality_id = public.current_locality_id());

drop policy if exists epc_delete_delegate on public.event_photo_comments;
create policy epc_delete_delegate on public.event_photo_comments
  for delete to authenticated
  using (public.has_perm(auth.uid(), 'fotos') and locality_id = public.current_locality_id());

-- ─── 6. Comunicación ─────────────────────────────────────────────

-- Solo comunicados de la comunidad (locality_id puesto), nunca nacionales.
drop policy if exists messages_delegate on public.messages;
create policy messages_delegate on public.messages
  for all to authenticated
  using (public.has_perm(auth.uid(), 'comunicados') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'comunicados') and locality_id = public.current_locality_id());

drop policy if exists message_polls_delegate on public.message_polls;
create policy message_polls_delegate on public.message_polls
  for all to authenticated
  using (public.has_perm(auth.uid(), 'comunicados') and locality_id = public.current_locality_id())
  with check (public.has_perm(auth.uid(), 'comunicados') and locality_id = public.current_locality_id());

drop policy if exists poll_options_delegate on public.poll_options;
create policy poll_options_delegate on public.poll_options
  for all to authenticated
  using (public.has_perm(auth.uid(), 'comunicados') and exists (
    select 1 from public.message_polls p
     where p.id = poll_options.poll_id and p.locality_id = public.current_locality_id()))
  with check (public.has_perm(auth.uid(), 'comunicados') and exists (
    select 1 from public.message_polls p
     where p.id = poll_options.poll_id and p.locality_id = public.current_locality_id()));

-- El informe de lectura y el de la encuesta, como los ve la Asamblea.
drop policy if exists message_reads_delegate on public.message_reads;
create policy message_reads_delegate on public.message_reads
  for select to authenticated
  using (public.has_perm(auth.uid(), 'comunicados') and locality_id = public.current_locality_id());

drop policy if exists poll_votes_delegate on public.poll_votes;
create policy poll_votes_delegate on public.poll_votes
  for select to authenticated
  using (public.has_perm(auth.uid(), 'comunicados') and locality_id = public.current_locality_id());

drop policy if exists poll_participants_delegate on public.poll_participants;
create policy poll_participants_delegate on public.poll_participants
  for select to authenticated
  using (public.has_perm(auth.uid(), 'comunicados') and locality_id = public.current_locality_id());

drop policy if exists contact_requests_select_delegate on public.contact_requests;
create policy contact_requests_select_delegate on public.contact_requests
  for select to authenticated
  using (public.has_perm(auth.uid(), 'contactos') and locality_id = public.current_locality_id());

drop policy if exists contact_requests_update_delegate on public.contact_requests;
create policy contact_requests_update_delegate on public.contact_requests
  for update to authenticated
  using (public.has_perm(auth.uid(), 'contactos') and locality_id = public.current_locality_id());

drop policy if exists contact_requests_delete_delegate on public.contact_requests;
create policy contact_requests_delete_delegate on public.contact_requests
  for delete to authenticated
  using (public.has_perm(auth.uid(), 'contactos') and locality_id = public.current_locality_id());

-- ─── 7. Chat de Secretaría (nunca el de Tesorería) ───────────────

drop policy if exists chat_select_delegate on public.chat_messages;
create policy chat_select_delegate on public.chat_messages
  for select to authenticated
  using (topic = 'secretaria' and public.has_perm(auth.uid(), 'secretaria')
         and locality_id = public.current_locality_id());

drop policy if exists chat_update_delegate on public.chat_messages;
create policy chat_update_delegate on public.chat_messages
  for update to authenticated
  using (topic = 'secretaria' and public.has_perm(auth.uid(), 'secretaria')
         and locality_id = public.current_locality_id())
  with check (topic = 'secretaria' and public.has_perm(auth.uid(), 'secretaria')
              and locality_id = public.current_locality_id());

drop policy if exists chat_insert_delegate on public.chat_messages;
create policy chat_insert_delegate on public.chat_messages
  for insert to authenticated
  with check (topic = 'secretaria' and from_user_id = auth.uid()
              and public.has_perm(auth.uid(), 'secretaria')
              and locality_id = public.current_locality_id());

-- ─── 8. Archivos ─────────────────────────────────────────────────

-- El bucket `comunicados` guarda las imágenes de comunicados, eventos del
-- calendario y noticias de la Fiesta; `materiales`, los archivos de
-- materiales. La lectura ya es pública.
drop policy if exists comunicados_delegate_insert on storage.objects;
create policy comunicados_delegate_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'comunicados' and (
      public.has_perm(auth.uid(), 'comunicados')
      or public.has_perm(auth.uid(), 'calendario')
      or public.has_perm(auth.uid(), 'fiestas')
    )
  );

drop policy if exists comunicados_delegate_update on storage.objects;
create policy comunicados_delegate_update on storage.objects
  for update to authenticated using (
    bucket_id = 'comunicados' and (
      public.has_perm(auth.uid(), 'comunicados')
      or public.has_perm(auth.uid(), 'calendario')
      or public.has_perm(auth.uid(), 'fiestas')
    )
  );

drop policy if exists comunicados_delegate_delete on storage.objects;
create policy comunicados_delegate_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'comunicados' and (
      public.has_perm(auth.uid(), 'comunicados')
      or public.has_perm(auth.uid(), 'calendario')
      or public.has_perm(auth.uid(), 'fiestas')
    )
  );

drop policy if exists materiales_delegate_insert on storage.objects;
create policy materiales_delegate_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiales' and public.has_perm(auth.uid(), 'materiales'));

drop policy if exists materiales_delegate_update on storage.objects;
create policy materiales_delegate_update on storage.objects
  for update to authenticated
  using (bucket_id = 'materiales' and public.has_perm(auth.uid(), 'materiales'));

drop policy if exists materiales_delegate_delete on storage.objects;
create policy materiales_delegate_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiales' and public.has_perm(auth.uid(), 'materiales'));

drop policy if exists event_photos_storage_delete_delegate on storage.objects;
create policy event_photos_storage_delete_delegate on storage.objects
  for delete to authenticated using (
    bucket_id = 'event-photos' and exists (
      select 1 from public.event_photos ep
       where ep.storage_path = name
         and public.has_perm(auth.uid(), 'fotos')
         and ep.locality_id = public.current_locality_id()
    )
  );
