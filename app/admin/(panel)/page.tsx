import Link from "next/link";
import { Banner, Card, PageHeader } from "@/components/admin/ui";
import {
  IconActividades,
  IconArrowRight,
  IconCalendario,
  IconChat,
  IconMateriales,
  IconMensajes,
  IconServicio,
  IconTesoreria,
} from "@/components/Icons";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

type Stat = {
  href: string;
  label: string;
  hint: string;
  count: number | string;
  Icon: typeof IconMensajes;
  color: string;
  requires?: "chat" | "treasury";
};

const COLOR_TERRA = "#2A3F8F";
const COLOR_AMBER = "#7E44B8";
const COLOR_GREEN = "#6A8B5F";
const COLOR_GOLD = "#96790E";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const [messages, comunicados, activities, calendar, materials, needs, members] =
    await Promise.all([
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("source", "casa_universal"),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("source", "asamblea_local"),
      supabase.from("activities").select("*", { count: "exact", head: true }),
      supabase.from("calendar_events").select("*", { count: "exact", head: true }),
      supabase.from("study_materials").select("*", { count: "exact", head: true }),
      supabase.from("service_needs").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);

  // Cuenta solo mensajes enviados POR miembros (no las propias respuestas
  // de Secretaría) que todavía estén sin leer.
  const chatUnread = session.profile.can_respond_chat
    ? await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .eq("is_admin_reply", false)
    : { count: 0 };

  const stats: Stat[] = [
    {
      href: "/admin/mensajes",
      label: "Mensajes",
      hint: "Casa Universal",
      count: messages.count ?? 0,
      Icon: IconMensajes,
      color: COLOR_TERRA,
    },
    {
      href: "/admin/actividades",
      label: "Actividades",
      hint: "Próximas + pasadas",
      count: activities.count ?? 0,
      Icon: IconActividades,
      color: COLOR_AMBER,
    },
    {
      href: "/admin/calendario",
      label: "Eventos calendario",
      hint: "Vinculados a actividades",
      count: calendar.count ?? 0,
      Icon: IconCalendario,
      color: COLOR_GREEN,
    },
    {
      href: "/admin/comunicados",
      label: "Comunicados",
      hint: "Asamblea Local",
      count: comunicados.count ?? 0,
      Icon: IconMensajes,
      color: COLOR_AMBER,
    },
    {
      href: "/admin/materiales",
      label: "Materiales",
      hint: "Ruhí + escritos",
      count: materials.count ?? 0,
      Icon: IconMateriales,
      color: COLOR_TERRA,
    },
    {
      href: "/admin/servicio",
      label: "Necesidades",
      hint: "De servicio",
      count: needs.count ?? 0,
      Icon: IconServicio,
      color: COLOR_GREEN,
    },
    {
      href: "/admin/chat",
      label: "Chat sin leer",
      hint: "Mensajes pendientes",
      count: chatUnread.count ?? 0,
      Icon: IconChat,
      color: COLOR_GOLD,
      requires: "chat",
    },
    {
      href: "/admin/miembros",
      label: "Miembros",
      hint: "Comunidad",
      count: members.count ?? 0,
      Icon: IconActividades,
      color: COLOR_TERRA,
    },
  ];

  const tagError = searchParams.error;
  const visibleStats = stats.filter((s) => {
    if (s.requires === "chat") return session.profile.can_respond_chat;
    if (s.requires === "treasury") return session.profile.can_manage_treasury;
    return true;
  });

  return (
    <>
      <PageHeader
        eyebrow="Panel"
        title={`Hola, ${(session.profile.full_name?.split(" ")[0] ?? "miembro").trim()}`}
        description="Gestiona los contenidos de la Comunidad Bahá'í desde un solo lugar."
      />

      {tagError === "no-chat-tag" && (
        <div className="mb-4">
          <Banner tone="warning">
            No tienes el permiso de chat. Pide a otro admin que active{" "}
            <code className="rounded bg-amber-100 px-1">can_respond_chat</code> en tu perfil.
          </Banner>
        </div>
      )}
      {tagError === "no-treasury-tag" && (
        <div className="mb-4">
          <Banner tone="warning">
            No tienes el permiso de tesorería. Pide a otro admin que active{" "}
            <code className="rounded bg-amber-100 px-1">can_manage_treasury</code>.
          </Banner>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {visibleStats.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="tap group flex flex-col gap-4 rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-elevated"
          >
            <div className="flex items-start justify-between">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${s.color}12`, color: s.color }}
              >
                <s.Icon size={20} />
              </div>
              <span className="font-display text-[32px] font-bold leading-none text-dark">
                {s.count}
              </span>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-dark">{s.label}</div>
              <div className="text-[11.5px] text-muted">{s.hint}</div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-terra opacity-0 transition group-hover:opacity-100">
              Gestionar <IconArrowRight size={11} />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
            Tus permisos
          </h2>
          <p className="text-[12px] text-muted">
            Algunas secciones requieren etiquetas específicas.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-[13px]">
            <li className="flex items-center justify-between">
              <span>Rol</span>
              <span className="rounded bg-terra/10 px-2 py-0.5 text-[11px] font-bold uppercase text-terra">
                {session.profile.role}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Chat con Secretaría</span>
              <PermissionBadge enabled={session.profile.can_respond_chat} />
            </li>
            <li className="flex items-center justify-between">
              <span>Gestión de Tesorería</span>
              <PermissionBadge enabled={session.profile.can_manage_treasury} />
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
            Atajos
          </h2>
          <p className="text-[12px] text-muted">
            Acciones rápidas para la Secretaría.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-[13px]">
            <li>
              <Link
                href="/admin/comunicados/nuevo"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-dark hover:bg-bg"
              >
                <span>Publicar comunicado de la Asamblea Local</span>
                <IconArrowRight size={12} className="text-muted" />
              </Link>
            </li>
            <li>
              <Link
                href="/admin/mensajes/nuevo"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-dark hover:bg-bg"
              >
                <span>Subir mensaje de la Casa Universal (PDF)</span>
                <IconArrowRight size={12} className="text-muted" />
              </Link>
            </li>
            <li>
              <Link
                href="/admin/actividades/nueva"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-dark hover:bg-bg"
              >
                <span>Programar nueva actividad</span>
                <IconArrowRight size={12} className="text-muted" />
              </Link>
            </li>
            <li>
              <Link
                href="/admin/servicio/nueva"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-dark hover:bg-bg"
              >
                <span>Publicar necesidad de servicio</span>
                <IconArrowRight size={12} className="text-muted" />
              </Link>
            </li>
            <li>
              <Link
                href="/admin/miembros"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-dark hover:bg-bg"
              >
                <span>Asignar roles y permisos</span>
                <IconArrowRight size={12} className="text-muted" />
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}

function PermissionBadge({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="rounded bg-terra/10 px-2 py-0.5 text-[11px] font-bold uppercase text-terra">
        Activo
      </span>
    );
  }
  return (
    <span className="rounded bg-bg px-2 py-0.5 text-[11px] font-bold uppercase text-muted">
      Sin permiso
    </span>
  );
}
