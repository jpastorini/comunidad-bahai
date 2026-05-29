import {
  Banner,
  Card,
  Checkbox,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  ROLE_LABELS,
  type LocalityChangeRequest,
  type Profile,
} from "@/lib/types";
import { decideLocalityChangeAction, updateMemberAction } from "./actions";

export default async function AdminMiembrosPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const [{ data }, { data: requestRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, can_respond_chat, can_manage_treasury, locality_id, created_at"
      )
      .eq("locality_id", session.locality.id)
      .order("role", { ascending: false })
      .order("created_at", { ascending: true })
      // Desempate determinístico: sin esto, las filas con mismo rol y
      // created_at empatado pueden volver en distinto orden tras un UPDATE,
      // descoordinando los inputs no controlados (nombre) del resto.
      .order("id", { ascending: true })
      .limit(100),
    // Solicitudes de ingreso PENDIENTES hacia esta localidad.
    supabase
      .from("locality_change_requests")
      .select("*")
      .eq("to_locality_id", session.locality.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const profiles = (data ?? []) as Profile[];
  const pendingRequests = (requestRows ?? []) as LocalityChangeRequest[];

  // Resolver nombres de las localidades de origen para mostrar contexto.
  const fromIds = Array.from(
    new Set(
      pendingRequests
        .map((r) => r.from_locality_id)
        .filter((x): x is string => !!x)
    )
  );
  const fromNames = new Map<string, string>();
  if (fromIds.length > 0) {
    const { data: locs } = await supabase
      .from("localities")
      .select("id, name")
      .in("id", fromIds);
    for (const l of (locs ?? []) as { id: string; name: string }[]) {
      fromNames.set(l.id, l.name);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Comunidad"
        title="Miembros"
        description="Gestiona el rol de cada usuario y los permisos especiales."
      />

      {pendingRequests.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2.5 flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
            Solicitudes de ingreso
            <span className="rounded-full bg-terra/15 px-2 py-0.5 text-[11px] font-bold text-terra">
              {pendingRequests.length}
            </span>
          </h2>
          <p className="mb-3 text-[12px] text-muted">
            Estas personas pidieron unirse a tu comunidad desde otra localidad.
            Al aprobar, pasan a pertenecer a la tuya.
          </p>
          <div className="grid gap-3">
            {pendingRequests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                fromName={
                  r.from_locality_id
                    ? fromNames.get(r.from_locality_id) ?? "Otra localidad"
                    : "Sin localidad"
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <Banner tone="warning">
          Para invitar a una persona nueva: pídele que abra{" "}
          <code className="rounded bg-amber-100 px-1">/login</code> con su
          correo. Aparecerá aquí tras su primer ingreso (como{" "}
          <strong>{ROLE_LABELS.member}</strong>).
        </Banner>
      </div>

      <div className="grid gap-3">
        {profiles.map((p) => (
          <MemberCard
            // La key incluye los campos editables: si el server devuelve datos
            // nuevos tras guardar, la tarjeta se remonta y los inputs no
            // controlados (nombre, rol, checkboxes) reflejan el valor real.
            key={`${p.id}:${p.full_name}:${p.role}:${p.can_respond_chat}:${p.can_manage_treasury}`}
            profile={p}
            isMe={p.id === session.user.id}
          />
        ))}
      </div>
    </>
  );
}

function RequestCard({
  request,
  fromName,
}: {
  request: LocalityChangeRequest;
  fromName: string;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[16px] font-semibold text-dark">
            {request.user_name}
          </div>
          {request.user_email && (
            <div className="text-[12px] text-muted">{request.user_email}</div>
          )}
          <div className="mt-1 text-[11.5px] text-muted">
            Viene de <span className="font-semibold">{fromName}</span> ·{" "}
            {new Date(request.created_at).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <form action={decideLocalityChangeAction}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="decision" value="reject" />
            <button
              type="submit"
              className="rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50"
            >
              Rechazar
            </button>
          </form>
          <form action={decideLocalityChangeAction}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="decision" value="approve" />
            <button
              type="submit"
              className="rounded-xl bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-card-soft"
            >
              Aprobar
            </button>
          </form>
        </div>
      </div>
    </Card>
  );
}

function MemberCard({ profile, isMe }: { profile: Profile; isMe: boolean }) {
  return (
    <Card>
      <form action={updateMemberAction}>
        <input type="hidden" name="id" value={profile.id} />
        <div className="grid gap-4 md:grid-cols-[1fr,200px,auto] md:items-end">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre completo" name="full_name">
              <TextInput
                name="full_name"
                defaultValue={profile.full_name ?? ""}
                placeholder="Nombre y apellido"
              />
            </Field>
            <Field label="Correo (solo lectura)" name="email">
              <TextInput
                name="email"
                value={profile.email ?? ""}
                disabled
                className="opacity-70"
              />
            </Field>
          </div>

          <Field label="Rol" name="role">
            <Select name="role" defaultValue={profile.role} disabled={isMe}>
              <option value="member">{ROLE_LABELS.member}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </Select>
          </Field>

          <div className="flex flex-col gap-2 md:col-span-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Checkbox
                name="can_respond_chat"
                label="Puede responder al chat de Secretaría"
                defaultChecked={profile.can_respond_chat}
              />
              <Checkbox
                name="can_manage_treasury"
                label="Puede editar Tesorería"
                defaultChecked={profile.can_manage_treasury}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
              >
                Guardar {profile.full_name?.split(" ")[0] ?? "miembro"}
              </button>
            </div>
          </div>
        </div>
        {isMe && (
          <p className="mt-2 text-[11px] text-muted">
            No puedes cambiar tu propio rol; pide a otro admin que lo haga.
          </p>
        )}
      </form>
    </Card>
  );
}
