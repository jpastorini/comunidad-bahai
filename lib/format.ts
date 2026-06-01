const WEEKDAYS_ES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Fecha en formato uruguayo dd/mm/yyyy (ej. "01/06/2026"). */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Día y mes sin año, formato uruguayo dd/mm (ej. "01/06"). Para chips compactos. */
export function formatDayMonth(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

/** Fecha + hora 24h: "dd/mm/yyyy HH:MM" (ej. "01/06/2026 14:30"). */
export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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
  const date = new Date(starts_at);
  const day = date.getDate();
  const weekday = WEEKDAYS_ES_SHORT[date.getDay()];

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const time = `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;

  return {
    dayLabel: String(day),
    weekdayLabel: weekday.toUpperCase(),
    fullLabel: `${weekday} ${formatDate(date)}`,
    time,
  };
}

export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
}
