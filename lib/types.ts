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

// ─── Fiesta de los Diecinueve Días ──────────────────────────────
export type FeastStatus = "upcoming" | "in_progress";

export type Feast = {
  id: string;
  bahai_month_name: string;
  bahai_month_index: number;
  bahai_year: number;
  status: FeastStatus;
  started_at: string | null;
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

export type CalendarEvent = {
  id: string;
  day: number;
  month: number;
  year: number;
  title: string;
  time: string;           // texto visible (ej. "7:00 PM")
  color: string;
  description?: string | null;
  location?: string | null;
  image_url?: string | null;
  duration_minutes?: number | null;
};
