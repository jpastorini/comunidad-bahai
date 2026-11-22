-- 094 · Invitaciones diseñadas con AI: el registro que sostiene el límite.
--
-- El Creador de invitaciones puede pedirle a Claude el diseño de la
-- tarjeta (colores, composición e ilustración). Cada pedido cuesta, así
-- que hay un tope por INSTITUCIÓN: una invitación por hora, con hasta
-- tres intentos de esa misma invitación.
--
-- Una fila por generación lograda. `invitation_key` lo arma el navegador
-- al abrir el editor: los intentos de la misma invitación lo comparten.
--
-- Sin policies, a propósito (como `treasury_mp_settings`, 079): la lee y
-- la escribe solo el servidor con service-role, después de chequear el
-- permiso de quien pide.

create table if not exists public.invitation_generations (
  id             uuid primary key default gen_random_uuid(),
  locality_id    uuid not null references public.localities(id) on delete cascade,
  created_by     uuid references auth.users(id) on delete set null,
  invitation_key uuid not null,
  created_at     timestamptz not null default now()
);

create index if not exists invitation_generations_locality_idx
  on public.invitation_generations (locality_id, created_at desc);

alter table public.invitation_generations enable row level security;
