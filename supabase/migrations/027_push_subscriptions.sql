-- ═════════════════════════════════════════════════════════════════
-- Suscripciones Web Push (Capa 3 de notificaciones de chat).
--
-- Cada navegador/dispositivo que activa las notificaciones guarda acá
-- su PushSubscription (endpoint + claves). El servidor las usa para
-- enviar notificaciones aunque la app esté cerrada.
--
-- RLS: cada usuario administra solo las suyas. El ENVÍO se hace desde el
-- servidor con la service-role key (bypassa RLS), porque al notificar a
-- otro usuario hay que leer su suscripción.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_select_own" on public.push_subscriptions;
create policy "push_subs_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
create policy "push_subs_insert_own" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "push_subs_update_own" on public.push_subscriptions;
create policy "push_subs_update_own" on public.push_subscriptions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_subs_delete_own" on public.push_subscriptions;
create policy "push_subs_delete_own" on public.push_subscriptions
  for delete using (user_id = auth.uid());
