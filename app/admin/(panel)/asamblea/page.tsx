import Link from "next/link";
import {
  Banner,
  Button,
  Card,
  Field,
  PageHeader,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { currentAssemblyYear, getAssemblyData } from "@/lib/assembly";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ASSEMBLY_SIZE, ASSEMBLY_OFFICE_LABELS } from "@/lib/types";
import { removeStatutesAction, saveAssemblyRecordAction } from "./actions";
import { ConfirmSubmit } from "../miembros/confirm-submit";
import { MembersEditor, type EditorRow, type PickableProfile } from "./members-editor";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "member" | "admin";
  can_manage_treasury: boolean;
  can_respond_chat: boolean;
};

/**
 * Datos de la Asamblea (052): la ficha legal, los estatutos y quiénes
 * integran la Asamblea en cada ejercicio. Solo la Asamblea (rol admin)
 * la ve; la RLS lo garantiza.
 */
export default async function AdminAsambleaPage({
  searchParams,
}: {
  searchParams: { ejercicio?: string };
}) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const current = currentAssemblyYear();
  const requested = parseInt(searchParams.ejercicio ?? "", 10);
  const year = Number.isFinite(requested) && requested >= 100 && requested <= 400 ? requested : current;

  const [data, { data: profileRows }] = await Promise.all([
    getAssemblyData(supabase, localityId, year),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, can_manage_treasury, can_respond_chat")
      .eq("locality_id", localityId)
      .is("disabled_at", null)
      .order("role", { ascending: false })
      .order("full_name", { ascending: true }),
  ]);

  const profiles: PickableProfile[] = ((profileRows ?? []) as ProfileRow[]).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || p.email || "Sin nombre",
    role: p.role,
    can_manage_treasury: p.can_manage_treasury,
    can_respond_chat: p.can_respond_chat,
  }));
  const profileIds = new Set(profiles.map((p) => p.id));

  // La lista inicial del editor: lo cargado; si no hay nada, la del
  // ejercicio anterior (la Asamblea suele repetirse en buena parte); y
  // si tampoco, quienes hoy tienen rol de Asamblea en la app.
  let initial: EditorRow[] = [];
  let prefillNote: string | null = null;
  const toRows = (members: { profile_id: string | null; display_name: string; office: string | null }[]) =>
    members.map((m) => ({
      profile: m.profile_id && profileIds.has(m.profile_id) ? m.profile_id : "otro",
      name: m.profile_id && profileIds.has(m.profile_id) ? "" : m.display_name,
      office: (m.office ?? "") as EditorRow["office"],
    }));

  if (data.term && data.term.members.length > 0) {
    // Respetar la posición guardada.
    initial = Array.from({ length: ASSEMBLY_SIZE }, () => ({ profile: "", name: "", office: "" }));
    for (const m of data.term.members) {
      initial[m.position - 1] = toRows([m])[0];
    }
  } else if (data.previousTerm && data.previousTerm.members.length > 0) {
    initial = toRows(data.previousTerm.members);
    prefillNote = `Pre-cargada con la composición del ejercicio ${data.previousTerm.bahai_year}.`;
  } else {
    initial = profiles
      .filter((p) => p.role === "admin")
      .slice(0, ASSEMBLY_SIZE)
      .map((p) => ({ profile: p.id, name: "", office: "" }));
    if (initial.length > 0) {
      prefillNote = "Pre-cargada con quienes hoy tienen rol de Asamblea en la app.";
    }
  }

  const yearOptions = Array.from(new Set([current, ...data.years, year])).sort((a, b) => b - a);
  const record = data.record;
  const officers = data.term?.members.filter((m) => m.office) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Asamblea"
        title="Datos de la Asamblea"
        description="La ficha legal, los estatutos y quiénes integran la Asamblea en cada ejercicio. Lo ve solo la Asamblea."
      />

      {!data.ready && (
        <div className="mb-5">
          <Banner tone="warning">
            Falta aplicar la migración <code>052_datos_asamblea.sql</code> en Supabase. Hasta
            entonces esta pantalla no puede guardar nada.
          </Banner>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        {/* ─── Ficha legal ─── */}
        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="font-display text-[18px] font-semibold text-dark">Ficha legal</h2>
            <p className="mb-4 mt-1 text-[12px] text-muted">
              Lo que piden en un trámite: BPS, DGI, un banco, una nota a otra institución.
            </p>
            <form action={saveAssemblyRecordAction} className="flex flex-col gap-4">
              <Field label="Nombre registrado" name="registered_name" hint="Tal como figura en el registro.">
                <TextInput
                  id="registered_name"
                  name="registered_name"
                  defaultValue={record?.registered_name ?? ""}
                  placeholder="Asamblea Espiritual Local de los Bahá'ís de …"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="RUT (DGI)" name="rut">
                  <TextInput id="rut" name="rut" defaultValue={record?.rut ?? ""} inputMode="numeric" />
                </Field>
                <Field label="N.º de empresa (BPS)" name="bps_number">
                  <TextInput
                    id="bps_number"
                    name="bps_number"
                    defaultValue={record?.bps_number ?? ""}
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <Field label="Fecha de registro" name="registered_at">
                <TextInput
                  id="registered_at"
                  name="registered_at"
                  type="date"
                  defaultValue={record?.registered_at ?? ""}
                />
              </Field>
              <Field
                label="Estatutos (PDF)"
                name="statutes"
                hint={record?.statutes_path ? "Subir otro reemplaza al actual." : "Hasta 15 MB."}
              >
                <input
                  id="statutes"
                  name="statutes"
                  type="file"
                  accept="application/pdf"
                  className="block w-full text-[13px] text-dark file:mr-3 file:rounded-lg file:border-0 file:bg-terra/10 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-terra"
                />
              </Field>
              <Field
                label="Notas"
                name="notes"
                hint="Personería jurídica, domicilio fiscal, contador, lo que haga falta."
              >
                <TextArea id="notes" name="notes" rows={4} defaultValue={record?.notes ?? ""} />
              </Field>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted">
                  {record ? `Actualizado ${formatDateTime(record.updated_at)}` : "Todavía sin datos."}
                </span>
                <Button type="submit" disabled={!data.ready}>
                  Guardar ficha
                </Button>
              </div>
            </form>
          </Card>

          {record?.statutes_path && (
            <Card>
              <h2 className="font-display text-[16px] font-semibold text-dark">Estatutos cargados</h2>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-[13px]">
                  <div className="truncate font-semibold text-dark">
                    {record.statutes_file_name ?? "estatutos.pdf"}
                  </div>
                  {record.statutes_uploaded_at && (
                    <div className="text-[11px] text-muted">
                      Subido el {formatDate(record.statutes_uploaded_at)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {data.statutesUrl && (
                    <a
                      href={data.statutesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-card px-4 py-2.5 text-[13px] font-semibold text-dark transition hover:bg-bg"
                    >
                      Abrir PDF
                    </a>
                  )}
                  <form action={removeStatutesAction}>
                    <ConfirmSubmit
                      message="¿Quitar el PDF de los estatutos? Se puede volver a subir."
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Quitar
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ─── Composición ─── */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[18px] font-semibold text-dark">
                Composición · ejercicio {year}
              </h2>
              <p className="mt-1 text-[12px] text-muted">
                Los nueve miembros y los cuatro oficiales, de Riḍván a Riḍván.
                {year === current ? " Es el ejercicio en curso." : ""}
              </p>
            </div>
            <nav className="flex flex-wrap gap-1.5" aria-label="Ejercicio">
              {yearOptions.map((y) => (
                <Link
                  key={y}
                  href={y === current ? "/admin/asamblea" : `/admin/asamblea?ejercicio=${y}`}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                    y === year
                      ? "bg-terra text-white"
                      : "border border-black/10 bg-card text-dark hover:bg-bg"
                  }`}
                >
                  {y}
                </Link>
              ))}
              {!yearOptions.includes(current + 1) && (
                <Link
                  href={`/admin/asamblea?ejercicio=${current + 1}`}
                  className="rounded-full border border-dashed border-black/15 px-3 py-1 text-[12px] font-semibold text-muted hover:text-terra"
                  title="Cargar la Asamblea del próximo ejercicio antes de Riḍván"
                >
                  + {current + 1}
                </Link>
              )}
            </nav>
          </div>

          {officers.length > 0 && (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {officers
                .sort((a, b) => a.position - b.position)
                .map((m) => (
                  <div key={m.id} className="rounded-xl bg-terra/[0.05] px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
                      {m.office ? ASSEMBLY_OFFICE_LABELS[m.office] : ""}
                    </dt>
                    <dd className="text-[14px] font-semibold text-dark">{m.display_name}</dd>
                  </div>
                ))}
            </dl>
          )}

          <div className="mt-5 border-t border-black/[0.06] pt-5">
            <MembersEditor
              key={year}
              year={year}
              electedOn={data.term?.elected_on ?? ""}
              notes={data.term?.notes ?? ""}
              profiles={profiles}
              initial={initial}
              prefillNote={data.ready ? prefillNote : null}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
