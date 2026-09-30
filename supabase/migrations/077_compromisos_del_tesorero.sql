-- 077 — El tesorero también registra compromisos.
--
-- Hasta la 063 un compromiso solo podía existir si la persona tenía cuenta
-- en la app y lo declaraba ella misma: la clave era (user_id, localidad).
-- Mucha gente no usa la app, o no esa pantalla, y le dice al tesorero de
-- palabra que quiere comprometerse. Eso obligaba a llevar dos listas.
--
-- Desde acá un compromiso cuelga de un creyente de la app (`user_id`), de
-- una ficha del padrón de contribuyentes (`contributor_id`), o de las dos.
-- La ficha es la misma que se elige al registrar un aporte en el Libro, así
-- que un compromiso con ficha SIEMPRE se puede medir: el informe compara
-- contra los aportes de esa ficha, sin depender de que esté vinculada a un
-- perfil.
--
-- Suma también `phone` (para el "Recordar por WhatsApp" de quien no tiene
-- la app) y `created_by` (quién lo registró: el propio creyente o el
-- tesorero).
--
-- Correr una vez en el SQL Editor de Supabase.

alter table public.treasury_commitments
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists contributor_id uuid references public.treasury_contributors(id),
  add column if not exists phone text,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- La PK pasa a ser el id. (user_id, localidad) sigue siendo única como
-- CONSTRAINT (no índice parcial): el upsert del creyente la usa como
-- `onConflict`, y en Postgres dos NULL no chocan, así que los compromisos
-- sin perfil conviven sin problema.
alter table public.treasury_commitments
  drop constraint if exists treasury_commitments_pkey;
alter table public.treasury_commitments
  add constraint treasury_commitments_pkey primary key (id);

alter table public.treasury_commitments alter column user_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'treasury_commitments_user_locality_key') then
    alter table public.treasury_commitments
      add constraint treasury_commitments_user_locality_key unique (user_id, locality_id);
  end if;
  -- Una ficha del padrón, un compromiso: la ficha ya es de una comunidad.
  if not exists (select 1 from pg_constraint where conname = 'treasury_commitments_contributor_key') then
    alter table public.treasury_commitments
      add constraint treasury_commitments_contributor_key unique (contributor_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'treasury_commitments_anchor_check') then
    alter table public.treasury_commitments
      add constraint treasury_commitments_anchor_check
      check (user_id is not null or contributor_id is not null);
  end if;
end $$;

-- ─── RLS ─────────────────────────────────────────────────────────
-- El dueño sigue igual (lee, edita y borra lo suyo, aunque lo haya
-- registrado el tesorero: el compromiso es de la persona). El tesorero,
-- que hasta acá solo leía, ahora escribe los de SU comunidad.
drop policy if exists "tc_treasurer_insert" on public.treasury_commitments;
create policy "tc_treasurer_insert" on public.treasury_commitments
  for insert with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

drop policy if exists "tc_treasurer_update" on public.treasury_commitments;
create policy "tc_treasurer_update" on public.treasury_commitments
  for update using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  ) with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

drop policy if exists "tc_treasurer_delete" on public.treasury_commitments;
create policy "tc_treasurer_delete" on public.treasury_commitments
  for delete using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── La ficha que se vincula arrastra su compromiso ──────────────
-- Si el tesorero registró el compromiso de alguien que no estaba en la app
-- y después esa ficha se vincula a un creyente (Contribuyentes, o el
-- buscador del Libro), el compromiso pasa a ser del creyente: lo ve en su
-- pantalla y le llega el aviso del 10. Si ese creyente ya había declarado
-- uno propio, manda el suyo y este queda como estaba.
create or replace function public.treasury_contributor_link_commitment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_id is not null and new.profile_id is distinct from old.profile_id then
    update public.treasury_commitments c
       set user_id = new.profile_id, updated_at = now()
     where c.contributor_id = new.id
       and c.user_id is null
       and not exists (
         select 1 from public.treasury_commitments o
          where o.user_id = new.profile_id and o.locality_id = c.locality_id
       );
  end if;
  return new;
end;
$$;

drop trigger if exists treasury_contributor_link_commitment on public.treasury_contributors;
create trigger treasury_contributor_link_commitment
  after update of profile_id on public.treasury_contributors
  for each row execute function public.treasury_contributor_link_commitment();

-- ─── Fusionar fichas (075) mueve también el compromiso ───────────
-- Igual que la 075, más el compromiso: si solo la ficha que se va tenía
-- uno, pasa a la que queda; si las dos tenían, se conserva el de la que
-- queda. Sin esto el DELETE final chocaría con la FK del compromiso.
create or replace function public.merge_contributors(p_source uuid, p_target uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc uuid := public.current_locality_id();
  v_src public.treasury_contributors%rowtype;
  v_tgt public.treasury_contributors%rowtype;
  v_moved int;
begin
  if not public.has_treasury_tag(auth.uid()) then
    raise exception 'SIN_PERMISO: solo el tesorero puede fusionar contribuyentes.';
  end if;
  if p_source = p_target then
    raise exception 'FUSION_INVALIDA: son la misma ficha.';
  end if;
  select * into v_src from public.treasury_contributors where id = p_source and locality_id = v_loc;
  select * into v_tgt from public.treasury_contributors where id = p_target and locality_id = v_loc;
  if v_src.id is null or v_tgt.id is null then
    raise exception 'FUSION_INVALIDA: alguna de las fichas no es de esta comunidad.';
  end if;
  if v_src.profile_id is not null and v_tgt.profile_id is not null
     and v_src.profile_id <> v_tgt.profile_id then
    raise exception 'FUSION_INVALIDA: las dos fichas apuntan a creyentes distintos; desvinculá una antes.';
  end if;

  perform set_config('app.merge_contributor', p_source::text, true);

  update public.treasury_entries
     set contributor_id = p_target
   where contributor_id = p_source;
  get diagnostics v_moved = row_count;

  if exists (select 1 from public.treasury_commitments where contributor_id = p_target) then
    -- Si el de la ficha que se va era además el del perfil, se lo suelta
    -- de la ficha y sigue siendo del creyente; si no, sobra.
    update public.treasury_commitments set contributor_id = null
     where contributor_id = p_source and user_id is not null;
    delete from public.treasury_commitments where contributor_id = p_source;
  else
    update public.treasury_commitments set contributor_id = p_target
     where contributor_id = p_source;
  end if;

  if v_tgt.profile_id is null and v_src.profile_id is not null then
    update public.treasury_contributors set profile_id = v_src.profile_id where id = p_target;
  end if;
  if v_tgt.notes is null and v_src.notes is not null then
    update public.treasury_contributors set notes = v_src.notes where id = p_target;
  end if;

  delete from public.treasury_contributors where id = p_source;
  return v_moved;
end;
$$;

revoke all on function public.merge_contributors(uuid, uuid) from public, anon;
grant execute on function public.merge_contributors(uuid, uuid) to authenticated;
