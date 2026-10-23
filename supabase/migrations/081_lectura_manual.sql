-- 081 · Lectura de hoy cargada a mano
--
-- La Lectura de hoy sale de public/citas.json, determinística por fecha y
-- sin tabla (lib/citas.ts). Esta tabla permite reemplazarla un día puntual
-- con una cita escrita a mano: una fila por fecha civil (la de Montevideo,
-- el mismo corte que el sorteo). Si hay fila, la ven todos los creyentes
-- del país ese día, en la app y en el aviso de las 8:00; si no, sigue la
-- cita calculada.
--
-- Por ahora la pantalla del panel solo deja cargar la de MAÑANA. La tabla
-- ya admite cualquier fecha a propósito: agendar fechas especiales es
-- abrir el formulario, no otra migración.
--
-- Quién escribe: el admin nacional, porque la lectura es la misma para
-- todo el país. Quién lee: cualquiera, también sin sesión, porque la app
-- la levanta con el cliente anónimo dentro de unstable_cache (como
-- `localities`) y el contenido es el que igual ve toda la comunidad.

create table if not exists public.daily_reading_overrides (
  reading_date date primary key,
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  reference text not null check (char_length(btrim(reference)) between 1 and 300),
  -- Rótulo opcional en lugar del tema ("Día del Convenio").
  title text check (title is null or char_length(title) <= 80),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_reading_overrides enable row level security;

drop policy if exists daily_reading_overrides_select on public.daily_reading_overrides;
create policy daily_reading_overrides_select
  on public.daily_reading_overrides
  for select to anon, authenticated
  using (true);

drop policy if exists daily_reading_overrides_write on public.daily_reading_overrides;
create policy daily_reading_overrides_write
  on public.daily_reading_overrides
  for all to authenticated
  using (public.is_national_admin(auth.uid()))
  with check (public.is_national_admin(auth.uid()));
