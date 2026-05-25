import { TabBar } from "@/components/TabBar";
import { requireMember } from "@/lib/auth";
import { getBadges } from "@/lib/data";

// Toda la app de miembros requiere login + localidad elegida.
// `requireMember` redirige a /login o /seleccionar-localidad si falta.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMember("/");
  const badges = await getBadges(session.user.id);
  // El hub AEL agrupa Chat y Comunicados: su pestaña avisa si cualquiera
  // de los dos tiene novedades sin leer.
  const aelHasUnseen =
    badges.chat_has_unseen || badges.comunicados_has_unseen;
  return (
    <div id="app-shell">
      {children}
      <TabBar aelHasUnseen={aelHasUnseen} />
    </div>
  );
}
