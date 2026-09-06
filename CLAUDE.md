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

## Rendimiento (leer antes de tocar auth o caché)

**Todas las rutas son dinámicas** (`ƒ` en el build): autentican con
cookies, así que Next no puede pre-renderizar ninguna y los
`export const revalidate = 60` que quedan en los layouts **no hacen
nada**. Lo que se paga en cada navegación no es descarga de JS (~90 kB
compartidos, que el service worker cachea con CacheFirst) sino idas y
vueltas a Supabase **en serie**. Eran cuatro; hoy es una. Tres cosas lo
sostienen:

- **El middleware no sale a la red para autenticar.** `getClaims()` lee
  el token de la cookie, lo refresca solo si está por vencer y verifica
  la **firma localmente** con WebCrypto contra el JWKS del proyecto, que
  la librería cachea 10 min en un global del isolate.
  ⚠️ Depende de que el proyecto firme con **clave asimétrica**
  (ES256/RS256, Settings → JWT Keys). Si volviera al secreto HS256
  legacy, `getClaims()` cae sola a `getUser()` —una llamada HTTP por
  request, prefetch incluidos— y se pierde el ahorro **sin que nada
  falle ni se vuelva inseguro**, que es justamente lo que lo hace difícil
  de notar. Medido: token con firma inválida rechazado en ~15 ms, contra
  ~150 ms del camino de red.
- **Lo que no cambia por request sale del caché.** `getLocality()`
  (`lib/auth.ts`) va por `unstable_cache` (entre requests, con tag
  `locality-<id>`) + `cache()` de React (dentro del render). El segundo
  no es de más: el layout y la página llaman al MISMO guard en el mismo
  render, así que la localidad se pedía dos veces por navegación.
  `getBadges()` estaba igual —el layout de `(app)` y la home, 3
  consultas cada uno— y también quedó envuelta en `cache()`.
  ⚠️ Adentro de `unstable_cache` no se puede leer `cookies()`; de ahí
  `createSupabaseAnonNoCookies()`. Vale **solo** para `localities`, cuya
  policy de lectura es `using (true)` (012). Y si se edita una
  localidad hay que llamar a `revalidateTag(localityTag(id))`, o el
  cambio tarda hasta una hora en verse.
- **Las pantallas ya visitadas viven en memoria del navegador.**
  `experimental.staleTimes` (`next.config.mjs`) más `prefetch` en los
  `<Link>` de la TabBar. El detalle que importa: en una ruta dinámica el
  prefetch por defecto trae **solo el esqueleto de `loading.tsx`** y los
  datos se piden igual al tocar; con `prefetch` completo quedan los
  datos. Lo urgente no se atrasa: `router.refresh()` (ChatNotifier) y el
  `revalidatePath` de los server actions tiran ese caché abajo al
  instante.

⚠️ **La región manda por encima de todo esto.** Las funciones de Vercel
corren en `iad1` (Washington) y Supabase está en `sa-east-1` (São
Paulo): cada consulta cruza el continente. Mientras siga así, sacar una
consulta vale ~120 ms; con las dos puntas en São Paulo (`gru1`) valdría
~5 ms, y de paso el servidor quedaría más cerca de la gente en Uruguay.

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
- **Un control `disabled` NO se envía con el formulario.** Los server
  actions no pueden derivar el valor de un campo ausente: `formData.get()`
  devuelve null y el ternario de turno lo colapsa al default. Fue
  exactamente el bug de auto-degradación en `/admin/miembros` (el
  `<Select>` de Rol viene disabled para tu propia ficha, así que guardar
  tus tags te ponía `role='member'`). Si un campo está bloqueado para
  alguien, la regla va en el action —omitir la columna del payload—, no
  solo en el markup.
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
link público compartible · **Comprobantes de gastos** (migración 043):
las facturas adjuntas al movimiento, en bucket privado. Ver la sección
"Tesorería" más abajo. ·
**Chat con dos canales** (migración 045): Secretaría y Tesorería, con el
nombre de quien responde a la vista. Ver la sección "Chat" más abajo. ·
**Mensajes de la Casa Universal con texto completo**: 51 mensajes de
Riḍván (1967–2026) sembrados desde los txt del usuario con
`scripts/import-ridvan.mjs` → `supabase/seed_mensajes_ridvan.sql`
(idempotente: UPDATE por título + INSERT si falta; no toca `pdf_url`).
Lectura en `/mensajes/[id]` (`reader.tsx`); el admin nacional puede
cargar texto completo y/o PDF en `/admin/mensajes`. ·
**Mis aportes** (migración 046): el creyente ve sus contribuciones en
`/perfil/aportes` y baja el recibo. Ver la sección "Mis aportes" más
abajo.

## Mis aportes (migración 046)

El tesorero elige al contribuyente de un buscador y el creyente ve ese
aporte, con su recibo, en `/perfil/aportes` (entrada desde `/perfil`).
Cuatro cosas que sostienen el diseño:

- **El vínculo es `treasury_contributors.profile_id`**, que existía desde
  la 040 pero nadie llenaba. El buscador (`contributor-picker.tsx`) ofrece
  dos fuentes: los contribuyentes del libro y los creyentes de la
  localidad (`catalog.members`). Elegir un creyente usa o crea su
  contribuyente vinculado; si ya existe uno suelto con su mismo nombre
  (los importados de la planilla) se lo vincula en vez de duplicar. Un
  contribuyente sin perfil muestra un desplegable "¿Es un creyente de la
  app? Vincular…", que es como se van emparejando los viejos. Escribir un
  nombre que no está en ningún lado lo crea suelto: bahá'ís de otras
  comunidades, empresas, grupos. Todo en `resolveContributor()`.
- **El seudónimo es POR APORTE**, en `treasury_entries.receipt_name`
  ("Familia Pérez"), no un contribuyente aparte. El libro sigue sabiendo
  quién aportó y el recibo imprime el seudónimo (`receiptDisplayName`).
  Se eligió así porque si los dos cónyuges están en la app y se alternan,
  cada uno ve los aportes que hizo; un contribuyente "Familia X" solo
  puede apuntar a un perfil (índice único por nombre). El formulario
  propone el último seudónimo que usó ese contribuyente
  (`lastReceiptNames`, armado en `ledger-client.tsx` desde los asientos
  del año en pantalla).
- **El creyente no lee el libro.** La RLS de `treasury_entries` no
  cambió. Las filas salen por `my_contributions()` y `my_receipt()`,
  security definer con el mismo criterio que `treasury_progress()`: solo
  los aportes cuyo contribuyente apunta a `auth.uid()`, solo las columnas
  de la lista y del recibo, sin gastos, aperturas ni transferencias. La
  canasta de la Fiesta no tiene perfil y nunca aparece. El corte por
  ejercicio (Riḍván a Riḍván) lo hace el TypeScript
  (`lib/my-contributions.ts`), por defecto el corriente.
- **Una sola hoja de recibo** (`components/treasury/ReceiptSheet.tsx`)
  para el tesorero (`/admin/tesoreria/recibo/[id]`) y para la copia del
  creyente (`/perfil/aportes/recibo/[id]`). La firma de la copia lleva a
  quien emitió (`receipt_issued_by`, que llena `markReceiptIssuedAction`)
  y, si nadie lo marcó emitido, al tesorero actual de esa localidad. En
  el celular la hoja se escala con `transform` para entrar en el ancho;
  la captura PNG sale a tamaño real igual, porque se genera del nodo.

⚠️ Hasta que corra la 046, guardar un movimiento falla con PGRST204
(`receipt_name` no existe): el formulario del libro manda la columna
siempre. No desplegar sin aplicar la migración antes.

## Chat (dos canales)

La conversación NO es una por creyente: es una por **(creyente, tema)**.
La columna `topic` de `chat_messages` vale `'secretaria'` o `'tesoreria'`
(migración 045). El segundo canal existe porque mucha gente aporta al
Fondo con un giro directo a la cuenta, y un giro no le dice al tesorero
de quién es ni a qué fondo va.

Tres cosas que sostienen el diseño:

- **Quién lee y responde cada canal lo decide el TAG, no el rol.**
  `can_respond_chat` para Secretaría, `can_manage_treasury` para
  Tesorería. Un miembro de la Asamblea con tag de chat **no** lee los
  mensajes al tesorero, ni por API directa: la RLS de `chat_messages`
  parte por `topic`, igual que el libro contable. Cada bandeja tiene su
  ruta y su guard: `/admin/chat` (`ensureChatTag`) y
  `/admin/tesoreria/chat` (`ensureTreasuryTag`).
- **El nombre de quien responde se denormaliza** en `from_name`, que el
  server action llena con el `full_name` de quien contesta. No se resuelve
  por join al leer, por dos razones: el payload de Realtime llega con la
  fila y nada más, y un creyente no lee el perfil de quien le contesta.
  Además queda el registro histórico de quién respondió esa vez. En la
  pantalla el nombre sale **una vez por tanda** del mismo autor; si falta
  (respuestas anteriores a la 045) cae a la etiqueta del canal.
- **El filtro de Realtime admite una sola condición**, así que las dos
  pantallas se suscriben a `member_id=eq.<id>` y descartan el otro canal
  en el cliente. Y las dos rutas del creyente renderizan el MISMO
  componente en la misma posición del árbol: sin el `key={topic}` de
  `ChatTopicPage`, React reusaría la instancia y quedarían a la vista los
  mensajes del otro canal.

⚠️ Marcar visto va por la RPC `mark_chat_seen(p_topic)` y no por UPDATE
directo: la RLS no acota columnas, así que dejar al creyente escribir en
sus propias filas le permitiría también tocar `read` (y esconderle
mensajes sin leer a quien atiende) o el propio texto. De paso arregla un
bug que estaba desde siempre: la única policy de UPDATE exigía tag de
chat, así que el indicador "!" del home no se apagaba **nunca** para un
creyente común.

⚠️ **Ningún error de Supabase se descarta en el chat.** Todos pasan por
`chatFailure()` (`lib/chat-errors.ts`), que loguea con contexto y
devuelve el texto a mostrar. La razón es concreta: cuando se desplegó
antes de correr la 045, la lectura fallaba y se veía **igual** que una
conversación vacía, y el insert fallaba sin que el server action lo
notara —así que la burbuja optimista quedaba en pantalla como enviada y
desaparecía en la próxima navegación—. El síntoma parecía pérdida de
historial y era un 400. Los códigos de esquema (42703, 42883, PGRST202,
PGRST204) tienen mensaje propio: "falta una actualización de la base".
Si agregás una consulta al chat, mirá el `error`.

Puntos de entrada: pestañas Secretaría / Tesorería dentro de `/chat`
(`CHAT_SEGMENTS`), un atajo en la sección "Cómo aportar" de `/tesoreria`
—donde la persona se acuerda del giro que hizo— y, para quien atiende,
una tarjeta por canal en el Inicio (`ChatDutyCard`, `getChatDuty`) que
lleva a la bandeja del panel. Esa tarjeta exige `role='admin'` además
del tag, porque el destino es el panel y el middleware no deja entrar a
un `role='member'`.

## Tesorería (leer antes de tocarla)

### ⚠️ El año contable empieza en Riḍván, no en Naw-Rúz

Distinción que es la fuente de todos los errores de un mes en esta parte
del código:

- El año bahá'í del **calendario** empieza en **Naw-Rúz** (~21 de marzo).
  Rige Fiestas y Días Sagrados; es el de `getCurrentBahaiYear()`.
- El **ejercicio contable** de la Asamblea —la que se elige en Riḍván—
  empieza el **primer día de Riḍván** (13 de Jalál, ~21 de abril) y
  termina el día anterior al Riḍván siguiente.

Los dos se llaman "183" y se solapan casi todo el año, pero difieren en
un mes en cada punta. Para la Tesorería manda el administrativo: los
saldos de apertura del libro 183 están fechados el **2026-04-21**, que es
exactamente el primer día de Riḍván. Helpers en `lib/treasury-year.ts`
(`treasuryYearStart/End/ForDate`, `treasuryMonths`); **no usar
`bahaiYearForDate` ni `nawRuz` para nada contable.**

Ojo con `treasuryMonths()`: el ejercicio arranca en mitad de Jalál, así
que devuelve **20 tramos** con el primero y el último parciales (los dos
Jalál). El ejercicio igual tiene 19 meses, que es lo que divide el
presupuesto. Y cada tramo va del día 1 de un mes al día anterior del
siguiente, con lo cual **Mulk absorbe Ayyám-i-Há**: si los intercalares
quedaran afuera, un aporte recibido ahí desaparecería de los gráficos.

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

### Informes de Tesorería (migraciones 041 y 044)

**Dos formatos, según `audience`** (migración 044). No es cosmético:
define quién puede leer el informe.

- `comunidad` — el **deck** de diapositivas que se proyecta en la Fiesta.
  Publicado, lo lee cualquier creyente de la localidad y se comparte por
  el link público `/i/<token>`.
- `internos` — la **hoja** condensada que se adjunta al acta y la
  Asamblea aprueba en reunión. A4 vertical, sin gráficos, totales por
  rubro, con conciliación, movimientos internos, observaciones y bloque
  de aprobación. Publicada ("emitida"), la leen los miembros con rol
  admin de la localidad; **nunca** sale por el link público.

⚠️ Lo único que impide que un informe interno quede accesible sin login
es el filtro `.eq("audience", "comunidad")` de `getPublicReport()`: esa
función usa la service-role key, que ignora la RLS.

`/admin/informe/[id]` renderiza el formato que corresponda y **no exige
el tag** `can_manage_treasury`, porque un miembro de la Asamblea tiene
que poder abrir el interno para aprobarlo; quién ve qué lo decide la RLS.
Solo el tesorero ve el botón de volver al editor.

**Tres pantallas, una por rol:**

- `/admin/tesoreria/informes` — el taller del tesorero (crear, editar,
  publicar, borrar). Exige el tag.
- `/admin/informes` — **registro de solo lectura** para toda la Asamblea
  (cualquier rol admin, en el sidebar). Lista los informes EMITIDOS con
  su fecha y su estado Aprobado / No aprobado, y nada que modifique.
  Vista en `components/treasury/ReportRegistry.tsx`, separada de la
  página para que la página se ocupe de datos y permisos.
- `/admin/informe/[id]` — el documento (hoja o deck), a pantalla completa.

**"Aprobado" se deriva, no se guarda aparte:** un informe está aprobado
cuando `editorial.approval.meetingDate` tiene algo, o sea cuando el
tesorero registró la reunión en que la Asamblea lo aprobó. Si algún día
la Asamblea tiene que poder aprobarlo desde la app, ahí sí conviene una
columna con su propia RLS.

Ninguno de los dos formatos lleva nombres de contribuyentes.

El tesorero da un rango de
fechas en `/admin/tesoreria/informes/nuevo` (los atajos son los meses
bahá'ís, que es el corte natural) y, para la comunidad, sale un **deck de
diapositivas**:
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

**La hoja interna** vive en `components/treasury/ReportSheet.tsx` y lee
el MISMO snapshot que el deck. Cuatro cosas de su diseño:

- **Totales por rubro, no movimiento por movimiento.** La Asamblea
  aprueba a nivel de rubro (= subcategoría del libro), así que el
  snapshot trae `incomeByRubro` y `expenseByRubro`; el detalle asiento
  por asiento queda en el libro. ⚠️ Un informe guardado ANTES de la 044
  no tiene esos agregados: hay que volver a guardarlo para que el
  snapshot se recalcule, o las secciones 2 y 3 salen vacías.
- **La conciliación se dice, no se supone:** el total por fondos y el
  total por cuentas tienen que coincidir moneda por moneda, y si no
  coinciden la hoja lo muestra en rojo.
- **El total del presupuesto suma solo lo comparable** (las líneas con
  rubro del libro vinculado). Sumar una línea sin ejecutado conocido daría
  un "saldo" que parece sobrante y no lo es.
- **Termina en el bloque de aprobación**, con la fecha de reunión y el
  N.º de acta; si están vacíos imprime líneas de puntos para completar a
  mano, que es como se usa.

Las tablas van envueltas en `.cb-wide` (scroll horizontal en pantalla
angosta, desarmado al imprimir): una tabla de cuatro columnas no baja de
su ancho mínimo y empujaría el ancho de todo el documento.

**Presentar e imprimir:** el deck se maneja con flechas/espacio, swipe en
el celular, y tiene botón de pantalla completa (Fullscreen API; en iPhone
Safari no lo permite y el botón queda sin efecto a propósito). El botón
"PDF" es `window.print()`: **las 12 diapositivas están siempre en el DOM**
y se oculta la que no toca con `.cb-off`, justamente para que el navegador
pueda imprimir el informe entero de una pasada. El bloque `@media print`
de `DECK_CSS` desarma el centrado a pantalla, muestra las ocultas, suelta
las listas recortadas (`.cb-scroll`), fija el alto de los gráficos en mm
(`.cb-chart`, porque `vh` no significa nada en una hoja) y fuerza
`print-color-adjust: exact`, que si no el navegador tira los fondos de
color. Si agregás una sección con lista larga o gráfico, ponele esas
clases o va a salir cortada.

### Progreso: presupuesto y metas (migración 042)

Tablero en `/admin/tesoreria/progreso` y, con el mismo componente, en
`/tesoreria` de la comunidad (reemplazó al anillo que leía el
`current_amount` a mano). Cuatro bloques: la pauta del año, mes a mes,
categorías del presupuesto, metas. Componente en
`components/treasury/ProgressBoard.tsx`, cálculo en
`lib/treasury-progress.ts`.

Tres cosas que sostienen el diseño:

- **La idea del presupuesto como meta de ingresos.** Las categorías del
  presupuesto son todas salidas o asignaciones, así que la suma de
  `planned_amount` es lo que tiene que ENTRAR al Fondo en el ejercicio.
  De ahí sale la pauta y el "necesario por mes bahá'í" (÷ 19).
- **La referencia se dibuja, no se calcula mentalmente.** Cada barra
  lleva una marca vertical en el punto del ejercicio transcurrido. Un
  43 % ejecutado no dice nada solo; un 43 % con la marca en el 65 % dice
  "vamos lentos". La pauta se mide en **días**, no en meses cerrados.
- **Los agregados salen por `treasury_progress()`**, security definer,
  porque un creyente no lee `treasury_entries` ni por API directa. La
  función devuelve solo totales (nunca un nombre, nunca una fila) y el
  panel usa la MISMA función que la comunidad, así que las dos pantallas
  no pueden divergir. El calendario queda en TypeScript: la función
  recibe `year_from` y `as_of` resueltos y no sabe de meses bahá'ís.
  ⚠️ El guard de localidad usa `coalesce(... , false)`: sin eso, un
  usuario sin localidad pasaría el chequeo (comparar contra NULL da NULL
  y un IF sobre NULL no dispara).

**Metas** (`treasury_goals`): dejaron de ser texto del informe. Una meta
declara **cómo se mide** — `direction` ('gasto' para financiar algo,
'ingreso' para juntar algo) más el vínculo al libro (fondo, categoría o
subcategoría; manda el más específico). `target_amount` puede ser NULL:
"conseguir un POS propio" es una meta real sin cifra y se informa por su
etiqueta de estado. Una meta `mensual` se compara contra el acumulado de
los meses transcurridos, no contra un mes suelto.

**Presupuesto vs. ejecutado:** los nombres de las categorías del
presupuesto (024) y del libro (040) no coinciden y no hay forma de
adivinar el par, así que el tesorero lo declara con el desplegable "Se
ejecuta con" en el editor del presupuesto. Son dos columnas
(`ledger_category_id` y `ledger_subcategory_id`) porque la granularidad
cambia según la línea: "Enseñanza" es una categoría entera, "Aporte al
Fondo Nacional" es una subcategoría dentro de "Gastos Operativos". Una
línea sin vincular se informa como tal, nunca como cero.

### Comprobantes de gastos (migración 043)

Las facturas del gasto, colgadas del movimiento (`treasury_attachments`).
El panel está dentro del formulario del libro y aparece cuando el
movimiento es un **gasto** —en un ingreso el comprobante lo emitimos
nosotros, así que solo se muestra si ese asiento ya tiene algo adjunto—.
Componente en `components/treasury/AttachmentsPanel.tsx`, actions en
`app/admin/(panel)/tesoreria/libro/attachment-actions.ts`.

Tres cosas que sostienen el diseño:

- **El desglose es respaldo, no contabilidad.** Un gasto de $ 3.500 por
  una Fiesta suele venir con tres facturas (arreglos, comida,
  invitaciones); el libro sigue viendo UNA línea de $ 3.500 y cada
  factura declara su `amount` y su `label`. Por eso `amount` es
  **opcional** (la mayoría de los gastos tiene una sola factura por el
  total) y **positivo** (el signo lo pone el asiento, no el papel). Que
  las facturas no sumen el total se **avisa**, no se bloquea: una puede
  traer un ítem que no corresponde y el tesorero sabe mejor que la app.
  Si algún día el desglose tiene que ser contable —rubros distintos del
  presupuesto— eso son N asientos atados, no N adjuntos.
- ⚠️ **El bucket `treasury-receipts` es PRIVADO**, a diferencia de los
  cuatro que ya existían (`event-photos`, `comunicados`, `materiales`,
  `avatars`). Una factura trae nombre, dirección y RUT del proveedor: es
  tan reservada como el libro. Se lee por **URL firmada** de una hora,
  emitida en el servidor (`signAttachments()`), nunca por `getPublicUrl`.
  Los comprobantes **no van al informe**: el deck de la Fiesta es
  público. Los paths son `<locality_id>/<entry_id>/<uuid>.<ext>` y las
  storage policies aíslan por la primera carpeta.
- **El archivo no lo borra el cascade.** La FK se lleva la fila cuando
  se borra el movimiento, pero el objeto del bucket queda huérfano; por
  eso `deleteEntryAction` llama a `purgeAttachmentFiles()` **antes** de
  borrar el asiento, que es cuando la RLS todavía deja encontrarlo.

En el alta el movimiento no existe todavía, así que los archivos quedan
en espera y `EntryForm` los sube con `uploadPending(id)` recién después
de guardar (`saveEntryAction` devuelve el `id` por eso). Si un
comprobante falla ahí, el asiento **ya quedó guardado** y se avisa sin
deshacerlo: perder el movimiento es peor que perder la foto. Las
imágenes se comprimen en el navegador con `compressImage` de la galería;
los PDF viajan tal cual (media factura llega por mail).

## Pendientes conocidos

- **Jubilar la tabla `treasury` vieja.** El anillo de `/tesoreria` ya se
  fue (lo reemplazó el tablero de progreso, 042), pero siguen leyendo el
  `current_amount` escrito a mano el "Informe mensual" de esa pantalla y
  los dos compartibles de imagen (`MonthlyReportShare`,
  `BudgetReportShare`), más el formulario de `/admin/tesoreria`. Todo eso
  se puede calcular desde el libro; falta hacerlo y borrar el formulario.
- **Las metas viven en dos lados.** `treasury_goals` (042) es el dato,
  pero el editor del informe (041) todavía tiene sus propios campos de
  texto para "Meta de la Asamblea" y "Destino de los Fondos". Conviene
  que las diapositivas del informe se alimenten de `treasury_goals` y
  esos campos desaparezcan, o el tesorero carga lo mismo dos veces.
- **Cierre de período.** Generar los asientos "Saldo anterior" del 184 a
  partir de los saldos al cierre del 183 (`is_opening_balance`), en vez
  de cargarlos a mano.
- **El informe no avisa.** Al publicar no sale push ni aparece en la app
  de la comunidad: la distribución es el link `/i/<token>` por WhatsApp.
  La RLS ya deja que un creyente lea los informes publicados de su
  localidad, así que sumar una pantalla en `/tesoreria` es solo UI.
- **La Asamblea no puede aprobar desde la app.** El registro
  (`/admin/informes`) muestra el estado, pero la aprobación la tipea el
  tesorero en el editor. Si se quiere que la Asamblea marque "aprobado"
  ella misma, eso es una columna propia (`approved_at`, `approved_by`)
  con su RLS, no un campo del editorial.
- **El aviso de aporte no se convierte en asiento.** El creyente le dice
  al tesorero por el chat de Tesorería que hizo el giro, y el tesorero lo
  carga a mano en el libro (la conversación tiene el botón "Registrar en
  el libro", que solo abre `/admin/tesoreria/libro`). Lo natural sería
  prellenar el formulario del movimiento con el contribuyente y lo que
  dice el mensaje, y dejar el vínculo mensaje↔asiento para no cargar dos
  veces el mismo aporte. Con la 046 el formulario ya acepta un creyente
  por `contributor_profile_id`, así que el prellenado es solo pasarle el
  `member_id` de la conversación.
- **Aviso al creyente cuando se registra su aporte.** Con la 046 el
  aporte ya aparece en `/perfil/aportes`, pero nadie le avisa; un push
  "Se registró tu aporte, recibo N.° X" ahorraría el WhatsApp del
  tesorero. También falta una pantalla de contribuyentes para el tesorero
  (fusionar duplicados, desvincular); hoy solo se vincula desde el
  formulario.
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
