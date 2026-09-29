-- 072 · Tablero de Tesorería: tarjetas de atención que se pueden ocultar
--
-- El Inicio del panel muestra, a quien tiene el tag de Tesorería y arriba
-- de todo, lo que pide atención del libro: el mes que falta cerrar, los
-- hallazgos graves de la última auditoría, la conciliación pendiente, el
-- estado del Fondo sin compartir, los recibos sin emitir, el informe de
-- compromisos del mes. Nada de eso es dato nuevo: sale de las tablas que
-- ya existen (054, 059, 061, 063, 066).
--
-- Lo único que hay que guardar es QUÉ TARJETA OCULTÓ CADA PERSONA. Es por
-- persona y no por comunidad (dos tesoreros pueden querer ver cosas
-- distintas), y va en la base y no en localStorage para que siga oculta
-- en el celular después de ocultarla en la PC.
--
-- La clave lleva el período o el objeto adentro ("cierre:2026-08",
-- "auditoria:<id de la corrida>", "compromisos:2026-09"): ocultar la
-- tarjeta de agosto no oculta la de setiembre. Las filas viejas quedan
-- —son inofensivas y pesan nada—; si algún día molestan, se borran las
-- de más de un año.

create table if not exists public.admin_attention_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  locality_id  uuid not null references public.localities(id) on delete cascade,
  item_key     text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, locality_id, item_key)
);

comment on table public.admin_attention_dismissals is
  'Tarjetas de atención del Inicio del panel que cada persona ocultó, por comunidad y clave.';

alter table public.admin_attention_dismissals enable row level security;

-- Cada persona ve y toca solo las suyas. La localidad se escribe desde la
-- app (el sombrero puesto), y la policy exige que sea la propia para que
-- nadie oculte tarjetas "a nombre de" otra comunidad.
drop policy if exists "attention_dismissals_self" on public.admin_attention_dismissals;
create policy "attention_dismissals_self" on public.admin_attention_dismissals
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and locality_id = public.current_locality_id()
  );
