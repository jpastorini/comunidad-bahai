"use client";

import { useRef, useState, type ReactNode } from "react";
import { INSTITUTION_DOCS_BUCKET, MAX_INSTITUTION_FILE_BYTES } from "@/lib/institution";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Un formulario con un archivo adjunto que NO viaja por el server action:
 * en Vercel una petición no pasa de 4,5 MB, y un acta escaneada los pasa
 * (lo que le pasó a los estatutos, ver CLAUDE.md). El navegador sube el
 * archivo al bucket privado de la institución (084) con la RLS de quien
 * está parado ahí, y al action llegan solo `file_path` y `file_name`, que
 * el action vuelve a verificar contra la carpeta de su localidad.
 *
 * El campo del archivo se llama `file`; si viene vacío, el action recibe
 * el formulario tal cual.
 */
export function UploadingForm({
  action,
  localityId,
  folder,
  children,
  className,
}: {
  action: (fd: FormData) => Promise<void>;
  localityId: string;
  folder: "actas" | "informes";
  children: ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = formRef.current;
    if (!form) return;
    setError(null);

    const fd = new FormData(form);
    const file = fd.get("file");
    fd.delete("file");

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_INSTITUTION_FILE_BYTES) {
        setError(
          `El archivo supera los ${Math.round(MAX_INSTITUTION_FILE_BYTES / (1024 * 1024))} MB.`
        );
        return;
      }
      setBusy("Subiendo el archivo…");
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${localityId}/${folder}/${crypto.randomUUID()}.${ext || "bin"}`;
      const { error: uploadError } = await createSupabaseBrowser()
        .storage.from(INSTITUTION_DOCS_BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) {
        setBusy(null);
        setError(`No se pudo subir el archivo: ${uploadError.message}`);
        return;
      }
      fd.set("file_path", path);
      fd.set("file_name", file.name.slice(0, 200));
    }

    setBusy("Guardando…");
    try {
      await action(fd);
    } catch (err) {
      // Un redirect de Next viaja como excepción: no es un error.
      if (err && typeof err === "object" && "digest" in err) throw err;
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
    setBusy(null);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className}>
      {/* Mientras sube o guarda, nada se toca: un segundo envío subiría
          el archivo dos veces. */}
      <fieldset disabled={!!busy} className="contents">
        {children}
      </fieldset>
      {busy && <p className="mt-3 text-[12.5px] font-semibold text-muted">{busy}</p>}
      {error && <p className="mt-3 text-[12.5px] font-semibold text-rose-600">{error}</p>}
    </form>
  );
}
