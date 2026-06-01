import { redirect } from "next/navigation";

type SearchParams = {
  error?: string;
  redirectTo?: string;
  next?: string;
};

/**
 * El login de Admin se unificó con el de la comunidad: ahora hay una sola
 * puerta de entrada (/login) y al panel se entra desde el perfil. Esta ruta
 * se conserva solo para no romper bookmarks/links viejos y reenvía a /login,
 * preservando el destino (`next`) para volver al panel tras autenticarse.
 */
export default function AdminLoginRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const next = searchParams.next ?? searchParams.redirectTo ?? "/admin";
  const params = new URLSearchParams();
  if (next.startsWith("/")) params.set("next", next);
  if (searchParams.error) params.set("error", searchParams.error);
  const qs = params.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}
