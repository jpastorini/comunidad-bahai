import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { EventPhoto } from "@/lib/types";
import { AvatarEditor } from "./avatar-editor";
import { MyPhotosSection } from "./my-photos";
import { NameForm } from "./name-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireMember("/perfil");
  const supabase = createSupabaseServer();

  // Avatar de Google (de la metadata de auth.users), por si el usuario
  // quiere volver a la foto de Google después de subir una manual.
  const { data: userResp } = await supabase.auth.getUser();
  const meta = (userResp.user?.user_metadata ?? {}) as Record<string, unknown>;
  const googleAvatar =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  // Fotos que subió el usuario, con join al evento para mostrar a qué
  // pertenecen.
  const { data: photoRows } = await supabase
    .from("event_photos")
    .select("*")
    .eq("uploader_user_id", session.user.id)
    .order("created_at", { ascending: false });
  const myPhotos = (photoRows ?? []) as EventPhoto[];

  // Resolver nombres de eventos en una sola query por tipo.
  const calendarIds = Array.from(
    new Set(myPhotos.filter((p) => p.event_type === "calendar").map((p) => p.event_id))
  );
  const feastIds = Array.from(
    new Set(myPhotos.filter((p) => p.event_type === "feast").map((p) => p.event_id))
  );

  const [calendarRows, feastRows] = await Promise.all([
    calendarIds.length > 0
      ? supabase
          .from("calendar_events")
          .select("id, title")
          .in("id", calendarIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    feastIds.length > 0
      ? supabase
          .from("feasts")
          .select("id, bahai_month_name")
          .in("id", feastIds)
      : Promise.resolve({
          data: [] as { id: string; bahai_month_name: string }[],
        }),
  ]);

  const eventTitles = new Map<string, string>();
  for (const r of (calendarRows.data ?? []) as {
    id: string;
    title: string;
  }[]) {
    eventTitles.set(`calendar:${r.id}`, r.title);
  }
  for (const r of (feastRows.data ?? []) as {
    id: string;
    bahai_month_name: string;
  }[]) {
    eventTitles.set(`feast:${r.id}`, `Fiesta de ${r.bahai_month_name}`);
  }

  const roleChips = buildRoleChips(session.profile);

  return (
    <>
      <GoldHeader title="Mi perfil" subtitle={session.locality.name} backHref="/" />
      <main className="scroll-area flex-1 px-4 pb-6 pt-4">
        {/* Avatar + nombre */}
        <div className="mb-5 rounded-2xl bg-card p-5 shadow-card-elevated">
          <AvatarEditor
            currentUrl={session.profile.avatar_url ?? null}
            name={session.profile.full_name}
            hasGoogleAvatar={!!googleAvatar}
          />
          <div className="mt-5 border-t border-black/[0.06] pt-4">
            <NameForm initialName={session.profile.full_name ?? ""} />
          </div>
        </div>

        {/* Datos de cuenta */}
        <div className="mb-5 rounded-2xl bg-card p-4 shadow-card-soft">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Cuenta
          </h3>
          <div className="space-y-3">
            <Field label="Correo electrónico" value={session.user.email} />
            <Field
              label="Localidad"
              value={session.locality.name}
              extra={
                session.locality.city
                  ? `${session.locality.city} · ${session.locality.country}`
                  : session.locality.country
              }
              action={
                <Link
                  href="/seleccionar-localidad?error=missing"
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Cambiar
                </Link>
              }
            />
            {roleChips.length > 0 && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted">
                  Roles
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {roleChips.map((c) => (
                    <span
                      key={c.label}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.className}`}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Field
              label="Miembro desde"
              value={new Date(session.profile.created_at).toLocaleDateString(
                "es-MX",
                { year: "numeric", month: "long" }
              )}
            />
          </div>
        </div>

        {/* Mis fotos */}
        <MyPhotosSection
          photos={myPhotos}
          eventTitles={eventTitles}
          currentUserId={session.user.id}
          isAdmin={session.profile.role === "admin"}
          adminLocalityId={session.locality.id}
        />

        {/* Cerrar sesión */}
        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="tap w-full rounded-xl border border-black/10 bg-card px-4 py-3 text-[13px] font-semibold text-rose-600 shadow-card-soft hover:bg-rose-50"
          >
            Cerrar sesión
          </button>
        </form>
      </main>
    </>
  );
}

function Field({
  label,
  value,
  extra,
  action,
}: {
  label: string;
  value: string | null | undefined;
  extra?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-wide text-muted">
          {label}
        </div>
        <div className="truncate text-[13.5px] text-dark">
          {value || "—"}
        </div>
        {extra && (
          <div className="text-[10.5px] text-muted">{extra}</div>
        )}
      </div>
      {action}
    </div>
  );
}

function buildRoleChips(
  profile: Awaited<ReturnType<typeof requireMember>>["profile"]
) {
  const chips: { label: string; className: string }[] = [];
  if (profile.is_national_admin) {
    chips.push({
      label: "Nacional",
      className: "bg-gold/15 text-gold-dark",
    });
  }
  if (profile.role === "admin") {
    chips.push({
      label: "Admin",
      className: "bg-terra/15 text-terra",
    });
  }
  if (profile.can_respond_chat) {
    chips.push({
      label: "Chat",
      className: "bg-amber/15 text-amber",
    });
  }
  if (profile.can_manage_treasury) {
    chips.push({
      label: "Tesorería",
      className: "bg-[#C4A235]/15 text-gold-dark",
    });
  }
  return chips;
}
