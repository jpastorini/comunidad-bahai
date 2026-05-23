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
};

export type ChatMessage = {
  id: string;
  member_id: string;
  from_user_id: string;
  text: string;
  created_at: string; // ISO
  read: boolean;
  /** True when sent by Secretaría (admin) — decouples from from_user_id. */
  is_admin_reply: boolean;
  // For UI rendering only
  mine?: boolean;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "member" | "admin";
  can_respond_chat: boolean;
  can_manage_treasury: boolean;
  /** Localidad a la que pertenece. NULL = todavía no eligió. */
  locality_id: string | null;
  /** Puede crear/editar localidades y asignar roles cross-locality. */
  is_national_admin: boolean;
  created_at: string;
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
  | "oracion_del_mes";

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
