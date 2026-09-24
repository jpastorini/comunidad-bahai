-- 064 · Servicio: que ofrecerse funcione, y que no se lea lo ajeno
--
-- La tabla `service_volunteers` existe desde el schema inicial, pero la
-- pantalla del creyente nunca escribió en ella (el botón "Ofrecerme" no
-- tenía acción). Al conectarla aparecen dos agujeros de la época anterior
-- a la multi-tenencia (012), que esa migración arregló en `service_needs`
-- y no en esta tabla:
--
--   1. La lectura era `using (true)`: cualquiera —incluso sin sesión, por
--      PostgREST— veía quién se ofreció para qué en TODAS las localidades.
--      Ahora cada persona lee sus propias filas y la Asamblea las de su
--      localidad. La comunidad solo ve cuántos se ofrecieron, por la
--      función de abajo, sin nombres.
--   2. El insert solo pedía `auth.uid() = user_id`: se podía uno anotar a
--      una necesidad de otra localidad con solo saber su id. Ahora la
--      necesidad tiene que ser visible para quien se anota (el `exists`
--      corre con la RLS de `service_needs`, que acota por localidad).

drop policy if exists "service_volunteers_select_all" on public.service_volunteers;
drop policy if exists "service_volunteers_select_scope" on public.service_volunteers;
create policy "service_volunteers_select_scope" on public.service_volunteers
  for select using (
    user_id = auth.uid()
    or public.is_national_admin(auth.uid())
    or (
      public.is_admin(auth.uid())
      and exists (
        select 1 from public.service_needs n
        where n.id = need_id
          and n.locality_id = public.current_locality_id()
      )
    )
  );

drop policy if exists "service_volunteers_insert_self" on public.service_volunteers;
create policy "service_volunteers_insert_self" on public.service_volunteers
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.service_needs n where n.id = need_id)
  );

-- El delete propio ("retirarme") ya existía y queda igual.

-- Cuántos se ofrecieron a cada necesidad de la localidad de quien pregunta.
-- Security definer porque la RLS de arriba ya no deja contar filas ajenas;
-- devuelve solo números, nunca un nombre.
create or replace function public.service_volunteer_counts()
returns table (need_id uuid, volunteers integer)
language sql
stable
security definer
set search_path = public
as $$
  select v.need_id, count(*)::integer
  from public.service_volunteers v
  join public.service_needs n on n.id = v.need_id
  where n.locality_id = public.current_locality_id()
  group by v.need_id;
$$;

revoke all on function public.service_volunteer_counts() from public;
grant execute on function public.service_volunteer_counts() to authenticated;
