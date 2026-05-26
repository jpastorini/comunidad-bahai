import { AdminShell } from "@/components/admin/AdminShell";
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
      {children}
    </AdminShell>
  );
}
