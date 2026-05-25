-- ═════════════════════════════════════════════════════════════════
-- RPCs: conteos agregados de interacciones de fotos.
--
-- Antes el feed (lib/feed.ts) y la galería (lib/photo-interactions.ts)
-- traían TODAS las filas crudas de reactions/comments y las contaban en
-- JS. Estas funciones agregan en SQL (count(*) group by) y devuelven solo
-- los números.
--
-- SECURITY INVOKER (default): respetan las RLS por localidad de
-- event_photo_reactions / event_photo_comments, así que solo cuentan
-- filas que el usuario que llama puede ver.
--
--   get_photo_interaction_counts(photo_ids) → totales por foto (feed)
--   get_photo_reaction_counts(photo_ids)    → conteo por emoji (galería)
--
-- El emoji propio del usuario ('mine') se resuelve aparte con una query
-- chica filtrada por user_id.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- Totales (reacciones + comentarios) por foto.
create or replace function public.get_photo_interaction_counts(photo_ids uuid[])
returns table (
  photo_id uuid,
  reaction_count bigint,
  comment_count bigint
)
language sql
stable
as $$
  select
    ids.id                 as photo_id,
    coalesce(r.cnt, 0)     as reaction_count,
    coalesce(c.cnt, 0)     as comment_count
  from unnest(photo_ids) as ids(id)
  left join (
    select photo_id, count(*)::bigint as cnt
    from public.event_photo_reactions
    where photo_id = any(photo_ids)
    group by photo_id
  ) r on r.photo_id = ids.id
  left join (
    select photo_id, count(*)::bigint as cnt
    from public.event_photo_comments
    where photo_id = any(photo_ids)
    group by photo_id
  ) c on c.photo_id = ids.id;
$$;

-- Conteo de reacciones desglosado por emoji (heart/pray/star/flower).
create or replace function public.get_photo_reaction_counts(photo_ids uuid[])
returns table (
  photo_id uuid,
  emoji text,
  count bigint
)
language sql
stable
as $$
  select photo_id, emoji, count(*)::bigint as count
  from public.event_photo_reactions
  where photo_id = any(photo_ids)
  group by photo_id, emoji;
$$;

grant execute on function public.get_photo_interaction_counts(uuid[]) to authenticated;
grant execute on function public.get_photo_reaction_counts(uuid[]) to authenticated;
