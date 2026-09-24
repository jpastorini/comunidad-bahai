-- 066 · El estado del Fondo, calculado y compartido por el tesorero
--
-- Decidido con el usuario el 2026-09-24. Hasta acá lo que la comunidad
-- veía de la Tesorería salía de cuatro lugares: el tablero de /tesoreria
-- (en vivo, desde el libro), el "Informe mensual" y la imagen para
-- WhatsApp (la tabla vieja `treasury`, escrita a mano), y las cifras de la
-- Fiesta (tres campos del formulario de la Fiesta, también a mano). Cada
-- uno podía decir otra cosa.
--
-- Ahora hay UN lugar y dos pasos, en Tesorería → Publicar:
--   · "Calcular" arma la foto desde el libro y la guarda como BORRADOR:
--     solo la ve el tesorero, tal cual la va a ver la comunidad.
--   · "Compartir" publica ESA fila, no un cálculo nuevo. Si entre un paso
--     y el otro se carga un movimiento, se publica lo que se revisó.
--
-- Cada publicación queda como historia (no se pisa): la Fiesta muestra la
-- que estaba vigente cuando la Asamblea la inició (`feasts.started_at`),
-- así que publicar otra al día siguiente no le cambia lo presentado.

create table if not exists public.treasury_publications (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  -- Movimientos hasta esta fecha, inclusive.
  as_of date not null,
  -- La foto entera, con los nombres de fondos y categorías ya resueltos:
  -- quien la lee no necesita acceso al catálogo ni al libro. Nunca lleva
  -- un nombre de contribuyente (sale de treasury_progress(), que solo
  -- devuelve agregados).
  snapshot jsonb not null,
  calculated_at timestamptz not null default now(),
  calculated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint treasury_publications_published_has_date
    check (status = 'draft' or published_at is not null)
);

-- Un solo borrador por comunidad: "Calcular" otra vez lo reemplaza.
create unique index if not exists treasury_publications_one_draft
  on public.treasury_publications (locality_id)
  where status = 'draft';

create index if not exists treasury_publications_latest_idx
  on public.treasury_publications (locality_id, published_at desc)
  where status = 'published';

alter table public.treasury_publications enable row level security;

-- Leer:
--   · una publicación → los creyentes de la localidad (un Amigo/a de la
--     Fe no tiene Tesorería, 047);
--   · todo, borradores incluidos → el tesorero de la localidad;
--   · el admin nacional, solo lectura, como en los informes (044).
drop policy if exists treasury_publications_select on public.treasury_publications;
create policy treasury_publications_select on public.treasury_publications
  for select to authenticated
  using (
    (
      status = 'published'
      and locality_id = public.current_locality_id()
      and public.is_bahai(auth.uid())
    )
    or (
      public.has_treasury_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or public.is_national_admin(auth.uid())
  );

-- Escribir: solo el tesorero, sobre su localidad.
drop policy if exists treasury_publications_write on public.treasury_publications;
create policy treasury_publications_write on public.treasury_publications
  for all to authenticated
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );
