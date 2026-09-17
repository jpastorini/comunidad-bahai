"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, TextInput } from "@/components/admin/ui";
import { ReceiptSheet } from "@/components/treasury/ReceiptSheet";
import {
  DEFAULT_TREASURER_TITLE,
  RECEIPT_PALETTES,
  RECEIPT_THEMES,
  type ReceiptTheme,
} from "@/lib/receipt-theme";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import {
  MAX_SIGNATURE_BYTES,
  RECEIPT_SIGNATURE_BUCKET,
  type ReceiptSettings,
} from "@/lib/receipt-settings";
import { saveReceiptSettingsAction } from "./actions";

const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Los ajustes del recibo, con la hoja a la vista mientras se tocan.
 *
 * Es un componente de cliente por dos razones: la firma se sube desde el
 * navegador directo al bucket (igual que los estatutos, por el techo de
 * 4,5 MB de Vercel; ver actions.ts), y elegir un color sin ver el papel
 * es elegir a ciegas — la vista previa es la mitad de la función.
 */
export function ReceiptSettingsForm({
  settings,
  ready,
  localityId,
  localityName,
  signatureUrl,
  signerName,
  legal,
  hasLogo,
  hasLegacySignature,
  updatedLabel,
}: {
  settings: ReceiptSettings | null;
  ready: boolean;
  localityId: string;
  localityName: string;
  signatureUrl: string | null;
  /** El nombre que sale impreso hoy, ya resuelto por la base. */
  signerName: string | null;
  legal: { registeredName: string | null; rut: string | null; address: string | null };
  hasLogo: boolean;
  /** Si sigue estando la firma vieja del repo (public/recibo/firma.png),
   *  la de la planilla de Montevideo. Se puede importar de un toque. */
  hasLegacySignature: boolean;
  updatedLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState<null | "subiendo" | "guardando">(null);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<ReceiptTheme>(
    (settings?.theme as ReceiptTheme) ?? "terracota"
  );
  const [name, setName] = useState(settings?.treasurer_name ?? "");
  const [title, setTitle] = useState(settings?.treasurer_title ?? "");
  const [removing, setRemoving] = useState(false);
  /** Lo que se ve en la vista previa: la firma guardada, la recién
   *  elegida (blob local) o ninguna. */
  const [preview, setPreview] = useState<string | null>(signatureUrl);
  /** Una firma ya subida al bucket en esta sesión (importada del repo o
   *  elegida del disco), lista para viajar al action como ruta. */
  const [uploaded, setUploaded] = useState<{ path: string; fileName: string } | null>(
    null
  );

  // El blob local de la vista previa hay que soltarlo o queda colgado.
  const blobRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, []);

  function showLocal(file: File) {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    const url = URL.createObjectURL(file);
    blobRef.current = url;
    setPreview(url);
    setRemoving(false);
  }

  /** Sube un archivo al bucket y devuelve su ruta. La RLS (060) exige el
   *  tag de Tesorería y que la primera carpeta sea esta localidad, así
   *  que el navegador no puede escribir en la de otra. */
  async function upload(file: File): Promise<string | null> {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
    const path = `${localityId}/firma/${crypto.randomUUID()}.${safeExt}`;
    const supabase = createSupabaseBrowser();
    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_SIGNATURE_BUCKET)
      .upload(path, file, { contentType: file.type || "image/png", upsert: false });
    if (uploadError) {
      setError(`No se pudo subir la firma: ${uploadError.message}`);
      return null;
    }
    return path;
  }

  /** Trae la firma que quedó en el repo (`public/recibo/firma.png`) y la
   *  guarda como la de esta comunidad. Existe para no obligar a nadie a
   *  ir a buscar un archivo que la app ya tiene servido. */
  async function importLegacy() {
    setError(null);
    setBusy("subiendo");
    try {
      const res = await fetch("/recibo/firma.png", { cache: "no-store" });
      if (!res.ok) throw new Error("no está");
      const blob = await res.blob();
      const file = new File([blob], "firma.png", { type: "image/png" });
      const path = await upload(file);
      if (path) {
        setUploaded({ path, fileName: "firma.png" });
        showLocal(file);
      }
    } catch {
      setError("No se encontró la firma del sistema anterior.");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = formRef.current;
    if (!form) return;
    setError(null);

    const fd = new FormData(form);
    const file = fd.get("signature");
    fd.delete("signature");

    if (file instanceof File && file.size > 0) {
      if (!ACCEPT.split(",").includes(file.type)) {
        setError("La firma tiene que ser PNG, JPG o WEBP.");
        return;
      }
      if (file.size > MAX_SIGNATURE_BYTES) {
        setError(
          `La imagen supera los ${Math.round(MAX_SIGNATURE_BYTES / (1024 * 1024))} MB. Recortá la firma antes de subirla.`
        );
        return;
      }
      setBusy("subiendo");
      const path = await upload(file);
      if (!path) {
        setBusy(null);
        return;
      }
      fd.set("signature_path", path);
      fd.set("signature_file_name", file.name.slice(0, 200) || "firma.png");
    } else if (uploaded) {
      fd.set("signature_path", uploaded.path);
      fd.set("signature_file_name", uploaded.fileName);
    }

    setBusy("guardando");
    try {
      await saveReceiptSettingsAction(fd);
    } catch (err) {
      // Un redirect de Next viaja como excepción: no es un error.
      if (err && typeof err === "object" && "digest" in err) throw err;
      setBusy(null);
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  const shownName = name.trim() || signerName || "";
  const shownSignature = removing ? null : preview;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <form ref={formRef} onSubmit={onSubmit} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="theme" value={theme} />

        <Field
          label="Nombre del Tesorero/a"
          name="treasurer_name"
          hint={
            signerName
              ? `Vacío, sale «${signerName}», que es el Tesorero/a declarado en Datos de la Asamblea. Completalo solo si hay que imprimir otra cosa.`
              : "Vacío, sale el Tesorero/a declarado en Datos de la Asamblea. Todavía no hay ninguno cargado."
          }
        >
          <TextInput
            id="treasurer_name"
            name="treasurer_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={signerName ?? "Nombre y apellido"}
          />
        </Field>

        <Field
          label="Renglón de la firma"
          name="treasurer_title"
          hint="Lo que dice arriba del nombre."
        >
          <TextInput
            id="treasurer_title"
            name="treasurer_title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={DEFAULT_TREASURER_TITLE}
          />
        </Field>

        <Field
          label="Firma escaneada"
          name="signature"
          hint={
            settings?.signature_path
              ? "Subir otra reemplaza a la actual. PNG con fondo transparente es lo que mejor queda."
              : "PNG, JPG o WEBP, hasta 2 MB. Un PNG con fondo transparente es lo que mejor queda."
          }
        >
          <input
            id="signature"
            name="signature"
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) showLocal(f);
            }}
            className="block w-full text-[13px] text-dark file:mr-3 file:rounded-lg file:border-0 file:bg-terra/10 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-terra"
          />
        </Field>

        {hasLegacySignature && !settings?.signature_path && !uploaded && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
            Esta comunidad no tiene firma propia. Hasta ahora todos los recibos
            del país salían con la misma imagen, la que quedó del sistema
            anterior.{" "}
            <button
              type="button"
              onClick={importLegacy}
              disabled={busy !== null}
              className="font-semibold underline underline-offset-2 disabled:opacity-60"
            >
              Usar esa firma acá
            </button>{" "}
            si es la de esta Asamblea, o subí la que corresponda.
          </div>
        )}

        {(settings?.signature_path || uploaded) && (
          <label className="flex items-center gap-2 text-[12.5px] text-dark">
            <input
              type="checkbox"
              name="remove_signature"
              checked={removing}
              onChange={(e) => setRemoving(e.target.checked)}
              className="h-4 w-4 rounded border-line text-terra"
            />
            Quitar la firma. El recibo sale con el renglón en blanco, para
            firmar a mano.
          </label>
        )}

        <div>
          <span className="mb-2 block text-[12px] font-semibold text-dark">
            Color del recibo
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RECEIPT_THEMES.map((t) => {
              const p = RECEIPT_PALETTES[t];
              const active = t === theme;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  aria-pressed={active}
                  className={`tap overflow-hidden rounded-xl border text-left transition ${
                    active
                      ? "border-terra ring-2 ring-terra/30"
                      : "border-line hover:border-terra/40"
                  }`}
                >
                  <span
                    className="block h-9 w-full"
                    style={{
                      background: `linear-gradient(160deg, ${p.gradFrom} 0%, ${p.gradVia} 55%, ${p.gradTo} 100%)`,
                    }}
                  />
                  <span className="block px-2.5 py-1.5">
                    <span className="block text-[12px] font-semibold text-dark">
                      {p.label}
                    </span>
                    <span className="block text-[10.5px] leading-tight text-muted">
                      {p.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">{updatedLabel}</span>
          <Button type="submit" disabled={!ready || busy !== null}>
            {busy === "subiendo"
              ? "Subiendo la firma…"
              : busy === "guardando"
                ? "Guardando…"
                : "Guardar"}
          </Button>
        </div>
      </form>

      {/* La hoja real, con datos de muestra. Se achica para caber al lado
          del formulario; los 148 mm siguen siendo 148 mm al imprimir. */}
      <div className="min-w-0">
        <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-muted">
          Así sale el recibo
        </p>
        <style>{`
          .cb-receipt-preview { --s: 0.62; height: calc(794px * var(--s)); overflow: hidden; }
          @media (max-width: 760px) {
            .cb-receipt-preview { --s: calc((100vw - 64px) / 560); }
          }
          .cb-receipt-preview > div { transform: scale(var(--s)); transform-origin: top left; }
        `}</style>
        <div className="cb-receipt-preview">
          <ReceiptSheet
            receiptNumber={128}
            dateLabel="21/04/2026"
            contributor="Nombre del contribuyente"
            currency="UYU"
            amount={1500}
            destination="Contribuciones — Fondo Local"
            localityName={localityName}
            treasurerName={shownName}
            treasurerTitle={title}
            hasLogo={hasLogo}
            signatureUrl={shownSignature}
            theme={theme}
            legal={legal}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Datos de muestra. El nombre registrado, el RUT y el domicilio salen de{" "}
          <strong>Asamblea → Datos de la Asamblea</strong>; el color de acá.
        </p>
      </div>
    </div>
  );
}
