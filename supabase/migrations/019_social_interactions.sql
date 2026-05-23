-- ═════════════════════════════════════════════════════════════════
-- Interacción social sobre fotos (Fase 1 del feed social)
--
-- Agrega tres tablas:
--   - event_photo_reactions  (un usuario puede dejar varios emojis distintos)
--   - event_photo_comments   (comentarios cortos por foto)
--   - social_notifications   (campana del header + pantalla /notificaciones)
--
-- Las notificaciones se generan via TRIGGERS security definer que insertan
-- en social_notifications cuando alguien reacciona o comenta en una foto.
-- El uploader de la foto recibe la notificación; no se notifica a uno mismo.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. event_photo_reactions ────────────────────────────────────
create table if not exists public.event_photo_reactions (
  id uuid primary key default uuid_generate_v4(),
  photo_id uuid not null references public.event_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Nombre simbólico, no unicode, para que la UI pueda cambiar emojis sin migrar.
  emoji text not null check (emoji in ('heart', 'pray', 'star', 'flower')),
  locality_id uuid not null references public.localities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, user_id, emoji)
);

create index if not exists epr_photo_idx
  on public.event_photo_reactions (photo_id);
create index if not exists epr_user_idx
  on public.event_photo_reactions (user_id, created_at desc);

alter table public.event_photo_reactions enable row level security;

drop trigger if exists epr_set_locality on public.event_photo_reactions;
create trigger epr_set_locality
  before insert on public.event_photo_reactions
  for each row execute function public.set_locality_from_auth();

drop policy if exists "epr_select_locality" on public.event_photo_reactions;
create policy "epr_select_locality" on public.event_photo_reactions
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "epr_insert_self" on public.event_photo_reactions;
create policy "epr_insert_self" on public.event_photo_reactions
  for insert with check (
    user_id = auth.uid()
    and locality_id = public.current_locality_id()
  );

drop policy if exists "epr_delete_self" on public.event_photo_reactions;
create policy "epr_delete_self" on public.event_photo_reactions
  for delete using (user_id = auth.uid());

-- ─── 2. event_photo_comments ─────────────────────────────────────
create table if not exists public.event_photo_comments (
  id uuid primary key default uuid_generate_v4(),
  photo_id uuid not null references public.event_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  locality_id uuid not null references public.localities(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists epc_photo_idx
  on public.event_photo_comments (photo_id, created_at);
create index if not exists epc_user_idx
  on public.event_photo_comments (user_id, created_at desc);

alter table public.event_photo_comments enable row level security;

drop trigger if exists epc_set_locality on public.event_photo_comments;
create trigger epc_set_locality
  before insert on public.event_photo_comments
  for each row execute function public.set_locality_from_auth();

-- updated_at auto-touch
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists epc_touch_updated_at on public.event_photo_comments;
create trigger epc_touch_updated_at
  before update on public.event_photo_comments
  for each row execute function public.touch_updated_at();

drop policy if exists "epc_select_locality" on public.event_photo_comments;
create policy "epc_select_locality" on public.event_photo_comments
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "epc_insert_self" on public.event_photo_comments;
create policy "epc_insert_self" on public.event_photo_comments
  for insert with check (
    user_id = auth.uid()
    and locality_id = public.current_locality_id()
  );

drop policy if exists "epc_update_self" on public.event_photo_comments;
create policy "epc_update_self" on public.event_photo_comments
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "epc_delete_self" on public.event_photo_comments;
create policy "epc_delete_self" on public.event_photo_comments
  for delete using (user_id = auth.uid());

drop policy if exists "epc_delete_admin" on public.event_photo_comments;
create policy "epc_delete_admin" on public.event_photo_comments
  for delete using (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── 3. social_notifications ─────────────────────────────────────
create table if not exists public.social_notifications (
  id uuid primary key default uuid_generate_v4(),

  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,

  type text not null check (type in ('reaction', 'comment')),
  photo_id uuid references public.event_photos(id) on delete cascade,
  -- Denormalizamos event_type/event_id para construir el deep-link sin join
  -- aunque la foto haya sido borrada después.
  event_type text check (event_type in ('calendar', 'feast')),
  event_id uuid,

  -- Específicos por tipo
  emoji text,                    -- para 'reaction'
  preview text,                  -- para 'comment' (primeros 120 chars)

  locality_id uuid not null references public.localities(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sn_recipient_idx
  on public.social_notifications (recipient_user_id, created_at desc);
create index if not exists sn_recipient_unread_idx
  on public.social_notifications (recipient_user_id)
  where read_at is null;

alter table public.social_notifications enable row level security;

-- El destinatario es el único que ve y marca como leídas.
drop policy if exists "sn_select_own" on public.social_notifications;
create policy "sn_select_own" on public.social_notifications
  for select using (recipient_user_id = auth.uid());

drop policy if exists "sn_update_own" on public.social_notifications;
create policy "sn_update_own" on public.social_notifications
  for update using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- No hay policy de insert: solo entran vía triggers security definer.
-- Si alguien intenta insertar manualmente, RLS lo bloquea.

-- ─── 4. Triggers de notificación ─────────────────────────────────

-- Reacción → notifica al uploader de la foto (a menos que sea el mismo usuario).
create or replace function public.notify_on_photo_reaction()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_photo  public.event_photos%rowtype;
  v_actor  text;
begin
  select * into v_photo from public.event_photos where id = new.photo_id;
  if not found then return new; end if;
  if v_photo.uploader_user_id = new.user_id then return new; end if;

  select coalesce(full_name, email, 'Alguien')
    into v_actor
    from public.profiles where id = new.user_id;

  insert into public.social_notifications (
    recipient_user_id, actor_user_id, actor_name, type,
    photo_id, event_type, event_id, emoji, locality_id
  ) values (
    v_photo.uploader_user_id, new.user_id, coalesce(v_actor, 'Alguien'),
    'reaction', v_photo.id, v_photo.event_type, v_photo.event_id,
    new.emoji, v_photo.locality_id
  );

  return new;
end;
$$;

drop trigger if exists epr_notify on public.event_photo_reactions;
create trigger epr_notify
  after insert on public.event_photo_reactions
  for each row execute function public.notify_on_photo_reaction();

-- Comentario → notifica al uploader de la foto (a menos que sea el mismo).
create or replace function public.notify_on_photo_comment()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_photo public.event_photos%rowtype;
begin
  select * into v_photo from public.event_photos where id = new.photo_id;
  if not found then return new; end if;
  if v_photo.uploader_user_id = new.user_id then return new; end if;

  insert into public.social_notifications (
    recipient_user_id, actor_user_id, actor_name, type,
    photo_id, event_type, event_id, preview, locality_id
  ) values (
    v_photo.uploader_user_id, new.user_id, new.author_name,
    'comment', v_photo.id, v_photo.event_type, v_photo.event_id,
    left(new.body, 120), v_photo.locality_id
  );

  return new;
end;
$$;

drop trigger if exists epc_notify on public.event_photo_comments;
create trigger epc_notify
  after insert on public.event_photo_comments
  for each row execute function public.notify_on_photo_comment();
