import {
  Button,
  Card,
  Checkbox,
  Field,
  TextInput,
} from "@/components/admin/ui";
import { upsertMessageAction } from "./actions";
import type { Message } from "@/lib/types";

type Props = {
  message?: Message;
};

export function MessageForm({ message }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={upsertMessageAction} encType="multipart/form-data">
      {message && <input type="hidden" name="id" value={message.id} />}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fecha" name="date" required>
            <TextInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={message?.date ?? today}
            />
          </Field>
          <div className="flex items-end">
            <Checkbox
              name="is_new"
              label='Marcar como "Nuevo" (badge en la app)'
              defaultChecked={message?.is_new ?? false}
            />
          </div>
        </div>

        <div className="mt-4">
          <Field label="Título" name="title" required>
            <TextInput
              id="title"
              name="title"
              required
              defaultValue={message?.title ?? ""}
              placeholder="Mensaje del Riḍván 2026"
            />
          </Field>
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
          PDF del mensaje
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Adjunta el documento oficial que los miembros podrán descargar.
        </p>
        <PdfSlot
          currentUrl={message?.pdf_url ?? null}
        />
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href="/admin/mensajes">
          Cancelar
        </Button>
        <Button type="submit">
          {message ? "Guardar cambios" : "Publicar mensaje"}
        </Button>
      </div>
    </form>
  );
}

function PdfSlot({ currentUrl }: { currentUrl: string | null }) {
  return (
    <div>
      {currentUrl && (
        <div className="mb-2 rounded-lg border border-black/[0.06] bg-bg p-2.5">
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
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <input type="checkbox" name="pdf_remove" className="h-3.5 w-3.5" />
            <span>Quitar este PDF al guardar</span>
          </label>
        </div>
      )}
      <input
        type="file"
        name="pdf_file"
        accept="application/pdf"
        className="block w-full cursor-pointer rounded-xl border border-dashed border-black/15 bg-bg/40 px-3 py-2.5 text-[12px] text-muted file:mr-3 file:rounded file:border-0 file:bg-terra file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white hover:bg-bg/70"
      />
      <p className="mt-1 text-[10px] text-muted">
        {currentUrl
          ? "Subir uno nuevo reemplaza el actual."
          : "Máximo 10MB. Formato PDF únicamente."}
      </p>
    </div>
  );
}
