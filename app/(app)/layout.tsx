import { ChatNotifier } from "@/components/ChatNotifier";
import { DayChangeRefresh } from "@/components/DayChangeRefresh";
import { HeaderUserProvider } from "@/components/HeaderUser";
import { InstallSheet } from "@/components/InstallSheet";
import { PhotoFab } from "@/components/PhotoFab";
import { TabBar } from "@/components/TabBar";
import { requireMember } from "@/lib/auth";
import { civilDateISO, getAppTimeZone } from "@/lib/citas";
import { getBadges } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

// Revalida cada 60s; se invalida al instante cuando el admin publica
// contenido (los server actions ya llaman revalidatePath).
export const revalidate = 60;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMember("/");
  const [badges, unreadNotifs] = await Promise.all([
    getBadges(session.user.id),
    getUnreadNotificationCount(session.user.id),
  ]);
  // El hub AEL agrupa Chat y Comunicados: su pestaña avisa si cualquiera
  // de los dos tiene novedades sin leer.
  const aelHasUnseen =
    badges.chat_has_unseen || badges.comunicados_has_unseen;
  return (
    <div id="app-shell">
      <ChatNotifier userId={session.user.id} side="member" />
      <DayChangeRefresh
        renderedDate={civilDateISO()}
        timeZone={getAppTimeZone()}
      />
      {/* El menú de perfil va en el header de todas las pantallas; el dato
          lo resuelve el layout una vez y lo consume GoldHeader. */}
      <HeaderUserProvider
        value={{
          avatarUrl: session.profile.avatar_url,
          fullName: session.profile.full_name,
          unreadCount: unreadNotifs,
          isBahai: session.profile.is_bahai,
        }}
      >
        {children}
      </HeaderUserProvider>
      <PhotoFab />
      {/* Hoja de instalación: solo en celular, sin la app instalada. */}
      <InstallSheet />
      <TabBar aelHasUnseen={aelHasUnseen} />
    </div>
  );
}
