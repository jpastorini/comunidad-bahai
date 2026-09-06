import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { WelcomeWizard } from "./wizard";

// Asistente de bienvenida post-invitación: pantalla completa (fuera del
// grupo (app), sin TabBar) con pasos guiados de una sola acción cada uno.
// Pensado para usuarios mayores: tipografía grande, un botón por pantalla.
export const metadata: Metadata = {
  title: "Bienvenida — Comunidad Bahá'í",
};

export default async function BienvenidaPage() {
  const session = await requireMember("/bienvenida");
  const firstName =
    session.profile.full_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <WelcomeWizard
      firstName={firstName}
      localityName={session.locality.name}
      isBahai={session.profile.is_bahai}
    />
  );
}
