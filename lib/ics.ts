import type { CalendarEvent } from "./types";

/**
 * Parsea "7:00 PM", "10:30 AM" o "19:00" a {hour, minute} 24h.
 * Devuelve {0,0} si no puede parsear.
 */
export function parseEventTime(time: string): { hour: number; minute: number } {
  if (!time) return { hour: 0, minute: 0 };
  const trimmed = time.trim().toUpperCase();
  const isPM = trimmed.includes("PM");
  const isAM = trimmed.includes("AM");
  const cleaned = trimmed.replace(/AM|PM/g, "").trim();
  const [hh, mm] = cleaned.split(":").map((s) => parseInt(s, 10));
  let hour = isNaN(hh) ? 0 : hh;
  const minute = isNaN(mm) ? 0 : mm;
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  return { hour, minute };
}

/** Pads a number to width 2 with leading zeros. */
const pad = (n: number) => n.toString().padStart(2, "0");

/** Devuelve "YYYYMMDDTHHMMSS" — formato "floating local time" para ICS. */
function toIcsDateTime(d: { y: number; m: number; d: number; h: number; min: number }) {
  return `${d.y}${pad(d.m)}${pad(d.d)}T${pad(d.h)}${pad(d.min)}00`;
}

/** Escapa caracteres reservados de iCalendar (RFC 5545 §3.3.11). */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Genera un archivo .ics (text/calendar) a partir de un evento. */
export function buildIcs(event: CalendarEvent, origin: string): string {
  const { hour, minute } = parseEventTime(event.time);
  const start = { y: event.year, m: event.month, d: event.day, h: hour, min: minute };

  const durationMin = event.duration_minutes ?? 60;
  const startMs = new Date(
    event.year, event.month - 1, event.day, hour, minute
  ).getTime();
  const endDate = new Date(startMs + durationMin * 60_000);
  const end = {
    y: endDate.getFullYear(),
    m: endDate.getMonth() + 1,
    d: endDate.getDate(),
    h: endDate.getHours(),
    min: endDate.getMinutes(),
  };

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Comunidad Bahai//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@comunidad-bahai`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsDateTime(start)}`,
    `DTEND:${toIcsDateTime(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.description
      ? `DESCRIPTION:${icsEscape(event.description)}`
      : "",
    event.location ? `LOCATION:${icsEscape(event.location)}` : "",
    `URL:${origin}/calendario/${event.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter(Boolean);

  // ICS uses CRLF as line break (RFC 5545 §3.1).
  return lines.join("\r\n");
}
