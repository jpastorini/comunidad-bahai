"use client";

import { useRef, useState } from "react";
import { Button, Field, TextArea, TextInput } from "@/components/admin/ui";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import {
  ASSEMBLY_DOCS_BUCKET,
  MAX_STATUTES_BYTES,
  type AssemblyRecord,
} from "@/lib/types";
import { saveAssemblyRecordAction } from "./actions";

/**
 * La ficha legal de la Asamblea.
 *
 * Es un componente de cliente por UNA razón: el PDF de los estatutos se
 * sube desde el navegador directo a Supabase Storage, y al server action
 * viaja solo la ruta. Antes el archivo iba dentro del formulario, y en
 * Vercel una petición a una función no puede pasar de 4,5 MB: los
 * estatutos de Montevideo pesan 4,6 MB, la petición se rechazaba antes de
 * llegar al código y la ficha entera —RUT, BPS, todo— se perdía sin aviso.
 * Es el mismo techo que hace que las fotos de la galería y los
 * comprobantes se compriman antes de mandarse; un PDF escaneado no se
 * puede comprimir, así que va por el otro camino.
 *
 * La RLS del bucket (052) exige admin y que la primera carpeta sea la
 * localidad de quien sube, así que el navegador no puede escribir en otro
 * lado; el server action vuelve a chequear la ruta antes de guardarla.
 */
export function RecordForm({
  record,
  ready,
  localityId,
  updatedLabel,
}: {
  record: AssemblyRecord | null;
  ready: boolean;
  localityId: string;
  /** "Actualizado 12/09/2026 10:15" o "Todavía sin datos.", ya formateado
   *  en el servidor (el huso es el de la comunidad). */
  updatedLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState<null | "subiendo" | "guardando">(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = formRef.current;
    if (!form) return;
    setError(null);

    const fd = new FormData(form);
    const file = fd.get("statutes");
    fd.delete("statutes");

    if (file instanceof File && file.size > 0) {
      if (file.type !== "application/pdf") {
        setError("Los estatutos tienen que ser un PDF.");
        return;
      }
      if (file.size > MAX_STATUTES_BYTES) {
        setError(`El PDF supera los ${Math.round(MAX_STATUTES_BYTES / (1024 * 1024))} MB.`);
        return;
      }
      setBusy("subiendo");
      const path = `${localityId}/estatutos/${crypto.randomUUID()}.pdf`;
      const supabase = createSupabaseBrowser();
      const { error: uploadError } = await supabase.storage
        .from(ASSEMBLY_DOCS_BUCKET)
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) {
        setBusy(null);
        setError(`No se pudo subir el PDF: ${uploadError.message}`);
        return;
      }
      fd.set("statutes_path", path);
      fd.set("statutes_file_name", file.name.slice(0, 200) || "estatutos.pdf");
    }

    setBusy("guardando");
    // El action redirige a la misma pantalla con un toast; si vuelve, fue
    // porque tiró antes de redirigir.
    try {
      await saveAssemblyRecordAction(fd);
    } catch (err) {
      // Un redirect de Next viaja como excepción: no es un error.
      if (err && typeof err === "object" && "digest" in err) throw err;
      setBusy(null);
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
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
      <Field
        label="Domicilio fiscal"
        name="fiscal_address"
        hint="Como figura en DGI. Va impreso en cada recibo y en el balance anual."
      >
        <TextInput
          id="fiscal_address"
          name="fiscal_address"
          defaultValue={record?.fiscal_address ?? ""}
          placeholder="Blvr. Artigas 2440, Montevideo"
        />
      </Field>
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
        hint="Personería jurídica, contador, número de registro, lo que haga falta."
      >
        <TextArea id="notes" name="notes" rows={4} defaultValue={record?.notes ?? ""} />
      </Field>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted">{updatedLabel}</span>
        <Button type="submit" disabled={!ready || busy !== null}>
          {busy === "subiendo"
            ? "Subiendo el PDF…"
            : busy === "guardando"
              ? "Guardando…"
              : "Guardar ficha"}
        </Button>
      </div>
    </form>
  );
}
