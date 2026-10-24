-- ═════════════════════════════════════════════════════════════════
-- 084 · Estructuras, etapa 3: informes presentados a la Asamblea, y
-- actas con su archivo.
--
-- Decidido con el usuario el 2026-10-24: una estructura (082) no le abre
-- su interior a la Asamblea que la creó —ni el libro, ni las actas, ni
-- las tareas—; le PRESENTA informes. Dos clases: los de Tesorería (la
-- hoja que ya arma el tesorero) y los de actividad (texto y un archivo).
-- La Asamblea los ve en su Registro de informes y registra en qué
-- reunión los aprobó.
--
-- 1. `structure_reports`: una fila por informe presentado (o en
--    borrador). Un informe de Tesorería no se copia: la fila apunta a
--    `treasury_reports` y una policy nueva deja leerlo a la Asamblea
--    madre mientras esté presentado.
-- 2. La aprobación es de la Asamblea madre y va por una función: la
--    estructura escribe su fila pero no puede aprobarse sola.
-- 3. `assembly_actas` (031) guardaba solo título y fecha. Suma el archivo
--    del acta, para las Asambleas y para las estructuras.
-- 4. Bucket PRIVADO `institucion-docs` para los dos archivos:
--    `<localidad>/actas/…` y `<localidad>/informes/…`.
--
-- Idempotente. Correr una vez en el SQL Editor de Supabase.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. Informes presentados ─────────────────────────────────────

create table if not exists public.structure_reports (
  id                 uuid primary key default gen_random_uuid(),
  structure_id       uuid not null references public.localities(id) on delete cascade,
  -- La Asamblea a la que se presenta. La pone el trigger desde la
  -- estructura: nadie elige a quién presentarle.
  parent_id          uuid not null references public.localities(id) on delete cascade,
  kind               text not null check (kind in ('actividad', 'tesoreria')),
  treasury_report_id uuid unique references public.treasury_reports(id) on delete cascade,
  title              text not null,
  period_from        date,
  period_to          date,
  body               text,
  file_path          text,
  file_name          text,
  status             text not null default 'borrador'
                     check (status in ('borrador', 'presentado')),
  presented_at       timestamptz,
  presented_by       uuid references public.profiles(id) on delete set null,
  -- Lo escribe solo `review_structure_report()`, la Asamblea madre.
  approved_on        date,
  approval_note      text,
  approved_by        uuid references public.profiles(id) on delete set null,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((kind = 'tesoreria') = (treasury_report_id is not null))
);

create index if not exists structure_reports_structure_idx
  on public.structure_reports (structure_id, created_at desc);
create index if not exists structure_reports_parent_idx
  on public.structure_reports (parent_id, presented_at desc)
  where status = 'presentado';

-- La madre sale de la estructura, y presentar sella la fecha.
create or replace function public.structure_reports_fill()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  select parent_id into new.parent_id
  from public.localities
  where id = new.structure_id and kind = 'estructura';
  if new.parent_id is null then
    raise exception 'NO_ES_ESTRUCTURA: solo una estructura presenta informes';
  end if;
  if new.status = 'presentado' and new.presented_at is null then
    new.presented_at := now();
    new.presented_by := auth.uid();
  elsif new.status = 'borrador' then
    -- Retirarlo antes de que lo aprueben lo vuelve a borrador.
    new.presented_at := null;
    new.presented_by := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists structure_reports_fill on public.structure_reports;
create trigger structure_reports_fill
  before insert or update on public.structure_reports
  for each row execute function public.structure_reports_fill();

alter table public.structure_reports enable row level security;

-- Leen: la estructura (sus integrantes con rol) y la Asamblea madre, esta
-- solo lo presentado. El admin nacional, todo.
drop policy if exists structure_reports_select on public.structure_reports;
create policy structure_reports_select on public.structure_reports
  for select using (
    (public.is_admin(auth.uid()) and structure_id = public.current_locality_id())
    or (
      public.is_admin(auth.uid())
      and parent_id = public.current_locality_id()
      and status = 'presentado'
    )
    or public.is_national_admin(auth.uid())
  );

-- Escribe la estructura, mientras no esté aprobado, y sin aprobarse sola.
drop policy if exists structure_reports_write on public.structure_reports;
create policy structure_reports_write on public.structure_reports
  for all
  using (
    public.is_admin(auth.uid())
    and structure_id = public.current_locality_id()
    and approved_on is null
  )
  with check (
    public.is_admin(auth.uid())
    and structure_id = public.current_locality_id()
    and approved_on is null
    and approved_by is null
    and approval_note is null
  );

-- ─── 2. La Asamblea madre aprueba ────────────────────────────────
-- Fecha de la reunión y una nota (el N.º de acta, una observación).
-- NULL en la fecha deshace la aprobación.
create or replace function public.review_structure_report(
  p_id uuid,
  p_approved_on date,
  p_note text
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.structure_reports r
    where r.id = p_id
      and r.status = 'presentado'
      and r.parent_id = public.current_locality_id()
      and public.is_admin(auth.uid())
  ) then
    raise exception 'SIN_PERMISO: solo la Asamblea a la que se presentó lo aprueba';
  end if;

  update public.structure_reports
  set approved_on = p_approved_on,
      approval_note = case when p_approved_on is null then null else nullif(trim(p_note), '') end,
      approved_by = case when p_approved_on is null then null else auth.uid() end
  where id = p_id;
end;
$$;

revoke all on function public.review_structure_report(uuid, date, text) from public;
grant execute on function public.review_structure_report(uuid, date, text) to authenticated;

-- El informe de Tesorería presentado lo lee la Asamblea madre. Policy
-- aparte (se suman con OR): la de la 054 sigue igual.
drop policy if exists treasury_reports_select_presented on public.treasury_reports;
create policy treasury_reports_select_presented on public.treasury_reports
  for select to authenticated
  using (
    public.is_admin(auth.uid())
    and exists (
      select 1 from public.structure_reports r
      where r.treasury_report_id = treasury_reports.id
        and r.status = 'presentado'
        and r.parent_id = public.current_locality_id()
    )
  );

-- ─── 3. El acta con su archivo ───────────────────────────────────

alter table public.assembly_actas
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists notes text;

-- ─── 4. El bucket ────────────────────────────────────────────────
-- Privado: un acta es tan reservada como el libro. Todo acceso sale de
-- una URL firmada emitida en el servidor.

insert into storage.buckets (id, name, public)
values ('institucion-docs', 'institucion-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "institucion_docs_read" on storage.objects;
create policy "institucion_docs_read" on storage.objects
  for select using (
    bucket_id = 'institucion-docs'
    and public.is_admin(auth.uid())
    and (
      (storage.foldername(name))[1] = public.current_locality_id()::text
      -- El archivo de un informe presentado lo lee la Asamblea madre.
      or exists (
        select 1 from public.structure_reports r
        where r.file_path = storage.objects.name
          and r.status = 'presentado'
          and r.parent_id = public.current_locality_id()
      )
    )
  );

drop policy if exists "institucion_docs_insert" on storage.objects;
create policy "institucion_docs_insert" on storage.objects
  for insert with check (
    bucket_id = 'institucion-docs'
    and public.is_admin(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "institucion_docs_delete" on storage.objects;
create policy "institucion_docs_delete" on storage.objects
  for delete using (
    bucket_id = 'institucion-docs'
    and public.is_admin(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );
