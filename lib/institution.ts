// El nombre de la institución que firma un documento de Tesorería.
//
// Puro y sin "server-only": lo usan el recibo y las hojas (componentes de
// cliente) y los PDF y el legajo (servidor). Antes cada documento escribía
// "Asamblea Espiritual Local de los Bahá'ís de X" a mano —doce lugares—,
// lo que en la Comunidad Nacional sin ficha legal ya era falso, y con las
// estructuras (082) lo sería en todos: un Comité no es una Asamblea.

import { receiptLocalityName } from "./treasury-format";

/**
 * Los datos de quien emite: la ficha legal de una Asamblea (054) o, para
 * una estructura, su nombre y la Asamblea de la que depende.
 */
export type InstitutionLegal = {
  registeredName: string | null;
  rut: string | null;
  address: string | null;
  /**
   * Una estructura (082): sus recibos son internos, sin RUT ni domicilio
   * fiscal (decidido con el usuario el 2026-10-24). No es la entidad
   * legal; la Asamblea de la que depende, sí.
   */
  internal?: boolean;
  /** "Asamblea Espiritual Local de los Bahá'ís de Montevideo". */
  dependsOn?: string | null;
};

type LocalityLike = {
  name: string;
  kind?: string | null;
  country?: string | null;
};

/** El nombre de una Asamblea cuando no hay ficha legal cargada. */
export function assemblyTitle(locality: LocalityLike): string {
  if (locality.kind === "nacional") {
    return `Asamblea Espiritual Nacional de los Bahá'ís del ${locality.country || "Uruguay"}`;
  }
  return `Asamblea Espiritual Local de los Bahá'ís de ${receiptLocalityName(locality.name)}`;
}

/**
 * La línea que encabeza un documento: el nombre registrado de la Asamblea,
 * o el de la estructura con la Asamblea de la que depende, o el nombre de
 * siempre si no hay ficha.
 */
export function institutionLine(
  legal: InstitutionLegal | null | undefined,
  locality: LocalityLike
): string {
  if (legal?.registeredName) {
    return legal.dependsOn
      ? `${legal.registeredName} · ${legal.dependsOn}`
      : legal.registeredName;
  }
  return assemblyTitle(locality);
}

/**
 * Quién aprueba un informe interno o un balance: la propia Asamblea (con
 * su nombre registrado si lo hay), o la Asamblea de la que depende la
 * estructura, que es a quien se le presenta.
 */
export function approverTitle(
  legal: InstitutionLegal | null | undefined,
  locality: Pick<LocalityLike, "kind">
): string {
  if (legal?.internal && legal.dependsOn) return legal.dependsOn;
  if (!legal?.internal && legal?.registeredName) return legal.registeredName;
  return locality.kind === "nacional"
    ? "Asamblea Espiritual Nacional"
    : "Asamblea Espiritual Local";
}
