/**
 * "Recordar por WhatsApp" y "Agradecer por WhatsApp" del informe de
 * compromisos (077). Para quien no usa la app el push del 10 no existe:
 * lo más que la app puede hacer es dejarle al tesorero el mensaje escrito,
 * con la misma cita del mes que recibe por push quien sí la tiene.
 *
 * Puro, sin server-only: el link lo arma la página y el número lo muestra
 * el formulario.
 */

/**
 * El número en el formato que pide wa.me: solo dígitos, con código de
 * país. Lo que se escribe en Uruguay es "099 123 456" (9 dígitos con el 0)
 * o "99 123 456": se le pone el 598 y se le saca el 0. Un número que ya
 * trae código ("+54 9 11…", "598…") pasa tal cual. Null si no parece un
 * teléfono.
 */
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.trim().startsWith("+") || digits.startsWith("00")) {
    const d = digits.replace(/^00/, "");
    return d.length >= 8 ? d : null;
  }
  if (/^09\d{7}$/.test(digits)) return `598${digits.slice(1)}`;
  if (/^9\d{7}$/.test(digits)) return `598${digits}`;
  if (/^598\d{8}$/.test(digits)) return digits;
  // Un fijo de Montevideo (2xxx xxxx) no tiene WhatsApp casi nunca, pero
  // si lo tiene, así es su número.
  if (/^[24]\d{7}$/.test(digits)) return `598${digits}`;
  return digits.length >= 10 ? digits : null;
}

/** El primer nombre, para un saludo que no suene a planilla. Con
 *  "Familia Pérez" queda entero. */
function greetingName(name: string): string {
  const n = name.trim();
  if (/^(familia|flia\.?|sr\.?|sra\.?)\s/i.test(n)) return n;
  return n.split(/\s+/)[0] ?? n;
}

export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const n = whatsappNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** El texto del recordatorio: el mismo del push del 10, sin montos ni
 *  deudas —es un recordatorio con una cita, no un estado de cuenta—. */
export function reminderText(name: string, quote: string): string {
  return [
    `¡Hola, ${greetingName(name)}! Con afecto te recordamos tu aporte de este mes al Fondo.`,
    quote,
    "Gracias por tu generosidad.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function thanksText(name: string, monthLabel: string): string {
  return `¡Hola, ${greetingName(name)}! Recibimos tu aporte de ${monthLabel.toLowerCase()} al Fondo. Muchas gracias por tu compromiso y tu generosidad.`;
}
