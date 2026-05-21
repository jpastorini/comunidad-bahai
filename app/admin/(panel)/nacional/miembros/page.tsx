import {
  Banner,
  Card,
  Checkbox,
  Field,
  PageHeader,
  Select,
} from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Locality, Profile } from "@/lib/types";
import { updateMemberLocalityAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NacionalMiembrosPage() {
  const session = await requireNationalAdmin();
  const supabase = createSupabaseServer();

  const [{ data: profilesRaw }, { data: localitiesRaw }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("is_national_admin", { ascending: false })
      .order("role", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase.from("localities").select("*").order("name"),
  ]);

  const profiles = (profilesRaw ?? []) as Profile[];
  const localities = (localitiesRaw ?? []) as Locality[];
  const localityMap = new Map(localities.map((l) => [l.id, l]));

  return (
    <>
      <PageHeader
        eyebrow="Admin Nacional"
        title="Miembros"
        description="Asigna localidad, promueve a admin local o admin nacional."
      />

      <div className="mb-4">
        <Banner tone="info">
          Cualquier persona que se registre (vía magic link) aparece acá
          automáticamente. Asígnale su localidad para que pueda usar la app.
        </Banner>
      </div>

      <div className="grid gap-3">
        {profiles.map((p) => (
          <MemberCard
            key={p.id}
            profile={p}
            localities={localities}
            currentLocality={p.locality_id ? localityMap.get(p.locality_id) : undefined}
            isMe={p.id === session.user.id}
          />
        ))}
      </div>
    </>
  );
}

function MemberCard({
  profile,
  localities,
  currentLocality,
  isMe,
}: {
  profile: Profile;
  localities: Locality[];
  currentLocality: Locality | undefined;
  isMe: boolean;
}) {
  return (
    <Card>
      <form action={updateMemberLocalityAction}>
        <input type="hidden" name="id" value={profile.id} />

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[18px] font-semibold text-dark">
              {profile.full_name || profile.email || "Sin nombre"}
            </div>
            <div className="text-[12px] text-muted">{profile.email}</div>
            <div className="mt-1 text-[11px] text-muted">
              Localidad actual:{" "}
              {currentLocality ? (
                <strong className="text-dark">{currentLocality.name}</strong>
              ) : (
                <em className="text-rose-600">sin asignar</em>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {profile.is_national_admin && (
              <span className="rounded bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-dark">
                Nacional
              </span>
            )}
            {profile.role === "admin" && (
              <span className="rounded bg-terra/15 px-2 py-0.5 text-[10px] font-bold uppercase text-terra">
                Admin local
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Localidad" name="locality_id">
            <Select name="locality_id" defaultValue={profile.locality_id ?? ""}>
              <option value="">— Sin asignar —</option>
              {localities.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {!l.is_active ? " (inactiva)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rol" name="role">
            <Select name="role" defaultValue={profile.role} disabled={isMe}>
              <option value="member">Miembro</option>
              <option value="admin">Admin local</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Checkbox
            name="is_national_admin"
            label="Admin Nacional"
            defaultChecked={profile.is_national_admin}
            disabled={isMe}
          />
          <Checkbox
            name="can_respond_chat"
            label="Chat Secretaría"
            defaultChecked={profile.can_respond_chat}
          />
          <Checkbox
            name="can_manage_treasury"
            label="Tesorería"
            defaultChecked={profile.can_manage_treasury}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
          >
            Guardar
          </button>
        </div>

        {isMe && (
          <p className="mt-2 text-[11px] text-muted">
            No puedes cambiar tu propio rol o flag de Nacional. Pide a otro
            admin nacional que lo haga.
          </p>
        )}
      </form>
    </Card>
  );
}
