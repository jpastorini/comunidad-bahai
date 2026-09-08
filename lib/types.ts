export type MessageSource = "casa_universal" | "asamblea_local";

export type Message = {
  id: string;
  date: string; // ISO date — "Fecha de creado" del comunicado
  title: string;
  excerpt: string;
  full_text?: string | null;
  is_new: boolean;
  source: MessageSource;
  /** Asunto (subject) — usado en comunicados de la Asamblea Local. */
  subject?: string | null;
  /** PDF adjunto (URL pública desde Supabase Storage). */
  pdf_url?: string | null;
  /** Imagen de invitación adjunta (URL pública desde Supabase Storage). */
  image_url?: string | null;
  /**
   * Quién lo lee: 'todos' (creyentes y amigos de la Fe) o 'creyentes'
   * (p. ej. la invitación a la Fiesta). La RLS lo aplica; el push lo
   * respeta. Migración 047.
   */
  audience?: MessageAudience;
  /**
   * Pide al lector que toque "Enterado/a". Solo para lo que importa
   * (una invitación, una convocatoria): el "visto" automático cubre el
   * resto. Migración 048.
   */
  ask_confirmation?: boolean;
};

export type MessageAudience = "todos" | "creyentes";

/**
 * Lectura de un comunicado por una persona (migración 048). `seen_at`
 * es automático (la tarjeta estuvo en pantalla); `confirmed_at` es el
 * botón "Enterado/a". Una fila por (comunicado, persona).
 */
export type MessageRead = {
  message_id: string;
  profile_id: string;
  seen_at: string;
  confirmed_at: string | null;
};

/**
 * Encuesta de un comunicado (migración 051): una pregunta con 2 a 10
 * opciones, como las de WhatsApp. Se vota una sola vez, sin cambiar.
 * En una encuesta `anonymous` el voto se guarda sin persona.
 */
export type MessagePoll = {
  id: string;
  message_id: string;
  question: string;
  allow_multiple: boolean;
  anonymous: boolean;
  /** Cierre automático (opcional). */
  closes_at: string | null;
  /** Cierre a mano por la Asamblea. */
  closed_at: string | null;
  options: PollOption[];
};

export type PollOption = {
  id: string;
  poll_id: string;
  position: number;
  label: string;
};

/** Totales de una encuesta: solo números, nunca un nombre. */
export type PollResults = {
  participants: number;
  /** option_id → votos. */
  votes: Record<string, number>;
};

/** Lo que el creyente sabe de su propia participación. */
export type MyPollVote = {
  voted_at: string;
  /** Opciones elegidas; vacío en una encuesta anónima (no se guardan). */
  option_ids: string[];
};

/**
 * Canal del chat. La conversación es una por (creyente, tema): a la
 * Secretaría se le escribe de todo, al tesorero se le avisa del giro que
 * se hizo al Fondo. Quién atiende cada canal lo decide el tag
 * (`can_respond_chat` / `can_manage_treasury`), no el rol.
 */
export type ChatTopic = "secretaria" | "tesoreria";

export type ChatMessage = {
  id: string;
  member_id: string;
  from_user_id: string;
  text: string;
  created_at: string; // ISO
  read: boolean;
  /** True when sent by Secretaría (admin) — decouples from from_user_id. */
  is_admin_reply: boolean;
  topic: ChatTopic;
  /**
   * Nombre de quien respondió, congelado al insertar (ver migración 045).
   * Null en los mensajes del creyente y en respuestas anteriores a esa
   * migración cuyo autor ya no tenía nombre cargado.
   */
  from_name: string | null;
  // For UI rendering only
  mine?: boolean;
};

/** Etiquetas visibles de cada canal del chat. */
export const CHAT_TOPIC_LABELS: Record<ChatTopic, string> = {
  secretaria: "Secretaría Local",
  tesoreria: "Tesorería",
};

/** Ruta de cada canal en la app del creyente. */
export const CHAT_TOPIC_PATHS: Record<ChatTopic, string> = {
  secretaria: "/chat",
  tesoreria: "/chat/tesoreria",
};

/** Ruta de la bandeja de cada canal en el panel. */
export const CHAT_TOPIC_ADMIN_PATHS: Record<ChatTopic, string> = {
  secretaria: "/admin/chat",
  tesoreria: "/admin/tesoreria/chat",
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  /** URL pública del avatar. Puede ser de Google o subido manualmente. */
  avatar_url: string | null;
  role: "member" | "admin";
  can_respond_chat: boolean;
  can_manage_treasury: boolean;
  /** Puede editar el Boletín local (aunque no sea admin de Asamblea). */
  can_manage_bulletin: boolean;
  /** Localidad a la que pertenece. NULL = todavía no eligió. */
  locality_id: string | null;
  /** Puede crear/editar localidades y asignar roles cross-locality. */
  is_national_admin: boolean;
  /**
   * Soft-disable: si tiene fecha, el miembro fue deshabilitado por la
   * Asamblea y el middleware le corta el acceso. NULL = activo.
   */
  disabled_at: string | null;
  /** Admin que lo deshabilitó (auth.users.id). */
  disabled_by: string | null;
  /** Aviso diario de la Oración Obligatoria corta (13:00). Opt-in. */
  prayer_reminder_enabled: boolean;
  /** Aviso de las 8:00 con la Lectura de hoy. Prendido por defecto. */
  daily_quote_push_enabled: boolean;
  /**
   * false = "Amigo/a de la Fe": persona que no es bahá'í y usa la app
   * sin Tesorería ni Fiesta de los 19 Días (migración 047). Lo asigna la
   * Asamblea o el link de invitación para amigos; el propio usuario no
   * puede cambiarlo. Un amigo es siempre role='member' y sin tags.
   */
  is_bahai: boolean;
  created_at: string;
};

/** Etiquetas visibles de la condición en la comunidad. */
export const CONDITION_LABELS = {
  bahai: "Creyente",
  amigo: "Amigo/a de la Fe",
} as const;

/**
 * Etiquetas visibles de los roles. Los valores en la base de datos siguen
 * siendo 'member' / 'admin' (RLS, triggers, tipos); esto es solo el texto
 * descriptivo que ve la gente. Convención cultural de la comunidad: a la
 * gente de la comunidad se le dice "creyente"; "miembro" se reserva para
 * los miembros de la Asamblea.
 */
export const ROLE_LABELS: Record<Profile["role"], string> = {
  member: "Creyente",
  admin: "Miembro Asamblea Local",
};

export type Locality = {
  id: string;
  name: string;
  city: string | null;
  country: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

// ─── Datos de la Asamblea (052) ─────────────────────────────────────

/** La ficha legal de la Asamblea, una por localidad. */
export type AssemblyRecord = {
  id: string;
  locality_id: string;
  registered_name: string | null;
  rut: string | null;
  bps_number: string | null;
  registered_at: string | null; // ISO date
  notes: string | null;
  statutes_path: string | null;
  statutes_file_name: string | null;
  statutes_uploaded_at: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

/** Una Asamblea Espiritual Local tiene nueve miembros. */
export const ASSEMBLY_SIZE = 9;

/** Los cuatro oficiales de la Asamblea. */
export type AssemblyOffice = "coordinador" | "vicecoordinador" | "secretario" | "tesorero";

export const ASSEMBLY_OFFICES: AssemblyOffice[] = [
  "coordinador",
  "vicecoordinador",
  "secretario",
  "tesorero",
];

export const ASSEMBLY_OFFICE_LABELS: Record<AssemblyOffice, string> = {
  coordinador: "Coordinador/a",
  vicecoordinador: "Vicecoordinador/a",
  secretario: "Secretario/a",
  tesorero: "Tesorero/a",
};

/** Un ejercicio de la Asamblea (Riḍván a Riḍván), por año BE. */
export type AssemblyTerm = {
  id: string;
  locality_id: string;
  bahai_year: number;
  elected_on: string | null; // ISO date
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

/** Uno de los nueve miembros de un ejercicio. */
export type AssemblyMember = {
  id: string;
  term_id: string;
  locality_id: string;
  position: number; // 1..9
  profile_id: string | null;
  display_name: string;
  office: AssemblyOffice | null;
  created_at: string;
};

export type LocalityChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type LocalityChangeRequest = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  from_locality_id: string | null;
  to_locality_id: string;
  status: LocalityChangeStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type ActivityType = "estudio" | "devocional" | "ninos" | "jovenes";

export type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  starts_at: string; // ISO datetime
  place: string;
};

export type StudyMaterialKind =
  | "ruhi"
  | "escritos"
  | "oraciones"
  | "oracion_del_mes"
  | "libros";

export type StudyMaterial = {
  id: string;
  kind: StudyMaterialKind;
  number: number | null;
  title: string;
  subtitle: string | null;
  completed: boolean;
  current: boolean;
  pdf_url: string | null;
  image_url: string | null;
  created_at?: string;
  /** null = contenido NACIONAL (visible a todas las localidades). */
  locality_id?: string | null;
};

export type TeachingGoal = {
  id: string;
  label: string;
  current: number;
  goal: number;
  color: string; // hex
  cycle: string;
};

export type ServiceUrgency = "alta" | "media" | "baja";

export type ServiceNeed = {
  id: string;
  title: string;
  description: string;
  urgency: ServiceUrgency;
  volunteers: string[];
};

export type Treasury = {
  goal_amount: number;
  current_amount: number;
  period: string;
  contributions: { label: string; amount: number }[];
  methods: { type: string; description: string; letter: string }[];
};

/** Compromiso mensual de aporte declarado por un miembro al Fondo Local. */
export type TreasuryCommitment = {
  user_id: string;
  display_name: string;
  amount: number;
  want_reminder: boolean;
  created_at: string;
  updated_at: string;
};

// ─── Fiesta de los Diecinueve Días ──────────────────────────────
/**
 * draft       — pre-cargada, solo Asamblea ve.
 * published   — Asamblea publicó: aparece en calendario público sin programa.
 * in_progress — Asamblea inició: programa visible a toda la comunidad.
 */
export type FeastStatus = "draft" | "published" | "in_progress";

export type Feast = {
  id: string;
  bahai_month_name: string;
  bahai_month_index: number;
  bahai_year: number;
  /** Fecha gregoriana oficial del día 1 del mes bahá'í. ISO YYYY-MM-DD. */
  gregorian_date: string | null;
  status: FeastStatus;
  started_at: string | null;
  published_at: string | null;
  deepening_theme: string | null;
  deepening_content: string | null;
  international_reports: string | null;
  national_reports: string | null;
  local_reports: string | null;
  assembly_communique: string | null;
  treasury_income: number | null;
  treasury_expenses: number | null;
  treasury_final: number | null;
  treasury_pdf_url: string | null;
  created_at: string;
};

export type FeastLocation = {
  id: string;
  feast_id: string;
  name: string;
  address: string | null;
  starts_at: string; // ISO
  notes: string | null;
  /** Asistentes registrados después de la Fiesta. NULL = sin registrar. */
  participant_count: number | null;
  created_at: string;
};

export type FeastPrayer = {
  id: string;
  feast_id: string;
  position: number;
  title: string | null;
  reference: string | null;
  body: string;
  created_at: string;
};

/** Ámbito de una noticia de la Fiesta: define en qué diapositiva sale. */
export type FeastNewsScope = "internacional" | "nacional" | "local";

/**
 * Una noticia del programa de la Fiesta (migración 050). Reemplaza a los
 * bloques de texto `international_reports` / `national_reports` /
 * `local_reports`, que quedaron en NULL y sin uso.
 */
export type FeastNewsItem = {
  id: string;
  feast_id: string;
  scope: FeastNewsScope;
  position: number;
  /** Texto libre: "21 de agosto", "Designación". Es lo que se proyecta. */
  date_label: string | null;
  title: string;
  body: string | null;
  /** URL pública (bucket `comunicados`, carpeta fiestas/noticias/). */
  image_url: string | null;
  created_at: string;
};

export type FeastSuggestion = {
  id: string;
  feast_id: string;
  /** Si fue enviada por un miembro logueado, su user_id. NULL si capturada por admin. */
  user_id: string | null;
  /** Nombre del autor cuando lo captura un admin (texto libre, opcional). */
  author_name: string | null;
  detail: string;
  /** True cuando la Asamblea ya trató la sugerencia en reunión. */
  reviewed: boolean;
  created_at: string;
};

// ─── Galería de fotos por evento (Fase 1) ────────────────────────
export type EventPhoto = {
  id: string;
  /** 'calendar' para filas de calendar_events (incluye Días Sagrados),
   *  'feast' para Fiestas. */
  event_type: "calendar" | "feast";
  event_id: string;
  uploader_user_id: string;
  uploader_name: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  locality_id: string;
  /** Hooks Fase 2 — sin UI todavía. */
  visibility: "locality" | "national";
  featured: boolean;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

// ─── Reacciones, comentarios, notificaciones sociales ──────────
export type ReactionEmoji = "heart" | "pray" | "star" | "flower";

export type PhotoReaction = {
  id: string;
  photo_id: string;
  user_id: string;
  emoji: ReactionEmoji;
  locality_id: string;
  created_at: string;
};

/** Agregado por foto: cuenta por emoji + qué emojis dejó el usuario actual. */
export type PhotoReactionSummary = {
  counts: Record<ReactionEmoji, number>;
  mine: ReactionEmoji[];
};

export type PhotoComment = {
  id: string;
  photo_id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  locality_id: string;
  created_at: string;
  updated_at: string;
};

export type SocialNotificationType = "reaction" | "comment";

export type SocialNotification = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  actor_name: string;
  type: SocialNotificationType;
  photo_id: string | null;
  event_type: "calendar" | "feast" | null;
  event_id: string | null;
  emoji: ReactionEmoji | null;
  preview: string | null;
  locality_id: string;
  read_at: string | null;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  day: number;
  month: number;
  year: number;
  title: string;
  time: string;           // texto visible (ej. "7:00 PM")
  color: string;
  /**
   * Categoría visual del evento. Ver lib/calendar-kinds.ts.
   * Default 'actividad_general' para eventos creados manualmente.
   */
  kind?: import("./calendar-kinds").CalendarEventKind | null;
  description?: string | null;
  location?: string | null;
  image_url?: string | null;
  duration_minutes?: number | null;
  /**
   * true cuando el evento fue sembrado automáticamente por el sistema
   * (ej. un Día Sagrado). La Asamblea NO puede borrar ni renombrar
   * estos eventos; solo puede editar hora, lugar, descripción, imagen
   * y duración.
   */
  is_system_seeded?: boolean | null;
  /** Identificador estable de la siembra (ej. 'holy_naw_ruz_BE183'). */
  system_id?: string | null;
  /**
   * Fecha gregoriana oficial del calendario Badí'. Para Días Sagrados
   * que se celebran la noche anterior, day/month/year guardan la fecha
   * de celebración y official_date guarda la fecha oficial. Para los
   * de horario exacto coinciden.
   */
  official_date?: string | null;
};

// ─── Boletín local ───────────────────────────────────────────────
// Ediciones editoriales por localidad que compilan contenido existente
// (eventos, comunicados, fotos) como snapshot JSON. Ver migración
// 036_local_bulletins.sql y lib/bulletins.ts.

export type BulletinStatus = "draft" | "published";

export type BulletinEventItem = {
  id: string;
  title: string;
  /** Fecha ya formateada (ej. "12 ago"), congelada en el snapshot. */
  dateLabel: string;
  time: string | null;
  location: string | null;
};

export type BulletinAnnouncementItem = {
  id: string;
  title: string;
  excerpt: string;
  /** Fecha del comunicado (ISO yyyy-mm-dd). */
  date: string;
};

export type BulletinPhotoItem = {
  id: string;
  url: string;
  caption: string | null;
  eventTitle: string;
};

export type BulletinContent = {
  events: BulletinEventItem[];
  announcements: BulletinAnnouncementItem[];
  photos: BulletinPhotoItem[];
};

export type Bulletin = {
  id: string;
  locality_id: string;
  title: string;
  editorial: string | null;
  content: BulletinContent;
  status: BulletinStatus;
  /** Token del link público /b/<token> (compartir fuera de la app). */
  share_token: string;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
