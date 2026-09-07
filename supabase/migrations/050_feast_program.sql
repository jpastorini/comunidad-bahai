-- ═════════════════════════════════════════════════════════════════
-- 050 · Programa de la Fiesta: noticias como ítems
--
-- La Fiesta se proyecta como deck de diapositivas y se descarga como
-- folleto PDF (ver lib/feast-program.ts). Las noticias —internacionales,
-- nacionales, locales— dejan de ser un bloque de texto libre y pasan a
-- ser ítems con fecha, título, cuerpo y foto opcional: una línea de
-- tiempo se proyecta bien; un párrafo largo, no.
--
-- Los textos que ya estaban cargados en feasts.international_reports /
-- national_reports / local_reports se convierten en un ítem cada uno
-- (título = primera línea, cuerpo = el resto) y las columnas quedan en
-- NULL. Las columnas no se borran: el select("*") de la app las sigue
-- leyendo y no molestan. Los placeholders de la plantilla ("[Resumen
-- de…]") se descartan, no son contenido.
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.feast_news_items (
  id uuid primary key default gen_random_uuid(),
  feast_id uuid not null references public.feasts(id) on delete cascade,
  -- Ámbito de la noticia. Define en qué diapositiva sale.
  scope text not null check (scope in ('internacional', 'nacional', 'local')),
  position int not null default 0,
  -- Texto libre: "21 de agosto", "Fin de semana pasado", "Designación".
  -- No es una fecha porque muchas noticias no la tienen y la etiqueta es
  -- lo que se proyecta.
  date_label text,
  title text not null,
  body text,
  -- URL pública en el bucket 'comunicados' (carpeta fiestas/noticias/).
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists feast_news_items_feast_idx
  on public.feast_news_items (feast_id, scope, position);

alter table public.feast_news_items enable row level security;

-- Misma regla que feast_prayers (047): se lee si se puede leer la
-- Fiesta. La RLS de feasts ya encierra borrador/publicada, localidad y
-- creyente/amigo, así que acá no se repite nada.
drop policy if exists "feast_news_select_visible" on public.feast_news_items;
create policy "feast_news_select_visible" on public.feast_news_items
  for select using (
    exists (select 1 from public.feasts f where f.id = feast_news_items.feast_id)
  );

drop policy if exists "feast_news_admin_write" on public.feast_news_items;
create policy "feast_news_admin_write" on public.feast_news_items
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─── Migrar los textos existentes a ítems ──────────────────────────
do $$
declare
  r record;
  col text;
  sc text;
  txt text;
  first_line text;
  rest text;
begin
  for r in select id, international_reports, national_reports, local_reports
           from public.feasts loop
    for col, sc in
      select * from (values
        ('international_reports', 'internacional'),
        ('national_reports', 'nacional'),
        ('local_reports', 'local')) as v(c, s) loop

      txt := case col
        when 'international_reports' then r.international_reports
        when 'national_reports' then r.national_reports
        else r.local_reports end;

      txt := nullif(btrim(coalesce(txt, '')), '');
      -- Placeholder de la plantilla, no contenido.
      if txt is null or left(txt, 1) = '[' then continue; end if;

      first_line := btrim(split_part(txt, E'\n', 1));
      rest := nullif(btrim(substr(txt, length(split_part(txt, E'\n', 1)) + 1)), '');
      if length(first_line) > 140 then
        -- Un párrafo sin título: se titula por ámbito y el texto va entero.
        first_line := case sc
          when 'internacional' then 'Noticias internacionales'
          when 'nacional' then 'Noticias nacionales'
          else 'Noticias locales' end;
        rest := txt;
      end if;

      insert into public.feast_news_items (feast_id, scope, position, title, body)
      values (r.id, sc, 0, first_line, rest);
    end loop;
  end loop;

  update public.feasts
  set international_reports = null,
      national_reports = null,
      local_reports = null;
end $$;
