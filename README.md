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
7. (chat en vivo) Database → Replication → activa replicación para
   `public.chat_messages`. El cliente puede subscribirse con
   `supabase.channel('chat').on('postgres_changes', …)`.

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
pantalla de inicio".

---

## Despliegue

Recomendado: **Vercel** (cero configuración para Next.js + PWA).

```powershell
npm install -g vercel
vercel
# añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
# desde el dashboard de Vercel (Project Settings → Environment Variables)
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
- [ ] Realtime chat: subscribirse a `chat_messages` desde
      `app/(app)/chat/chat-screen.tsx` con
      `supabase.channel().on('postgres_changes', …)`. Hoy se envían
      mensajes pero el render es estático.
- [ ] Conectar la app de miembros a la sesión real (hoy el chat usa
      `seed-data` y no envía mensajes a la DB).
- [ ] Notificaciones push: usar `web-push` + un endpoint Edge Function.
- [ ] Calendario dinámico (hoy se muestra Mayo 2026 fijo según el
      prototipo): swap por mes/año actuales y navegación entre meses.
- [ ] Bahá'í Calendar (19-day Feast + Holy Days): integrar el calendario
      bahá'í además del gregoriano.
- [ ] i18n: estructura ya preparada para múltiples idiomas (Sora + Outfit
      cubren latin extended; añadir Persian con `next/font` si se necesita).
