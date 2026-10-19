-- 080 · Enseñanza: pedidos de contacto desde el folleto público
--
-- El folleto "Qué es la Fe Bahá'í" (/la-fe) se lee SIN login: es material
-- de enseñanza que un creyente le manda a un simpatizante. Al pie, la
-- persona puede dejar nombre, teléfono, correo y un mensaje para que
-- alguien de la comunidad la contacte. Esa fila es esto.
--
-- Quién la lee: quienes atienden el chat de Secretaría en la comunidad
-- elegida (`has_chat_tag` + `current_locality_id`), que son los mismos a
-- los que les llega el push al momento de enviarse. El admin nacional ve
-- todas. NADIE inserta por RLS: el formulario es público y escribe el
-- servidor con service-role después de validar; no hay policy de insert a
-- propósito, para que un cliente anónimo no pueda llenar la tabla por
-- PostgREST.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 160),
  message text check (message is null or char_length(message) <= 2000),
  -- 'folleto' = desde /la-fe sin sesión; 'app' = un creyente lo cargó
  -- desde Enseñanza → Contacto (le prestó el teléfono a la persona).
  source text not null default 'folleto' check (source in ('folleto', 'app')),
  -- Quién lo cargó, si fue desde la app con sesión.
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'nuevo' check (status in ('nuevo', 'atendido')),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint contact_requests_some_way_to_reach
    check (coalesce(phone, '') <> '' or coalesce(email, '') <> '')
);

create index if not exists contact_requests_locality_status_idx
  on public.contact_requests (locality_id, status, created_at desc);

alter table public.contact_requests enable row level security;

drop policy if exists "contact_requests_select_chat" on public.contact_requests;
create policy "contact_requests_select_chat" on public.contact_requests
  for select using (
    public.is_national_admin(auth.uid())
    or (
      public.has_chat_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
  );

drop policy if exists "contact_requests_update_chat" on public.contact_requests;
create policy "contact_requests_update_chat" on public.contact_requests
  for update using (
    public.is_national_admin(auth.uid())
    or (
      public.has_chat_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
  );

drop policy if exists "contact_requests_delete_chat" on public.contact_requests;
create policy "contact_requests_delete_chat" on public.contact_requests
  for delete using (
    public.is_national_admin(auth.uid())
    or (
      public.has_chat_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
  );
