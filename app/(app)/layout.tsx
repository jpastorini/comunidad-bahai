import { TabBar } from "@/components/TabBar";
import { requireMember } from "@/lib/auth";

// Toda la app de miembros requiere login + localidad elegida.
// `requireMember` redirige a /login o /seleccionar-localidad si falta.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMember("/");
  return (
    <div id="app-shell">
      {children}
      <TabBar />
    </div>
  );
}
