"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Field,
  Select,
  TextInput,
} from "@/components/admin/ui";
import { upsertMaterialAction } from "./actions";
import type { StudyMaterial } from "@/lib/types";

type Props = {
  material?: StudyMaterial;
  /**
   * true cuando el formulario vive en la sección Admin Nacional: el
   * material se crea/edita a nivel NACIONAL (visible a todas las
   * localidades). El alcance lo fija la sección, no un selector.
   */
  national?: boolean;
};

const KINDS = [
  { value: "ruhi", label: "Libro Ruhí" },
  { value: "libros", label: "Libro" },
  { value: "escritos", label: "Escritos sagrados" },
  { value: "oraciones", label: "Oraciones" },
  { value: "oracion_del_mes", label: "Oración del mes (imagen)" },
];

export function MaterialForm({ material, national = false }: Props) {
  const [kind, setKind] = useState<string>(material?.kind ?? "ruhi");
  const isRuhi = kind === "ruhi";
  const isImageBased = kind === "oracion_del_mes";
  const cancelHref = national ? "/admin/nacional/materiales" : "/admin/materiales";

  return (
    <form action={upsertMaterialAction} encType="multipart/form-data">
      {material && <input type="hidden" name="id" value={material.id} />}
      {/* El alcance lo define la sección (local vs. nacional). */}
      <input type="hidden" name="scope" value={national ? "nacional" : "local"} />

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo" name="kind" required>
            <Select
              id="kind"
              name="kind"
              required
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          {isRuhi && (
            <Field label="Número del libro" name="number">
              <TextInput
                id="number"
                name="number"
                type="number"
                min={1}
                max={20}
                defaultValue={material?.number ?? ""}
              />
            </Field>
          )}
        </div>

        <div className="mt-4">
          <Field label="Título" name="title" required>
            <TextInput
              id="title"
              name="title"
              required
              defaultValue={material?.title ?? ""}
              placeholder={
                isImageBased
                  ? "Oración del mes — Mayo 2026"
                  : isRuhi
                    ? "Reflexiones sobre la vida del espíritu"
                    : "Kitáb-i-Íqán"
              }
            />
          </Field>
        </div>

        {!isRuhi && (
          <div className="mt-4">
            <Field label="Subtítulo" name="subtitle">
              <TextInput
                id="subtitle"
                name="subtitle"
                defaultValue={material?.subtitle ?? ""}
                placeholder={
                  isImageBased
                    ? "Compartida por la Asamblea Espiritual Local"
                    : "Escritos sagrados"
                }
              />
            </Field>
          </div>
        )}

        {isRuhi && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Checkbox
              name="completed"
              label="Completado por la comunidad"
              defaultChecked={material?.completed ?? false}
            />
            <Checkbox
              name="current"
              label="En curso (libro actual)"
              defaultChecked={material?.current ?? false}
            />
          </div>
        )}

        {isImageBased && (
          <div className="mt-4">
            <Checkbox
              name="current"
              label="Es la Oración del mes actual (se destaca en la app)"
              defaultChecked={material?.current ?? false}
            />
          </div>
        )}
      </Card>

      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
          {isImageBased ? "Imagen para compartir" : "PDF del material"}
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          {isImageBased
            ? "Sube la imagen que los miembros podrán descargar y compartir por WhatsApp."
            : "Sube el PDF que los miembros podrán descargar."}
        </p>

        {isImageBased ? (
          <FileSlot
            label="Imagen (JPG / PNG)"
            name="image_file"
            removeName="image_remove"
            accept="image/*"
            currentUrl={material?.image_url ?? null}
            previewKind="image"
          />
        ) : (
          <FileSlot
            label="PDF"
            name="pdf_file"
            removeName="pdf_remove"
            accept="application/pdf"
            currentUrl={material?.pdf_url ?? null}
            previewKind="pdf"
          />
        )}
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href={cancelHref}>
          Cancelar
        </Button>
        <Button type="submit">{material ? "Guardar" : "Crear material"}</Button>
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
              className="max-h-48 w-full rounded object-contain"
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
        {currentUrl ? "Subir uno nuevo reemplaza el actual." : "Máximo 10MB."}
      </p>
    </div>
  );
}
