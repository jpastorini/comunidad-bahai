-- ═════════════════════════════════════════════════════════════════
-- Informes de Tesorería (por localidad).
--
-- El tesorero elige un rango de fechas y la app arma el informe que se
-- presenta en la Fiesta de los Diecinueve Días: contribuciones del
-- período, egresos, resultado, saldos por fondo y por cuenta, aportes
-- por mes y presupuesto vs. ejecutado.
--
-- Dos columnas jsonb, con roles distintos:
--
--   `snapshot`  — las CIFRAS, congeladas. Se recalculan desde el libro
--                 cada vez que el tesorero guarda (hay botón para eso),
--                 pero nunca solas: un informe presentado en la Fiesta
--                 no puede cambiar porque después se cargó un
--                 movimiento más. Ver lib/treasury-reports.ts.
--   `editorial` — los TEXTOS: notas al pie de cada sección, "Destino de
--                 los Fondos", la meta de la Asamblea, la cita de
--                 cierre y la firma. Nada de esto sale del libro.
--
-- Ciclo: draft → published (reversible), como el Boletín.
--
-- CONFIDENCIALIDAD: el informe NO lleva nombres de contribuyentes. El
-- detalle de ingresos se publica por número de recibo, fecha y monto,
-- que es lo que la comunidad necesita ver. El libro sigue siendo
-- exclusivo de quien tiene `can_manage_treasury`; el informe, en
-- cambio, es para toda la comunidad.
--
-- `share_token` habilita el link público (/i/<token>) para compartir
-- fuera de la app. Se resuelve server-side con la service-role key, por
-- eso acá NO hay policy para `anon`.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.treasury_reports (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  -- Título y subtítulo de la portada: "Fiesta de los Diecinueve Días"
  -- y "Asmáʼ · «Nombres» · 183 E.B.".
  title text not null,
  subtitle text,
  -- El rango que define el informe. Los ingresos y egresos son los del
  -- rango; los SALDOS son acumulados hasta `period_to`, porque un saldo
  -- no tiene período (ver lib/treasury-reports.ts).
  period_from date not null,
  period_to date not null,
  -- Año bahá'í del ejercicio: define el eje de los gráficos anuales y
  -- con qué presupuesto se compara.
  bahai_year int,
  editorial jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- 64 hex chars aleatorios (dos uuid v4 sin guiones), igual que el Boletín.
  share_token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_to >= period_from)
);

create index if not exists treasury_reports_locality_idx
  on public.treasury_reports (locality_id, status, period_to desc);

drop trigger if exists set_locality_treasury_reports on public.treasury_reports;
create trigger set_locality_treasury_reports
  before insert on public.treasury_reports
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_reports enable row level security;

-- Lectura: cualquier creyente de la localidad ve los informes
-- PUBLICADOS (no llevan nombres); los borradores, solo el tesorero.
drop policy if exists treasury_reports_select on public.treasury_reports;
create policy treasury_reports_select on public.treasury_reports
  for select to authenticated
  using (
    (status = 'published' and locality_id = public.current_locality_id())
    or (
      public.has_treasury_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or public.is_national_admin(auth.uid())
  );

-- Escritura: solo el tesorero, y solo sobre su localidad.
drop policy if exists treasury_reports_tag_write on public.treasury_reports;
create policy treasury_reports_tag_write on public.treasury_reports
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Presupuesto ↔ libro ─────────────────────────────────────────
-- El presupuesto (migración 024) nombra sus categorías con texto libre
-- ("Tareas Administrativas", "Aporte al Fondo Nacional"); el libro
-- tiene las suyas ("Gastos Operativos", "Celebraciones"). Los nombres
-- no coinciden y no hay forma de adivinar el par, así que el tesorero
-- lo declara: cada línea del presupuesto apunta a la categoría del
-- libro cuyos movimientos son su ejecutado.
--
-- Sin este vínculo la comparación presupuesto vs. ejecutado no se puede
-- calcular; una línea sin mapear se informa como "sin vincular" en vez
-- de mostrar cero, que se leería como "no se gastó nada".
--
-- Son DOS columnas porque la granularidad no es la misma en las dos
-- puntas: "Enseñanza" del presupuesto abarca una categoría entera del
-- libro (materiales, proyectos, actividades educativas), mientras que
-- "Aporte al Fondo Nacional" es una subcategoría suelta adentro de
-- "Gastos Operativos". Si están las dos, manda la subcategoría, que es
-- la más específica.
alter table public.treasury_budget_items
  add column if not exists ledger_category_id uuid
    references public.treasury_categories(id) on delete set null;

alter table public.treasury_budget_items
  add column if not exists ledger_subcategory_id uuid
    references public.treasury_subcategories(id) on delete set null;
