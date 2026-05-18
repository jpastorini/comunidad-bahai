# Handoff: Comunidad Bahá'í — App de Centro de Comunicados

## Overview

Aplicación móvil para una Comunidad Bahá'í que centraliza comunicación, actividades, recursos de estudio y gestión comunitaria. Incluye 10 pantallas con navegación completa.

## About the Design Files

Los archivos en este paquete son **prototipos de diseño creados en HTML/React** — muestran la apariencia y comportamiento deseados. **No son código de producción para copiar directamente.** La tarea es recrear estos diseños en el framework elegido para la app real (React Native, Next.js PWA, Flutter, etc.) usando patrones y librerías apropiados para producción.

## Fidelity

**High-fidelity (hifi)**: Los prototipos son maquetas pixel-perfect con colores finales, tipografía, espaciado e interacciones. El desarrollador debe recrear la UI con fidelidad visual usando las librerías del framework elegido.

## Recommended Tech Stack

### Opción A: Progressive Web App (recomendada para MVP)
- **Framework**: Next.js 14+ con App Router
- **UI**: Tailwind CSS + componentes custom
- **Backend**: Supabase (Auth, Database, Realtime, Storage)
- **Deploy**: Vercel
- **PWA**: next-pwa para instalación en móvil

### Opción B: App Nativa
- **Framework**: React Native + Expo
- **UI**: React Native StyleSheet (siguiendo los tokens de diseño)
- **Backend**: Supabase
- **Deploy**: App Store / Google Play via EAS Build

## Screens / Views

### 1. HOME (Pantalla de Inicio)
**Purpose:** Dashboard principal con acceso a todas las secciones.

**Layout:**
- Full-height flex column
- Gold gradient header (fixed)
- Scrollable content area
- Fixed tab bar at bottom

**Components:**

#### 1.1 Gold Header
- Background: `linear-gradient(160deg, #96790E, #C4A235)`
- Padding: 62px top (status bar), 20px bottom, 22px sides
- Title: "Comunidad Bahá'í" — Cormorant Garamond, 27px, weight 600, white
- Subtitle row: "CENTRO DE COMUNICADOS" (10px, uppercase, letter-spacing 2.5, white 50% opacity) + date "17 mayo, 2026" (11px, Outfit, white 45% opacity)
- Decorative: 9-pointed star (130px, white, 7% opacity) positioned top-right

#### 1.2 Featured Message Card
- Background: `linear-gradient(135deg, #2A3F8F, #3D56B0)`
- Border-radius: 18px, padding: 15px 18px
- Label: "✦ Mensaje reciente" (9px, uppercase, letter-spacing 1.5, white 55% opacity)
- Title: Cormorant Garamond, 18px, weight 600, white
- Excerpt: Outfit 11.5px, white 70% opacity
- CTA: "Leer mensaje →" (11.5px, weight 600, white)
- Decorative: 9-pointed star (80px, white, 6% opacity) bottom-right
- **Tap action:** Navigate to Mensajes screen

#### 1.3 Section Grid
- 2 columns, gap 9px
- 8 cards, each:
  - Background: white, border-radius 14px, padding 14px 10px 12px
  - Box-shadow: `0 2px 6px rgba(42,31,20,0.04)`
  - Icon circle: 42×42px, border-radius 13px, background `{color}10`
  - Title: 12.5px, weight 600, color #2A2833
  - Subtitle: 10px, Outfit, color #7A7670
  - Optional badge (top-right, 8px): background terra for "Nuevo" (white text), or `terra 15%` background for numbers
  - Optional progress bar (Tesorería): 75% width, 4px height, amber color
  - **Tap action:** Navigate to corresponding screen

**Section grid items:**
| Section | Icon | Color | Badge | Screen ID |
|---------|------|-------|-------|-----------|
| Mensajes (Casa Universal) | Document | #2A3F8F (terra) | "Nuevo" | mensajes |
| Secretaría (Local) | Chat | #7E44B8 (amber) | "2" | chat |
| Actividades (Locales) | People | #2A3F8F | "3" | actividades |
| Calendario (Mayo 2026) | Calendar | #7E44B8 | — | calendario |
| Servicio (Necesidades) | Heart | #2A3F8F | "5" | servicio |
| Materiales (de Estudio) | Book | #7E44B8 | — | materiales |
| Metas (Enseñanza) | Target | #2A3F8F | — | metas |
| Tesorería (65% meta) | Chart | #7E44B8 | progress bar | tesoreria |

#### 1.4 Upcoming Activities Section
- Section title: "Próximamente" (14px, Sora, weight 600)
- 2 cards side-by-side (flex, gap 9px)
- Each card: white, border-radius 14px, padding 12px
- Date/time label: 9.5px, uppercase, terra color
- Activity title: 12.5px, weight 600
- Detail: 10.5px, Outfit, muted
- **Tap action:** Navigate to Actividades

#### 1.5 Tab Bar
- 5 items: Inicio, Mensajes, Calendario, Servicio, Más
- Padding: 10px top, 34px bottom (home indicator space)
- Active color: #2A3F8F (terra), inactive: #7A7670
- Icon: 20px, label: 10px
- Border-top: 1px solid rgba(0,0,0,0.06)

---

### 2. MENSAJES (Casa Universal de Justicia)
**Purpose:** Lista de mensajes/cartas de la Casa Universal de Justicia.

**Layout:** Gold header → search bar → scrollable message list → tab bar

**Components:**
- Gold header with back button ("← Inicio"), title "Mensajes", subtitle "Casa Universal de Justicia"
- Search bar: background `gold 8%`, border-radius 12px, padding 10px 14px
- Message list items:
  - Date: 10px, terra color, weight 600
  - "Nuevo" badge: 8px, background terra, white text, border-radius 4px
  - Title: Cormorant Garamond, 17px, weight 600
  - Excerpt: Outfit, 12px, muted, 2-line clamp
  - Divider: 1px solid rgba(42,63,143,0.08)

---

### 3. CHAT (Secretaría Local)
**Purpose:** Mensajería directa con la Secretaría de la Asamblea Local.

**Layout:** Gold header with avatar → chat bubbles → input bar → tab bar

**Components:**
- Header: Gold gradient, avatar circle (40px, white 20% bg), name "Secretaría Local", online indicator (green dot #7ECF8B)
- Chat bubbles:
  - Received: white card, border-radius 16px 16px 16px 4px, shadow
  - Sent: terra background (#2A3F8F), white text, border-radius 16px 16px 4px 16px
  - Font: Outfit 13px, line-height 1.5
  - Timestamp: 9.5px, muted
- Input bar: background #F8F7F2, border-radius 24px, send button (terra, 32px circle)

---

### 4. ACTIVIDADES LOCALES
**Purpose:** Lista de próximas actividades comunitarias.

**Layout:** Gold header → scrollable card list → tab bar

**Activity card:**
- White, border-radius 16px, padding 14px 16px
- Left: Date column (48px wide, border-radius 12px, colored background)
- Right: Type badge (8.5px, uppercase), title (14px, weight 600), detail, time + place
- Activity types with colors: Estudio=#2A3F8F, Devocional=#7E44B8, Niños=#6A8B5F, Jóvenes=#C4A235

---

### 5. CALENDARIO
**Purpose:** Vista mensual de calendario con eventos.

**Layout:** Gold header → calendar grid card → event list → tab bar

**Calendar grid:**
- 7 columns (Lu-Do), day headers 10px uppercase
- Day cells: 36×36px circles
- Today: terra background, white text
- Event days: terra 10% background, terra text
- Non-event days: transparent, dark text

**Event list:** Cards with date circle (40px) + title + time

---

### 6. MATERIALES DE ESTUDIO
**Purpose:** Acceso a libros del Instituto Ruhí y escritos sagrados.

**Layout:** Gold header → Ruhí book list → Sacred writings list → tab bar

**Ruhí books:**
- Each item: white card, number circle (32px), title, checkmark or "En curso" badge
- Completed: terra number circle (12% bg), checkmark icon
- Current: terra solid number circle, purple "En curso" badge
- Pending: muted number circle

**Sacred writings:** Simple list items with book icon + title + subtitle

---

### 7. METAS DE ENSEÑANZA
**Purpose:** Visualización del progreso en metas del ciclo actual.

**Layout:** Gold header → stat cards → progress bars → tab bar

**Stat cards:** 3 side-by-side (flex, gap 9px)
- Number: Cormorant Garamond, 26px, weight 700, terra
- Label: 9.5px, Outfit, muted

**Progress bars:** Per activity type
- Label + current/goal counter
- Bar: 6px height, border-radius 3px, colored fill
- Colors: Círculos=#2A3F8F, Devocionales=#7E44B8, Niños=#6A8B5F, Prejuniors=#C4A235

---

### 8. NECESIDADES DE SERVICIO
**Purpose:** Lista de necesidades de la comunidad donde los miembros pueden ofrecerse.

**Layout:** Gold header → service need cards → tab bar

**Service need card:**
- Title + urgency badge (Alta/Media/Baja)
- Description: 12px, Outfit, muted
- CTA: "Ofrecerme como voluntario →" (11.5px, terra, weight 600)
- Urgency colors: Alta=#2A3F8F, Media=#7E44B8, Baja=#C4A235

---

### 9. TESORERÍA
**Purpose:** Progreso del fondo, métodos de contribución, informes.

**Layout:** Gold header → progress ring → contribution methods → monthly report → tab bar

**Progress ring:** SVG circle, radius 56, amber stroke (#7E44B8), 65% filled
- Center: "65%" (Cormorant Garamond, 30px) + "de la meta" (10px)
- Below: "$3,250 de $5,000" + "Meta anual del Fondo"

**Contribution methods:** 2 cards (Transferencia, Efectivo) with letter icons

**Monthly report:** Table rows with label + amount, thin dividers

---

### 10. MÁS (More Menu)
**Purpose:** Acceso a secciones no mostradas en el tab bar.

**Layout:** Gold header → list of section items → tab bar

**Items:** 5 rows, each with icon circle (40px) + label + subtitle + chevron

---

## Interactions & Behavior

### Navigation
- **Tab bar:** Direct navigation to Home, Mensajes, Calendario, Servicio, Más
- **Home grid tap:** Navigate to corresponding section
- **Back button (← Inicio):** Returns to Home screen
- **Más menu items:** Navigate to corresponding section
- **Featured message card:** Navigate to Mensajes

### Animations (suggested for production)
- Screen transitions: 250ms slide (forward: slide-left, back: slide-right)
- Tab changes: 150ms fade
- Card tap: subtle scale(0.98) on press

### Real-time features (for production)
- **Chat:** WebSocket/Supabase Realtime for live messaging
- **Badges:** Live counters from database
- **Activities:** Auto-sort by date, remove past events

---

## State Management

### Global State
```
{
  currentScreen: 'home' | 'mensajes' | 'chat' | ... ,
  user: { id, name, role },
  notifications: { mensajes: number, chat: number, servicio: number },
}
```

### Data Models

#### Messages (Casa Universal)
```
{ id, date, title, excerpt, fullText, isNew }
```

#### Chat Messages
```
{ id, fromUserId, text, timestamp, read }
```

#### Activities
```
{ id, type: 'estudio'|'devocional'|'ninos'|'jovenes', title, detail, date, time, place }
```

#### Calendar Events
```
{ id, date, title, time, color, activityId? }
```

#### Study Materials
```
{ id, type: 'ruhi'|'escritos'|'oraciones', number?, title, subtitle?, completed, current }
```

#### Teaching Goals
```
{ id, label, current, goal, color, cycle }
```

#### Service Needs
```
{ id, title, description, urgency: 'alta'|'media'|'baja', volunteers: userId[] }
```

#### Treasury
```
{ id, goalAmount, currentAmount, period, 
  contributions: { label, amount }[],
  methods: { type, description }[] }
```

---

## Design Tokens

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| gold | #C4A235 | Header gradient end, gold accents |
| goldDark | #96790E | Header gradient start |
| goldLight | #D4B85A | Highlights |
| terra (primary) | #2A3F8F | Deep blue — primary accent, buttons, badges, links |
| terraLight | #3D56B0 | Lighter blue for gradients |
| amber (secondary) | #7E44B8 | Purple — secondary accent, alternating icons |
| dark | #2A2833 | Primary text |
| muted | #7A7670 | Secondary text, placeholders |
| bg | #F8F7F2 | Page background (warm cream) |
| card | #FFFFFF | Card backgrounds |

### Typography
| Token | Font Family | Weight | Size | Usage |
|-------|------------|--------|------|-------|
| display-lg | Cormorant Garamond | 700 | 28-30px | Screen titles, large numbers |
| display-md | Cormorant Garamond | 600 | 18-27px | Section titles, card titles |
| heading | Sora | 600-700 | 14-16px | Section headers, names |
| body | Outfit | 400-500 | 12-13px | Body text, descriptions |
| caption | Outfit | 400-600 | 10-11px | Subtitles, metadata |
| badge | Sora | 700 | 8-9px | Badges, labels (uppercase) |

### Spacing
- Card padding: 12-16px
- Grid gap: 9-10px
- Section spacing: 12-14px
- Screen horizontal padding: 13-16px
- Border-radius: 4px (badges), 12-14px (cards), 16-18px (large cards), 24px (pills)

### Shadows
- Card: `0 2px 6px rgba(42,31,20,0.04)`
- Elevated card: `0 2px 10px rgba(42,31,20,0.05)`
- Device: `0 40px 80px rgba(0,0,0,0.18)`

### Decorative Elements
- **9-pointed Bahá'í star:** Used as subtle watermark in headers (5-7% opacity, white, large size)
- Generate with: 9 outer points at radius R, 9 inner points at radius R×0.49, alternating at 40° intervals, rotated -90°

---

## Assets

### Icons (Stroke-based, 24px viewBox, strokeWidth 1.5)
All icons are simple SVG stroke icons — use any icon library (Lucide, Heroicons) with equivalent icons:
- Mensajes → FileText / Document
- Chat → MessageSquare
- Actividades → Users / People
- Calendario → Calendar
- Servicio → Heart
- Materiales → BookOpen
- Metas → Target / Crosshair
- Tesorería → BarChart
- Home → Home
- More → MoreVertical

### Fonts (Google Fonts)
- Cormorant Garamond (400, 500, 600, 700, italic 400)
- Sora (400, 500, 600, 700)
- Outfit (300, 400, 500, 600, 700)

---

## Files

Design reference files in this package:
- `Comunidad Bahai Prototype.html` — Main interactive prototype (open in browser)
- `home-refined.jsx` — Home screen design + color tokens
- `proto-nav.jsx` — Shared navigation components
- `proto-home.jsx` — Interactive home screen
- `proto-screens.jsx` — All inner screens (Mensajes, Chat, Actividades, Calendario, Materiales, Metas, Servicio, Tesorería, Más)
- `proto-app.jsx` — Navigation router
- `app-icons.jsx` — SVG icons and Bahá'í star
- `ios-frame.jsx` — iOS device frame (design reference only)

---

## Implementation Notes

1. **Auth:** Use Supabase Auth with email/magic link — no passwords for simplicity
2. **Roles:** Admin (Secretariat members who can edit content) vs Member (read + chat + volunteer)
3. **Chat:** Supabase Realtime subscriptions for live messaging
4. **Content management:** Secretariat uses a simple admin panel to manage activities, goals, treasury reports, service needs, and upload Casa Universal messages
5. **Notifications:** Push notifications for new messages, chat replies, upcoming activities
6. **Offline:** Cache recent data with service worker for offline reading
7. **i18n:** Currently Spanish-only but structure for multi-language support
