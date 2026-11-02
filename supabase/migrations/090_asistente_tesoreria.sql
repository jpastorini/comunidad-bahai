-- 090 · Asistente de Tesorería
--
-- Una conversación del tesorero con el asistente (Claude) que lee el libro
-- y propone movimientos. Cada conversación es de UNA persona en UNA
-- comunidad: la ve solo quien la tuvo, y solo mientras tenga el tag de
-- Tesorería en esa comunidad. Nadie más, ni la Asamblea: adentro hay
-- nombres de contribuyentes.
--
-- `messages` es el historial tal cual lo manda y recibe la API de
-- Anthropic (bloques de texto, de pensamiento, de herramienta y sus
-- resultados). Se guarda entero porque la API exige que los bloques de
-- pensamiento vuelvan sin cambios en el pedido siguiente.
--
-- `decided` guarda las tarjetas ya resueltas para volver a mostrarlas.
-- `pending` existe mientras el asistente espera que el tesorero confirme
-- o descarte una propuesta (registrar, anular, revertir…). Lo que se
-- confirma lo escribe el MISMO server action del Libro, con las mismas
-- reglas: el asistente nunca escribe en el libro por su cuenta.

create table if not exists public.treasury_assistant_threads (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  pending jsonb,
  -- Las propuestas ya decididas, con en qué punto del historial se
  -- hicieron, para volver a dibujar la tarjeta al reabrir la conversación.
  decided jsonb not null default '[]'::jsonb,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treasury_assistant_threads_owner_idx
  on public.treasury_assistant_threads (profile_id, locality_id, updated_at desc);

-- Una fila por pregunta, para el tope diario (como corpus_searches, 053).
create table if not exists public.treasury_assistant_turns (
  id bigserial primary key,
  thread_id uuid not null references public.treasury_assistant_threads(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  locality_id uuid not null references public.localities(id) on delete cascade,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists treasury_assistant_turns_owner_idx
  on public.treasury_assistant_turns (profile_id, created_at desc);

alter table public.treasury_assistant_threads enable row level security;
alter table public.treasury_assistant_turns enable row level security;

drop policy if exists treasury_assistant_threads_own on public.treasury_assistant_threads;
create policy treasury_assistant_threads_own on public.treasury_assistant_threads
  for all
  using (
    profile_id = auth.uid()
    and locality_id = public.current_locality_id()
    and public.has_treasury_tag(auth.uid())
  )
  with check (
    profile_id = auth.uid()
    and locality_id = public.current_locality_id()
    and public.has_treasury_tag(auth.uid())
  );

drop policy if exists treasury_assistant_turns_own on public.treasury_assistant_turns;
create policy treasury_assistant_turns_own on public.treasury_assistant_turns
  for all
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and locality_id = public.current_locality_id()
    and public.has_treasury_tag(auth.uid())
  );
