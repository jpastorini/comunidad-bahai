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
   ⚠️ El type-check NO detecta todo lo que rompe el build de Vercel. En
   particular, un archivo `"use server"` que exporte algo que no sea una
   función async (una constante, un tipo con valor) compila en tsc y
   falla en `next build`; pasó dos veces (Encuestas y Buscador). Si
   tocás un `actions.ts`, corré `npx next build` antes de pushear.

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
**Hoja de instalación de la PWA** (`components/InstallSheet.tsx`, montada
en el layout de `(app)`): en celular y sin la app instalada, sube una hoja
que tapa la pantalla y pide instalar. Android: solo si disparó
`beforeinstallprompt`, y con `appinstalled` pasa a la confirmación "ya
podés cerrar el navegador". iOS: pasos de Safari + botón "Ya la instalé"
(no hay evento); se saltea a los webviews sin menú Compartir. "Ahora no"
la esconde 3 días en `localStorage` (`cb-install-snooze-until`), sin
límite de veces: la tarjeta `InstallAppButton` queda en `/perfil` como
camino manual (se sacó del Inicio por redundante) ·
**Hoja de avisos** (`components/NotificationsSheet.tsx`, mismo layout): la
gemela de la anterior para el push. Sube sola cuando la app corre
**instalada** (standalone) y el permiso de notificaciones está en
"default"; con un botón grande "Activar avisos" que llama a
`subscribeToPush()`. Existe porque el paso de avisos del asistente de
bienvenida corre en el navegador, antes de instalar, y en iPhone el push
solo funciona desde la app instalada: la primera apertura desde el ícono
era justo el momento en que se podía pedir y no se pedía. Las dos hojas no
se pisan (una actúa sin instalar, la otra instalada). Permiso "denied" →
muestra cómo desbloquearlo en los ajustes del teléfono, por plataforma
(el navegador no deja volver a preguntar). Permiso concedido → no se
muestra y **repara en silencio**: `ensurePushSubscription()`
(`lib/push-client.ts`) recrea la suscripción si el navegador la perdió y
la vuelve a registrar en el servidor una vez por día
(`cb-push-synced-day`); el SW además maneja `pushsubscriptionchange`
(`worker/index.js`). "Ahora no" esconde 3 días (`cb-push-snooze-until`),
sin límite. ⚠️ **No se puede activar por defecto**: el diálogo del sistema
solo se abre desde un toque de la persona; lo único en nuestras manos es
que el pedido sea inevitable y llegue en el momento correcto. Estado de
push sin pedir nada: `getPushStatus()`. `isStandalone()` en
`lib/standalone.ts` ·
**Pinch-zoom en las fotos** (`components/gallery/ZoomableImage.tsx`,
dentro del `Lightbox` de `PhotoGrid.tsx`): el zoom del navegador sigue
bloqueado en toda la app (`userScalable: false`, rompe el layout de la
PWA), así que el gesto es propio, con Pointer Events y `touch-action:
none`. Pinch o doble toque llevan la foto a pantalla completa (modo
inmersivo, `z-[60]` sobre el lightbox) y escalan hasta 4x desde el punto
tocado; volver a 1 (doble toque, achicar, ✕, Escape) la devuelve a su
lugar con comentarios. El swipe entre fotos solo actúa a escala 1; en PC,
doble clic y rueda. ⚠️ El transform se aplica al `<img>` por ref, sin
pasar por React en cada movimiento: re-renderizar el lightbox 60 veces
por segundo se siente pegajoso en celulares viejos ·
**Tamaño de letra global** (`lib/ui-zoom.ts`, selector `UiZoomControl`
en `/perfil`, sección "Pantalla"): tres pasos (100/115/130 %) con `zoom`
en `<html>`, no font-size, porque hay ~870 clases con px fijos y porque
agrandar solo el texto dentro de botones que no crecen rompe más de lo
que arregla. Preferencia POR DISPOSITIVO en la cookie `cb_ui_zoom` (un
año), que el layout raíz lee en el servidor para renderizar ya escalado.
El control de lecturas (`ReadingSize`) se suma al global.
⚠️ **`zoom` también escala las unidades de viewport y `env()`**: `100dvh`
a zoom 1.3 mide 130 % de la pantalla. Todo vh/dvh de la app va dividido
por `var(--ui-zoom, 1)` (`calc(100dvh/var(--ui-zoom,1))`), igual que
`--safe-top/--safe-bottom`. Si agregás una altura en vh, dividila o el
shell desborda en "Grande" ·
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
abajo. ·
**Amigos de la Fe** (migración 047): la app también para quien no es
bahá'í, sin Tesorería ni Fiesta de los 19 Días. Ver la sección "Amigos
de la Fe" más abajo. ·
**Lectura de comunicados** (migración 048): quién vio y quién confirmó
cada comunicado, con informe en vivo para la Asamblea y "última vez en
la app" por persona. Ver la sección "Lectura de comunicados" más abajo. ·
**Uso de la app** (migración 049): estadística por localidad en
`/admin/uso` (instalada, avisos, regularidad, secciones, persona por
persona). Ver la sección "Uso de la app" más abajo. ·
**Menú del panel anidado** (sin migración): siete grupos que se despliegan
con sus pantallas adentro. Ver la sección "Navegación del panel" más abajo. ·
**Programa de la Fiesta** (migración 050): lo cargado en la Fiesta se
proyecta como deck de diapositivas (`/programa/[id]`) y se baja como
folleto PDF (`/programa/[id]/pdf`); las noticias pasaron a ser ítems. Ver
la sección "Programa de la Fiesta" más abajo. ·
**Encuestas** (migración 051): un comunicado puede llevar una pregunta
para votar, como las de WhatsApp; un solo voto por persona, anonimato
opcional garantizado por el modelo, informe para la Asamblea dentro del
de lectura. Ver la sección "Encuestas" más abajo. ·
**Datos de la Asamblea** (migración 052): la ficha legal (RUT, BPS,
nombre registrado, fecha de registro, estatutos PDF en bucket privado)
y quiénes integran la Asamblea en cada ejercicio, con los cuatro
oficiales. Ver la sección "Datos de la Asamblea" más abajo. ·
**Buscador de pasajes** (migración 053): la persona escribe un tema y
la app le sugiere párrafos y citas de los Escritos, los mensajes de la
Casa Universal y los libros Ruhi donde se habla de eso, con Haiku
eligiendo entre lo que encuentra la base. Ver la sección "Buscador de
pasajes" más abajo.

## Buscador de pasajes (migración 053)

Biblioteca → Buscar (`/buscar`, para toda la comunidad, Amigos de la Fe
incluidos: el corpus es público). La persona escribe "la consulta" o
"¿qué dicen los Escritos sobre la muerte?" y recibe hasta diez pasajes
originales con su referencia, una frase de por qué cada uno viene al
caso, y arriba una orientación de dos o tres frases. El corpus son los
59 libros del Panel, los 7 libros Ruhi, los 51 mensajes de Riḍván y las
991 citas de la Lectura de hoy: ~1,8 M de palabras, ~16 500 pasajes.
Probado con veinte preguntas reales el 2026-09-08: todas con pasajes
pertinentes, 7–12 s y ~0,03 USD cada una.

**La base busca, Haiku elige.** Decidido con el usuario frente a la
alternativa de que el modelo lea todo el corpus en cada consulta (no
entra en una ventana de 200 k tokens; serían ~15 llamadas y ~2,50 USD
por búsqueda). Así queda en dos llamadas chicas a `claude-haiku-4-5`
(`lib/corpus-search.ts`, unos 0,03 USD por búsqueda):

1. `expandTerms()`: la pregunta → 6 a 14 términos con sinónimos del
   vocabulario bahá'í ("consulta" → "deliberar", "unanimidad"…). Si
   falla, se usan las palabras de contenido de la propia pregunta.
2. `search_corpus(p_query, p_limit)` en Postgres: full-text search con
   la configuración `es_unaccent` (español + unaccent, porque en el
   celular se escribe sin acentos), `ts_rank_cd`, como mucho 8 pasajes
   por documento para que un libro largo no llene solo la lista. Devuelve
   60 candidatos. Security invoker: corre con la RLS de quien pregunta.
3. `pickPassages()`: Haiku recibe los 60 numerados y devuelve NÚMEROS
   con un motivo cada uno, más la orientación. ⚠️ El texto que se muestra
   sale siempre de `corpus_chunks` por ese número; el modelo no
   transcribe ningún pasaje. Es lo que garantiza que no aparezca una cita
   inventada o retocada, que en este corpus es el error caro. La
   orientación sí es del modelo y la pantalla lo dice.

**El corpus se carga con `scripts/load-corpus.mjs`** desde los Markdown
de `C:\Claude\ComunidadBahai-materiales` (los que generan
`export-materiales-md.mjs` y `export-mensajes-md.mjs`) más
`public/citas.json`, con service-role (no hay policy de insert). Borra y
recarga por tipo. El troceado es lo que decide la calidad: pasajes de
40 a 300 palabras; un párrafo corto que empieza con "(" es la referencia
de la cita anterior y se pega al pasaje ANTERIOR (recopilaciones del
Panel); los demás cortos se pegan al siguiente; los largos se parten por
oraciones; en los Ruhi se descartan las líneas de ejercicio (preguntas
con puntos de relleno, viñetas de consigna). Si se agregan materiales o
mensajes, exportar a Markdown y volver a correr la carga.

**Tope de 40 búsquedas por persona en 24 h** (`MAX_SEARCHES_PER_DAY`,
`app/(app)/buscar/actions.ts`), contadas en `corpus_searches`, que
registra quién buscó qué, con qué términos y cuántos resultados. La
Asamblea puede leer las de su localidad (RLS) para ver qué busca la
gente; todavía no hay pantalla para eso.

⚠️ Hasta que corra la 053, buscar devuelve "falta aplicar la migración
053" y el resto de la app no se entera. La entrada es el cuadro de
búsqueda de la Biblioteca (`components/BibliotecaSearchBox.tsx`), ARRIBA
de los segmentos Mensajes / Materiales en las tres pantallas del hub
(`/mensajes`, `/materiales` y `/buscar`): un form GET a `/buscar?q=`,
que arranca la búsqueda sola. Se probó un tercer segmento "Buscar" y el
usuario no lo encontró; el cuadro visible en el mismo lugar siempre fue
lo pedido.

## Datos de la Asamblea (migración 052)

Asamblea → Datos de la Asamblea (`/admin/asamblea`): lo que la Asamblea
necesita tener a mano para un trámite y quiénes la integran. Dos
bloques en una sola pantalla, cada uno con su formulario y su action
(`app/admin/(panel)/asamblea/actions.ts`); datos en `lib/assembly.ts`.

- **La ficha legal** es `assembly_records`, una fila por localidad
  (upsert por `locality_id`): nombre registrado, RUT en DGI, N.º de
  empresa en BPS, fecha de registro, notas libres y el PDF de los
  estatutos. Es una tabla NUEVA y no columnas en `localities` a
  propósito: `localities` se lee con `using (true)` y sale de un caché
  con cliente anónimo, así que un RUT ahí quedaría legible para
  cualquiera. Acá la RLS es `is_admin` + `current_locality_id` (más el
  admin nacional), en las tres tablas.
- **Los estatutos** van al bucket PRIVADO `asamblea-docs` (paths
  `<locality_id>/estatutos/<uuid>.pdf`, policies por primera carpeta),
  mismo molde que los comprobantes de Tesorería (043): URL firmada de
  una hora emitida en el servidor al renderizar la página, nunca
  `getPublicUrl`. Subir otro reemplaza al anterior (se borra del bucket
  después del upsert, cuando la fila ya no lo nombra).
- **La composición es por ejercicio**, `assembly_terms` (localidad, año
  BE) + `assembly_members` (posición 1–9, `profile_id` opcional,
  `display_name` SIEMPRE, cargo). El ejercicio es el mismo corte que la
  Tesorería —Riḍván a Riḍván, `currentAssemblyYear()` usa
  `treasuryYearForDate`— porque la Asamblea se elige en Riḍván. El
  nombre se guarda aunque la persona esté en la app, porque la
  composición de 182 no puede cambiar porque alguien se fue o cambió su
  nombre de Google. Los cargos son Coordinador/a, Vicecoordinador/a,
  Secretario/a y Tesorero/a (`ASSEMBLY_OFFICES`, etiquetas en
  `ASSEMBLY_OFFICE_LABELS`), uno por ejercicio (índice único parcial).
  Al guardar, la lista se reescribe entera (borrar e insertar).
- **Pre-carga** (`page.tsx`): si el ejercicio pedido no tiene miembros,
  el editor arranca con la composición del ejercicio anterior más
  cercano; si no hay ninguno, con quienes hoy tienen `role='admin'` en
  la localidad. No se guarda solo: la persona revisa y guarda. Un chip
  "+ <año siguiente>" permite cargar la Asamblea nueva antes de Riḍván.
- **Es informativa.** Decidido con el usuario: los permisos siguen
  saliendo de los tags de `profiles` y la firma del recibo sigue
  deduciendo al tesorero de `can_manage_treasury`. El editor
  (`members-editor.tsx`) solo AVISA si el Tesorero/a declarado no tiene
  el tag de Tesorería, si el Secretario/a no atiende el chat, o si un
  miembro no tiene rol de Asamblea en la app. Tampoco la ve la
  comunidad: todo queda dentro del panel.

⚠️ Hasta que corra la 052, la pantalla muestra el aviso de migración
pendiente, deshabilita el botón de la ficha y cualquier guardado
devuelve "Falta aplicar la migración 052".

La ficha suma **domicilio fiscal** (054): va impreso en cada recibo y en
el encabezado de la Memoria y Balance anual, junto al nombre registrado y
el RUT.

⚠️ **El PDF de los estatutos se sube desde el navegador, no dentro del
formulario** (`record-form.tsx`, cliente). En Vercel una petición a una
función no puede pasar de **4,5 MB**, y los estatutos de Montevideo pesan
4,6 MB: con el archivo dentro del form la petición se rechazaba antes de
llegar al server action y la ficha ENTERA —RUT, BPS, todo— se perdía sin
toast ni error visible (detectado el 2026-09-12). El navegador sube al
bucket con la RLS de 052 y al action llega solo `statutes_path`, que se
vuelve a verificar contra `<locality_id>/estatutos/`. Regla general para
cualquier upload nuevo: si el archivo puede pasar de 4 MB, va directo a
Storage desde el cliente, nunca por el server action.

## Encuestas (migración 051)

Por debajo, la encuesta es **un comunicado con una pregunta**: la misma
fila de `messages` más `message_polls`. Se ve como parte de la tarjeta
en `/comunicados` (`PollBlock`) y hereda todo lo del comunicado: la
audiencia (una encuesta en un comunicado "solo creyentes" es solo para
creyentes, por la RLS de `messages`), el push al publicar ("La Asamblea
pregunta: …"), el "visto" de la 048 y el informe de lectura. Una pregunta
por comunicado, de 2 a 10 opciones, "varias opciones" sí/no, "anónima"
sí/no, cierre por fecha (fin del día civil de Montevideo) o a mano.

Para quien la arma, en cambio, es otra cosa, y por eso tiene **su propia
pantalla** en Comunicación → Encuestas (`/admin/encuestas`): lista de
preguntas con estado y participación, alta pensada desde la pregunta
(`EncuestaForm`: el título del comunicado ES la pregunta, la fecha es
hoy, un texto de acompañamiento opcional y quién vota), resultados en
`/admin/encuestas/[id]` y edición en `/editar`. La tarjeta de
Comunicados conserva "Pregunta para votar" (`PollFields`) para quien
quiere agregar una pregunta a un comunicado largo. Los dos formularios
comparten `PollFields` y `savePoll()` (`lib/polls-admin.ts`, fuera de
los actions porque un módulo "use server" solo exporta actions). Cuando
el título es igual a la pregunta, `PollBlock` no la repite
(`hideQuestion`).

Tres reglas de producto, decididas con el usuario, y cómo se sostienen:

- **Se vota una sola vez y no se cambia.** Lo único que escribe un voto
  es la RPC `cast_vote(poll_id, option_ids[])`, security definer: no hay
  policy de insert en `poll_votes` ni en `poll_participants`. La función
  comprueba que la persona pueda leer la encuesta (`can_read_poll`, que
  repite la regla de `messages_select_scope` porque la RLS no corre
  adentro de un definer), que esté abierta, que las opciones sean de esa
  encuesta y las que corresponden, y anota la participación; la PK de
  `poll_participants` es el candado contra el doble voto. Votar cuenta
  como haber visto el comunicado. En la tarjeta no se vota al toque: se
  elige y se confirma con "Votar", porque un roce no puede ser un voto
  irreversible.
- **El anonimato es una garantía del modelo, no una policy.** En una
  encuesta anónima `poll_votes.profile_id` va NULL y la fila no lleva
  hora (para que no se cruce con `voted_at`); quién votó queda solo en
  `poll_participants`, sin qué. No existe la fila que una persona y
  opción, así que nadie —ni con acceso directo a la base— la reconstruye.
  El precio: la persona no puede ver después qué eligió; la tarjeta lo
  recuerda solo en ese dispositivo (`localStorage`, `cb-poll-<id>`) para
  resaltarlo. En el informe de una anónima tampoco se lista quién falta
  votar: con pocas personas, saber quién votó ya dice mucho.
- **Los totales los ve todo el que puede leer el comunicado; los
  nombres, solo la Asamblea.** Los totales salen por `poll_results()`
  (definer, solo números) y se muestran a quien ya votó o a todos al
  cierre; antes de votar se ve solo cuántos votaron, para no arrastrar.
  "Quién votó qué" lo lee la Asamblea de `poll_votes` con la RLS de
  admin, y solo existe en encuestas no anónimas.

Con votos emitidos, la pregunta y las opciones quedan **congeladas** en
el formulario (se muestran de solo lectura y no viajan; `savePoll()` en
`actions.ts` solo toca `closes_at`). Sin votos se reescriben enteras
(las opciones se borran y se insertan) y desmarcar la casilla borra la
encuesta. El informe (`PollReportSection`, dentro de
`/admin/comunicados/[id]/lectura`) muestra barras por opción con
porcentaje sobre quienes votaron (en múltiple no suman 100),
participación sobre la audiencia del comunicado, y las dos listas con
nombre si no es anónima; se refresca solo con Realtime (`poll_votes` en
la publicación, mismo `ReadReportRefresher`). La tabla de
`/admin/comunicados` agrega "Encuesta: votaron N" bajo la barra de
lectura.

De paso quedó el **deep link del push**: el aviso de un comunicado nuevo
abre `/comunicados#c-<id>` y `ScrollToHash` lleva la vista a esa tarjeta
(la lista scrollea dentro de `.scroll-area`, el salto nativo no alcanza).

⚠️ Hasta que corra la 051, guardar un comunicado con pregunta avisa "la
encuesta no: falta aplicar la migración 051" (el comunicado se guarda) y
las pantallas muestran los comunicados sin encuesta.

## Navegación del panel (leer antes de agregar una pantalla al admin)

El menú lateral del panel es **una sola fuente**: `lib/admin-nav.ts`.
Pocos grupos, uno por área de trabajo de la Asamblea, que se despliegan
con sus pantallas adentro. Los sub-ítems del menú SON la navegación
interna de cada sección: no hay pestañas ni hubs de botones aparte, un
solo mecanismo. Grupos: Inicio (ítem suelto) · Asamblea (Tareas,
Reuniones, Informes de Tesorería, Datos de la Asamblea) · Comunicación (Comunicados, Encuestas, Boletín,
Chat de Secretaría) · Vida comunitaria (Calendario, Fiestas, Sugerencias,
Actividades, Servicio, Materiales, Fotos) · Creyentes (Creyentes, Uso de
la app) · Tesorería (Libro, Informes, Progreso, Presupuesto, Metas,
Mensajes, Cómo aportar) · Admin Nacional.

Tres reglas de comportamiento (`components/admin/Sidebar.tsx`):

- **El grupo de la pantalla actual está siempre abierto.** Se puede
  cerrar a mano, pero al navegar a otra pantalla suya vuelve a abrirse.
  El grupo activo lo decide `activeLeaf()`: la coincidencia de prefijo
  MÁS LARGA entre las hojas visibles, con `match` para rutas que prenden
  otra hoja (el recibo prende "Libro") y `exact` para las que son prefijo
  de otras (`/admin/nacional`).
- **Los demás arrancan cerrados**, se abren tocando el título, pueden
  quedar varios abiertos (sin acordeón) y lo abierto se recuerda por
  dispositivo en `localStorage` (`cb-admin-nav-open`). El servidor
  renderiza con solo el grupo activo abierto; los recordados se suman al
  montar.
- **El título del grupo no navega**, solo despliega. Un ícono por grupo,
  no por pantalla (`GROUP_ICONS`).

Los permisos siguen en `canSee()`: Tesorería con `can_manage_treasury`,
Chat con `can_respond_chat`, Nacional con `is_national_admin`; un editor
de Boletín con `role='member'` ve solo Comunicación → Boletín. Un grupo
sin hijos visibles no se muestra.

Para agregar una pantalla: una hoja en `ADMIN_NAV`, y en la página
`<PageHeader eyebrow="<nombre del grupo>" ...>`. El **eyebrow es siempre
el nombre del grupo del menú** (o "Tesorería · Presupuesto" para un
detalle), para que la persona sepa dónde está parada. Las subpantallas
(nuevo, editar, detalle) llevan `back={{ href, label }}`, que dibuja el
link "← Sección" arriba del eyebrow y reemplaza a los botones "Volver"
sueltos: uno solo, siempre en el mismo lugar. Las cancelaciones de los
formularios siguen siendo del formulario.

`/admin/tesoreria` redirige al Libro. El formulario viejo de la tabla
`treasury` (medios de pago y cifra a mano) quedó en
`/admin/tesoreria/aportar` como "Cómo aportar" hasta que se jubile.

**El Inicio del panel es un tablero de ATENCIÓN**, no de totales
(`app/admin/(panel)/page.tsx`, datos en `lib/admin-attention.ts`). Cada
tarjeta responde a una pregunta que la Asamblea se hace al abrir el
panel: tareas pendientes (con vencidas en rojo y "vencen esta semana"),
chats sin responder de los canales que la persona atiende
(`getChatDuty`), la próxima Fiesta **sin importar su estado** (la que
está en borrador es justamente la que pide atención; la fecha es la
víspera de la oficial), la agenda de los próximos 7 días (eventos,
Fiestas y Días Sagrados, vía `getUnifiedCalendarItems`), el último
comunicado con su barra de lectura, quién falta cargar la disponibilidad
(con nombres: `getAvailabilityFillStats` devuelve `missing`) y el alcance
del push. El tono de cada tarjeta lo decide el dato (verde en orden,
ámbar por hacer, rojo vencido). Los contadores de "cuántas actividades /
materiales / eventos hay" se sacaron a propósito: no llevan a ninguna
acción. Si agregás una tarjeta, que responda una pregunta y que su
consulta falle a un valor neutro (el Inicio no puede romperse porque una
tabla no exista todavía).

## Programa de la Fiesta (migración 050)

Lo que la Asamblea carga en `/admin/fiestas/[id]` (oraciones,
profundización, noticias, comunicado, lugares) se arma solo en dos
salidas, sin que nadie escriba un HTML a mano cada 19 días:

- **El deck** (`/programa/[id]`, `components/feast/FeastDeck.tsx`): una
  diapositiva por pantalla, fondo noche y dorado, para proyectar en la
  Fiesta. Portada (mes, significado, fecha de la víspera, lugares) ·
  programa en tres porciones · divisor I · una diapositiva por oración ·
  profundización · divisor II · una por ámbito de noticias · comunicado ·
  Tesorería · cierre III. Misma mecánica que el deck de Tesorería
  (flechas, swipe, pantalla completa, todas las diapositivas en el DOM).
  Vive fuera de los grupos `(app)` y `(panel)` porque ocupa la pantalla.
- **El folleto PDF** (`/programa/[id]/pdf`, `components/feast/FeastBooklet.tsx`):
  A5 claro, para que el creyente lo baje y siga la lectura. Se genera en
  el servidor con `@react-pdf/renderer` (Node puro, sin Chromium) y se
  sirve `inline` en pestaña nueva: en la PWA de iPhone un `attachment` no
  muestra nada, y el visor del navegador trae guardar y compartir. Sin
  fotos, a propósito: una imagen remota que falle rompería el PDF.
  ⚠️ Las TTF están en `public/fonts/` y viajan a la función por
  `outputFileTracingIncludes` (`next.config.mjs`); react-pdf va en
  `serverComponentsExternalPackages`. En ese mismo include van las
  fuentes estándar de pdfkit (`node_modules/pdfkit/js/standard-fonts`):
  pdfkit las carga con un require dinámico que el trace no sigue, y sin
  ellas la función falla en Vercel con "Cannot find module
  …/Helvetica.cjs" aunque en local ande. Si react-pdf falla en
  producción y en local no, mirar primero ahí. Los nombres de meses llevan ḥ, ẕ,
  ṭ, ʻ, que Outfit no tiene: todo lo que pueda contener un nombre
  bahá'í va en Cormorant.

Las dos salidas leen la MISMA estructura, `buildFeastProgram()`
(`lib/feast-program.ts`), que no consulta nada: recibe lo que
`loadFeastProgram()` (`lib/feast-program-server.ts`) ya trajo y decide
qué secciones tienen contenido. Tres cosas del diseño:

- **Las noticias son ítems**, no texto libre: `feast_news_items`
  (ámbito `internacional`/`nacional`/`local`, posición, etiqueta de fecha
  libre, título, cuerpo, foto opcional en el bucket `comunicados`,
  carpeta `fiestas/noticias/`). Una línea de tiempo se proyecta; un
  párrafo largo no. La 050 convirtió los textos viejos de
  `international_reports` / `national_reports` / `local_reports` en un
  ítem cada uno y dejó esas columnas en NULL; siguen existiendo pero
  nada las escribe ni las lee. La plantilla ya no carga placeholders de
  noticias.
- **Quién lo ve, y cuándo.** La RLS de `feasts` decide si la Fiesta
  existe para la persona (borrador solo Asamblea, nada para un Amigo de
  la Fe; `feast_news_items` hereda con un `exists`, igual que
  `feast_prayers`). Encima, el programa de una Fiesta publicada pero NO
  iniciada sigue siendo interno salvo para la Asamblea, que lo necesita
  antes para ensayar: `loadFeastProgram()` devuelve `not-started` y la
  página redirige a `/fiestas/[id]`. Al creyente los dos botones le
  aparecen al iniciar la Fiesta.
- **La Tesorería se enlaza, no se copia.** En la Fiesta del mes M se
  presenta el informe del mes que termina: `pickReportForFeast()` toma
  el informe publicado para la comunidad con `period_to` más cercano por
  debajo de la fecha oficial de M (tolerancia 45 días) y la diapositiva
  lleva a `/i/<token>`. No hay `feast_id` en los informes; la
  coincidencia por fecha alcanza. Si no hay informe pero la Fiesta tiene
  las cifras a mano (`treasury_income` etc.), se muestran esas.

De paso se arregló el borrado de filas del formulario de Fiestas: la
casilla "Eliminar al guardar" de lugares y oraciones llevaba un hidden
espejo con el mismo nombre y desalineaba los índices, así que borraba
la fila SIGUIENTE. Ahora la casilla lleva el id como valor
(`*_remove_ids[]`) y el action recibe un Set.

⚠️ Hasta que corra la 050, guardar una Fiesta avisa "las noticias no"
(el resto se guarda) y las pantallas muestran la Fiesta sin noticias.

## Uso de la app (migración 049)

Cada Asamblea quiere saber cómo usa su comunidad la app. El dato es
`usage_daily`: **una fila por (persona, día, sección) con un contador**.
No se guarda cada toque ni la hora, a propósito: el día alcanza para
regularidad y secciones y es mucho menos invasivo que un registro de
navegación. Decisiones tomadas con el usuario: granularidad por día, la
lista de personas con nombre sí va (mismo criterio que el informe de
lectura: sirve para saber a quién acompañar), y la pantalla la ve toda
la Asamblea con rol admin.

- **Quién escribe.** `UsageBeacon` (layout de `(app)`, no del panel:
  el uso del panel no es uso de la comunidad) llama a la RPC
  `record_usage(section, standalone)` cuando cambia la SECCIÓN, no la
  pantalla: `sectionForPath()` (`lib/usage-sections.ts`) mapea el primer
  segmento de la ruta a una de ~20 claves (`/mensajes/[id]` es
  "biblioteca"). También al volver la PWA al frente. Va directo del
  navegador a Supabase. La función es security definer y usa
  `auth.uid()`: no hay policy de insert, nadie anota uso ajeno. El día
  es el civil de Montevideo (mismo corte que la Lectura de hoy).
- **"Instalada"** es `profiles.pwa_installed_at`, que `record_usage`
  llena la primera vez que la app corre en `display-mode: standalone`.
  Quien instaló y nunca abrió cuenta como no instalada, que para el
  propósito es la respuesta correcta. "Con avisos" sale de
  `push_subscriptions` con service-role (la RLS solo deja ver las
  propias), igual que `getLocalityPushReach`.
- **Los agregados los hace la base**: `usage_by_section`,
  `usage_by_day`, `usage_by_person` (rango de fechas), security
  **invoker** para que la RLS de `usage_daily` acote a la localidad de
  quien pregunta. Bajar filas a la app no sirve: un año de una localidad
  grande son decenas de miles y PostgREST corta en mil.
- **Regularidad** (`regularityFor`, `lib/usage.ts`) es la proporción de
  días activos sobre los días del rango: ≥ 80 % "casi todos los días",
  ≥ 3/7 "varias veces por semana", ≥ 1/7 "una vez por semana", algo
  "alguna vez", nada "no entró en el período". El rango lo elige la
  Asamblea (`?from=&to=`, atajos de 7/30/90 días y el mes bahá'í en
  curso, tope de un año). La lista de personas va de menos a más
  activa.

⚠️ Hasta que corra la 049, `/admin/uso` muestra el aviso de migración
pendiente y el beacon loguea un warning por navegación (no rompe nada).

## Lectura de comunicados (migración 048)

La Asamblea necesita saber, por comunicado, a quién NO le llegó, para
contactarlo por otro medio. Tabla `message_reads`, una fila por
(comunicado, persona), con dos marcas que significan cosas distintas:

- **`seen_at`, automático.** La tarjeta estuvo en pantalla. Lo dispara
  `ComunicadoCard` (`components/comunicados/`) con un
  IntersectionObserver: la mitad de la tarjeta —o media pantalla, si la
  tarjeta es más alta que el viewport— a la vista durante 1,5 s
  seguidos. Pasar scrolleando no cuenta; detenerse a leer sí. Los
  comunicados no tienen página propia (son tarjetas con el texto
  completo en la lista), por eso "abrió" no existe como señal.
- **`confirmed_at`, explícito.** El botón "Enterado/a", que aparece solo
  si el comunicado lo pide (`messages.ask_confirmation`, checkbox del
  formulario de la Asamblea). El error caro es el falso positivo —el
  informe dice que leyó, nadie lo llama—, así que el "visto" no se
  disfraza de leído y lo importante lleva confirmación.

Tres cosas más que sostienen el diseño:

- **El badge "Nuevo" es por persona.** Ya no lo marca la Asamblea a
  mano: `isNewForReader()` (`lib/message-reads.ts`) lo muestra a quien
  no tiene fila de lectura, con tope de 30 días desde la fecha del
  comunicado para que el histórico no aparezca todo como nuevo al
  estrenar la función. La columna `is_new` sigue existiendo pero el
  formulario de comunicados dejó de escribirla (el de Mensajes de la
  Casa Universal, no).
- **"Última vez en la app"** (`profiles.last_seen_at`): `PresenceBeacon`
  en el layout de `(app)` llama a `touchLastSeenAction()` al montar y
  al volver al frente; el servidor escribe a lo sumo una vez por día
  civil, frenado por la cookie `cb_last_seen_day`. En la lista de "no
  vieron" separa a quien no entra nunca (un llamado) de quien entró
  ayer y no llegó (un recordatorio). Es columna personal, no
  privilegiada: no hay que tocar `profiles_update_self`.
- **La regla vive en la RLS.** Cada persona escribe solo su fila, y
  solo sobre un comunicado que puede leer: el `exists` de la policy de
  insert corre con la RLS de `messages` del que escribe, así que un
  Amigo de la Fe no puede marcar un comunicado "solo creyentes". Lee la
  propia persona y la Asamblea de su localidad (`is_admin` +
  `current_locality_id`). Las acciones de marcar **no revalidan rutas**
  a propósito: se disparan mientras la persona scrollea y tirar el
  caché de la pantalla en cada marca recargaría la lista bajo su dedo.

El informe: columna "Lectura" en `/admin/comunicados` (vistos de total,
barra, confirmados si se pidieron) y detalle en
`/admin/comunicados/[id]/lectura` con tres listas —confirmaron, vieron
sin confirmar, no vieron todavía— que se refresca sola con Realtime
(`ReadReportRefresher`, mismo molde que `ChatListRefresher`; la tabla
está en la publicación `supabase_realtime`). La audiencia (el
denominador) son los perfiles activos de la localidad, solo creyentes si
el comunicado es `audience='creyentes'`, igual que el push. Quien se fue
de la localidad o quedó deshabilitado no cuenta en ningún lado. Un
comunicado anterior a la 048 muestra "Sin datos" en la tabla hasta que
alguien lo vea.

Decisión de producto: **no se le avisa al creyente** que la Asamblea ve
quién leyó. Se conversó y se decidió que no hace falta en una comunidad
de este tamaño.

⚠️ Hasta que corra la 048, el formulario de comunicados falla al
guardar (`ask_confirmation` no existe) y el listado de `/comunicados`
sale sin estado de lectura (el error se loguea y se sigue). No desplegar
sin aplicar la migración antes.

## Amigos de la Fe (migración 047)

La comunidad tiene dos tipos de persona: el **creyente** y el **Amigo/a
de la Fe** (`profiles.is_bahai = false`), que usa la misma app menos dos
zonas: la Tesorería (tablero, chat con el tesorero, Mis aportes,
informes, presupuesto) y la Fiesta de los 19 Días (calendario, pantalla
de Fiestas, fotos de la Fiesta, Boletín, y los comunicados marcados
"solo creyentes"). Etiquetas en `CONDITION_LABELS` (`lib/types.ts`).

Cuatro cosas que sostienen el diseño:

- **La regla vive en la RLS, no en la UI.** Helper SQL `is_bahai(uid)`,
  mismo molde que `is_admin`. Un amigo no lee una Fiesta ni un informe ni
  por API directa. La UI solo esconde lo que la base no devolvería:
  `bahaiOnly` en los segmentos de `SegmentedNav` (lee `useIsBahai()` del
  contexto de `HeaderUser`), la tarjeta Fiestas del Inicio, la leyenda
  del calendario, "Mis aportes" en el perfil. Las rutas que un amigo no
  tiene usan `requireBahai()` (`lib/auth.ts`) y redirigen al Inicio.
  Las funciones security definer (`treasury_progress`,
  `my_contributions`, `my_receipt`, `mark_chat_seen`) llevan el guard
  adentro, porque saltan la RLS.
- **`is_bahai` es una condición que asigna la Asamblea**, como un tag:
  está congelada para el propio usuario en `profiles_update_self` y la
  constraint `profiles_amigo_sin_cargos` impide que un amigo sea admin o
  tenga tags. Se asigna desde la ficha en `/admin/miembros` (desplegable
  "Condición", disabled en la propia ficha y omitido del payload, igual
  que el rol) o desde el **segundo link de invitación** por localidad
  (`locality_invites.friends_token`). Por eso `applyInviteToken()` pasó
  a escribir con service-role: el cliente del usuario ya no puede tocar
  `is_bahai`. Quien entra sin invitación es creyente por default.
- **Cada comunicado declara su audiencia** (`messages.audience`:
  `'todos'` | `'creyentes'`). El default de la **columna** es `'todos'`
  (los mensajes de la Casa Universal se insertan sin decir nada y son
  para todo el mundo); el default del **formulario** de la Asamblea es
  `'creyentes'`, porque mandarle la invitación a la Fiesta a un amigo es
  el error caro y que se pierda un aviso general es el barato. El push
  respeta lo mismo: `getLocalityMemberIds(id, { bahaiOnly })`, también
  en el Boletín (que es "solo creyentes" siempre) y en el recordatorio
  de una Fiesta cargada a mano en el calendario.
- **Lo que no se puede tapar.** Los links públicos del informe
  (`/i/<token>`) y del boletín (`/b/<token>`) no tienen login: quien
  tenga el link lo ve, amigo o no. Decidido dejarlo así.

⚠️ Hasta que corra la 047, el listado de `/admin/miembros` y el panel de
comunicados fallan (`is_bahai` / `audience` no existen), y
`resolveInviteToken()` no encuentra ningún link. No desplegar sin
aplicar la migración antes.

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

⚠️ **Los estatutos dicen otra cosa, y todavía no está en el código.** El
Agregado 2 del artículo XI del estatuto de la AEL de Montevideo (aprobado
por el MEC el 18/2/1998) fija "el cierre del ejercicio económico y del
balance anual tres días antes de la Convención Anual (**17 de abril** de
cada año)". Es una fecha gregoriana fija: el ejercicio legal corre del 18
de abril al 17 de abril siguiente, y los movimientos del 18 al 20 de abril
hoy caen en el ejercicio equivocado. Riḍván sigue siendo el corte que la
gente reconoce y el que divide el presupuesto en 19 meses; el 17 de abril
es el que rige balance anual, Libro de Caja y memoria. Ver "Adecuación a
la ley uruguaya" más abajo antes de tocar `treasury-year.ts`.

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
  (cualquier rol admin, en el grupo "Asamblea" del menú). Lista los informes EMITIDOS con
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

⚠️ **Qué presupuesto es "el del ejercicio" lo decide un solo lugar:**
`findBudgetForYear()` en `lib/budget-lookup.ts`, usado por el progreso y
por el informe. Existe porque `treasury_budgets.bahai_year` era opcional
en el alta y quedó NULL: el presupuesto "183 EB" existía con $ 141.900 y
el tablero decía "Sin presupuesto cargado" (2026-09-12). El helper acepta
el año en la columna, o escrito en el período ("183 E.B."), o el activo
sin año para el ejercicio en curso. El alta ahora propone el año como
valor y lo deduce del período si queda vacío; el editor lo deja
corregir. Cualquier pantalla nueva que necesite el presupuesto del año
tiene que pasar por ahí, no por `.eq("bahai_year", …)`.

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

### Cierre mensual, anulación, recibo fiscal, Libro de Caja y Balance (migración 054)

La primera tanda de la adecuación legal (los puntos 1, 2, 3, 11 y 12 de
la lista de abajo, en su numeración original), decidida con el usuario el
2026-09-12 con cuatro reglas: cierre por **mes civil**, reapertura **solo
del último mes cerrado y con motivo**, balance sobre el **ejercicio
estatutario 18/4 → 17/4**, y un movimiento con recibo emitido **solo se
anula**. Y una quinta, que manda sobre las otras: **el alta de ingresos y
gastos no cambia.** El formulario es el mismo; todo lo nuevo son acciones
sobre la fila y una pantalla aparte.

⚠️ **No desplegar sin aplicar la 054.** `computeReportSnapshot` filtra
`voided_at is null`, así que sin la columna TODO informe se guarda vacío;
el libro sí cae con gracia (`getLedgerEntries` reintenta sin las columnas
nuevas) y los cierres devuelven "falta la migración".

**El guardián está en la base, no en la app.** El trigger
`treasury_entries_guard` (BEFORE INSERT/UPDATE/DELETE) aplica tres reglas
que ningún camino de escritura puede saltear, y sus mensajes empiezan con
un código que `friendlyDbError()` en `libro/actions.ts` traduce:
`MES_CERRADO` (nada entra, cambia ni sale de un mes cerrado; la única
excepción es marcar el recibo como emitido, porque imprimirlo después no
cambia el libro), `ANULADO` (un anulado queda congelado) y
`RECIBO_EMITIDO` (con recibo emitido no se borra ni se edita: se anula).
Un segundo trigger impide borrar comprobantes de un mes cerrado; agregar
uno que faltaba sí se puede. Los server actions chequean lo mismo ANTES
—`monthIsClosed()` vía la RPC `treasury_month_is_closed`— por dos
razones: el aviso llega en palabras y a tiempo, y `deleteEntryAction`
purga los archivos del bucket antes del DELETE, así que tiene que saber
que el DELETE va a pasar.

**El cierre es una fila en `treasury_closings`** (localidad, mes civil,
quién, cuándo, `snapshot` con los saldos por cuenta y moneda,
`entries_count`). Los cierres son **consecutivos**: `nextMonthToClose()`
en `lib/treasury-closings.ts` devuelve el único mes que se puede cerrar
—el siguiente al último cerrado, o el del primer movimiento del libro— y
solo si ya terminó. Reabrir marca la fila `reopened` con motivo (no la
borra: es historia) y solo vale para el último cerrado; el mes se puede
volver a cerrar y queda una fila nueva. El índice único parcial
`treasury_closings_open_uniq` es lo que garantiza un solo cierre vigente
por mes. El snapshot es **evidencia, no fuente**: el Libro de Caja se
recalcula desde los movimientos (que el trigger congela) y
`snapshotMismatches()` compara; si algo no coincide, la hoja lo dice en
rojo antes de imprimir. Nada se cierra solo: el tesorero cierra mes a mes
en `/admin/tesoreria/libro/cierres` desde abril de 2026.

**Corregir un mes cerrado es un contra-asiento**, `revertEntryAction`:
un movimiento con fecha de HOY, misma cuenta, moneda, rubro y fondo, monto
invertido, `adjusts_entry_id` apuntando al original y
`adjustment_reason` obligatorio. Los dos quedan a la vista —el original
tal cual se cerró y la corrección en el mes abierto—, que es exactamente
lo que el MEC quiere ver en lugar de una tachadura. Una transferencia se
revierte con sus dos patas atadas por un grupo nuevo. Un movimiento con
contra-asiento no admite un segundo. Después el tesorero carga el correcto
como siempre.

**Anular** (`voidEntryAction`) es para un movimiento con recibo en un mes
abierto: `voided_at`, `voided_by`, `void_reason`. No suma en NADA
—`balancesBy`, `periodTotals`, `computeReportSnapshot`, `treasury_progress()`
(reescrita en la 054), el Libro de Caja y `my_contributions()` lo dejan
afuera o lo marcan— y su número sigue ocupando el lugar en la serie, que
es lo que la DGI pide de una numeración correlativa. La hoja del recibo
imprime "ANULADO" cruzado y "Mis aportes" lo muestra tachado. Todo aporte
lleva número: si el campo queda vacío, `saveEntryAction` pide
`next_receipt_number()` y reintenta una vez si choca con el índice único
(dos tesoreros cargando a la vez).

**El recibo lleva los datos fiscales** (Res. DGI 688/992 num. 22):
`ReceiptSheet` recibe `legal` con nombre registrado, RUT y domicilio, que
salen de `assembly_records` (`fiscal_address` es nuevo; se carga en
Asamblea → Datos de la Asamblea) por `getReceiptLegal()` para el tesorero
y por `my_receipt()` para la copia del creyente. Sin ficha legal, el recibo
sale como antes y la pantalla del tesorero avisa. El pie dice que lo emitió
el sistema de Tesorería; qué reemplaza a los "datos de imprenta" del
numeral 18 en un recibo por sistema sigue siendo pregunta para el contador.

**El Libro Mayor de Caja** (`/admin/libro-caja/[month]`, fuera del grupo
`(panel)` como el informe, con `components/treasury/CashBookSheet.tsx`) es
el formato del instructivo del MEC: por **mes civil**, una hoja resumen
con todas las cuentas y una hoja por **cuenta y moneda** con Día /
Concepto / Ingresos / Egresos / Saldo, saldo anterior y saldo al cierre.
El cálculo es puro en `lib/treasury-cashbook.ts` (`buildCashbook`), sin
React ni queries, compartido por la hoja, la pantalla de cierres y el
snapshot del cierre. Sobre un mes cerrado imprime en limpio y con quién
cerró; sobre uno abierto imprime con marca de agua BORRADOR. **Sin nombres
de contribuyentes**: el concepto de un aporte es su recibo y su rubro,
porque es un documento que puede pedir una inspección.

**La Memoria y Balance anual es el tercer `audience` del informe,
`'balance'`** (`components/treasury/BalanceSheet.tsx`), armado con las
MISMAS piezas exportadas de `ReportSheet.tsx` y el mismo snapshot. Cubre
el ejercicio estatutario: `periodPresets()` ofrece "Ejercicio estatutario
18 abr → 17 abr" (en curso y anterior, `statutoryYears()`) sin tocar
`treasury-year.ts`, y `period-picker` lo selecciona solo al elegir el
destinatario. Lo que el libro no sabe va en `editorial.balance`: la
**memoria** en prosa, la **cotización de cierre** del dólar con fecha y
fuente —no hay tipo de cambio por movimiento todavía, así que la declara
el tesorero y la hoja la imprime como criterio de conversión; sin ella no
totaliza en pesos, porque "nunca sumar monedas distintas" solo se rompe
con un tipo de cambio dicho y firmado— y las tres **firmas** (Coordinador,
Secretario, Tesorero, art. VII del estatuto), propuestas desde la
composición de la Asamblea del ejercicio (052). La RLS (054) deja que
**cualquier creyente de la localidad lea un balance publicado**, que es lo
que ordena el Agregado 3 del art. XI; el link público `/i/<token>` sigue
siendo solo del deck (`getPublicReport` filtra `comunidad`). En el
registro de la Asamblea (`/admin/informes`) el balance se lista junto a
las hojas internas porque también se aprueba en reunión.

### Adecuación a la ley uruguaya (relevamiento 2026-09-12)

Qué le pide la normativa al libro y a los informes, contrastado con lo que
el sistema hace hoy. Documento completo, con fuentes y las preguntas para
el contador, publicado en
https://claude.ai/code/artifact/643d59f1-8e98-48ba-8e47-29568e7781e3.
La primera tanda (cierre mensual e inmutabilidad, anulación de recibos,
datos fiscales en el recibo, Libro de Caja imprimible, Memoria y Balance
anual) está implementada en la 054; ver la sección anterior. El resto no
se implementa hasta que el contador valide los puntos abiertos. No es un
dictamen: lo preparó ingeniería leyendo la norma.

**Qué manda y qué no.** Manda el **MEC** (instructivo de libros sociales:
Libro Mayor de Caja con cinco columnas Día / Concepto / Ingresos /
Egresos / Saldo, cierres **mensuales** por mes civil, sin correcciones ni
tachaduras, cada asiento con comprobante; puede llevarse por computadora
pegando hojas foliadas en un libro de tapas duras; memoria y balance
anual aprobados y transcriptos al libro de actas), la **DGI** (Res.
688/992 num. 22 y Consulta 6234/019: por donaciones basta un recibo con
nombre registrado, domicilio fiscal, RUT, numeración correlativa, la
leyenda "Recibo" y datos de imprenta; se admite emisión por sistema; no
hace falta CFE para donaciones), el **Código Tributario** (arts. 38 y 68:
conservar libro y comprobantes 5 años, 10 en ciertos casos) y la **Ley
18.331** (inscribir la base de contribuyentes en la URCDP). **No aplican
por umbral** la Ley 19.574 de lavado de activos ni la declaración de
beneficiario final ante el BCU (Ley 19.484): ambas rigen desde 4.000.000
UI de ingresos anuales o 2.500.000 UI de activos.

**Lo que fijan los estatutos** (copia autenticada en OneDrive, `AEL
Montevideo/Estatutos de AEL digitalizados.pdf`; 14 páginas escaneadas sin
capa de texto): cierre del ejercicio el **17 de abril** (art. XI Agregado
2); el libro "consta de tres columnas: Contribuciones, Gastos y Saldo",
llevado diariamente; copias de la **memoria y el balance anual a
disposición de todos los bahá'ís desde el 17 de abril** en el Centro
(Agregado 3, obligación estatutaria, no cortesía); un informe financiero
de "todos los ingresos y desembolsos" en la Reunión Anual del 21 de abril
(Sección 4); **no hay Comisión Fiscal**, aprueban los nueve miembros en
reunión con quórum de cinco (art. VIII); oficiales Coordinador,
Vice-Coordinador, Secretario y Tesorero (art. VII). Nombre registrado y
sello: "Asamblea Espiritual Local de los Bahá'ís de Montevideo";
personería del 4/2/1952; reforma inscripta el 11/3/1998, Registro 5760,
Folio 36, Libro 13. Solo la Asamblea Nacional enmienda el estatuto y lo
hace para todas las AEL (art. XIV): las otras localidades casi seguro
tienen el mismo texto, confirmar con la AEN antes de generalizar la fecha.

**Cambios al libro, por etapa.** Etapa 1: (1) ejercicio estatutario 18/4 →
17/4 configurable por localidad, con saldos de apertura generados al 18/4;
(2) cierre mensual con saldos congelados y trigger que bloquee UPDATE y
DELETE sobre asientos y adjuntos de un mes cerrado, correcciones por
contra-asiento con referencia y motivo — hoy `saveEntryAction` y
`deleteEntryAction` no tienen límite y el borrado purga el comprobante;
(3) recibos que se **anulan** con motivo y conservan el número, nunca se
borran, y `receipt_number` obligatorio en todo aporte; (4) datos fiscales
en `ReceiptSheet`: nombre registrado, RUT, domicilio fiscal (columna nueva
en `assembly_records`), leyenda "Recibo". Etapa 2: (5) comprobante
estructurado en `treasury_attachments` (tipo de documento, serie y número,
RUT emisor, fecha) y motivo declarado cuando un gasto no tiene respaldo;
(6) medio de pago por asiento (efectivo / transferencia / depósito / POS /
cheque, con referencia bancaria); (7) `exchange_rate` en los asientos USD o
cotización de cierre por período, y la implícita de las transferencias
entre monedas calculada y guardada — en pantalla se sigue sin sumar
monedas, el balance legal sí totaliza en pesos con la cotización
declarada; (8) `is_restricted` en `treasury_funds`; (9) calendario civil
junto al bahá'í. Etapa 3: (10) nada de un período cerrado se borra
físicamente y exportación anual libro + comprobantes a ZIP; (11) bitácora
de cambios en mes abierto y registro de quién reveló los nombres.

**Cambios a los informes.** Etapa 1: (12) Libro Mayor de Caja imprimible
con el formato MEC, por cuenta y moneda, saldo al cierre de cada mes
civil, foliado continuo, solo sobre meses cerrados; (13) **Memoria y
Balance anual** como tercer formato con snapshot congelado: estado de
situación por cuenta y moneda con equivalente en pesos y cotización,
recursos y gastos por rubro con resultado, fondos restringidos vs. libres,
notas, bloque de aprobación con acta y firmas de Coordinador, Secretario y
Tesorero; (14) el balance aprobado visible en `/tesoreria` para la
comunidad desde el 17/4 (el pendiente "el informe no avisa" pasa a ser
cumplimiento estatutario). Etapa 2: (15) aprobación registrada por un
miembro de la Asamblea (`approved_at`, `approved_by`, acta) que bloquea el
informe y dispara el cierre; (16) encabezado legal en hoja, balance y
recibo, y datos registrales precargados en `assembly_records` (registro,
folio, libro, personería, reforma, domicilio fiscal); (17) sección de
comprobantes y conciliación bancaria en la hoja interna. Etapa 3: (18)
ingresos y activos del ejercicio en UI contra los umbrales de 4.000.000 y
2.500.000; (19) aviso de finalidad en la ficha del contribuyente e
inscripción en la URCDP (trámite, no código).

**Preguntas abiertas para el contador** (cada respuesta cambia un punto):
cierre ante DGI, ¿17/4 o año civil, y hay declaración jurada anual?; qué
reemplaza los datos de imprenta en un recibo emitido por sistema; si la
colecta anónima de la Fiesta puede ir en un recibo único; cotización por
operación o de cierre para los dólares; 5 o 10 años de retención; si
todas las localidades cierran el 17/4; si hay alguna base ya inscripta en
la URCDP; y si aparecen ventas (libros, cenas) que exijan factura o CFE,
que hoy el libro de aportes no contempla.

## Pendientes conocidos

- **Aplicar la 054 antes de desplegar** (ver el ⚠️ de su sección) y, ya
  aplicada, cargar el domicilio fiscal en Datos de la Asamblea y cerrar los
  meses de abril a agosto de 2026 en `/admin/tesoreria/libro/cierres`,
  imprimiendo el Libro de Caja de cada uno.
- **El corte legal es el 17 de abril y el código usa Riḍván.** El balance
  anual ya corta el 18/4 → 17/4 por preset, pero `treasury-year.ts`, los
  saldos de apertura y "Mis aportes" siguen en Riḍván. Ver "Adecuación a
  la ley uruguaya": condiciona el cierre de período del 184.
- **El balance publicado no tiene pantalla en la app de la comunidad.** La
  RLS ya lo deja leer (054) y los estatutos lo exigen desde el 17 de
  abril; falta listarlo en `/tesoreria` (punto 14 de la lista legal).
- **La aprobación sigue siendo texto del editor** (fecha de reunión y
  acta), también en el balance. Aprobar desde la app con `approved_at` /
  `approved_by` y bloquear el informe aprobado es el punto 13.
- **Preguntas al contador que condicionan lo hecho:** qué reemplaza los
  datos de imprenta en un recibo emitido por sistema (hoy el pie dice
  "emitido por el sistema de Tesorería"), y si la cotización del balance
  va por cierre o por operación (hoy es la de cierre, declarada).
- **Jubilar la tabla `treasury` vieja.** El anillo de `/tesoreria` ya se
  fue (lo reemplazó el tablero de progreso, 042), pero siguen leyendo el
  `current_amount` escrito a mano el "Informe mensual" de esa pantalla y
  los dos compartibles de imagen (`MonthlyReportShare`,
  `BudgetReportShare`), más el formulario de `/admin/tesoreria/aportar` ("Cómo aportar"). Todo eso
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
- **Lectura de comunicados: el informe no sabe quién se sumó a la
  localidad DESPUÉS del comunicado**: cuenta como "no vio" (y como "no
  votó") a alguien que nunca fue destinatario. El deep link del push ya
  está (051).
- **Encuestas: falta el recordatorio a quienes no votaron** (un push
  solo para ellos desde el informe; en una anónima no se puede, porque
  no se sabe quién falta) y mostrar el resultado como diapositiva en el
  programa de la Fiesta.
- **Buscador de pasajes: medir y, si hace falta, sumar embeddings.** La
  búsqueda es lexical con sinónimos; no encuentra un pasaje que trata el
  tema sin usar ninguna de las palabras. Probar con veinte preguntas
  reales (las de `corpus_searches` con 0 resultados son la lista) y, si
  falla seguido, agregar pgvector con embeddings multilingües (Voyage
  AI, recomendación de Anthropic; indexar todo cuesta menos de 1 USD) y
  fusionar los dos rankings antes de pasarle los candidatos a Haiku.
  También falta una pantalla en el panel con lo que busca la gente.
- **Uso de la app: falta el consolidado nacional.** Cada Asamblea ve su
  localidad; el admin nacional podría ver una tabla de todas (la RLS ya
  lo deja leer todo, es solo agrupar por `locality_id`). Y `usage_daily`
  crece sin poda: a este tamaño no importa, pero si algún día molesta,
  compactar lo anterior a un año en totales mensuales.
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
