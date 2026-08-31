/**
 * Botón Volver dinámico de /citas: a la pantalla se llega desde Inicio
 * (tarjeta Lectura de hoy, push) o desde la Biblioteca, y la flecha tiene
 * que devolver a quien vino, no siempre a Inicio.
 *
 * El query param `volver` lleva una CLAVE de esta whitelist, nunca una URL:
 * así un link armado a mano no puede apuntar el Volver a cualquier lado.
 * Sin param (o con clave desconocida) cae al default, Inicio.
 */
const ORIGENES = {
  biblioteca: { href: "/materiales", label: "Biblioteca" },
} as const;

type OrigenKey = keyof typeof ORIGENES;

function origenValido(volver: string | undefined): OrigenKey | null {
  return volver && volver in ORIGENES ? (volver as OrigenKey) : null;
}

export function backTarget(volver: string | undefined): {
  href: string;
  label: string;
} {
  const key = origenValido(volver);
  return key ? ORIGENES[key] : { href: "/", label: "Inicio" };
}

/** Propaga el origen a los links internos de /citas (temas), para que el
 *  Volver de un tema no pierda el hilo. */
export function withVolver(href: string, volver: string | undefined): string {
  const key = origenValido(volver);
  return key ? `${href}?volver=${key}` : href;
}
