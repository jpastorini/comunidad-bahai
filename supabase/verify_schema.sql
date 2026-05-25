-- ═════════════════════════════════════════════════════════════════
-- Verificación de esquema — Comunidad Bahá'í
--
-- Corré este script en el SQL Editor de Supabase. Compara la base contra
-- el esquema que la app espera (schema.sql + migraciones 001–021) y lista
-- lo que FALTE, indicando qué migración lo agrega.
--
-- Resultado VACÍO = todo en orden. Cada fila = un objeto faltante.
-- (Chequea tablas y columnas; no valida RLS/políticas ni constraints.)
-- ═════════════════════════════════════════════════════════════════

with expected_tables(t, mig) as (
  values
    ('profiles', 'base'),
    ('localities', '012'),
    ('messages', 'base'),
    ('activities', 'base'),
    ('calendar_events', 'base'),
    ('study_materials', 'base'),
    ('teaching_goals', 'base'),
    ('service_needs', 'base'),
    ('service_volunteers', 'base'),
    ('treasury', 'base'),
    ('treasury_commitments', '011'),
    ('chat_messages', 'base'),
    ('feasts', '007'),
    ('feast_locations', '007'),
    ('feast_prayers', '007'),
    ('feast_suggestions', '007'),
    ('event_photos', '017'),
    ('event_photo_reactions', '019'),
    ('event_photo_comments', '019'),
    ('social_notifications', '019')
),
expected_columns(t, c, mig) as (
  values
    ('profiles', 'avatar_url', '018'),
    ('profiles', 'locality_id', '012'),
    ('profiles', 'is_national_admin', '012'),
    ('profiles', 'comunicados_seen_at', '020'),
    ('messages', 'source', '002'),
    ('messages', 'subject', '003'),
    ('messages', 'pdf_url', '003'),
    ('messages', 'image_url', '003'),
    ('messages', 'locality_id', '012'),
    ('calendar_events', 'kind', '013'),
    ('calendar_events', 'description', '006'),
    ('calendar_events', 'location', '006'),
    ('calendar_events', 'image_url', '006'),
    ('calendar_events', 'duration_minutes', '006'),
    ('calendar_events', 'is_system_seeded', '015'),
    ('calendar_events', 'system_id', '015'),
    ('calendar_events', 'official_date', '015'),
    ('calendar_events', 'locality_id', '012'),
    ('study_materials', 'pdf_url', '005'),
    ('study_materials', 'image_url', '005'),
    ('study_materials', 'locality_id', '012'),
    ('chat_messages', 'is_admin_reply', '001'),
    ('chat_messages', 'read_by_member', '010'),
    ('chat_messages', 'locality_id', '012'),
    ('activities', 'locality_id', '012'),
    ('service_needs', 'locality_id', '012'),
    ('treasury', 'locality_id', '012'),
    ('treasury_commitments', 'locality_id', '012'),
    ('feasts', 'locality_id', '012'),
    ('feast_locations', 'participant_count', '008'),
    ('feast_suggestions', 'author_name', '009')
)
select 'TABLA FALTANTE'      as problema,
       et.mig                as migracion,
       et.t                  as tabla,
       ''                    as columna
from expected_tables et
where not exists (
  select 1 from information_schema.tables it
  where it.table_schema = 'public' and it.table_name = et.t
)
union all
select 'COLUMNA FALTANTE',
       ec.mig,
       ec.t,
       ec.c
from expected_columns ec
where exists (   -- solo si la tabla existe (si no, ya se reporta arriba)
        select 1 from information_schema.tables it
        where it.table_schema = 'public' and it.table_name = ec.t
      )
  and not exists (
        select 1 from information_schema.columns ic
        where ic.table_schema = 'public'
          and ic.table_name = ec.t
          and ic.column_name = ec.c
      )
order by problema, migracion, tabla, columna;
