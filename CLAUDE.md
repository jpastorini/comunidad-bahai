# CLAUDE.md — Guía para sesiones de Claude Code

Este archivo lo lee Claude Code automáticamente al inicio de cada sesión.
Mantenerlo actualizado: es la memoria compartida entre todas las sesiones
(viaja con el repo, a diferencia de la memory local de `~/.claude`).

---

## Qué es este proyecto

PWA móvil para una Comunidad Bahá'í (multi-localidad). Centro de
comunicados, calendario, Fiestas de 19 Días, Días Sagrados, actividades,
materiales, tesorería, servicio, chat con Secretaría, y galería de fotos.

**Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind ·
Supabase (Auth + Postgres + RLS + Realtime + Storage) · PWA con
`@ducanh2912/next-pwa` · deploy en Vercel.

Ver `README.md` para arranque local, estructura de carpetas y detalle del stack.

---

## ⚠️ Reglas de flujo CRÍTICAS (leer antes de tocar código)

Hubo trabajo en paralelo de varias sesiones y eso causó divergencias.
Para evitarlo:

1. **Sincronizar SIEMPRE al arrancar la sesión.** Antes de editar nada:
   ```
   git fetch origin && git rebase origin/main   # o git pull --rebase
   ```
   El branch puede haber quedado atrás de `main` desde la última sesión.

2. **No correr dos sesiones editando el mismo código en simultáneo.**
   Secuencial está bien si cada una sincroniza al empezar.

3. **Migraciones: numeración secuencial sin colisiones.**
   Antes de crear una migración nueva, mirá el número más alto en
   `supabase/migrations/` y usá el siguiente. Ya hubo una colisión de dos
   `019_*`. Si encontrás colisiones, renombrá al siguiente número libre.

4. **Type-check antes de cada commit:** `npm run type-check` (debe pasar
   limpio). En esta máquina Windows, si `npm` no está en PATH, usar
   `./node_modules/.bin/tsc --noEmit` con node en
   `/c/Program Files/nodejs`.

5. **Pushear a `main` dispara el deploy en Vercel** automáticamente.
   El usuario trabaja solo, así que se pushea directo a `main`
   (`git push origin HEAD:main`). No hay PRs por ahora.

6. **Las migraciones NO se aplican solas.** El usuario las corre
   manualmente en el SQL Editor de Supabase. Al terminar una migración,
   recordale aplicarla y pasale el link de GitHub al archivo.

---

## Arquitectura esencial

- **Multi-tenancy por localidad.** Cada Asamblea Espiritual Local es un
  tenant. Las tablas de contenido tienen `locality_id` y la RLS filtra por
  `current_locality_id()`. Trigger `set_locality_from_auth()` lo auto-llena.
  Admin nacional (`is_national_admin`) ve/gestiona todas las localidades.
- **Auth:** Google OAuth (primario) + magic link (fallback), vía Supabase.
  Callback en `app/auth/callback/route.ts` (sirve para ambos). El trigger
  `handle_new_user` crea el perfil y copia nombre/avatar de Google.
- **Roles:** `profiles.role` = `member` | `admin`. Tags extra:
  `can_respond_chat`, `can_manage_treasury`, `is_national_admin`.
  Helpers de auth en `lib/auth.ts` (`requireMember`, `requireAdmin`, etc.).
- **Dos apps:** `/` (miembros, PWA) y `/admin/*` (Asamblea, panel).
  Protección en `middleware.ts` + server components.
- **Datos:** capa en `lib/data.ts`. Cae a `lib/seed-data.ts` si no hay
  Supabase configurado (modo demo).
- **Calendario unificado:** `getUnifiedCalendarItems()` fusiona
  `calendar_events` + Fiestas (+ Días Sagrados, que viven en
  `calendar_events` con `is_system_seeded=true`). Categorías visuales en
  `lib/calendar-kinds.ts`.
- **Calendario Badí':** fechas oficiales en `lib/bahai-calendar.ts`
  (Fiestas y Días Sagrados por año BE). Auto-siembra en `lib/year-seed.ts`,
  corre al abrir `/admin/calendario` y `/admin/fiestas`.

---

## Convenciones

- **UI en español** (es-UY/es-MX). Voseo aceptable en copy informal.
- **Charlar el diseño antes de codear** cuando hay decisiones de producto;
  el usuario prefiere alinear conceptualmente primero.
- **Pre-cargar datos conocidos** en vez de pedir que el usuario los cree
  (ej. las 19 Fiestas y los 11 Días Sagrados se auto-siembran).
- **Pre-producción:** borrar y recargar datos es aceptable cuando un
  rediseño lo justifica (confirmar con el usuario).
- Commits descriptivos enfocados en el "por qué". El `git log` es parte
  de la memoria compartida.

---

## Estado actual (features en producción)

Calendario con 4 categorías · Fiestas auto-sembradas (ciclo
draft→published→in_progress) · Días Sagrados auto-sembrados con horarios
especiales · Galería de fotos (con lightbox y vista full-screen) ·
Google OAuth + magic link · Perfil de usuario (avatar, nombre, mis fotos) ·
Aprobación de cambio de localidad por Asamblea destino · Notificaciones de
chat (in-app + Web Push) · Botón "Instalar App" (PWA) · Tesorería con
presupuesto · Contenido nacional.

## Pendientes conocidos

- **Notificaciones de comunicados y recordatorios de eventos** (24h antes).
  Ya existe infra de Web Push para chat (`supabase/migrations/027_push_subscriptions.sql`)
  que conviene reusar. Decidir cron: Vercel Cron vs pg_cron.
- **Fase 2 de fotos:** boletín nacional (los campos `visibility` y
  `featured` en `event_photos` ya están listos, sin UI todavía).
- **Verificar fechas Badí' BE 185+** (2028 en adelante) contra bahai.org
  cuando se acerque; hoy `lib/bahai-calendar.ts` tiene Fiestas hasta 185 y
  Días Sagrados hasta 184 verificados.
