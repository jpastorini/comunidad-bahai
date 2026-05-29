import Link from "next/link";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const revalidate = 60;

export default async function AdminNacionalPage() {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();

  const [localities, profiles] = await Promise.all([
    supabase.from("localities").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin Nacional"
        title="Panel Nacional"
        description="Gestión de localidades y asignación de admins a nivel nacional. Los datos operativos de cada comunidad los maneja su propio admin local."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/nacional/localidades"
          className="tap group rounded-2xl border border-black/[0.04] bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-elevated"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
            Localidades
          </div>
          <div className="mt-1 font-display text-[36px] font-bold leading-none text-dark">
            {localities.count ?? 0}
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Crear, editar y desactivar Comunidades Bahá'ís.
          </p>
        </Link>

        <Link
          href="/admin/nacional/miembros"
          className="tap group rounded-2xl border border-black/[0.04] bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-elevated"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
            Miembros registrados
          </div>
          <div className="mt-1 font-display text-[36px] font-bold leading-none text-dark">
            {profiles.count ?? 0}
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Asignar localidad, promover a admin local y a admin nacional.
          </p>
        </Link>
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-[18px] font-semibold text-dark">
          Sobre tu rol
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Como Admin Nacional puedes:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-dark">
          <li>Crear nuevas localidades (Comunidades Bahá'ís)</li>
          <li>Asignar la localidad de cada usuario</li>
          <li>
            Promover a Usuarios de la Comunidad a Miembros de la Asamblea Local
          </li>
          <li>
            Otorgar tags especiales (Chat Secretaría, Tesorería) a Miembros de
            la Asamblea Local
          </li>
        </ul>
        <p className="mt-3 text-[12px] text-muted">
          Los datos operativos de cada comunidad (mensajes, fiestas, chat,
          tesorería) los gestiona el admin local de cada Asamblea.
        </p>
      </Card>
    </>
  );
}
