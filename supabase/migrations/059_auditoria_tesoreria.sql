-- 059 · Auditoría de Tesorería: corridas y despacho de hallazgos.
--
-- El motor de la auditoría NO vive acá: son ~53 reglas deterministas en
-- `lib/treasury-audit.ts`, funciones puras sobre datos ya cargados, sin
-- llamadas a la red y sin costo. Esta migración solo guarda lo que esas
-- reglas encontraron y lo que la Asamblea decidió al respecto.
--
-- Por qué se persiste, si las reglas se pueden volver a correr:
--
--  · Una corrida es EVIDENCIA, igual que el snapshot de un cierre. "El
--    12 de setiembre el libro estaba así" es lo que se puede mostrar
--    después, y no cambia porque hoy se haya corregido algo.
--
--  · Un hallazgo despachado no puede volver a gritar. Sin `treasury_audit_
--    dispositions`, la corrida siguiente vuelve a listar los 40 gastos sin
--    comprobante de la planilla importada y la herramienta se vuelve ruido
--    en la segunda semana. Por eso el despacho se guarda por CLAVE de
--    hallazgo (`finding_key`, estable entre corridas por diseño: sale del
--    código de la regla más la identidad de aquello de lo que habla, nunca
--    del índice en una lista ni de la fecha) y no por corrida.
--
-- Alcance: una auditoría es de UNA comunidad. La Comunidad Nacional (056)
-- es una localidad más y se audita igual; las reglas que salen del
-- estatuto de una Asamblea Local o de la Fiesta de los 19 Días se apagan
-- solas por `appliesTo`, en el TypeScript. Acá no hay nada que distinga
-- un tenant del otro.
--
-- Confidencialidad: las dos tablas viven detrás del tag
-- `can_manage_treasury`, como el libro. Un hallazgo puede nombrar a un
-- contribuyente, así que vale exactamente lo mismo que un asiento.

-- ─── 1. Las corridas ─────────────────────────────────────────────

create table if not exists public.treasury_audits (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,

  -- El rango auditado. Por defecto el ejercicio contable en curso, pero
  -- el tesorero puede pedir otro (un ejercicio cerrado, por ejemplo).
  period_from date not null,
  period_to date not null,
  -- Ejercicio contable (Riḍván a Riḍván) que cubre el rango, para poder
  -- listar "las auditorías del 183" sin recalcular.
  bahai_year int,

  -- Los hallazgos tal cual los devolvió el motor: un array de objetos
  -- {code, key, severity, basis, title, detail, entryIds, figures}. Es un
  -- snapshot congelado, igual que `treasury_closings.snapshot` y
  -- `treasury_reports.snapshot`: no se recalcula al renderizar.
  findings jsonb not null default '[]'::jsonb,
  findings_count int not null default 0,
  high_count int not null default 0,
  medium_count int not null default 0,
  low_count int not null default 0,

  -- Lo que escribió el modelo: la orientación, los hallazgos agrupados y
  -- las recomendaciones. NULL cuando la corrida fue solo de reglas (la
  -- que dispara la pantalla de cierres, que es gratis e instantánea).
  -- ⚠️ El modelo no inventa hallazgos ni recalcula cifras: recibe la
  -- lista cerrada de `findings` y solo agrupa, prioriza y redacta.
  summary jsonb,
  -- Qué modelo lo escribió, para saber a qué atenerse al releer un
  -- informe viejo.
  model text,

  run_by uuid references auth.users(id) on delete set null,
  run_at timestamptz not null default now(),

  check (period_to >= period_from)
);

comment on table public.treasury_audits is
  'Una corrida de la auditoría de Tesorería. `findings` es evidencia congelada, no se recalcula.';
comment on column public.treasury_audits.summary is
  'Lo que redactó el modelo a partir de `findings`. NULL en una corrida solo de reglas.';

create index if not exists treasury_audits_locality_idx
  on public.treasury_audits (locality_id, run_at desc);

drop trigger if exists set_locality_treasury_audits on public.treasury_audits;
create trigger set_locality_treasury_audits
  before insert on public.treasury_audits
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_audits enable row level security;

drop policy if exists "treasury_audits_tag_all" on public.treasury_audits;
create policy "treasury_audits_tag_all" on public.treasury_audits
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── 2. El despacho de un hallazgo ───────────────────────────────
--
-- Una fila por (comunidad, clave de hallazgo). Sobrevive a las corridas:
-- es lo que hace que la auditoría sea un papel de trabajo y no un botón
-- que asusta.
--
-- 'pendiente' existe para poder DESHACER un despacho sin borrar el
-- registro de quién lo había marcado y cuándo: la fila queda, con su
-- historia, y el hallazgo vuelve a aparecer como pendiente.

create table if not exists public.treasury_audit_dispositions (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,

  -- La clave estable del hallazgo, p. ej. "RECIBO_HUECO:212".
  finding_key text not null,
  -- El código de la regla, desnormalizado, para poder contar por regla
  -- sin parsear la clave.
  code text not null,

  status text not null default 'pendiente'
    check (status in ('pendiente', 'corregido', 'no_aplica')),
  -- Obligatorio para 'no_aplica': decir que algo no corresponde sin
  -- explicar por qué es exactamente lo que una auditoría no acepta.
  reason text,

  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  check (status <> 'no_aplica' or (reason is not null and btrim(reason) <> '')),
  unique (locality_id, finding_key)
);

comment on table public.treasury_audit_dispositions is
  'Qué decidió la Asamblea sobre un hallazgo. Por clave estable, no por corrida.';
comment on column public.treasury_audit_dispositions.finding_key is
  'Clave estable del hallazgo (código de regla + identidad del objeto). Si cambia, el despacho se pierde y el hallazgo reaparece.';

create index if not exists treasury_audit_dispositions_code_idx
  on public.treasury_audit_dispositions (locality_id, code);

drop trigger if exists set_locality_treasury_audit_dispositions
  on public.treasury_audit_dispositions;
create trigger set_locality_treasury_audit_dispositions
  before insert on public.treasury_audit_dispositions
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_audit_dispositions enable row level security;

drop policy if exists "treasury_audit_dispositions_tag_all"
  on public.treasury_audit_dispositions;
create policy "treasury_audit_dispositions_tag_all" on public.treasury_audit_dispositions
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── 3. Nota de crecimiento ──────────────────────────────────────
--
-- `treasury_audits` crece con cada corrida y cada fila lleva el array de
-- hallazgos entero. A este tamaño (una comunidad corre esto unas pocas
-- veces por mes) no importa. Si algún día molesta, el camino es borrar
-- las corridas solo-reglas de más de un año y conservar las que tienen
-- `summary` (las que alguien leyó de verdad).
