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
import type { Profile } from "@/lib/types";
import { updateMemberAction } from "./actions";

export default async function AdminMiembrosPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("role", { ascending: false })
    .order("created_at", { ascending: true });

  const profiles = (data ?? []) as Profile[];

  return (
    <>
      <PageHeader
        eyebrow="Comunidad"
        title="Miembros"
        description="Gestiona el rol de cada usuario y los permisos especiales."
      />

      <div className="mb-4">
        <Banner tone="warning">
          Para invitar a un nuevo miembro: pídele que abra{" "}
          <code className="rounded bg-amber-100 px-1">/login</code> con su
          correo. Aparecerá aquí tras su primer ingreso (como{" "}
          <code className="rounded bg-amber-100 px-1">member</code>).
        </Banner>
      </div>

      <div className="grid gap-3">
        {profiles.map((p) => (
          <MemberCard key={p.id} profile={p} isMe={p.id === session.user.id} />
        ))}
      </div>
    </>
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
              <option value="member">Miembro</option>
              <option value="admin">Admin</option>
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
