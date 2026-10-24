import Link from "next/link";
import { Banner, Button, Card, DateInput, Field, PageHeader, TextArea, TextInput } from "@/components/admin/ui";
import { UploadingForm } from "@/components/admin/UploadingForm";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { INSTITUTION_DOCS_BUCKET } from "@/lib/institution";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isStructureLocality } from "@/lib/types";
import { deleteActaAction, saveActaAction } from "./actions";

export const dynamic = "force-dynamic";

type Acta = {
  id: string;
  title: string;
  meeting_date: string | null;
  notes?: string | null;
  file_path?: string | null;
  file_name?: string | null;
};

/**
 * Las actas de las reuniones (084), de una Asamblea o de una estructura.
 * Hasta acá `assembly_actas` (031) guardaba solo título y fecha, las que
 * creaba el importador de tareas; ahora cada una puede llevar su archivo.
 * Lo ve solo quien tiene rol en esta institución: una estructura no le
 * muestra sus actas a la Asamblea, le presenta informes.
 */
export default async function ActasPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const [{ data, error }, probe] = await Promise.all([
    supabase
      .from("assembly_actas")
      .select("*")
      .eq("locality_id", session.locality.id)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("assembly_actas").select("file_path").limit(1),
  ]);
  const schemaMissing = probe.error?.code === "42703";
  if (error) console.error("[actas] listar:", error.message);
  const actas = (data ?? []) as Acta[];

  // Cuántas tareas salieron de cada acta, y las URL firmadas de una vez.
  const ids = actas.map((a) => a.id);
  const [tasksRes, signedRes] = await Promise.all([
    ids.length
      ? supabase.from("assembly_tasks").select("acta_id").in("acta_id", ids)
      : Promise.resolve({ data: [] }),
    actas.some((a) => a.file_path)
      ? supabase.storage
          .from(INSTITUTION_DOCS_BUCKET)
          .createSignedUrls(
            actas.map((a) => a.file_path).filter((p): p is string => !!p),
            3600
          )
      : Promise.resolve({ data: [] }),
  ]);
  const tasksBy = new Map<string, number>();
  for (const t of (tasksRes.data ?? []) as Array<{ acta_id: string }>) {
    tasksBy.set(t.acta_id, (tasksBy.get(t.acta_id) ?? 0) + 1);
  }
  const urlBy = new Map<string, string>();
  for (const s of (signedRes.data ?? []) as Array<{ path: string | null; signedUrl: string }>) {
    if (s.path && s.signedUrl) urlBy.set(s.path, s.signedUrl);
  }

  const structure = isStructureLocality(session.locality);

  return (
    <>
      <PageHeader
        eyebrow={structure ? "Reuniones y tareas" : "Asamblea"}
        title="Actas"
        description="Las actas de las reuniones, con su archivo. Las tareas que salen de un acta se cargan en Tareas → Importar."
        actions={
          <Button href="/admin/tareas/importar" variant="secondary">
            Importar tareas de un acta
          </Button>
        }
      />

      {schemaMissing && (
        <div className="mb-5">
          <Banner tone="warning">
            Falta aplicar la migración 084 en la base. Hasta entonces las actas se
            listan pero no se les puede adjuntar el archivo.
          </Banner>
        </div>
      )}

      {actas.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {actas.map((a) => {
            const url = a.file_path ? urlBy.get(a.file_path) : null;
            const tasks = tasksBy.get(a.id) ?? 0;
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {a.meeting_date ? formatDate(a.meeting_date) : "Sin fecha"}
                      {tasks > 0 && (
                        <>
                          {" · "}
                          <Link href="/admin/tareas" className="text-terra hover:underline">
                            {tasks} {tasks === 1 ? "tarea" : "tareas"}
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="font-display text-[18px] font-semibold text-dark">{a.title}</div>
                    {a.notes && (
                      <p className="mt-1 whitespace-pre-line text-[13px] text-dark">{a.notes}</p>
                    )}
                  </div>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="tap shrink-0 rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
                    >
                      Abrir {a.file_name ?? "el acta"}
                    </a>
                  ) : (
                    <span className="shrink-0 text-[12px] text-muted">Sin archivo</span>
                  )}
                </div>
                <details className="mt-3 border-t border-black/[0.06] pt-3">
                  <summary className="cursor-pointer text-[12.5px] font-semibold text-muted hover:text-terra">
                    Editar o adjuntar el archivo
                  </summary>
                  <ActaForm localityId={session.locality.id} acta={a} disabled={schemaMissing} />
                  <form action={deleteActaAction} className="mt-3 flex justify-end">
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="text-[12px] font-semibold text-rose-600 hover:underline">
                      Eliminar el acta
                    </button>
                  </form>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">+ Nueva acta</h2>
        <ActaForm localityId={session.locality.id} disabled={schemaMissing} />
      </Card>
    </>
  );
}

function ActaForm({
  localityId,
  acta,
  disabled,
}: {
  localityId: string;
  acta?: Acta;
  disabled: boolean;
}) {
  return (
    <UploadingForm
      action={saveActaAction}
      localityId={localityId}
      folder="actas"
      className="mt-3 flex flex-col gap-4"
    >
      {acta && <input type="hidden" name="id" value={acta.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título" name="title" required>
          <TextInput
            name="title"
            required
            defaultValue={acta?.title ?? ""}
            placeholder="Acta de la reunión ordinaria"
          />
        </Field>
        <Field label="Fecha de la reunión" name="meeting_date">
          <DateInput name="meeting_date" defaultValue={acta?.meeting_date ?? ""} />
        </Field>
      </div>
      <Field label="Notas" name="notes">
        <TextArea name="notes" rows={2} defaultValue={acta?.notes ?? ""} />
      </Field>
      <Field
        label="Archivo del acta"
        name="file"
        hint={
          acta?.file_name
            ? `Tiene «${acta.file_name}». Subir otro lo reemplaza. Hasta 20 MB.`
            : "PDF, Word o fotos del acta firmada. Hasta 20 MB."
        }
      >
        <input
          type="file"
          name="file"
          disabled={disabled}
          className="block w-full text-[13px] text-dark file:mr-3 file:rounded-lg file:border-0 file:bg-terra/10 file:px-3 file:py-2 file:text-[12.5px] file:font-semibold file:text-terra"
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit">{acta ? "Guardar cambios" : "Guardar acta"}</Button>
      </div>
    </UploadingForm>
  );
}
