// Creador de invitaciones: la imagen que la Asamblea comparte por WhatsApp
// a partir de un evento del calendario o de una Fiesta.
//
// Puro (sin server-only ni React): lo usan las páginas del servidor para
// armar los datos iniciales y el editor del cliente para dibujar.

export type InvitationFormat = "cuadrada" | "vertical";
export type InvitationStyle = "claro" | "noche" | "foto";

/** Medidas en px CSS; la captura sale al triple (1080 de ancho). */
export const INVITATION_SIZE: Record<InvitationFormat, { w: number; h: number }> = {
  cuadrada: { w: 360, h: 360 },
  vertical: { w: 360, h: 640 },
};

export type InvitationQuote = { text: string; reference: string };

export type InvitationData = {
  /** Línea chica arriba del título ("Te invitamos", "Día Sagrado"). */
  eyebrow: string;
  title: string;
  /** "yyyy-mm-dd". */
  date: string;
  /** Texto libre: "19:30", "Al atardecer". */
  time: string;
  place: string;
  /** Una o dos líneas opcionales. */
  text: string;
  /** Pie opcional: el nombre de la comunidad. */
  footer: string;
};

/** Lo que el servidor le pasa al editor para arrancar. */
export type InvitationInitial = InvitationData & { imageUrl: string | null };

/** Los cuatro datos que una invitación lleva SIEMPRE. */
export function missingFields(d: InvitationData): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push("el título");
  if (!invitationDateLabel(d.date)) out.push("la fecha");
  if (!d.time.trim()) out.push("la hora");
  if (!d.place.trim()) out.push("el lugar");
  return out;
}

/** "Sábado 28 de noviembre", desde "yyyy-mm-dd". "" si no es una fecha. */
export function invitationDateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(date.getTime())) return "";
  const text = new Intl.DateTimeFormat("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
    .format(date)
    .replace(",", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "19:30" → "19:30 h"; un texto libre ("Al atardecer") queda como está. */
export function invitationTimeLabel(time: string): string {
  const t = time.trim();
  return /^\d{1,2}:\d{2}$/.test(t) ? `${t} h` : t;
}

/** El pie que se propone según la institución que invita. */
export function invitationFooter(locality: {
  name: string;
  kind?: string | null;
}): string {
  // El nombre de una localidad puede venir ya completo ("Comunidad Bahá'í
  // de Montevideo") o solo la ciudad: no se le antepone dos veces.
  const name = locality.name.trim();
  if (locality.kind === "nacional" || locality.kind === "estructura") return name;
  return /^(comunidad|asamblea)\b/i.test(name) ? name : `Comunidad Bahá'í de ${name}`;
}

/** Recorte en un espacio, para proponer el texto breve. */
export function shortText(text: string | null | undefined, max = 140): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

export function invitationFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `invitacion-${slug || "evento"}.png`;
}

// ── La ilustración de una invitación sin foto ───────────────────────

export type InvitationArtKind = "amanecer" | "libro" | "arcos" | "estrella";

export const INVITATION_ART: Array<{ id: InvitationArtKind; label: string }> = [
  { id: "amanecer", label: "Amanecer" },
  { id: "libro", label: "Libro" },
  { id: "arcos", label: "Arcos" },
  { id: "estrella", label: "Estrella" },
];

/**
 * Qué ilustración le corresponde a un evento, leyendo su título y su
 * encabezado. Es una propuesta: en el editor se puede cambiar o quitar.
 */
export function pickInvitationArt(text: string): InvitationArtKind {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/fiesta|sagrado|ridvan|naw|nacimiento|declaracion|ascension|martirio|alianza|ayyam/.test(t))
    return "estrella";
  if (/oracion|devocional|rezo|plegaria|meditacion|amanecer/.test(t)) return "amanecer";
  if (/estudio|circulo|libro|ruhi|profundiza|instituto|curso|taller|clase|ninos|jovenes|charla|lectura/.test(t))
    return "libro";
  if (/reunion|asamblea|consulta|encuentro|servicio|visita|convencion|conferencia|paseo|jornada/.test(t))
    return "arcos";
  return "estrella";
}
