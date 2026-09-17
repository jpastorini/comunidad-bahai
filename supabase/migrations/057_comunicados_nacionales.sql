-- ═════════════════════════════════════════════════════════════════
-- 057 · Comunicados nacionales: la AEN le habla al país.
--
-- Tercer paso del Usuario Nacional (055 pertenencia, 056 el tenant).
-- Por debajo NO es una tabla nueva ni un tipo nuevo: es un comunicado
-- con `locality_id IS NULL`, que desde la 021 significa "lo ven todas
-- las localidades", y un `source` propio para distinguirlo del de una
-- Asamblea Local y de los mensajes de la Casa Universal.
--
-- Quién puede escribirlo ya lo resolvió la 056: `is_national_assembly()`
-- en la policy de `messages`. Acá van las tres piezas que faltaban.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. El origen nuevo ───────────────────────────────────────────
-- 'casa_universal' (nacional, sin autor local) · 'asamblea_local' (el
-- comunicado de la AEL) · 'asamblea_nacional' (el de la AEN, nuevo).

alter table public.messages drop constraint if exists messages_source_check;
alter table public.messages add constraint messages_source_check
  check (source in ('casa_universal', 'asamblea_local', 'asamblea_nacional'));

-- ─── 2. Ocultar un comunicado nacional ────────────────────────────
-- El comunicado local es de tu Asamblea y no se esconde; el nacional
-- llega a todo el país y no siempre te toca, así que se puede sacar de
-- la lista. Es una marca POR PERSONA en la fila de lectura que ya
-- existe (048), no una tabla aparte.
--
-- "Ocultar exige haberlo visto" no necesita constraint: `seen_at` es
-- `not null default now()`, así que no existe una fila oculta sin
-- vista. Quien oculta queda contado como que lo vio, que es lo correcto
-- —descartarlo es un acto de lectura— y evita el falso "no vio" en el
-- informe de la AEN.

alter table public.message_reads
  add column if not exists hidden_at timestamptz;

comment on column public.message_reads.hidden_at is
  'La persona sacó este comunicado de su lista (solo los nacionales). Reversible desde "ver ocultos". NULL = visible.';

-- ─── 3. La AEN lee el informe de SUS comunicados ──────────────────
-- ⚠️ Sin esto el informe nacional sale vacío. `message_reads` lleva la
-- localidad de QUIEN LEE (trigger de la 012), y la policy de la 048
-- solo deja al admin ver las filas de su propia localidad: la AEN,
-- parada en la Comunidad Nacional, vería únicamente las lecturas de sus
-- pocos miembros y ninguna de las 25 personas de Montevideo que sí lo
-- leyeron.
--
-- La línea nueva es acotada a propósito: la AEN lee las filas de los
-- comunicados NACIONALES (los de `locality_id is null`) y de ningún
-- otro. Los comunicados de una Asamblea Local, y quién los leyó, siguen
-- siendo de esa Asamblea.

drop policy if exists "message_reads_select" on public.message_reads;
create policy "message_reads_select" on public.message_reads
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
    or (
      public.is_national_assembly(auth.uid())
      and exists (
        select 1 from public.messages m
        where m.id = message_reads.message_id
          and m.locality_id is null
      )
    )
  );

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional, para correr en el SQL Editor).
--
--   -- El origen nuevo se acepta:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint where conname = 'messages_source_check';
--
--   -- Un comunicado nacional se ve desde cualquier localidad, porque
--   -- la policy de lectura de `messages` (021) devuelve todo lo que
--   -- tiene locality_id null. Impersonando a un creyente cualquiera:
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UUID>","role":"authenticated"}';
--   select id, title, source from public.messages
--   where source = 'asamblea_nacional';
--   rollback;
-- ═════════════════════════════════════════════════════════════════
