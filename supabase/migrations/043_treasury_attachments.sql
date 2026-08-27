-- ═════════════════════════════════════════════════════════════════
-- Comprobantes de Tesorería: las facturas del gasto, adjuntas al
-- movimiento.
--
-- Un gasto de $ 3.500 por una Fiesta suele venir con tres facturas:
-- $ 1.000 de arreglos, $ 2.000 de comida, $ 500 de invitaciones. El
-- libro sigue viendo UNA línea de $ 3.500 —el desglose no es
-- contabilidad, es respaldo—, pero cada comprobante puede declarar su
-- monto y su concepto, y la pantalla avisa si las facturas no suman el
-- total del movimiento.
--
-- Por eso `amount` es OPCIONAL: la mayoría de los gastos tiene una sola
-- factura por el total y no hace falta repetir el número. Y por eso es
-- positivo: el signo lo pone el asiento, no el papel.
--
-- ⚠️ CONFIDENCIALIDAD — el bucket va PRIVADO, a diferencia de los cuatro
-- que ya existen (event-photos, comunicados, materiales, avatars). Una
-- factura trae nombre, dirección y RUT del proveedor: es tan reservada
-- como el libro. Se lee por URL firmada de vida corta, emitida en el
-- servidor para quien tiene el tag `can_manage_treasury`. Una URL
-- pública acá sería una filtración.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.treasury_attachments (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  -- Si se borra el movimiento se van sus comprobantes. Los objetos del
  -- bucket los limpia la server action antes de borrar el asiento:
  -- el cascade se lleva la fila, no el archivo.
  entry_id uuid not null references public.treasury_entries(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null default 0,
  -- Monto de ESTA factura, sin signo. NULL cuando el comprobante cubre
  -- todo el movimiento y no hay nada que desglosar.
  amount numeric(14, 2) check (amount is null or amount > 0),
  -- "Comida", "Arreglos", "Invitaciones". El concepto del papel, que no
  -- siempre coincide con la subcategoría del asiento.
  label text,
  sort_order int not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists treasury_attachments_entry_idx
  on public.treasury_attachments (entry_id, sort_order, created_at);

create index if not exists treasury_attachments_locality_idx
  on public.treasury_attachments (locality_id);

drop trigger if exists set_locality_treasury_attachments on public.treasury_attachments;
create trigger set_locality_treasury_attachments
  before insert on public.treasury_attachments
  for each row execute function public.set_locality_from_auth();

-- ─── RLS: el mismo candado que el libro ──────────────────────────
alter table public.treasury_attachments enable row level security;

drop policy if exists "treasury_attachments_tag_all" on public.treasury_attachments;
create policy "treasury_attachments_tag_all" on public.treasury_attachments
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Storage: bucket PRIVADO ─────────────────────────────────────
-- `public = false`: no hay URL pública que valga. Todo acceso sale de
-- una URL firmada emitida en el servidor.
insert into storage.buckets (id, name, public)
values ('treasury-receipts', 'treasury-receipts', false)
on conflict (id) do update set public = false;

-- Los paths son <locality_id>/<entry_id>/<uuid>.<ext>, así que la
-- primera carpeta alcanza para aislar localidades.
drop policy if exists "treasury_receipts_read" on storage.objects;
create policy "treasury_receipts_read" on storage.objects
  for select using (
    bucket_id = 'treasury-receipts'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "treasury_receipts_insert" on storage.objects;
create policy "treasury_receipts_insert" on storage.objects
  for insert with check (
    bucket_id = 'treasury-receipts'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "treasury_receipts_delete" on storage.objects;
create policy "treasury_receipts_delete" on storage.objects
  for delete using (
    bucket_id = 'treasury-receipts'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );
