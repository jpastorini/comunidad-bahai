-- ═════════════════════════════════════════════════════════════════
-- Cerrar la escalada de privilegios en `profiles_update_self`.
--
-- La política original era:
--
--   create policy "profiles_update_self" on public.profiles
--     for update using (auth.uid() = id);
--
-- Sin `with check` y sin restricción de columnas. Como `profiles` es
-- accesible por PostgREST con la anon key, cualquier persona logueada
-- podía hacer un PATCH a su propia fila y cambiar:
--   · role                → 'member' a 'admin' (entrar al panel de la AEL)
--   · is_national_admin   → verse y gestionar TODAS las localidades
--   · can_respond_chat / can_manage_treasury / can_manage_bulletin
--   · locality_id         → mudarse solo, salteando la aprobación de la
--                           Asamblea destino (migración 029)
--   · disabled_at         → revertir un soft-disable (migración 035)
--
-- Ahora la política enumera las columnas privilegiadas y exige que
-- queden IGUAL que como estaban. Lo que el creyente sí puede editar de
-- su propia fila queda por descarte:
--   full_name, avatar_url, comunicados_seen_at,
--   prayer_reminder_enabled, daily_quote_push_enabled
--
-- Excepción de locality_id: se puede fijar cuando está en NULL, que es
-- el primer ingreso. Es exactamente lo que ya hacían en código
-- selectLocalityAction (caso 2) y applyInviteToken; ahora además lo
-- garantiza la base. Mudarse de comunidad sigue pasando por el flujo de
-- solicitud + aprobación.
--
-- Las políticas de Asamblea siguen intactas: en Postgres las policies
-- permisivas se combinan con OR, así que un admin editando cualquier
-- perfil (incluido el suyo) pasa por `profiles_admin_update`.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and exists (
      -- `p` es la fila COMO ESTÁ HOY (la subconsulta ve el snapshot previo
      -- al UPDATE); `profiles.*` sin alias es la fila NUEVA que se quiere
      -- escribir. Comparar una contra otra es lo que congela las columnas.
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = profiles.role
        and p.can_respond_chat = profiles.can_respond_chat
        and p.can_manage_treasury = profiles.can_manage_treasury
        and p.can_manage_bulletin = profiles.can_manage_bulletin
        and p.is_national_admin = profiles.is_national_admin
        and p.email is not distinct from profiles.email
        and p.disabled_at is not distinct from profiles.disabled_at
        and p.disabled_by is not distinct from profiles.disabled_by
        and p.created_at = profiles.created_at
        and (
          p.locality_id is not distinct from profiles.locality_id
          or p.locality_id is null -- primer ingreso: todavía no eligió
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- De paso: que un admin LOCAL no pueda repartir el tag nacional.
--
-- `profiles_admin_update` dejaba a cualquier role='admin' escribir
-- is_national_admin sobre cualquier perfil (incluido el propio). En la
-- app ese campo solo se toca desde /admin/nacional, detrás de
-- requireNationalAdmin(), así que la restricción no cambia ningún flujo
-- real: el Admin Nacional sigue pudiendo, vía `profiles_national_update`.
-- ─────────────────────────────────────────────────────────────────

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    and exists (
      select 1
      from public.profiles target
      where target.id = profiles.id
        and target.is_national_admin = profiles.is_national_admin
    )
  );

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional, para correr en el SQL Editor).
--
-- El SQL Editor corre como owner y la RLS no le aplica, así que hay que
-- impersonar a un usuario. Poné el uuid de un creyente común (role
-- 'member') en los tres lugares y corré el bloque entero:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UUID-DEL-CREYENTE>","role":"authenticated"}';
--
--   -- Debe funcionar (columnas propias):
--   update public.profiles set full_name = full_name where id = '<UUID-DEL-CREYENTE>';
--
--   -- Deben afectar 0 filas (la RLS las filtra en silencio):
--   update public.profiles set role = 'admin' where id = '<UUID-DEL-CREYENTE>';
--   update public.profiles set is_national_admin = true where id = '<UUID-DEL-CREYENTE>';
--   update public.profiles set disabled_at = null where id = '<UUID-DEL-CREYENTE>';
--
--   rollback;
--
-- Ojo: un UPDATE bloqueado por WITH CHECK tira error 42501
-- ("new row violates row-level security policy"), mientras que uno
-- bloqueado por USING devuelve 0 filas. Cualquiera de las dos cosas es
-- señal de que la política está haciendo su trabajo.
-- ═════════════════════════════════════════════════════════════════
