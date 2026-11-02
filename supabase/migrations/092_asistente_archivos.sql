-- 092 · Archivos del asistente de Tesorería
--
-- El tesorero le pasa al asistente (090) un extracto, la foto de una
-- factura, la captura de un giro o una planilla, para que lo cruce con el
-- libro. Los archivos quedan guardados con la conversación: son material
-- del tesorero y al reabrirla se tienen que poder ver.
--
-- El navegador sube el archivo directo al bucket privado (el techo de
-- 4,5 MB de Vercel, ver CLAUDE.md) y al servidor le llega el path, que se
-- vuelve a verificar contra `<localidad>/<persona>/`. La fila lo ata a la
-- conversación. Una imagen o un PDF además se sube a la API de Anthropic
-- (Files API) y se guarda su id, para que el historial lo nombre sin
-- repetir el archivo en cada pedido.
--
-- Lo que se confirma desde el asistente (un comprobante, un extracto
-- importado) se COPIA a su bucket de siempre (`treasury-receipts`,
-- `extractos`) por los actions del Libro y de Conciliación: el archivo de
-- acá es la copia de la conversación, no la del libro.

create table if not exists public.treasury_assistant_files (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.treasury_assistant_threads(id) on delete cascade,
  locality_id uuid not null references public.localities(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  kind text not null check (kind in ('imagen', 'pdf', 'planilla')),
  anthropic_file_id text,
  created_at timestamptz not null default now()
);

create index if not exists treasury_assistant_files_thread_idx
  on public.treasury_assistant_files (thread_id, created_at);

alter table public.treasury_assistant_files enable row level security;

drop policy if exists treasury_assistant_files_own on public.treasury_assistant_files;
create policy treasury_assistant_files_own on public.treasury_assistant_files
  for all
  using (
    profile_id = auth.uid()
    and locality_id = public.current_locality_id()
    and public.has_treasury_tag(auth.uid())
  )
  with check (
    profile_id = auth.uid()
    and locality_id = public.current_locality_id()
    and public.has_treasury_tag(auth.uid())
  );

-- ─── Storage: bucket PRIVADO, <localidad>/<persona>/<uuid>.<ext> ──────

insert into storage.buckets (id, name, public)
values ('asistente-archivos', 'asistente-archivos', false)
on conflict (id) do update set public = false;

drop policy if exists "asistente_archivos_read" on storage.objects;
create policy "asistente_archivos_read" on storage.objects
  for select using (
    bucket_id = 'asistente-archivos'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "asistente_archivos_insert" on storage.objects;
create policy "asistente_archivos_insert" on storage.objects
  for insert with check (
    bucket_id = 'asistente-archivos'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "asistente_archivos_delete" on storage.objects;
create policy "asistente_archivos_delete" on storage.objects
  for delete using (
    bucket_id = 'asistente-archivos'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
