-- ═════════════════════════════════════════════════════════════════
-- 070 · Quien entra, entra como Amigo/a de la Fe
--
-- Pedido el 2026-09-28. Hasta acá quien se registraba eligiendo su
-- localidad de la lista quedaba como CREYENTE (default de la 047), con
-- Tesorería, Fiesta y comunicados "solo creyentes" desde el primer
-- toque, y la Asamblea se enteraba después. Ahora entra como Amigo/a de
-- la Fe, la Asamblea recibe el aviso (lib/new-member-alert.ts) y lo
-- habilita como creyente desde su ficha en /admin/miembros.
--
-- Lo único que decide la condición al entrar:
--   · Sin invitación (elige de la lista)   → Amigo/a (este default).
--   · Link de invitación para creyentes    → creyente
--     (applyInviteToken escribe is_bahai explícito según el link).
--   · Link de invitación para amigos       → Amigo/a.
-- Una mudanza aprobada entre localidades conserva la condición que la
-- persona ya tenía.
-- ═════════════════════════════════════════════════════════════════

alter table public.profiles
  alter column is_bahai set default false;

-- Quien se registró pero todavía no eligió comunidad pasa a la misma
-- regla: si elige de la lista mañana, que entre como entraría hoy
-- alguien nuevo. Solo perfiles sin cargos, que es lo que la constraint
-- profiles_amigo_sin_cargos (047) exige de un amigo.
update public.profiles p
set is_bahai = false
where p.locality_id is null
  and p.is_bahai
  and p.role = 'member'
  and not p.can_respond_chat
  and not p.can_manage_treasury
  and not p.can_manage_bulletin
  and not p.is_national_admin
  and not exists (
    select 1 from public.profile_localities m where m.profile_id = p.id
  );

-- Verificación (opcional):
--   select column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name = 'is_bahai';          -- → false
