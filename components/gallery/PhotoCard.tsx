"use client";

import { useState } from "react";
import type { EventPhoto } from "@/lib/types";
import { deleteEventPhotoAction } from "./photo-actions";

type Props = {
  photo: EventPhoto;
  canDelete: boolean;
};

export function PhotoCard({ photo, canDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (deleting) return;
    if (
      !window.confirm("¿Borrar esta foto? Esta acción no se puede deshacer.")
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    const res = await deleteEventPhotoAction(photo.id);
    if (!res.ok) {
      setError(res.error || "No se pudo borrar.");
      setDeleting(false);
    }
    // Si tuvo éxito, revalidatePath del action refresca la lista.
  }

  return (
    <>
      <div className="group relative aspect-square overflow-hidden rounded-xl bg-bg/40 shadow-card-soft">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.public_url}
            alt={photo.caption ?? "Foto del evento"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            title="Borrar foto"
            className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100 disabled:opacity-50"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="col-span-full -mt-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11.5px] text-rose-700">
          {error}
        </div>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-4 py-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.public_url}
            alt={photo.caption ?? "Foto del evento"}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 max-w-full rounded-lg bg-black/55 px-4 py-2 text-center text-[12.5px] text-white"
          >
            {photo.caption && <p className="mb-1">{photo.caption}</p>}
            <p className="text-[10.5px] uppercase tracking-wide opacity-80">
              {photo.uploader_name} ·{" "}
              {new Date(photo.created_at).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 rounded-full bg-white/90 px-4 py-1.5 text-[12px] font-semibold text-dark"
          >
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}
