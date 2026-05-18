const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MONTHS_ES_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const WEEKDAYS_ES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function formatLongDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]}, ${date.getFullYear()}`;
}

export function formatMessageDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS_ES_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatActivityWhen(starts_at: string): {
  dayLabel: string; // "22"
  weekdayLabel: string; // "VIE"
  fullLabel: string; // "Vie 22 mayo"
  time: string; // "7:00 PM"
} {
  const date = new Date(starts_at);
  const day = date.getDate();
  const weekday = WEEKDAYS_ES_SHORT[date.getDay()];
  const month = MONTHS_ES[date.getMonth()];

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const time = `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;

  return {
    dayLabel: String(day),
    weekdayLabel: weekday.toUpperCase(),
    fullLabel: `${weekday} ${day} ${month}`,
    time,
  };
}

export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
}
