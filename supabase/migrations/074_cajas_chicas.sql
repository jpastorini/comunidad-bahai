-- 074 · Cajas chicas: fondo fijo, responsable, rendición y arqueo
--
-- Hasta acá la caja chica era una cuenta más del catálogo (040) que
-- solo podía tocar quien tiene el tag de Tesorería. La Secretaría y los
-- coordinadores de instituto manejan efectivo y no hay forma de darles
-- una caja sin darles el libro entero. Esto lo resuelve con el esquema
-- que un auditor espera —FONDO FIJO ("imprest")— y tres reglas decididas
-- con el usuario el 2026-09-29:
--
--   · Los gastos del responsable NO entran al libro de a uno: se
--     acumulan en una RENDICIÓN y entran todos juntos cuando el tesorero
--     la aprueba, con la reposición desde la cuenta de origen atada.
--     El libro lo sigue escribiendo solo el tesorero.
--   · La rendición es mensual (la Guía la pide antes del cierre) y
--     además se puede rendir antes, cuando la caja baja o hace falta.
--   · Los aportes en efectivo se depositan ÍNTEGROS: la caja chica gasta
--     solo lo que se le repone. Es la regla de "no compensar" ingresos
--     con gastos; la app la recomienda (regla de auditoría), no la
--     bloquea.
--
-- Cuatro tablas. `treasury_cash_boxes` cuelga de una cuenta del catálogo
-- (así el saldo sigue saliendo del libro como el de cualquier cuenta) y
-- agrega responsable, fondo fijo por moneda, cuenta de origen y fondo por
-- defecto. `treasury_cash_reports` es la rendición (borrador → enviada →
-- aprobada, o devuelta), con el arqueo declarado al enviar.
-- `treasury_cash_lines` son los gastos de la rendición, con su
-- comprobante en el bucket de comprobantes (043) bajo
-- <locality>/caja/<box>/…, que al aprobar pasan a ser asientos +
-- `treasury_attachments` apuntando al MISMO archivo. `treasury_cash_counts`
-- son los arqueos del tesorero sobre cualquier caja.
--
-- ⚠️ La RLS del responsable es lo que hace posible todo esto sin abrirle
-- el libro: lee SU caja, escribe SUS rendiciones mientras están en
-- borrador o devueltas, y el saldo lo consulta por una función security
-- definer que devuelve solo números de esa cuenta.

-- ─── 1. Las cajas ─────────────────────────────────────────────────

create table if not exists public.treasury_cash_boxes (
  id                uuid primary key default gen_random_uuid(),
  locality_id       uuid not null references public.localities(id) on delete cascade,
  account_id        uuid not null unique references public.treasury_accounts(id) on delete restrict,
  holder_profile_id uuid references public.profiles(id) on delete set null,
  -- De dónde se repone (Prex, BROU). NULL = la reposición se carga a mano.
  source_account_id uuid references public.treasury_accounts(id) on delete set null,
  -- El fondo que gasta esta caja por defecto (Secretaría: Local; un
  -- coordinador de instituto: Enseñanza). El rubro puede cambiarlo.
  default_fund_id   uuid references public.treasury_funds(id) on delete set null,
  fixed_uyu         numeric(14, 2) not null default 0 check (fixed_uyu >= 0),
  fixed_usd         numeric(14, 2) not null default 0 check (fixed_usd >= 0),
  notes             text,
  is_active         boolean not null default true,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.treasury_cash_boxes is
  'Una caja chica: cuenta del catálogo + responsable + fondo fijo por moneda (074).';

create index if not exists treasury_cash_boxes_holder_idx
  on public.treasury_cash_boxes (holder_profile_id) where holder_profile_id is not null;

drop trigger if exists set_locality_treasury_cash_boxes on public.treasury_cash_boxes;
create trigger set_locality_treasury_cash_boxes
  before insert on public.treasury_cash_boxes
  for each row execute function public.set_locality_from_auth();

-- ─── 2. Las rendiciones ───────────────────────────────────────────

create table if not exists public.treasury_cash_reports (
  id            uuid primary key default gen_random_uuid(),
  locality_id   uuid not null references public.localities(id) on delete cascade,
  box_id        uuid not null references public.treasury_cash_boxes(id) on delete cascade,
  status        text not null default 'borrador'
                  check (status in ('borrador', 'enviada', 'devuelta', 'aprobada')),
  -- El arqueo que declara el responsable al enviar: cuánto efectivo tiene.
  counted_uyu   numeric(14, 2) check (counted_uyu is null or counted_uyu >= 0),
  counted_usd   numeric(14, 2) check (counted_usd is null or counted_usd >= 0),
  -- Lo que DEBERÍA tener según el libro menos los gastos de esta
  -- rendición, congelado al enviar: la diferencia es lo que el tesorero
  -- mira primero.
  expected_uyu  numeric(14, 2),
  expected_usd  numeric(14, 2),
  note          text,
  submitted_at  timestamptz,
  submitted_by  uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id) on delete set null,
  review_note   text,
  -- La reposición generada al aprobar (las dos patas del libro).
  transfer_group_id uuid,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.treasury_cash_reports is
  'Rendición de una caja chica: gastos acumulados + arqueo declarado, que el tesorero aprueba (074).';

create index if not exists treasury_cash_reports_box_idx
  on public.treasury_cash_reports (box_id, status, created_at desc);

-- Una sola rendición abierta (borrador o devuelta) por caja.
drop index if exists public.treasury_cash_reports_open_uniq;
create unique index treasury_cash_reports_open_uniq
  on public.treasury_cash_reports (box_id)
  where status in ('borrador', 'devuelta');

drop trigger if exists set_locality_treasury_cash_reports on public.treasury_cash_reports;
create trigger set_locality_treasury_cash_reports
  before insert on public.treasury_cash_reports
  for each row execute function public.set_locality_from_auth();

-- ─── 3. Las líneas (los gastos de la rendición) ───────────────────

create table if not exists public.treasury_cash_lines (
  id              uuid primary key default gen_random_uuid(),
  locality_id     uuid not null references public.localities(id) on delete cascade,
  report_id       uuid not null references public.treasury_cash_reports(id) on delete cascade,
  line_date       date not null,
  currency        text not null check (currency in ('UYU', 'USD')),
  amount          numeric(14, 2) not null check (amount > 0),
  subcategory_id  uuid references public.treasury_subcategories(id) on delete restrict,
  description     text,
  -- El comprobante, en el bucket treasury-receipts bajo <locality>/caja/<box>/.
  storage_path    text,
  file_name       text,
  mime_type       text,
  size_bytes      int,
  -- El asiento que generó al aprobarse.
  entry_id        uuid references public.treasury_entries(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists treasury_cash_lines_report_idx
  on public.treasury_cash_lines (report_id, line_date, created_at);

drop trigger if exists set_locality_treasury_cash_lines on public.treasury_cash_lines;
create trigger set_locality_treasury_cash_lines
  before insert on public.treasury_cash_lines
  for each row execute function public.set_locality_from_auth();

-- ─── 4. Los arqueos del tesorero ──────────────────────────────────

create table if not exists public.treasury_cash_counts (
  id            uuid primary key default gen_random_uuid(),
  locality_id   uuid not null references public.localities(id) on delete cascade,
  box_id        uuid not null references public.treasury_cash_boxes(id) on delete cascade,
  counted_on    date not null,
  counted_uyu   numeric(14, 2) not null default 0 check (counted_uyu >= 0),
  counted_usd   numeric(14, 2) not null default 0 check (counted_usd >= 0),
  expected_uyu  numeric(14, 2) not null default 0,
  expected_usd  numeric(14, 2) not null default 0,
  note          text,
  counted_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table public.treasury_cash_counts is
  'Arqueo de una caja chica: lo contado contra lo que dice el libro, con fecha (074).';

create index if not exists treasury_cash_counts_box_idx
  on public.treasury_cash_counts (box_id, counted_on desc);

drop trigger if exists set_locality_treasury_cash_counts on public.treasury_cash_counts;
create trigger set_locality_treasury_cash_counts
  before insert on public.treasury_cash_counts
  for each row execute function public.set_locality_from_auth();

-- ─── 5. Helper: ¿soy el responsable de esta caja? ─────────────────

create or replace function public.is_cash_box_holder(p_box uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.treasury_cash_boxes b
    where b.id = p_box and b.holder_profile_id = auth.uid()
  );
$$;

revoke all on function public.is_cash_box_holder(uuid) from public, anon;
grant execute on function public.is_cash_box_holder(uuid) to authenticated;

-- ─── 6. RLS ───────────────────────────────────────────────────────

alter table public.treasury_cash_boxes   enable row level security;
alter table public.treasury_cash_reports enable row level security;
alter table public.treasury_cash_lines   enable row level security;
alter table public.treasury_cash_counts  enable row level security;

-- El tesorero: todo, en su localidad (mismo candado que el libro).
drop policy if exists "cash_boxes_tag_all" on public.treasury_cash_boxes;
create policy "cash_boxes_tag_all" on public.treasury_cash_boxes
  for all
  using (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id());

drop policy if exists "cash_reports_tag_all" on public.treasury_cash_reports;
create policy "cash_reports_tag_all" on public.treasury_cash_reports
  for all
  using (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id());

drop policy if exists "cash_lines_tag_all" on public.treasury_cash_lines;
create policy "cash_lines_tag_all" on public.treasury_cash_lines
  for all
  using (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id());

drop policy if exists "cash_counts_tag_all" on public.treasury_cash_counts;
create policy "cash_counts_tag_all" on public.treasury_cash_counts
  for all
  using (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id());

-- El responsable: lee su caja y sus arqueos; escribe sus rendiciones
-- mientras no estén aprobadas. Sin sombrero: la caja es de la persona,
-- la vea desde la comunidad que la vea (igual que "Mis aportes").
drop policy if exists "cash_boxes_holder_select" on public.treasury_cash_boxes;
create policy "cash_boxes_holder_select" on public.treasury_cash_boxes
  for select using (holder_profile_id = auth.uid());

drop policy if exists "cash_counts_holder_select" on public.treasury_cash_counts;
create policy "cash_counts_holder_select" on public.treasury_cash_counts
  for select using (public.is_cash_box_holder(box_id));

drop policy if exists "cash_reports_holder_select" on public.treasury_cash_reports;
create policy "cash_reports_holder_select" on public.treasury_cash_reports
  for select using (public.is_cash_box_holder(box_id));

drop policy if exists "cash_reports_holder_insert" on public.treasury_cash_reports;
create policy "cash_reports_holder_insert" on public.treasury_cash_reports
  for insert with check (
    public.is_cash_box_holder(box_id) and status = 'borrador'
  );

-- Puede editar el borrador o la devuelta, y pasarla a enviada. Nunca a
-- aprobada, y nunca tocar una enviada o aprobada.
drop policy if exists "cash_reports_holder_update" on public.treasury_cash_reports;
create policy "cash_reports_holder_update" on public.treasury_cash_reports
  for update
  using (public.is_cash_box_holder(box_id) and status in ('borrador', 'devuelta'))
  with check (public.is_cash_box_holder(box_id) and status in ('borrador', 'enviada'));

drop policy if exists "cash_lines_holder_all" on public.treasury_cash_lines;
create policy "cash_lines_holder_all" on public.treasury_cash_lines
  for all
  using (
    exists (
      select 1 from public.treasury_cash_reports r
      where r.id = report_id
        and public.is_cash_box_holder(r.box_id)
    )
  )
  with check (
    exists (
      select 1 from public.treasury_cash_reports r
      where r.id = report_id
        and public.is_cash_box_holder(r.box_id)
        and r.status in ('borrador', 'devuelta')
    )
  );

-- ─── 7. El saldo de la caja, para el responsable ──────────────────
-- Solo números de ESA cuenta, y solo si quien pregunta es el responsable
-- o tiene el tag. Los movimientos anulados no suman (054).

create or replace function public.cash_box_balance(p_box uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select case
    when not (public.is_cash_box_holder(p_box) or public.has_treasury_tag(auth.uid()))
      then '[]'::jsonb
    else coalesce((
      select jsonb_agg(jsonb_build_object('currency', t.currency, 'amount', t.total) order by t.currency)
      from (
        select e.currency, sum(e.amount) as total
        from public.treasury_entries e
        join public.treasury_cash_boxes b on b.account_id = e.account_id
        where b.id = p_box
          and e.voided_at is null
        group by e.currency
      ) t
    ), '[]'::jsonb)
  end;
$$;

revoke all on function public.cash_box_balance(uuid) from public, anon;
grant execute on function public.cash_box_balance(uuid) to authenticated;

-- ─── 8. Storage: los comprobantes del responsable ─────────────────
-- Mismo bucket privado de los comprobantes (043), carpeta
-- <locality>/caja/<box>/<uuid>.<ext>. El responsable sube, ve y borra
-- SOLO en la carpeta de su caja; el tesorero ya podía todo en la
-- localidad. Al aprobar, `treasury_attachments` apunta al mismo archivo.

drop policy if exists "treasury_receipts_holder_read" on storage.objects;
create policy "treasury_receipts_holder_read" on storage.objects
  for select using (
    bucket_id = 'treasury-receipts'
    and (storage.foldername(name))[2] = 'caja'
    and exists (
      select 1 from public.treasury_cash_boxes b
      where b.id::text = (storage.foldername(name))[3]
        and b.holder_profile_id = auth.uid()
    )
  );

drop policy if exists "treasury_receipts_holder_insert" on storage.objects;
create policy "treasury_receipts_holder_insert" on storage.objects
  for insert with check (
    bucket_id = 'treasury-receipts'
    and (storage.foldername(name))[2] = 'caja'
    and exists (
      select 1 from public.treasury_cash_boxes b
      where b.id::text = (storage.foldername(name))[3]
        and b.holder_profile_id = auth.uid()
        and b.locality_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "treasury_receipts_holder_delete" on storage.objects;
create policy "treasury_receipts_holder_delete" on storage.objects
  for delete using (
    bucket_id = 'treasury-receipts'
    and (storage.foldername(name))[2] = 'caja'
    and exists (
      select 1 from public.treasury_cash_boxes b
      where b.id::text = (storage.foldername(name))[3]
        and b.holder_profile_id = auth.uid()
    )
  );
