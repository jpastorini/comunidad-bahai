import {
  Card,
  Checkbox,
  DateInput,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/admin/ui";
import {
  ContactButtons,
  contactTopics,
} from "@/components/admin/chat/ContactButtons";
import { requireAdmin } from "@/lib/auth";
import { PERMISSIONS, permissionsSentence } from "@/lib/delegations";
import { getLocalityHelpers, type HelperAssignment } from "@/lib/delegations-server";
import { formatDate } from "@/lib/format";
import { getOrCreateLocalityInvite } from "@/lib/invites";
import { getLocalityMembers, type LocalityMember } from "@/lib/memberships";
import { getEffectiveAgrupaciones, getTerritory } from "@/lib/territory";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CONDITION_LABELS,
  isNationalLocality,
  ROLE_LABELS,
  type LocalityChangeRequest,
  type Profile,
} from "@/lib/types";
import {
  decideLocalityChangeAction,
  regenerateInviteAction,
  setMemberDisabledAction,
  setHelperAction,
  setMemberAgrupacionAction,
  updateMemberAction,
} from "./actions";
import { ConfirmSubmit } from "./confirm-submit";
import { InviteCard } from "./invite-card";
import { MembersList } from "./members-list";
import { ScrollToHash } from "@/components/comunicados/ScrollToHash";

/** Cuántos días lleva la chapita "Nuevo" (mismo corte que el filtro). */
const NEW_DAYS = 30;

export default async function AdminMiembrosPage({
  searchParams,
}: {
  searchParams: { filtro?: string };
}) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const [roster, { data: requestRows }, invite] = await Promise.all([
    // Por MEMBRESÍA (056): el padrón de esta comunidad, con el rol y los
    // tags de acá. Antes preguntaba por el sombrero puesto, así que
    // quien anduviera con el de otra comunidad desaparecía de su propia
    // lista. El orden se hace acá porque la función devuelve por nombre.
    getLocalityMembers(supabase, session.locality.id),
    // Solicitudes de ingreso PENDIENTES hacia esta localidad.
    supabase
      .from("locality_change_requests")
      .select("*")
      .eq("to_locality_id", session.locality.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    getOrCreateLocalityInvite(session.locality.id),
  ]);

  // Los ayudantes de la Asamblea (088): creyentes que no la integran con
  // algunas secciones del panel encargadas.
  const helpers = await getLocalityHelpers(supabase, session.locality.id);

  // El orden, la búsqueda y los filtros los hace `MembersList` en el
  // navegador. Antes había un tope de 100: con un buscador, alguien que
  // quedara afuera del tope sería imposible de encontrar.
  const now = Date.now();
  const profiles = roster
    .map((m) => ({
      ...m,
      locality_id: session.locality.id,
    })) as unknown as Profile[];
  const activeProfiles = profiles.filter((p) => !p.disabled_at);

  // La agrupación de cada uno (086), solo en el padrón de la Comunidad
  // Nacional: es donde está la mayoría del país y donde sirve filtrar por
  // zona o agrupación. En una AEL todos son de la misma.
  const national = isNationalLocality(session.locality);
  const [territory, people] = national
    ? await Promise.all([
        getTerritory(supabase),
        getEffectiveAgrupaciones(activeProfiles.map((p) => p.id)),
      ])
    : [null, null];
  const agrById = new Map((territory?.agrupaciones ?? []).map((a) => [a.id, a]));
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
        eyebrow="Creyentes"
        title="Creyentes"
        description="Gestiona el rol de cada creyente, los permisos especiales y quiénes ayudan a la Asamblea."
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

      <ScrollToHash />
      <MembersList
        initialFilter={searchParams.filtro}
        territory={
          territory && !territory.missing
            ? { zones: territory.zones, agrupaciones: territory.agrupaciones }
            : undefined
        }
        items={activeProfiles.map((p) => {
          const m = p as unknown as LocalityMember;
          const isNew = now - new Date(m.created_at).getTime() <= NEW_DAYS * 864e5;
          return {
            id: p.id,
            name: p.full_name ?? "",
            email: p.email ?? "",
            isAdmin: p.role === "admin",
            isBahai: p.is_bahai,
            chat: p.can_respond_chat,
            treasury: p.can_manage_treasury,
            helper: (helpers.byProfile.get(p.id)?.active.length ?? 0) > 0,
            createdAt: m.created_at,
            lastSeenAt: m.last_seen_at,
            agrupacionId: people?.effective.get(p.id) ?? null,
            zoneId: agrById.get(people?.effective.get(p.id) ?? "")?.zone_id ?? null,
            card: (
              <MemberCard
                // La key incluye los campos editables: si el server devuelve
                // datos nuevos tras guardar, la tarjeta se remonta y los
                // inputs no controlados (nombre, rol, checkboxes) reflejan
                // el valor real.
                key={`${p.id}:${p.full_name}:${p.role}:${p.is_bahai}:${p.can_respond_chat}:${p.can_manage_treasury}:${people?.own.get(p.id) ?? ""}:${helpers.byProfile.get(p.id)?.perms.join(",") ?? ""}:${helpers.byProfile.get(p.id)?.until ?? ""}`}
                profile={p}
                helper={{
                  assignment: helpers.byProfile.get(p.id) ?? null,
                  missing: helpers.missing,
                  national,
                }}
                joinedAt={m.created_at}
                lastSeenAt={m.last_seen_at}
                isNew={isNew}
                agrupacion={
                  territory && people && !territory.missing
                    ? {
                        options: territory.agrupaciones,
                        own: people.own.get(p.id) ?? null,
                        effectiveName: agrById.get(people.effective.get(p.id) ?? "")?.name ?? null,
                        fromAssembly:
                          !!people.effective.get(p.id) &&
                          people.effective.get(p.id) !== people.own.get(p.id),
                      }
                    : undefined
                }
                isMe={p.id === session.user.id}
                contact={
                  <ContactButtons
                    memberId={p.id}
                    topics={contactTopics(session.profile, p, session.user.id)}
                    size="sm"
                    // A alguien que recién llegó, el primer mensaje de la
                    // Secretaría es la bienvenida (el aviso de alguien nuevo
                    // abre esta ficha con ?filtro=nuevos).
                    labels={
                      isNew ? { secretaria: "Darle la bienvenida" }
                        : undefined
                    }
                  />
                }
              />
            ),
          };
        })}
      />

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

function MemberCard({
  profile,
  isMe,
  joinedAt,
  lastSeenAt,
  isNew,
  contact,
  agrupacion,
  helper,
}: {
  profile: Profile;
  helper: { assignment: HelperAssignment | null; missing: boolean; national: boolean };
  isMe: boolean;
  contact: React.ReactNode;
  joinedAt: string;
  lastSeenAt: string | null;
  isNew: boolean;
  /** Solo en la Comunidad Nacional (086). */
  agrupacion?: {
    options: Array<{ id: string; name: string }>;
    own: string | null;
    effectiveName: string | null;
    fromAssembly: boolean;
  };
}) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
        {isNew && (
          <span className="rounded-full bg-terra/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-terra">
            Nuevo
          </span>
        )}
        <span>Se registró el {formatDate(joinedAt)}</span>
        <span aria-hidden>·</span>
        <span>
          {lastSeenAt
            ? `Última vez en la app: ${formatDate(lastSeenAt)}`
            : "Sin visitas registradas"}
        </span>
        <span className="ml-auto">{contact}</span>
      </div>
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

      {/* Ayudante de la Asamblea (088): solo para un creyente que no la
          integra. Form aparte, como el de la agrupación. */}
      {profile.role !== "admin" && profile.is_bahai && (
        <HelperForm profileId={profile.id} {...helper} />
      )}

      {/* La agrupación (086), solo en el padrón de la Comunidad Nacional:
          la mayoría del país no tiene Asamblea Local y la Asamblea
          Nacional puede cargarla o corregirla. Form aparte, como el de
          deshabilitar. */}
      {agrupacion && (
        <form
          action={setMemberAgrupacionAction}
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3"
        >
          <input type="hidden" name="id" value={profile.id} />
          <span className="text-[11.5px] text-muted">Agrupación</span>
          {agrupacion.fromAssembly ? (
            <span className="text-[12.5px] font-medium text-dark">
              {agrupacion.effectiveName}{" "}
              <span className="text-[11.5px] font-normal text-muted">(por su Asamblea Local)</span>
            </span>
          ) : (
            <>
              <select
                name="agrupacion_id"
                defaultValue={agrupacion.own ?? ""}
                aria-label="Agrupación"
                className="min-w-0 rounded-lg border border-black/10 bg-card px-2.5 py-1.5 text-[12.5px] text-dark"
              >
                <option value="">Sin agrupación</option>
                {agrupacion.options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="tap rounded-lg border border-black/10 bg-card px-3 py-1.5 text-[12px] font-semibold text-dark hover:bg-bg"
              >
                Guardar
              </button>
            </>
          )}
        </form>
      )}

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

/**
 * El nombramiento como ayudante de la Asamblea (088), plegado para no
 * alargar cada ficha: el resumen dice si lo es y de qué. Las casillas son
 * la lista entera (desmarcar saca) y el "hasta" vale para todas.
 */
function HelperForm({
  profileId,
  assignment,
  missing,
  national,
}: {
  profileId: string;
  assignment: HelperAssignment | null;
  missing: boolean;
  national: boolean;
}) {
  const active = assignment?.active ?? [];
  const expired = (assignment?.perms.length ?? 0) > 0 && active.length === 0;
  const groups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));
  return (
    <details className="group mt-3 border-t border-black/[0.06] pt-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold text-dark">Ayudante de la Asamblea</span>
        {active.length > 0 ? (
          <span className="text-muted">
            · {permissionsSentence(active)}
            {assignment?.until ? ` · hasta el ${formatDate(assignment.until)}` : ""}
          </span>
        ) : expired ? (
          <span className="text-amber">· venció el {formatDate(assignment?.until ?? "")}</span>
        ) : (
          <span className="text-muted">· no</span>
        )}
        <span className="ml-auto text-[11px] font-semibold text-terra group-open:hidden">
          {active.length > 0 ? "Cambiar" : "Nombrar"}
        </span>
      </summary>
      {missing ? (
        <p className="mt-2 text-[12px] text-amber">
          Falta aplicar la migración 088 para nombrar ayudantes.
        </p>
      ) : (
        <form action={setHelperAction} className="mt-3 grid gap-3">
          <input type="hidden" name="id" value={profileId} />
          <p className="text-[11.5px] text-muted">
            Puede usar en el panel solo lo que marques, y lo que publique sale directo.
            Al nombrarlo le llega un aviso.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {groups.map((g) => (
              <div key={g} className="grid content-start gap-2">
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                  {g}
                </div>
                {PERMISSIONS.filter((p) => p.group === g && !(national && p.aelOnly)).map((p) => (
                  <Checkbox
                    key={p.key}
                    name="perm"
                    value={p.key}
                    label={p.label}
                    title={p.hint}
                    defaultChecked={assignment?.perms.includes(p.key) ?? false}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Hasta (opcional)" name="until">
              <DateInput name="until" defaultValue={assignment?.until ?? ""} />
            </Field>
            <button
              type="submit"
              className="tap ml-auto rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
            >
              Guardar
            </button>
          </div>
        </form>
      )}
    </details>
  );
}
