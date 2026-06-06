// Formateo de fechas determinístico respecto a una zona horaria fija
// (America/Montevideo), idéntico en server (Vercel = UTC) y cliente (UY = UTC-3).
// Esto evita hydration mismatches de React: sin esto, getDate()/getHours() del
// runtime dependían del timezone del proceso y server/cliente podían diferir en
// un día para valores date-only o timestamps cerca de medianoche.

const TIME_ZONE = "America/Montevideo";

const WEEKDAYS_ES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const EN_WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Un solo formatter reutilizable que extrae las partes en la zona horaria fija.
const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

// "yyyy-mm-dd" puro (date-only): se trata como fecha local de pared, sin aplicar
// desfase de timezone (si no, new Date("2026-06-01") = medianoche UTC se correría
// al día anterior en UTC-3).
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: number; // 0=Dom .. 6=Sáb
};

function getParts(d: Date | string): DateParts {
  if (typeof d === "string") {
    const m = DATE_ONLY_RE.exec(d.trim());
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      // getUTCDay sobre la fecha en UTC da el día de la semana correcto sin
      // que intervenga el timezone del runtime.
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      return { year, month, day, hour: 0, minute: 0, weekday };
    }
  }

  const date = typeof d === "string" ? new Date(d) : d;
  const parts = PARTS_FORMATTER.formatToParts(date);

  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let weekday = 0;

  for (const p of parts) {
    switch (p.type) {
      case "year":
        year = Number(p.value);
        break;
      case "month":
        month = Number(p.value);
        break;
      case "day":
        day = Number(p.value);
        break;
      case "hour":
        hour = Number(p.value);
        break;
      case "minute":
        minute = Number(p.value);
        break;
      case "weekday":
        weekday = EN_WEEKDAY_INDEX[p.value] ?? 0;
        break;
    }
  }

  // Algunos runtimes devuelven "24" para medianoche con hour12:false.
  if (hour === 24) hour = 0;

  return { year, month, day, hour, minute, weekday };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Fecha en formato uruguayo dd/mm/yyyy (ej. "01/06/2026"). */
export function formatDate(d: Date | string): string {
  const { year, month, day } = getParts(d);
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

/** Día y mes sin año, formato uruguayo dd/mm (ej. "01/06"). Para chips compactos. */
export function formatDayMonth(d: Date | string): string {
  const { month, day } = getParts(d);
  return `${pad2(day)}/${pad2(month)}`;
}

/** Fecha + hora 24h: "dd/mm/yyyy HH:MM" (ej. "01/06/2026 14:30"). */
export function formatDateTime(d: Date | string): string {
  const { year, month, day, hour, minute } = getParts(d);
  return `${pad2(day)}/${pad2(month)}/${year} ${pad2(hour)}:${pad2(minute)}`;
}

export function formatLongDate(d: Date | string): string {
  return formatDate(d);
}

export function formatMessageDate(d: Date | string): string {
  return formatDate(d);
}

export function formatActivityWhen(starts_at: string): {
  dayLabel: string; // "22"
  weekdayLabel: string; // "VIE"
  fullLabel: string; // "Vie 22/05/2026"
  time: string; // "7:00 PM"
} {
  const { day, hour, minute, weekday } = getParts(starts_at);
  const weekdayName = WEEKDAYS_ES_SHORT[weekday];

  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  const time = `${hour12}:${pad2(minute)} ${ampm}`;

  return {
    dayLabel: String(day),
    weekdayLabel: weekdayName.toUpperCase(),
    fullLabel: `${weekdayName} ${formatDate(starts_at)}`,
    time,
  };
}

export function formatChatTime(iso: string): string {
  const { hour, minute } = getParts(iso);
  return `${hour}:${pad2(minute)}`;
}
