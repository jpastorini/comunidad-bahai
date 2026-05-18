import {
  Button,
  Card,
  Checkbox,
  Field,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { upsertComunicadoAction } from "./actions";
import type { Message } from "@/lib/types";

type Props = {
  comunicado?: Message;
};

export function ComunicadoForm({ comunicado }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={upsertComunicadoAction} encType="multipart/form-data">
      {comunicado && <input type="hidden" name="id" value={comunicado.id} />}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fecha de creado" name="date" required>
            <TextInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={comunicado?.date ?? today}
            />
          </Field>
          <div className="flex items-end">
            <Checkbox
              name="is_new"
              label='Marcar como "Nuevo" (badge en la app)'
              defaultChecked={comunicado?.is_new ?? false}
            />
          </div>
        </div>

        <div className="mt-4">
          <Field label="Título" name="title" required>
            <TextInput
              id="title"
              name="title"
              required
              defaultValue={comunicado?.title ?? ""}
              placeholder="Convocatoria a la Fiesta de 19 días"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Asunto"
            name="subject"
            hint="Una línea corta — aparece bajo el título"
          >
            <TextInput
              id="subject"
              name="subject"
              defaultValue={comunicado?.subject ?? ""}
              placeholder="Fiesta del mes de Núr — Asamblea Local"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Resumen"
            name="excerpt"
            hint="Opcional — si lo dejas vacío se genera del cuerpo"
          >
            <TextArea
              id="excerpt"
              name="excerpt"
              rows={2}
              defaultValue={comunicado?.excerpt ?? ""}
              placeholder="Se muestra en la lista y en la tarjeta destacada del home"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Texto / Descripción" name="full_text">
            <TextArea
              id="full_text"
              name="full_text"
              rows={10}
              defaultValue={comunicado?.full_text ?? ""}
              placeholder="Cuerpo completo del comunicado..."
            />
          </Field>
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
          Adjuntos
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Opcional. Útil para invitaciones gráficas y documentos firmados.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          <FileSlot
            label="Imagen de invitación"
            name="image_file"
            removeName="image_remove"
            accept="image/*"
            currentUrl={comunicado?.image_url ?? null}
            previewKind="image"
          />
          <FileSlot
            label="PDF adjunto"
            name="pdf_file"
            removeName="pdf_remove"
            accept="application/pdf"
            currentUrl={comunicado?.pdf_url ?? null}
            previewKind="pdf"
          />
        </div>
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href="/admin/comunicados">
          Cancelar
        </Button>
        <Button type="submit">
          {comunicado ? "Guardar cambios" : "Publicar comunicado"}
        </Button>
      </div>
    </form>
  );
}

function FileSlot({
  label,
  name,
  removeName,
  accept,
  currentUrl,
  previewKind,
}: {
  label: string;
  name: string;
  removeName: string;
  accept: string;
  currentUrl: string | null;
  previewKind: "image" | "pdf";
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold text-dark">{label}</div>
      {currentUrl && (
        <div className="mb-2 rounded-lg border border-black/[0.06] bg-bg p-2.5">
          {previewKind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt="Adjunto actual"
              className="h-32 w-full rounded object-cover"
            />
          ) : (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 text-[12px] font-medium text-terra hover:underline"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Ver PDF actual
            </a>
          )}
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <input type="checkbox" name={removeName} className="h-3.5 w-3.5" />
            <span>Quitar este adjunto al guardar</span>
          </label>
        </div>
      )}
      <input
        type="file"
        name={name}
        accept={accept}
        className="block w-full cursor-pointer rounded-xl border border-dashed border-black/15 bg-bg/40 px-3 py-2.5 text-[12px] text-muted file:mr-3 file:rounded file:border-0 file:bg-terra file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white hover:bg-bg/70"
      />
      <p className="mt-1 text-[10px] text-muted">
        {currentUrl
          ? "Subir uno nuevo reemplaza el actual."
          : "Máximo 10MB."}
      </p>
    </div>
  );
}
