-- ═════════════════════════════════════════════════════════════════
-- 053 · Buscador de pasajes en los Escritos, los mensajes y las citas.
--
-- Alguien pregunta por un tema ("¿qué dicen los Escritos sobre la
-- consulta?") y la app le sugiere párrafos, extractos y citas donde se
-- habla de eso. El corpus son los 59 libros del Panel, los 7 libros
-- Ruhi, los 51 mensajes de Riḍván de la Casa Universal y las 991 citas
-- de la Lectura de hoy: ~1,8 millones de palabras, que no entran en
-- ninguna llamada a un modelo. Por eso el diseño es en dos tiempos:
--
--   1. LA BASE BUSCA. Cada párrafo es una fila de `corpus_chunks` con un
--      tsvector en español; `search_corpus()` devuelve los ~60 mejores
--      para una consulta. Full-text search de Postgres, sin servicios
--      externos.
--   2. HAIKU ELIGE Y EXPLICA (lib/corpus-search.ts). Antes, convierte la
--      pregunta en términos de búsqueda con sinónimos; después, de los
--      60 candidatos elige los 8–10 pertinentes y dice por qué. Solo
--      devuelve números de candidato: el TEXTO que se muestra sale
--      siempre de esta tabla, nunca del modelo, así no hay cita
--      inventada ni retocada.
--
-- La configuración de búsqueda `es_unaccent` es la de español más el
-- diccionario unaccent, para que "oracion" encuentre "oración": en el
-- celular la gente escribe sin acentos.
--
-- Las filas las carga scripts/load-corpus.mjs con la service-role key
-- (no hay policy de escritura). La lectura es para cualquier persona
-- autenticada: el corpus es público y nacional, no tiene localidad.
--
-- `corpus_searches` registra cada consulta (quién, qué, cuántos
-- resultados) y es lo que sostiene el tope diario por persona: la
-- búsqueda cuesta unos centavos de API cada vez, así que se acota.
-- ═════════════════════════════════════════════════════════════════

-- ─── Configuración de búsqueda: español sin acentos ──────────────
create extension if not exists unaccent with schema extensions;

do $$
declare
  dict_schema text;
begin
  select n.nspname into dict_schema
    from pg_ts_dict d
    join pg_namespace n on n.oid = d.dictnamespace
   where d.dictname = 'unaccent'
   limit 1;
  if dict_schema is null then
    raise exception 'El diccionario unaccent no está disponible';
  end if;

  if not exists (
    select 1 from pg_ts_config c
      join pg_namespace n on n.oid = c.cfgnamespace
     where c.cfgname = 'es_unaccent' and n.nspname = 'public'
  ) then
    execute 'create text search configuration public.es_unaccent (copy = pg_catalog.spanish)';
    execute format(
      'alter text search configuration public.es_unaccent
         alter mapping for hword, hword_part, word
         with %I.unaccent, spanish_stem',
      dict_schema
    );
  end if;
end $$;

-- ─── Los pasajes ─────────────────────────────────────────────────
create table if not exists public.corpus_chunks (
  -- "<kind>:<doc_key>:<posición>", estable entre recargas.
  id text primary key,
  source_kind text not null
    check (source_kind in ('libro', 'ruhi', 'mensaje', 'cita')),
  -- Slug del documento (o id del tema, en las citas).
  doc_key text not null,
  doc_title text not null,
  -- Autor o sección ("Bahá'u'lláh", "Casa Universal de Justicia", ...).
  author text,
  -- Cómo se cita este pasaje en pantalla y al compartir.
  reference text not null,
  -- Orden del pasaje dentro del documento. Se llama `seq` y no
  -- `position` porque POSITION es palabra clave de SQL: sirve como
  -- columna de una tabla pero no en el `returns table` de una función.
  seq int not null,
  body text not null,
  word_count int not null,
  tsv tsvector generated always as (
    to_tsvector('public.es_unaccent'::regconfig, body)
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists corpus_chunks_tsv_idx
  on public.corpus_chunks using gin (tsv);
-- Si un intento anterior de esta migración llegó a crear la tabla con la
-- columna `position`, se renombra (la tabla todavía no tiene datos).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'corpus_chunks'
       and column_name = 'position'
  ) then
    alter table public.corpus_chunks rename column "position" to seq;
  end if;
end $$;

create index if not exists corpus_chunks_doc_idx
  on public.corpus_chunks (source_kind, doc_key, seq);

alter table public.corpus_chunks enable row level security;

drop policy if exists "corpus_chunks_select_authenticated" on public.corpus_chunks;
create policy "corpus_chunks_select_authenticated" on public.corpus_chunks
  for select using (auth.uid() is not null);
-- Sin policies de escritura: carga solo con service-role.

-- ─── La búsqueda ─────────────────────────────────────────────────
-- Security INVOKER a propósito: corre con la RLS de quien pregunta.
-- Los términos vienen ya expandidos (sinónimos unidos con OR) en la
-- sintaxis de websearch_to_tsquery. Se acota a 8 pasajes por documento
-- para que un libro largo no llene solo la lista de candidatos.
create or replace function public.search_corpus(p_query text, p_limit int default 60)
returns table (
  id text,
  source_kind text,
  doc_key text,
  doc_title text,
  author text,
  reference text,
  seq int,
  body text,
  word_count int,
  rank real
)
language sql stable
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('public.es_unaccent'::regconfig, p_query) as tsq
  ),
  ranked as (
    select c.id, c.source_kind, c.doc_key, c.doc_title, c.author, c.reference,
           c.seq, c.body, c.word_count,
           ts_rank_cd(c.tsv, q.tsq, 1) as rank,
           row_number() over (
             partition by c.doc_key
             order by ts_rank_cd(c.tsv, q.tsq, 1) desc
           ) as rn
      from public.corpus_chunks c, q
     where c.tsv @@ q.tsq
  )
  select id, source_kind, doc_key, doc_title, author, reference,
         seq, body, word_count, rank
    from ranked
   where rn <= 8
   order by rank desc
   limit least(greatest(p_limit, 1), 200);
$$;

revoke all on function public.search_corpus(text, int) from public;
grant execute on function public.search_corpus(text, int) to authenticated;

-- ─── Registro de consultas (y tope diario) ───────────────────────
create table if not exists public.corpus_searches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  query text not null,
  -- Los términos que propuso el modelo, para revisar la calidad.
  terms text[],
  results int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists corpus_searches_profile_idx
  on public.corpus_searches (profile_id, created_at desc);

alter table public.corpus_searches enable row level security;

-- Cada persona ve y anota solo lo suyo; la Asamblea ve las de su
-- localidad para saber qué busca la gente (sin ningún dato más).
drop policy if exists "corpus_searches_select" on public.corpus_searches;
create policy "corpus_searches_select" on public.corpus_searches
  for select using (
    profile_id = auth.uid()
    or (
      public.is_admin(auth.uid())
      and exists (
        select 1 from public.profiles p
         where p.id = corpus_searches.profile_id
           and p.locality_id = public.current_locality_id()
      )
    )
  );

drop policy if exists "corpus_searches_insert_self" on public.corpus_searches;
create policy "corpus_searches_insert_self" on public.corpus_searches
  for insert with check (profile_id = auth.uid());
