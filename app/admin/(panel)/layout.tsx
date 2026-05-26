import { AdminShell } from "@/components/admin/AdminShell";
import { ChatNotifier } from "@/components/ChatNotifier";
import { requireAdmin } from "@/lib/auth";
import { consumeFlashToast } from "@/lib/toast";

export const revalidate = 60;

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const toast = consumeFlashToast();
  return (
    <AdminShell
      profile={session.profile}
      locality={session.locality}
      toast={toast}
    >
      {/* Aviso de chat para la Secretaría (solo con tag de chat). */}
      {session.profile.can_respond_chat && (
        <ChatNotifier userId={session.user.id} side="admin" />
      )}
      {children}
    </AdminShell>
  );
}
