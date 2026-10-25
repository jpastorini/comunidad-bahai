import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { helperAllowsPath, helperHome, structureAllowsPath } from "@/lib/admin-nav";
import { hasPermission, isHelper } from "@/lib/delegations";
import { isStructureLocality } from "@/lib/types";
import { ChatNotifier } from "@/components/ChatNotifier";
import { requirePanelAccess } from "@/lib/auth";
import { getMyMemberships } from "@/lib/memberships";
import { consumeFlashToast } from "@/lib/toast";
import type { ChatTopic } from "@/lib/types";

export const revalidate = 60;

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La Asamblea o un ayudante (088). Cada página del panel sigue
  // auto-protegida (requireAdmin / requirePermission), así que esto solo
  // abre el shell, no las secciones.
  const session = await requirePanelAccess();

  // Un ayudante ve solo sus secciones, y el Inicio del panel (un tablero
  // de la Asamblea) lo manda a la primera.
  if (isHelper(session.profile)) {
    const path = headers().get("x-pathname");
    if (path && !helperAllowsPath(session.profile, path, session.locality.kind)) {
      redirect(helperHome(session.profile, session.locality.kind) ?? "/");
    }
  }

  // Una estructura (082) ve solo lo de su menú; lo demás del panel habla
  // de creyentes que no tiene. El middleware deja la ruta en x-pathname.
  if (isStructureLocality(session.locality)) {
    const path = headers().get("x-pathname");
    if (path && !structureAllowsPath(session.profile, path)) redirect("/admin");
  }

  const toast = consumeFlashToast();

  // Comunidades entre las que puede cambiar DESDE EL PANEL: solo donde
  // tiene rol de Asamblea. Si el selector ofreciera una donde es creyente
  // común, el middleware la echaría del panel apenas cambie.
  // Una estructura desactivada ya no se ofrece, salvo la que está puesta.
  const memberships = (
    await getMyMemberships(session.user.id, session.locality.id)
  ).filter((m) => m.role === "admin" && (m.enabled || m.isActive));

  const chatTopics: ChatTopic[] = [];
  if (hasPermission(session.profile, "secretaria")) chatTopics.push("secretaria");
  if (session.profile.can_manage_treasury) chatTopics.push("tesoreria");

  return (
    <AdminShell
      profile={session.profile}
      locality={session.locality}
      memberships={memberships}
      toast={toast}
    >
      {/* Aviso de chat de los canales que atiende: Secretaría con el tag de
          chat, Tesorería con el de tesorería. */}
      {chatTopics.length > 0 && (
        <ChatNotifier
          userId={session.user.id}
          side="admin"
          topics={chatTopics}
        />
      )}
      {children}
    </AdminShell>
  );
}
