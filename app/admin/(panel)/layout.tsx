import { AdminShell } from "@/components/admin/AdminShell";
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
  // Admin local o editor designado del Boletín. Cada página del panel
  // sigue auto-protegida (requireAdmin / ensure*Tag), así que esto solo
  // abre el shell, no las secciones.
  const session = await requirePanelAccess();
  const toast = consumeFlashToast();

  // Comunidades entre las que puede cambiar DESDE EL PANEL: solo donde
  // tiene rol de Asamblea. Si el selector ofreciera una donde es creyente
  // común, el middleware la echaría del panel apenas cambie.
  const memberships = (
    await getMyMemberships(session.user.id, session.locality.id)
  ).filter((m) => m.role === "admin");

  const chatTopics: ChatTopic[] = [];
  if (session.profile.can_respond_chat) chatTopics.push("secretaria");
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
