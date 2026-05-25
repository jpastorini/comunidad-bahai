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
  return (
    <div id="app-shell">
      {children}
      <TabBar chatHasUnseen={badges.chat_has_unseen} />
    </div>
  );
}
