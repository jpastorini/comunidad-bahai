import { colors } from "./tokens";
import type {
  Activity,
  CalendarEvent,
  ChatMessage,
  Message,
  ServiceNeed,
  StudyMaterial,
  TeachingGoal,
  Treasury,
} from "./types";

/**
 * Seed data — used when Supabase env vars are missing or for demo/offline.
 * Mirrors the content shown in the design prototype.
 */

// Demo PDFs (placeholders publicos para que la vista no quede vacia).
const DEMO_PDF = "https://www.bahai.org/library/_downloads/messages/2024-pdf-demo.pdf";

export const seedMessages: Message[] = [
  {
    id: "m-2026-04-20",
    date: "2026-04-20",
    title: "Mensaje del Riḍván 2026",
    pdf_url: DEMO_PDF,
    excerpt:
      "A los bahá'ís del mundo — En este momento decisivo de la historia humana, la luz de la Revelación brilla con intensidad...",
    full_text:
      "A los bahá'ís del mundo — En este momento decisivo de la historia humana, la luz de la Revelación brilla con intensidad sobre los corazones y los pueblos. El Plan de Nueve Años avanza con vigor renovado y las comunidades, en todos los rincones del planeta, dan pasos firmes para construir un mundo nuevo, fundado en la unidad de la humanidad.\n\nMientras contemplamos los logros del último ciclo, sentimos honda gratitud por el esfuerzo sostenido de los amigos: nuevos círculos de estudio florecen, clases de niños y grupos de prejuniors echan raíces más profundas, y la vida devocional se enriquece en hogares y barrios.",
    is_new: true,
    source: "casa_universal",
  },
  {
    id: "m-2026-01-01",
    date: "2026-01-01",
    title: "Mensaje a los Bahá'ís del Mundo",
    excerpt:
      "Queridísimos amigos — Al comenzar un nuevo año, dirigimos nuestros pensamientos a la magnitud de la tarea que tenéis ante vosotros...",
    is_new: false,
    source: "casa_universal",
  },
  {
    id: "m-2025-11-26",
    date: "2025-11-26",
    title: "Mensaje del Día de la Alianza",
    excerpt:
      "Queridos amigos — El Convenio constituye la fuerza que sostiene la unidad de la Causa y guía a los creyentes...",
    is_new: false,
    source: "casa_universal",
  },
  {
    id: "m-2025-04-20",
    date: "2025-04-20",
    title: "Mensaje del Riḍván 2025",
    excerpt:
      "A los bahá'ís del mundo — Las fuerzas transformadoras desencadenadas por la Revelación de Bahá'u'lláh continúan...",
    is_new: false,
    source: "casa_universal",
  },
  {
    id: "m-2024-11-28",
    date: "2024-11-28",
    title: "Sobre el Plan de Nueve Años",
    excerpt:
      "Queridísimos amigos — Con sentimientos de profunda gratitud por las labores que se realizan en todos los continentes...",
    is_new: false,
    source: "casa_universal",
  },
];

export const seedLocalAnnouncements: Message[] = [
  {
    id: "la-2026-05-15",
    date: "2026-05-15",
    title: "Convocatoria a la próxima Fiesta de 19 días",
    subject: "Fiesta del mes de Núr — Asamblea Local",
    excerpt:
      "Queridos amigos — La Asamblea Espiritual Local les convoca a la próxima Fiesta de 19 días el domingo, en casa de la familia García a las 7:00 PM.",
    full_text:
      "Queridos amigos — La Asamblea Espiritual Local les convoca a la próxima Fiesta de 19 días el domingo, en casa de la familia García a las 7:00 PM.\n\nHabrá porción devocional con oraciones seleccionadas, parte administrativa con informe del tesorero y los planes del ciclo actual, y parte social con compartir comunitario.\n\nLes pedimos confirmar asistencia por chat para coordinar el refrigerio.",
    is_new: true,
    source: "asamblea_local",
    pdf_url: null,
    image_url: null,
  },
];

export const seedChat: ChatMessage[] = [
  {
    id: "c1",
    member_id: "me",
    from_user_id: "sec",
    text: "Buenos días, ¿en qué podemos ayudarle?",
    created_at: "2026-05-17T09:15:00Z",
    read: true,
    is_admin_reply: true,
    mine: false,
  },
  {
    id: "c2",
    member_id: "me",
    from_user_id: "me",
    text: "Quisiera información sobre las próximas actividades.",
    created_at: "2026-05-17T09:16:00Z",
    read: true,
    is_admin_reply: false,
    mine: true,
  },
  {
    id: "c3",
    member_id: "me",
    from_user_id: "sec",
    text: "Tenemos un círculo de estudio del Libro 7 este viernes a las 7 PM y una reunión devocional el domingo.",
    created_at: "2026-05-17T09:17:00Z",
    read: true,
    is_admin_reply: true,
    mine: false,
  },
  {
    id: "c4",
    member_id: "me",
    from_user_id: "me",
    text: "¿Dónde se realiza el círculo de estudio?",
    created_at: "2026-05-17T09:18:00Z",
    read: true,
    is_admin_reply: false,
    mine: true,
  },
  {
    id: "c5",
    member_id: "me",
    from_user_id: "sec",
    text: "En la casa de la familia Rodríguez. ¿Le gustaría confirmar su asistencia?",
    created_at: "2026-05-17T09:19:00Z",
    read: false,
    is_admin_reply: true,
    mine: false,
  },
];

export const seedActivities: Activity[] = [
  {
    id: "a1",
    type: "estudio",
    title: "Círculo de Estudio",
    detail: "Libro 7, Unidad 2",
    starts_at: "2026-05-22T19:00:00",
    place: "Casa Rodríguez",
  },
  {
    id: "a2",
    type: "devocional",
    title: "Reunión Devocional",
    detail: "Oraciones y música",
    starts_at: "2026-05-24T10:00:00",
    place: "Casa García",
  },
  {
    id: "a3",
    type: "ninos",
    title: "Clase de Niños",
    detail: "Grado 2, Lección 5",
    starts_at: "2026-05-23T16:00:00",
    place: "Centro Comunitario",
  },
  {
    id: "a4",
    type: "jovenes",
    title: "Grupo de Prejuniors",
    detail: "Caminando el sendero",
    starts_at: "2026-05-27T17:30:00",
    place: "Casa López",
  },
];

const blankAttachments = { pdf_url: null, image_url: null };

export const seedRuhi: StudyMaterial[] = [
  { id: "r1", kind: "ruhi", number: 1, title: "Reflexiones sobre la vida del espíritu", subtitle: null, completed: true, current: false, ...blankAttachments },
  { id: "r2", kind: "ruhi", number: 2, title: "Levantándose para servir", subtitle: null, completed: true, current: false, ...blankAttachments },
  { id: "r3", kind: "ruhi", number: 3, title: "Enseñando clases de niños (Grado 1)", subtitle: null, completed: true, current: false, ...blankAttachments },
  { id: "r4", kind: "ruhi", number: 4, title: "Las manifestaciones gemelas", subtitle: null, completed: true, current: false, ...blankAttachments },
  { id: "r5", kind: "ruhi", number: 5, title: "Liberando los poderes de los prejóvenes", subtitle: null, completed: false, current: false, ...blankAttachments },
  { id: "r6", kind: "ruhi", number: 6, title: "Enseñando la Causa", subtitle: null, completed: true, current: false, ...blankAttachments },
  { id: "r7", kind: "ruhi", number: 7, title: "Caminando juntos en un sendero de servicio", subtitle: null, completed: false, current: true, ...blankAttachments },
  { id: "r8", kind: "ruhi", number: 8, title: "El Convenio de Bahá'u'lláh", subtitle: null, completed: false, current: false, ...blankAttachments },
];

export const seedEscritos: StudyMaterial[] = [
  { id: "e1", kind: "oraciones", number: null, title: "Oraciones selectas", subtitle: "Compilación", completed: false, current: false, ...blankAttachments },
  { id: "e2", kind: "escritos", number: null, title: "Palabras Ocultas", subtitle: "Escritos sagrados", completed: false, current: false, ...blankAttachments },
  { id: "e3", kind: "escritos", number: null, title: "Kitáb-i-Íqán", subtitle: "Escritos sagrados", completed: false, current: false, ...blankAttachments },
];

/** Oración del mes — la Asamblea publica una nueva cada mes con una
 *  imagen lista para compartir por WhatsApp.
 *  Ordenadas de la más reciente a la más antigua. */
export const seedOracionesDelMes: StudyMaterial[] = [
  {
    id: "om-2026-05",
    kind: "oracion_del_mes",
    number: null,
    title: "Oración del mes — Mayo 2026",
    subtitle: "Compartida por la Asamblea Espiritual Local",
    completed: false,
    current: true,
    pdf_url: null,
    image_url: null,
    created_at: "2026-05-01T00:00:00Z",
  },
];

export const seedGoals: TeachingGoal[] = [
  { id: "g1", label: "Círculos de estudio", current: 3, goal: 5, color: colors.terra, cycle: "Mayo 2026" },
  { id: "g2", label: "Devocionales", current: 4, goal: 6, color: colors.amber, cycle: "Mayo 2026" },
  { id: "g3", label: "Clases de niños", current: 2, goal: 4, color: colors.green, cycle: "Mayo 2026" },
  { id: "g4", label: "Grupos de prejuniors", current: 1, goal: 3, color: colors.gold, cycle: "Mayo 2026" },
];

export const seedStats = [
  { n: 47, label: "Participantes activos" },
  { n: 12, label: "Nuevos este ciclo" },
  { n: 8, label: "Tutores" },
];

export const seedNeeds: ServiceNeed[] = [
  { id: "n1", title: "Tutores para Libro 1", description: "Se necesitan 2 tutores para un nuevo círculo de estudio", urgency: "alta", volunteers: [] },
  { id: "n2", title: "Anfitrión devocional", description: "Hogar para reuniones devocionales los domingos", urgency: "media", volunteers: [] },
  { id: "n3", title: "Maestro clase de niños", description: "Grado 3, los sábados por la tarde", urgency: "alta", volunteers: [] },
  { id: "n4", title: "Transporte para ancianos", description: "Llevar a 2 amigos a las reuniones semanales", urgency: "media", volunteers: [] },
  { id: "n5", title: "Músicos para devocional", description: "Acompañamiento musical para las reuniones", urgency: "baja", volunteers: [] },
];

export const seedTreasury: Treasury = {
  goal_amount: 5000,
  current_amount: 3250,
  period: "Año 2026",
  contributions: [
    { label: "Ingresos del mes", amount: 450 },
    { label: "Fondo Nacional", amount: 150 },
    { label: "Fondo Continental", amount: 50 },
    { label: "Fondo Local", amount: 250 },
  ],
  methods: [
    { type: "Transferencia", description: "Datos bancarios", letter: "T" },
    { type: "Efectivo", description: "En reunión", letter: "E" },
  ],
};

export const seedCalendarEvents: CalendarEvent[] = [
  {
    id: "ce1",
    day: 22, month: 5, year: 2026,
    title: "Círculo de Estudio", time: "7:00 PM", color: colors.terra,
    description: "Estudio del Libro 7, Unidad 2 — Caminando juntos en un sendero de servicio. Empezaremos puntualmente con oraciones.",
    location: "Casa Rodríguez",
    duration_minutes: 90,
    image_url: null,
  },
  {
    id: "ce2",
    day: 23, month: 5, year: 2026,
    title: "Clase de Niños", time: "4:00 PM", color: colors.green,
    description: "Grado 2, Lección 5. Trae tu cuaderno y crayones.",
    location: "Centro Comunitario",
    duration_minutes: 60,
    image_url: null,
  },
  {
    id: "ce3",
    day: 24, month: 5, year: 2026,
    title: "Reunión Devocional", time: "10:00 AM", color: colors.amber,
    description: "Reunión abierta para compartir oraciones y música devocional. Todos están invitados, incluyendo familiares y amigos.",
    location: "Casa García",
    duration_minutes: 75,
    image_url: null,
  },
  {
    id: "ce4",
    day: 27, month: 5, year: 2026,
    title: "Grupo de Prejuniors", time: "5:30 PM", color: colors.gold,
    description: "Encuentro del grupo de prejuniors — actividades, conversación y servicio.",
    location: "Casa López",
    duration_minutes: 90,
    image_url: null,
  },
];

export const seedFeaturedMessage = seedMessages[0];

/** Comunicado destacado en Home: el último de la Asamblea Local. */
export const seedFeaturedLocalAnnouncement = seedLocalAnnouncements[0];

export const seedBadges = {
  mensajes: "Nuevo" as const,
  chat: 2,
  actividades: 3,
  servicio: 5,
};
