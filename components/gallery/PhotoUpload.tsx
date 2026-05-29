"use client";

import { useRef, useState } from "react";
import { uploadEventPhotoAction } from "./photo-actions";

type Props = {
  eventType: "calendar" | "feast";
  eventId: string;
};

const MAX_CAPTION_LEN = 140;

export function PhotoUpload({ eventType, eventId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function reset() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCaption("");
    setConsent(false);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Seleccioná una foto.");
      return;
    }
    if (!consent) {
      setError("Debes marcar el consentimiento antes de subir.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.set("event_type", eventType);
      fd.set("event_id", eventId);
      fd.set("caption", caption);
      fd.set("consent", consent ? "on" : "");
      fd.set("file", compressed, compressed.name);

      const res = await uploadEventPhotoAction(fd);
      if (!res.ok) {
        setError(res.error || "Error al subir.");
      } else {
        reset();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar la foto.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-black/[0.06] bg-card p-4 shadow-card-soft"
    >
      <h3 className="mb-1 font-display text-[15px] font-semibold text-dark">
        Compartir una foto
      </h3>
      <p className="mb-3 text-[11.5px] text-muted">
        Visible solo para los miembros de la comunidad.
      </p>

      {preview ? (
        <div className="mb-3 overflow-hidden rounded-xl border border-black/[0.06] bg-bg/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Vista previa"
            className="block max-h-64 w-full object-contain"
          />
          <button
            type="button"
            onClick={reset}
            className="block w-full px-3 py-2 text-[11.5px] font-semibold text-rose-600 hover:underline"
          >
            Quitar foto
          </button>
        </div>
      ) : (
        <div className="mb-3 rounded-xl border border-dashed border-black/[0.15] bg-bg/40 px-3 py-5 text-center">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-terra"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="mt-1 text-[11.5px] text-muted">Agregá una foto · max 10 MB</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="tap flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.1] bg-card px-3 py-2 text-[12.5px] font-semibold text-terra"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Galería
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="tap flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.1] bg-card px-3 py-2 text-[12.5px] font-semibold text-terra"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Cámara
            </button>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      )}

      <div className="mb-3">
        <textarea
          name="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))}
          rows={2}
          placeholder="Descripción breve (opcional)"
          className="w-full rounded-xl border border-black/[0.08] bg-bg/40 px-3 py-2 text-[13px] text-dark placeholder:text-muted focus:border-terra focus:outline-none"
        />
        <div className="mt-1 text-right text-[10px] text-muted">
          {caption.length} / {MAX_CAPTION_LEN}
        </div>
      </div>

      <label className="mb-3 flex items-start gap-2 rounded-xl bg-bg/40 px-3 py-2.5 text-[11.5px] text-dark">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-[3px] h-3.5 w-3.5 shrink-0"
        />
        <span>
          Confirmo que las personas en estas fotos están de acuerdo con
          compartirlas en la comunidad, y que en el caso de menores cuento
          con el consentimiento de sus padres o tutores.
        </span>
      </label>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !file || !consent}
        className="tap w-full rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Subiendo…" : "Compartir foto"}
      </button>

      <p className="mt-2 text-center text-[10px] text-muted">
        Si necesitás que bajen una foto, hablalo con la Secretaría por chat.
      </p>
    </form>
  );
}

/**
 * Comprime la imagen en el navegador antes de subirla.
 * - Redimensiona el lado mayor a `maxDim` (1600 px por default)
 * - Re-encodea como JPEG calidad 85
 *
 * Una foto típica de 4-8 MB del teléfono queda en 400-900 KB
 * sin pérdida visual perceptible.
 */
async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxSide = Math.max(width, height);
        if (maxSide > maxDim) {
          const scale = maxDim / maxSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas no soportado por el navegador"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("No se pudo comprimir la imagen"));
              return;
            }
            const baseName = file.name.replace(/\.[^.]+$/, "");
            const out = new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
            });
            resolve(out);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
