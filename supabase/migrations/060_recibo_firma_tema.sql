-- ═════════════════════════════════════════════════════════════════
-- 060 · El recibo deja de ser el mismo para todo el país:
--       firma, nombre del Tesorero/a y tema de color, por comunidad.
--
-- Qué estaba mal, que es lo que explica la forma de esta migración:
--
--  · La FIRMA era un archivo del repo, `public/recibo/firma.png`,
--    extraído del Apps Script de la planilla de Montevideo y servido
--    igual a todas las localidades. Con la Comunidad Nacional (056) eso
--    dejó de ser un detalle: la AEN imprimiría la firma del tesorero de
--    Montevideo en sus propios recibos.
--
--  · El NOMBRE bajo la firma lo ponía la pantalla del tesorero con
--    `session.profile.full_name`, o sea el de quien tuviera el recibo
--    abierto. La copia del creyente, en cambio, salía de `my_receipt()`.
--    Las dos caras del mismo papel podían decir cosas distintas.
--
--  · Los COLORES eran una decena de hexadecimales terracota sueltos en
--    el componente. La Tesorería Nacional emite en azul oscuro.
--
-- La decisión de fondo: el nombre del Tesorero/a NO es un dato nuevo. Ya
-- está declarado en Datos de la Asamblea (052), por ejercicio y con
-- `display_name` siempre. Duplicarlo acá sería el problema que ya tienen
-- las metas (viven en dos lados y se cargan dos veces), así que
-- `treasury_receipt_settings.treasurer_name` es un OVERRIDE opcional y la
-- fuente normal sigue siendo la composición de la Asamblea.
--
-- Y UNA sola función resuelve quién firma —`receipt_signer_name()`—, que
-- usan las DOS caras: la pantalla del tesorero por RPC y la copia del
-- creyente desde adentro de `my_receipt()`. Es lo que garantiza que no
-- puedan volver a divergir.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. La configuración del recibo, una fila por localidad ────────
-- Vive detrás del tag `can_manage_treasury` y no del rol admin: quien
-- tiene el PNG de la firma escaneada es el tesorero, y el tema de color
-- es una decisión suya. Por eso es tabla propia y no columnas en
-- `assembly_records`, cuya RLS es admin-only a propósito (052).

create table if not exists public.treasury_receipt_settings (
  id                    uuid primary key default gen_random_uuid(),
  locality_id           uuid not null unique references public.localities(id) on delete cascade,
  -- Override del nombre que va bajo la firma. NULL = se resuelve desde
  -- la composición de la Asamblea (ver `receipt_signer_name`).
  treasurer_name        text,
  -- Lo que dice el renglón sobre el nombre. NULL = "Tesorero/a de la
  -- Asamblea". La AEN quizá quiera "Tesorero/a de la Asamblea Nacional".
  treasurer_title       text,
  signature_path        text,
  signature_file_name   text,
  signature_uploaded_at timestamptz,
  -- El juego completo de tonos vive en el TypeScript (lib/receipt-theme.ts);
  -- acá solo se guarda cuál. Un hex libre no alcanzaría: la hoja deriva
  -- tres paradas de degradé, dos fondos de banda y cuatro tonos de texto,
  -- y con un color elegido a mano el texto del encabezado desaparece.
  theme                 text not null default 'terracota'
                          check (theme in ('terracota', 'azul', 'verde', 'ciruela')),
  updated_by            uuid references public.profiles(id) on delete set null,
  updated_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

drop trigger if exists set_locality_treasury_receipt_settings on public.treasury_receipt_settings;
create trigger set_locality_treasury_receipt_settings
  before insert on public.treasury_receipt_settings
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_receipt_settings enable row level security;

-- El tesorero de la localidad, y el admin nacional. El creyente NO lee
-- esta tabla: el tema y la ruta de la firma le llegan por `my_receipt()`,
-- que es security definer y solo devuelve el recibo que es suyo.
drop policy if exists "treasury_receipt_settings_treasurer_all" on public.treasury_receipt_settings;
create policy "treasury_receipt_settings_treasurer_all" on public.treasury_receipt_settings
  for all to authenticated
  using (
    (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  )
  with check (
    (public.has_treasury_tag(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- ─── 2. Storage: bucket PRIVADO para las firmas ────────────────────
-- Privado, como los comprobantes de gastos (043) y a diferencia de los
-- cuatro buckets públicos: una firma escaneada suelta en una URL
-- adivinable es material para falsificar un papel. Se lee por URL
-- firmada, emitida en el servidor al renderizar el recibo.

insert into storage.buckets (id, name, public)
values ('recibo-firmas', 'recibo-firmas', false)
on conflict (id) do update set public = false;

-- ⚠️ La LECTURA es para cualquier autenticado, no por carpeta. Es
-- deliberado y es el único camino que funciona: un creyente de
-- Montevideo que aportó al Fondo Nacional abre una copia cuyo recibo es
-- de la Comunidad Nacional, así que tiene que poder firmar la URL de una
-- firma que no es la de SU localidad. Y no se pierde nada: esa misma
-- imagen va impresa en el recibo que recibe por WhatsApp.
drop policy if exists "recibo_firmas_read" on storage.objects;
create policy "recibo_firmas_read" on storage.objects
  for select using (
    bucket_id = 'recibo-firmas'
    and auth.uid() is not null
  );

-- Escribir, solo el tesorero y solo en la carpeta de su localidad
-- (paths <locality_id>/firma/<uuid>.png).
drop policy if exists "recibo_firmas_insert" on storage.objects;
create policy "recibo_firmas_insert" on storage.objects
  for insert with check (
    bucket_id = 'recibo-firmas'
    and (
      (public.has_treasury_tag(auth.uid())
        and (storage.foldername(name))[1] = public.current_locality_id()::text)
      or public.is_national_admin(auth.uid())
    )
  );

drop policy if exists "recibo_firmas_delete" on storage.objects;
create policy "recibo_firmas_delete" on storage.objects
  for delete using (
    bucket_id = 'recibo-firmas'
    and (
      (public.has_treasury_tag(auth.uid())
        and (storage.foldername(name))[1] = public.current_locality_id()::text)
      or public.is_national_admin(auth.uid())
    )
  );

-- ─── 3. Quién firma el recibo ──────────────────────────────────────
-- UNA función para las dos caras del papel. Security definer porque el
-- creyente no lee `assembly_members` (052 es admin-only) y porque
-- `my_receipt()` ya corre así.
--
-- El orden de precedencia, y por qué:
--
--  1. El override de la configuración, si el tesorero lo cargó.
--  2. El Tesorero/a declarado en el EJERCICIO QUE CONTIENE la fecha del
--     asiento. `assembly_terms.elected_on` es el primer día de Riḍván, o
--     sea exactamente el corte del ejercicio contable: el mayor
--     `elected_on` anterior o igual a la fecha es el ejercicio de ese
--     asiento. Un recibo del 183 reimpreso hoy sale con el tesorero del
--     183, que es lo que dice el papel original.
--  3. El del ejercicio más reciente cargado (si ninguno tiene fecha de
--     elección, que es lo que pasa mientras la composición se carga a
--     mano).
--  4. Quien marcó el recibo como emitido. Era lo PRIMERO hasta acá; pasa
--     a ser respaldo porque imprimir un recibo no convierte a nadie en
--     Tesorero/a, y el renglón de abajo dice "Tesorero/a de la Asamblea".
--  5. El tag `can_manage_treasury`, POR MEMBRESÍA (055/058), que es lo
--     que había antes de que existiera la composición de la Asamblea.

create or replace function public.receipt_signer_name(
  p_locality uuid,
  p_date date default null,
  p_issued_by uuid default null
)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(s.treasurer_name), '')
       from public.treasury_receipt_settings s
      where s.locality_id = p_locality),

    (select m.display_name
       from public.assembly_members m
       join public.assembly_terms t on t.id = m.term_id
      where m.locality_id = p_locality
        and m.office = 'tesorero'
        and t.elected_on is not null
        and p_date is not null
        and t.elected_on <= p_date
      order by t.elected_on desc
      limit 1),

    (select m.display_name
       from public.assembly_members m
       join public.assembly_terms t on t.id = m.term_id
      where m.locality_id = p_locality
        and m.office = 'tesorero'
      order by t.bahai_year desc
      limit 1),

    (select p.full_name
       from public.profiles p
      where p.id = p_issued_by),

    (select p.full_name
       from public.profile_localities ml
       join public.profiles p on p.id = ml.profile_id
      where ml.locality_id = p_locality
        and ml.can_manage_treasury
        and p.disabled_at is null
      order by (ml.role = 'admin') desc, p.created_at
      limit 1)
  );
$$;

revoke all on function public.receipt_signer_name(uuid, date, uuid) from public, anon;
grant execute on function public.receipt_signer_name(uuid, date, uuid) to authenticated;

-- ─── 4. `my_receipt()` suma firma, tema y el nombre resuelto ───────
-- Mismo cuerpo que la 058 (los datos fiscales salen de la localidad DEL
-- ASIENTO, no de la de quien mira), con tres campos nuevos y el nombre
-- del firmante delegado en la función de arriba.

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
    'voided_at', e.voided_at,
    'registered_name', a.registered_name,
    'rut', a.rut,
    'fiscal_address', a.fiscal_address,
    -- La apariencia del recibo es la de la comunidad que lo EMITIÓ, no la
    -- de quien lo abre: un aporte al Fondo Nacional se ve azul aunque lo
    -- mire un creyente de Montevideo.
    'theme', coalesce(rs.theme, 'terracota'),
    'signature_path', rs.signature_path,
    'treasurer_title', rs.treasurer_title,
    'treasurer_name', public.receipt_signer_name(
      e.locality_id, e.entry_date, e.receipt_issued_by
    )
  )
  from public.treasury_entries e
  join public.treasury_contributors c on c.id = e.contributor_id
  left join public.treasury_funds f on f.id = e.fund_id
  left join public.treasury_subcategories s on s.id = e.subcategory_id
  left join public.localities l on l.id = e.locality_id
  left join public.assembly_records a on a.locality_id = e.locality_id
  left join public.treasury_receipt_settings rs on rs.locality_id = e.locality_id
  where e.id = entry_id
    and auth.uid() is not null
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null;
$$;

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional, para correr en el SQL Editor).
--
--   -- Quién firma hoy el recibo de cada comunidad, y con qué tema.
--   select l.name,
--          public.receipt_signer_name(l.id, current_date) as firma,
--          coalesce(rs.theme, 'terracota')                as tema,
--          rs.signature_path is not null                  as tiene_firma
--     from public.localities l
--     left join public.treasury_receipt_settings rs on rs.locality_id = l.id
--    order by l.name;
--
--   -- Que el corte por ejercicio sea el que se espera: el tesorero de un
--   -- asiento viejo no tiene por qué ser el de hoy.
--   select e.entry_date,
--          public.receipt_signer_name(e.locality_id, e.entry_date) as firma
--     from public.treasury_entries e
--    where e.receipt_number is not null
--    order by e.entry_date
--    limit 20;
-- ═════════════════════════════════════════════════════════════════
