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
- **Terminología de la comunidad:** a la gente de la comunidad se le dice
  **"creyente(s)"** en todo texto visible; **"miembro(s)"** se reserva para
  los miembros de la Asamblea (AEL). Los valores internos no cambian
  (`role='member'`, rutas `/admin/miembros`, nombres de funciones). Las
  citas de Escritos no se tocan. Etiquetas centrales en `ROLE_LABELS`
  (`lib/types.ts`).
- **Charlar el diseño antes de codear** cuando hay decisiones de producto;
  el usuario prefiere alinear conceptualmente primero.
- **Pre-cargar datos conocidos** en vez de pedir que el usuario los cree
  (ej. las 19 Fiestas y los 11 Días Sagrados se auto-siembran).
- **Pre-producción:** borrar y recargar datos es aceptable cuando un
  rediseño lo justifica (confirmar con el usuario).
- **Columnas nuevas en `profiles`:** la política `profiles_update_self`
  (migración 039) congela por nombre las columnas privilegiadas y deja
  editable todo lo demás de la propia fila. Si agregás una columna
  **privilegiada** (un permiso, un estado que asigna la Asamblea), hay que
  sumarla a esa lista o queda escribible por el propio usuario vía
  PostgREST. Las preferencias personales no necesitan nada.
- Commits descriptivos enfocados en el "por qué". El `git log` es parte
  de la memoria compartida.

---

## Estado actual (features en producción)

Calendario con 4 categorías · Fiestas auto-sembradas (ciclo
draft→published→in_progress) · Días Sagrados auto-sembrados con horarios
especiales · Galería de fotos (con lightbox y vista full-screen) ·
Google OAuth + magic link · Perfil de usuario (avatar, nombre, mis fotos) ·
Aprobación de cambio de localidad por Asamblea destino · Notificaciones de
chat (in-app + Web Push) · Botón "Instalar App" (PWA) · Presupuesto anual
de Tesorería · Contenido nacional · Disponibilidad para reuniones (grilla
semanal por miembro AEL + consolidado/heatmap en `/admin/disponibilidad`;
además, al crear/editar un evento "Reunión AEL" se despliega el consolidado
compacto al costado del formulario, solo en PC) · Boletín local (ediciones
draft→published que compilan eventos/comunicados/fotos + editorial;
editan admins locales o designados con tag `can_manage_bulletin` — pueden
ser `role='member'`, con excepción en middleware/layout acotada a
`/admin/boletin`; push al publicar; link público compartible `/b/<token>`
resuelto con service-role, ver `lib/bulletins.ts` y migración 036) ·
Onboarding amigable (link/QR de invitación reusable por localidad en
`/admin/miembros` — quien lo abre queda incorporado automáticamente en su
primer ingreso, cookie `cb_invite` + `/auth/callback`; asistente de
bienvenida `/bienvenida` con pasos guiados: avisos push, instalar PWA y
mini-tour; ver `lib/invites.ts` y migración 037. El cambio ENTRE
localidades sigue requiriendo aprobación manual) ·
**Vida devocional**: "Lectura de hoy" (cita de los Escritos Sagrados, la
misma para toda la comunidad cada día, determinística por fecha — sin tabla
ni estado, ver `lib/citas.ts`; corpus de 991 citas en `public/citas.json`
generado por `scripts/build-citas.mjs` desde la compilación "La Fuente de
Todo Bien") con tarjeta en Inicio, pantalla `/citas` navegable por tema y
push a las 8:00 · recordatorio opt-in de la **Oración Obligatoria corta** a
las 13:00, que se prende desde el perfil, el asistente de bienvenida o la
propia pantalla de la oración (migración 038) ·
**Tesorería como libro contable** (migración 040, reemplaza al Google
Sheet del tesorero): los MOVIMIENTOS son la fuente de verdad y el saldo se
calcula · **Informes de Tesorería** (migración 041): el deck que se
presenta en la Fiesta, armado desde el libro por rango de fechas, con
link público compartible. Ver la sección "Tesorería" más abajo.

## Tesorería (leer antes de tocarla)

El libro vive en `/admin/tesoreria/libro`, detrás del tag
`can_manage_treasury` (no del rol admin). Migración 040; el catálogo y los
54 movimientos del año 183 entraron con `supabase/seed_tesoreria_183.sql`,
generado por `scripts/import-tesoreria.mjs` desde los CSV de la planilla.

Cuatro cosas del dominio que el modelo respeta y conviene no romper:

- **El saldo no es un número: es una matriz cuenta × moneda.** "Caja Chica
  Tesorero" tiene pesos y dólares a la vez, así que las cuentas no llevan
  moneda; la lleva el asiento. **Nunca sumar monedas distintas en un total.**
- **La plata está "coloreada" por fondo** (Local, Enseñanza, Ayuda Social,
  Retorno de Deuda AEN, Clases de Niños, Mantenimiento). Dos movimientos de
  la misma cuenta pueden ser de fondos distintos y no se suman entre sí.
- **Las transferencias** (cambio de caja, compra de divisas) son UNA
  operación con dos asientos atados por `transfer_group_id`, y pueden
  cruzar monedas: el tipo de cambio queda implícito en los dos montos.
  Borrar una pata borra las dos.
- **Los recibos son correlativos y sin huecos.** El próximo número lo da
  `next_receipt_number()`, no la memoria de nadie. Una línea puede agrupar
  varios aportes anónimos (`contributions_count`): es la canasta de la
  Fiesta.

**Confidencialidad:** el libro y los contribuyentes son exclusivos del
tesorero; un miembro de la Asamblea sin el tag no los lee ni por API
directa. En la pantalla, los nombres arrancan ocultos y se muestran con un
botón. Los agregados para la Asamblea (cuando se hagan) tienen que salir
por funciones security definer que no expongan nombres.

Recibos en `/admin/tesoreria/recibo/[id]`: hoja A5, imprimible o
compartible como PNG por WhatsApp. Logo y firma en `public/recibo/`,
extraídos del Apps Script viejo con `scripts/extract-recibo-assets.mjs`; si
faltan, el recibo se emite igual.

⚠️ Al capturar un nodo con `lib/share-image.ts`, el nodo **no puede tener
márgenes `auto`**: `getComputedStyle` los devuelve resueltos en píxeles y
el clon sale corrido y recortado. El helper ya fuerza `margin: 0`, pero el
centrado va siempre en un envoltorio.

### Informes de Tesorería (migración 041)

El informe que se presenta en la Fiesta. El tesorero da un rango de
fechas en `/admin/tesoreria/informes/nuevo` (los atajos son los meses
bahá'ís, que es el corte natural) y sale un **deck de diapositivas**:
portada, resumen, ingresos por recibo, egresos, fondos, cuentas, dos
gráficos del año, presupuesto vs. ejecutado, meta, destino de los fondos
y cierre. Ciclo `draft→published` como el Boletín, con link público
`/i/<token>` resuelto con service-role. Deck en
`components/treasury/ReportDeck.tsx`; vista previa full-screen en
`/admin/informe/[id]`, **fuera** del grupo `(panel)` porque el shell del
admin le comería la pantalla.

Cuatro reglas del cálculo (`lib/treasury-reports.ts`) que conviene no
romper:

- **Ingresos y egresos son del rango; los saldos son acumulados.** Un
  saldo no tiene período: es todo el libro hasta la fecha de cierre,
  arrastre incluido.
- **Las transferencias no son movimiento del Fondo.** Las dos patas
  atadas por `transfer_group_id` se cancelan; contarlas infla las dos
  columnas. Quedan fuera y el informe dice cuántas hubo. Ojo que los
  "Gastos por transferencia" (el costo del giro) NO llevan grupo: son
  gasto real y se cuentan.
- **El snapshot se congela.** Las cifras viven en la columna `snapshot`
  y se recalculan al guardar, nunca al renderizar: el informe que se
  proyectó en la Fiesta no cambia porque después se cargó un movimiento.
  La columna `editorial` guarda los textos (notas por sección, destino,
  meta, cita, firma), que el libro no puede saber.
- **Sin nombres.** El detalle de ingresos es por número de recibo, fecha
  y monto. El informe es público; el libro no.

**Presupuesto vs. ejecutado:** los nombres de las categorías del
presupuesto (024) y del libro (040) no coinciden y no hay forma de
adivinar el par, así que el tesorero lo declara con el desplegable "Se
ejecuta con" en el editor del presupuesto. Son dos columnas
(`ledger_category_id` y `ledger_subcategory_id`) porque la granularidad
cambia según la línea: "Enseñanza" es una categoría entera, "Aporte al
Fondo Nacional" es una subcategoría dentro de "Gastos Operativos". Una
línea sin vincular se informa como tal, nunca como cero.

## Pendientes conocidos

- **Jubilar la tabla `treasury` vieja.** `/tesoreria` de la comunidad y
  los dos compartibles (`MonthlyReportShare`, `BudgetReportShare`) siguen
  leyendo el `current_amount` escrito a mano, que ahora contradice al
  libro. El informe (041) ya calcula todo desde los movimientos: falta
  que esas tres pantallas tomen de ahí y que el formulario a mano
  desaparezca.
- **Cierre de período.** Generar los asientos "Saldo anterior" del 184 a
  partir de los saldos al cierre del 183 (`is_opening_balance`), en vez
  de cargarlos a mano.
- **El informe no avisa.** Al publicar no sale push ni aparece en la app
  de la comunidad: la distribución es el link `/i/<token>` por WhatsApp.
  La RLS ya deja que un creyente lea los informes publicados de su
  localidad, así que sumar una pantalla en `/tesoreria` es solo UI.
- **Buscador del libro:** encuentra por nombre de contribuyente aunque los
  nombres estén ocultos. Decidido dejarlo así por ahora; si molesta, que
  ignore los nombres mientras estén ocultos.

- **Presupuesto de crons.** El plan Hobby de Vercel permite pocos crons
  diarios, así que los dos avisos de la mañana (Lectura de hoy + eventos de
  mañana) comparten `/api/cron/manana` (11:00 UTC = 8:00 local) y el de la
  oración va en `/api/cron/oracion` (16:00 UTC = 13:00 local). Si hacen
  falta más horarios —o granularidad menor a un día— el camino es pg_cron +
  pg_net desde Supabase pegándole a la ruta con el `CRON_SECRET`.
- **Abreviaturas de las referencias** (PEB, SEAB, TB, PO, MVB…). La
  compilación de origen no trae la leyenda, así que las citas muestran la
  referencia tal cual. Si se consigue la lista, conviene mostrarla en
  `/citas`.
- **Palabras Ocultas completas.** El corpus actual incluye 44 citas de PO
  vía la compilación, pero no el libro entero. Si aparece el texto oficial
  en español, se agrega como segunda fuente al mismo `citas.json` y el
  selector diario no cambia.
- **Fase 2 de fotos:** boletín nacional (los campos `visibility` y
  `featured` en `event_photos` ya están listos, sin UI todavía).
- **Verificar fechas Badí' BE 185+** (2028 en adelante) contra bahai.org
  cuando se acerque; hoy `lib/bahai-calendar.ts` tiene Fiestas hasta 185 y
  Días Sagrados hasta 184 verificados.
