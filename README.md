# Comunidad Bahá'í — PWA

PWA móvil para la Comunidad Bahá'í: centro de comunicados, actividades,
materiales de estudio, metas, servicio y tesorería. 10 pantallas siguiendo
el diseño del handoff (`handoff/Comunidad Bahai/design_handoff_comunidad_bahai`).

**Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS ·
Supabase (Auth + Postgres + Realtime + Storage) · `@ducanh2912/next-pwa`
(service worker / installable PWA).

---

## Requisitos

- **Node.js 18.17+** (recomendado 20 LTS). Si no lo tienes instalado:
  - `winget install OpenJS.NodeJS.LTS` (Windows)
  - o descarga desde https://nodejs.org

- Una cuenta **Supabase** gratis (opcional para correr la demo).

---

## Arranque rápido

```powershell
# 1) Instalar dependencias
npm install

# 2) (opcional) Configurar Supabase — la app corre con datos demo si no lo haces
cp .env.example .env.local        # PowerShell: copy .env.example .env.local
# edita .env.local y rellena las dos variables de Supabase

# 3) Servidor de desarrollo
npm run dev
# abre http://localhost:3000
```

Sin variables de Supabase, todas las pantallas se renderizan con los
datos de demostración de `lib/seed-data.ts` (mismo contenido que el
prototipo del handoff). Esto te permite ver y maquetar todo el flujo sin
backend.

---

## Dos apps en un solo proyecto

| URL | Para quién | Datos |
|---|---|---|
| `/` y subrutas | **Miembros** — PWA móvil con las 10 pantallas del handoff | Lee Supabase, cae a datos demo si no está configurado |
| `/admin/*` | **Asamblea Local** — panel responsive (laptop + móvil) | **Requiere Supabase real**. Protegido por middleware con verificación de rol |
| `/admin/login` | Login con magic link (sin contraseña) | Recibe enlace por email |

El acceso a `/admin/*` se valida en dos capas:
- **Middleware** (`middleware.ts`): redirige a `/admin/login` si no hay sesión o el perfil no es `admin`.
- **Server components** (`requireAdmin`, `ensureChatTag`, `ensureTreasuryTag` en `lib/auth.ts`): validan permisos finos en cada página.

## Estructura

```
app/
  layout.tsx                 # raíz: fuentes + metadata PWA
  manifest.ts                # /manifest.webmanifest (Next.js)
  icon.svg                   # favicon
  globals.css                # Tailwind + shell mobile
  (app)/
    layout.tsx               # shell con TabBar
    page.tsx                 # Home
    mensajes/page.tsx        # Casa Universal de Justicia
    chat/page.tsx + chat-screen.tsx   # Secretaría Local (cliente)
    actividades/page.tsx
    calendario/page.tsx
    materiales/page.tsx      # Ruhí + Escritos
    metas/page.tsx           # Stats + barras de progreso
    servicio/page.tsx        # Necesidades + voluntariado
    tesoreria/page.tsx       # Ring SVG + informe
    mas/page.tsx             # Menú secundario

components/
  BahaiStar.tsx              # Estrella de 9 puntas
  GoldHeader.tsx             # Header dorado compartido
  TabBar.tsx                 # Barra inferior con estado activo
  Icons.tsx                  # Iconos stroke 24×24
  home/                      # Tarjetas exclusivas de Home

app/admin/
  login/                     # Magic-link form (público, fuera del shell)
  (panel)/
    layout.tsx               # Shell admin (sidebar + drawer) + requireAdmin()
    page.tsx                 # Dashboard con KPIs y atajos
    mensajes/                # CRUD Mensajes (Casa Universal)
    actividades/             # CRUD Actividades
    calendario/              # CRUD Eventos de calendario
    materiales/              # CRUD Ruhí + Escritos + Oraciones
    metas/                   # CRUD Metas de enseñanza
    servicio/                # CRUD Necesidades + lista de voluntarios
    chat/                    # (requiere can_respond_chat) lista + conversación
    tesoreria/               # (requiere can_manage_treasury) edición completa
    miembros/                # Gestión de roles y tags

app/auth/
  callback/route.ts          # Intercambio de código mágico → sesión
  signout/route.ts           # POST /auth/signout

components/admin/
  AdminShell.tsx             # Layout responsive (sidebar md+ / drawer mobile)
  Sidebar.tsx                # Navegación + tarjeta de sesión
  ui.tsx                     # PageHeader, Card, Button, Field, DataTable, Banner

lib/
  tokens.ts                  # Colores (hex) para usos inline (SVG, gradientes)
  format.ts                  # Fechas y horas en español
  types.ts                   # Tipos compartidos (incluye Profile)
  seed-data.ts               # Datos demo (también se inserta en Supabase)
  data.ts                    # Capa de acceso: Supabase con fallback a seed
  auth.ts                    # requireAdmin / ensureChatTag / ensureTreasuryTag
  supabase/
    client.ts                # createBrowserClient
    server.ts                # createServerClient + cookies
    middleware.ts            # updateSession para middleware.ts

middleware.ts                # Protege /admin/* y refresca sesión

supabase/
  schema.sql                 # Tablas + RLS (perfiles, mensajes, actividades,
                             # calendario, materiales, metas, servicio,
                             # tesorería, chat)
  seed.sql                   # Datos de ejemplo equivalentes a seed-data.ts

scripts/
  generate-icons.ps1         # Regenera los íconos PWA (192/512/maskable)

public/icons/                # Íconos PWA generados (no commiteado por defecto)
```

---

## Configuración de Supabase

1. Crea un proyecto en https://app.supabase.com.
2. Project Settings → API: copia `URL` y `anon public key` a `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

3. SQL Editor → ejecuta `supabase/schema.sql` (tablas, RLS, políticas, trigger
   que crea perfil al registrarse).
4. (opcional) Ejecuta `supabase/seed.sql` para precargar los datos de demo.
5. Auth → Providers → habilita **Email** (magic link, sin contraseñas).
6. Auth → URL Configuration → añade
   `http://localhost:3000/auth/callback` y la URL de producción a la lista
   de redirect URLs.
7. (chat en vivo + notificaciones) Ejecuta
   `supabase/migrations/028_chat_realtime_publication.sql`, que agrega
   `public.chat_messages` a la publicación `supabase_realtime` (y le pone
   `replica identity full`). **Sin esto no llega ningún evento de Realtime**
   y las notificaciones de chat no funcionan. Verificá en Database →
   Publications → `supabase_realtime`. Ver la sección
   [Notificaciones de chat](#notificaciones-de-chat).

### Roles y permisos

| Campo en `profiles` | Valor | Qué habilita |
|---|---|---|
| `role` | `member` | Acceso normal a la app de miembros |
| `role` | `admin` | Acceso a `/admin/*` y edición de todos los contenidos |
| `can_respond_chat` | `true` | Responder en Chat Secretaría desde el panel admin |
| `can_manage_treasury` | `true` | Editar la sección de Tesorería |

Promover al primer admin (después de su primer ingreso con magic link):

```sql
update public.profiles
set role = 'admin',
    can_respond_chat = true,
    can_manage_treasury = true
where email = 'tu@correo.com';
```

A partir de ahí, ese admin puede gestionar al resto desde
**`/admin/miembros`**.

---

## PWA

- Manifest: generado por `app/manifest.ts` en `/manifest.webmanifest`.
- Service worker: `@ducanh2912/next-pwa` genera `public/sw.js` durante el
  `next build` (deshabilitado en dev para evitar caché ruidosa).
- Iconos: `public/icons/icon-{192,512}.png` y `icon-maskable-512.png`.
  Regenerar con `powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1`.

Para instalarla en móvil: abre la URL en Chrome/Safari → "Añadir a
pantalla de inicio". La app también muestra un botón **"Instalar App"**
(componente `InstallAppButton` en Home y Perfil) que solo aparece si NO
está instalada: en Android dispara el instalador nativo
(`beforeinstallprompt`); en iPhone muestra las instrucciones de Safari
(iOS no permite instalar por código). Se oculta al correr en modo
standalone.

---

## Notificaciones de chat

El chat avisa en **tres capas**, en ambos sentidos (miembro ↔ Secretaría):

1. **En la app — sonido + badge en vivo.** Un listener global
   `ChatNotifier` (montado en los layouts de miembro y de admin) escucha
   `chat_messages` por Supabase Realtime desde **cualquier pantalla**:
   reproduce un sonido (Web Audio, sin archivo de audio) y refresca el
   badge del tab AEL / "chat sin leer". Solo necesita que Realtime esté
   habilitado (ver más abajo).
2. **Notificación del sistema — app en segundo plano.** Si la pestaña/PWA
   no está visible y el usuario dio permiso, se muestra una `Notification`.
3. **Web Push — app cerrada.** Service worker (`worker/index.js`) +
   `web-push` envían la notificación aunque la app esté totalmente cerrada.

### Requisitos

**a) Realtime habilitado para `chat_messages`** (capas 1 y 2). **Sin esto
no llega ningún evento.** Lo garantiza la migración
`supabase/migrations/028_chat_realtime_publication.sql`. Verificá en
Database → Publications → `supabase_realtime`.

**b) Web Push** (capa 3):

- Ejecutar `supabase/migrations/027_push_subscriptions.sql` (tabla de
  suscripciones con RLS por usuario).
- Variables de entorno (en `.env.local` **y** en Vercel):

  ```
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # clave pública VAPID (cliente)
  VAPID_PRIVATE_KEY=...              # clave privada VAPID (servidor, secreta)
  VAPID_SUBJECT=mailto:tu@correo.com
  SUPABASE_SERVICE_ROLE_KEY=...      # service_role (Settings → API): el envío
                                     # lee las suscripciones del destinatario
  ```

- Generar el par VAPID:

  ```
  node -e "console.log(require('web-push').generateVAPIDKeys())"
  ```

- El usuario activa el push con el botón **"Activar"** en **Perfil**
  (miembro) o **Secretaría → Conversaciones** (admin).

### A quién se notifica

- Un **miembro** escribe → a los admins con `can_respond_chat` de su localidad.
- La **Secretaría** responde → al miembro.
- El **emisor se excluye** → para probar, usá **dos cuentas distintas**.

### Cómo probar

- **Capa 1** (sin segunda cuenta): abrí `/chat` y, desde el SQL Editor,
  insertá un mensaje dirigido a vos:

  ```sql
  insert into chat_messages (member_id, from_user_id, text, is_admin_reply, read, locality_id)
  select p.id, p.id, 'prueba realtime', true, true, p.locality_id
  from profiles p where p.email = 'tu@correo.com';
  ```

  Debería aparecer solo + sonar. En consola: `[chat:member] subscribe
  status: SUBSCRIBED` y `[chat:member] INSERT received`.
- **Capa 3:** dos cuentas en dos dispositivos; una manda, la otra recibe
  con la app cerrada.

### Gotchas

- **Solo funciona en producción** (Vercel): `next-pwa` desactiva el service
  worker en `npm run dev`, así que push e instalación se prueban deployado.
- **iPhone:** el push solo llega si la app está **instalada** en la pantalla
  de inicio (iOS 16.4+); en Safari como pestaña normal, iOS no entrega push.
- **Cambios de variables de entorno en Vercel** requieren **redeploy**.
- Si el push no llega, verificá que se creó una fila en `push_subscriptions`
  al tocar "Activar".

---

## Notificaciones de comunicados y eventos

Reusan la misma infra de Web Push (VAPID + `SUPABASE_SERVICE_ROLE_KEY`).

- **Comunicado nuevo:** al publicar un comunicado (no al editarlo), se envía
  push a **todos los miembros de la localidad** (incluido quien publica, como
  confirmación). Deep-link → `/comunicados`, donde el más reciente queda
  resaltado en dorado.
- **Recordatorio de evento (1 día antes):** un **Vercel Cron** diario llama a
  `GET /api/cron/event-reminders` a las **13:00 UTC ≈ 10:00 UYT** (ver
  `vercel.json`) y avisa de los eventos de *mañana* a los miembros de cada
  localidad. La columna `calendar_events.reminder_sent_at` (migración 030)
  evita reenvíos.

Variables de entorno extra (Vercel → Environment Variables):

```
CRON_SECRET=...        # Vercel lo envía como "Authorization: Bearer <secret>".
                       # La ruta lo exige si está seteado; sin él, queda abierta.
APP_TIMEZONE=America/Montevideo   # opcional; default ya es esta TZ.
                       # Define qué fecha civil cuenta como "mañana".
```

> El plan Hobby de Vercel permite cron una vez por día — el horario fijo
> diario encaja. Para cambiar la hora, ajustá el `schedule` (cron en UTC).

---

## Despliegue

Recomendado: **Vercel** (cero configuración para Next.js + PWA).

```powershell
npm install -g vercel
vercel
# añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
# desde el dashboard de Vercel (Project Settings → Environment Variables)
# Para notificaciones push, añade además NEXT_PUBLIC_VAPID_PUBLIC_KEY,
# VAPID_PRIVATE_KEY, VAPID_SUBJECT y SUPABASE_SERVICE_ROLE_KEY
# (ver "Notificaciones de chat"). Para el cron de recordatorios de eventos,
# añade CRON_SECRET (ver "Notificaciones de comunicados y eventos").
# Cambiar env vars requiere redeploy.
```

---

## Tokens de diseño

Definidos a la vez en `tailwind.config.ts` (clases utilitarias) y
`lib/tokens.ts` (hex literal para SVG / gradientes inline).

| Token | Hex | Uso |
|-------|-----|-----|
| `gold` / `gold-dark` / `gold-light` | `#C4A235` / `#96790E` / `#D4B85A` | Header dorado |
| `terra` / `terra-light` | `#2A3F8F` / `#3D56B0` | Acento principal, badges |
| `amber` | `#7E44B8` | Acento secundario (morado) |
| `dark` / `muted` | `#2A2833` / `#7A7670` | Texto |
| `bg` / `card` | `#F8F7F2` / `#FFFFFF` | Fondo / tarjetas |
| `green` / `online` | `#6A8B5F` / `#7ECF8B` | Categoría niños / chat online |

Fuentes (Google Fonts vía `next/font`): **Cormorant Garamond** (display),
**Sora** (sans), **Outfit** (body).

---

## Siguientes pasos sugeridos

- [x] Auth UI: magic-link + middleware Supabase (`/admin/login`).
- [x] Panel admin (`/admin/...`) para que la Secretaría edite mensajes,
      actividades, calendario, materiales, metas, servicio, tesorería y
      miembros — con tags `can_respond_chat` y `can_manage_treasury`.
- [x] Realtime chat: `chat-screen.tsx` y `conversation.tsx` se subscriben a
      `chat_messages` con `postgres_changes` (requiere migración 028).
- [x] Conectar la app de miembros a la sesión real (el chat envía y lee
      mensajes de la DB con la sesión del miembro).
- [x] Notificaciones de chat en 3 capas: in-app (sonido + badge), del
      sistema (segundo plano) y Web Push con la app cerrada (`web-push` +
      service worker, sin Edge Function). Ver "Notificaciones de chat".
- [ ] Calendario dinámico (hoy se muestra Mayo 2026 fijo según el
      prototipo): swap por mes/año actuales y navegación entre meses.
- [ ] Bahá'í Calendar (19-day Feast + Holy Days): integrar el calendario
      bahá'í además del gregoriano.
- [ ] i18n: estructura ya preparada para múltiples idiomas (Sora + Outfit
      cubren latin extended; añadir Persian con `next/font` si se necesita).
