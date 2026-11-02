import { LEGAL } from "./legal";

/** Dominios viejos de la app: un link armado desde ahí sale con el nuevo. */
const OLD_HOSTS = new Set(["mvdbahai.vercel.app"]);

/**
 * El origen con que se arma un link para compartir (invitación, QR,
 * boletín, informe). Es `window.location.origin` —así una vista previa o
 * localhost comparten lo suyo—, salvo desde un dominio viejo: quien sigue
 * con la PWA o una pestaña en `mvdbahai.vercel.app` repartiría links al
 * dominio anterior. Solo en el navegador.
 */
export function shareOrigin(): string {
  const { hostname, origin } = window.location;
  return OLD_HOSTS.has(hostname) ? LEGAL.appUrl : origin;
}
