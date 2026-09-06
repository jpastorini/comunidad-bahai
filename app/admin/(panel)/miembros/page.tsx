import {
  Card,
  Checkbox,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getOrCreateLocalityInvite } from "@/lib/invites";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CONDITION_LABELS,
  ROLE_LABELS,
  type LocalityChangeRequest,
  type Profile,
} from "@/lib/types";
import {
  decideLocalityChangeAction,
  regenerateInviteAction,
  setMemberDisabledAction,
  updateMemberAction,
} from "./actions";
import { ConfirmSubmit } from "./confirm-submit";
import { InviteCard } from "./invite-card";

export default async function AdminMiembrosPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const [{ data }, { data: requestRows }, invite] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, can_respond_chat, can_manage_treasury, can_manage_bulletin, is_bahai, locality_id, disabled_at, created_at"
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
    getOrCreateLocalityInvite(session.locality.id),
  ]);

  const profiles = (data ?? []) as Profile[];
  const activeProfiles = profiles.filter((p) => !p.disabled_at);
  const disabledProfiles = profiles.filter((p) => p.disabled_at);
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
        title="Creyentes"
        description="Gestiona el rol de cada creyente y los permisos especiales."
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

      {invite && (
        <div className="mb-4 grid gap-3">
          <InviteCard
            which="creyentes"
            path={`/invitacion/${invite.token}`}
            localityName={session.locality.name}
            title="Link de invitación para creyentes"
            description={`Compartilo por WhatsApp o imprimí el QR. Quien lo abra entra con su cuenta y queda incorporado a ${session.locality.name} automáticamente, con una bienvenida guiada paso a paso.`}
            qrHint="Guardá la imagen (mantené presionado / clic derecho) para imprimirla o proyectarla en la Fiesta."
            regenerateAction={regenerateInviteAction}
          />
          {/* Segundo link (047): quien entra por acá queda como Amigo/a
              de la Fe, sin Tesorería ni Fiesta de los 19 Días. Si un
              amigo entra por el link de creyentes, se corrige en su
              ficha con el desplegable "Condición". */}
          <InviteCard
            which="amigos"
            path={`/invitacion/${invite.friendsToken}`}
            localityName={session.locality.name}
            title="Link de invitación para Amigos de la Fe"
            description={`Para quienes no son bahá'ís. Quien lo abra queda incorporado a ${session.locality.name} como Amigo/a de la Fe: ve la app entera menos la Tesorería, la Fiesta de los 19 Días y los comunicados marcados "solo creyentes".`}
            qrHint="Guardá la imagen para imprimirla o compartirla en una reunión devocional o una clase."
            regenerateAction={regenerateInviteAction}
          />
        </div>
      )}

      <div className="grid gap-3">
        {activeProfiles.map((p) => (
          <MemberCard
            // La key incluye los campos editables: si el server devuelve datos
            // nuevos tras guardar, la tarjeta se remonta y los inputs no
            // controlados (nombre, rol, checkboxes) reflejan el valor real.
            key={`${p.id}:${p.full_name}:${p.role}:${p.is_bahai}:${p.can_respond_chat}:${p.can_manage_treasury}:${p.can_manage_bulletin}`}
            profile={p}
            isMe={p.id === session.user.id}
          />
        ))}
      </div>

      {disabledProfiles.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
            Creyentes deshabilitados
            <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold text-muted">
              {disabledProfiles.length}
            </span>
          </h2>
          <p className="mb-3 text-[12px] text-muted">
            No pueden ingresar a la app. Su historial se conserva; podés
            reactivarlos cuando quieras.
          </p>
          <div className="grid gap-3">
            {disabledProfiles.map((p) => (
              <DisabledMemberCard key={`${p.id}:${p.disabled_at}`} profile={p} />
            ))}
          </div>
        </div>
      )}
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
            {formatDate(request.created_at)}
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

          <div className="grid gap-3">
            <Field label="Rol" name="role">
              <Select name="role" defaultValue={profile.role} disabled={isMe}>
                <option value="member">{ROLE_LABELS.member}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </Select>
            </Field>
            {/* Condición (047). Un Amigo/a de la Fe usa la app sin
                Tesorería ni Fiesta. Disabled en la propia ficha: el
                action lo omite del payload, igual que el rol. */}
            <Field label="Condición" name="condition">
              <Select
                name="condition"
                defaultValue={profile.is_bahai ? "bahai" : "amigo"}
                disabled={isMe}
              >
                <option value="bahai">{CONDITION_LABELS.bahai}</option>
                <option value="amigo">{CONDITION_LABELS.amigo}</option>
              </Select>
            </Field>
          </div>

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
              <Checkbox
                name="can_manage_bulletin"
                label="Puede editar el Boletín local"
                defaultChecked={profile.can_manage_bulletin}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
              >
                Guardar {profile.full_name?.split(" ")[0] ?? "creyente"}
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

      {/* Deshabilitar — form separado (no se puede anidar dentro del de
          edición). No se ofrece sobre la propia cuenta. */}
      {!isMe && (
        <form
          action={setMemberDisabledAction}
          className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3"
        >
          <input type="hidden" name="id" value={profile.id} />
          <input type="hidden" name="disable" value="1" />
          <span className="text-[11.5px] text-muted">
            Cortar el acceso de este creyente a la app.
          </span>
          <ConfirmSubmit
            message={`¿Deshabilitar a ${
              profile.full_name?.split(" ")[0] ?? "este creyente"
            }? No podrá ingresar hasta que lo reactives.`}
            className="tap shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-100"
          >
            Deshabilitar
          </ConfirmSubmit>
        </form>
      )}
    </Card>
  );
}

function DisabledMemberCard({ profile }: { profile: Profile }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[16px] font-semibold text-muted line-through decoration-muted/40">
            {profile.full_name || "Sin nombre"}
          </div>
          {profile.email && (
            <div className="text-[12px] text-muted">{profile.email}</div>
          )}
          <div className="mt-1 text-[11.5px] text-muted">
            Deshabilitado
            {profile.disabled_at
              ? ` el ${formatDate(profile.disabled_at)}`
              : ""}
          </div>
        </div>
        <form action={setMemberDisabledAction}>
          <input type="hidden" name="id" value={profile.id} />
          <input type="hidden" name="disable" value="0" />
          <button
            type="submit"
            className="tap rounded-xl bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-card-soft"
          >
            Reactivar
          </button>
        </form>
      </div>
    </Card>
  );
}
