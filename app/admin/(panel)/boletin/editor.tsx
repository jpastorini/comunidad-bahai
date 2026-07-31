"use client";

import { useMemo, useState } from "react";
import { Card, Field, TextArea, TextInput } from "@/components/admin/ui";
import type {
  BulletinContent,
  BulletinStatus,
} from "@/lib/types";

type Props = {
  /** Contenido candidato compilado del calendario/comunicados/fotos. */
  candidates: BulletinContent;
  defaultTitle: string;
  /** Presente al editar una edición existente. */
  bulletin?: {
    id: string;
    status: BulletinStatus;
    title: string;
    editorial: string | null;
    content: BulletinContent;
  };
  action: (formData: FormData) => Promise<void>;
};

/**
 * Editor de una edición del boletín: texto editorial + selección con
 * checkboxes sobre el contenido candidato. Los items que ya estaban en
 * una edición guardada pero salieron de la ventana de candidatos (p.ej.
 * un evento que ya pasó) se conservan y se muestran igual.
 */
export function BulletinEditor({ candidates, defaultTitle, bulletin, action }: Props) {
  // Merge: candidatos + items guardados que ya no aparecen como candidatos.
  const merged = useMemo<BulletinContent>(() => {
    const mergeById = <T extends { id: string }>(saved: T[], cands: T[]): T[] => {
      const candIds = new Set(cands.map((c) => c.id));
      return [...saved.filter((s) => !candIds.has(s.id)), ...cands];
    };
    const saved = bulletin?.content ?? { events: [], announcements: [], photos: [] };
    return {
      events: mergeById(saved.events, candidates.events),
      announcements: mergeById(saved.announcements, candidates.announcements),
      photos: mergeById(saved.photos, candidates.photos),
    };
  }, [candidates, bulletin]);

  const [selEvents, setSelEvents] = useState<Set<string>>(
    () => new Set((bulletin?.content.events ?? []).map((e) => e.id))
  );
  const [selAnnouncements, setSelAnnouncements] = useState<Set<string>>(
    () => new Set((bulletin?.content.announcements ?? []).map((a) => a.id))
  );
  const [selPhotos, setSelPhotos] = useState<Set<string>>(
    () => new Set((bulletin?.content.photos ?? []).map((p) => p.id))
  );

  const toggle =
    (set: Set<string>, update: (s: Set<string>) => void) => (id: string) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      update(next);
    };

  const selectedContent: BulletinContent = {
    events: merged.events.filter((e) => selEvents.has(e.id)),
    announcements: merged.announcements.filter((a) => selAnnouncements.has(a.id)),
    photos: merged.photos.filter((p) => selPhotos.has(p.id)),
  };
  const totalSelected =
    selectedContent.events.length +
    selectedContent.announcements.length +
    selectedContent.photos.length;

  const isPublished = bulletin?.status === "published";

  return (
    <form action={action} className="grid gap-4">
      {bulletin && <input type="hidden" name="id" value={bulletin.id} />}
      <input
        type="hidden"
        name="content"
        value={JSON.stringify(selectedContent)}
      />

      <Card>
        <div className="grid gap-4">
          <Field label="Título de la edición" name="title" required>
            <TextInput
              name="title"
              defaultValue={bulletin?.title ?? defaultTitle}
              placeholder="Ej. Boletín de agosto"
              required
            />
          </Field>
          <Field
            label="Editorial"
            name="editorial"
            hint="Mensaje de apertura de la Asamblea (opcional)."
          >
            <TextArea
              name="editorial"
              rows={5}
              defaultValue={bulletin?.editorial ?? ""}
              placeholder="Queridos amigos…"
            />
          </Field>
        </div>
      </Card>

      <SectionCard
        title="Próximos eventos"
        hint="Del calendario unificado (eventos, Fiestas y Días Sagrados)."
        emptyText="No hay eventos próximos en el calendario."
        count={selectedContent.events.length}
        isEmpty={merged.events.length === 0}
      >
        {merged.events.map((e) => (
          <CheckRow
            key={e.id}
            checked={selEvents.has(e.id)}
            onToggle={() => toggle(selEvents, setSelEvents)(e.id)}
            title={e.title}
            detail={[e.dateLabel, e.time, e.location]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Comunicados recientes"
        hint="Comunicados de la Asamblea de las últimas semanas."
        emptyText="No hay comunicados recientes."
        count={selectedContent.announcements.length}
        isEmpty={merged.announcements.length === 0}
      >
        {merged.announcements.map((a) => (
          <CheckRow
            key={a.id}
            checked={selAnnouncements.has(a.id)}
            onToggle={() => toggle(selAnnouncements, setSelAnnouncements)(a.id)}
            title={a.title}
            detail={a.excerpt}
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Fotos"
        hint="Fotos recientes de la galería de la comunidad."
        emptyText="No hay fotos recientes."
        count={selectedContent.photos.length}
        isEmpty={merged.photos.length === 0}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {merged.photos.map((p) => {
            const selected = selPhotos.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(selPhotos, setSelPhotos)(p.id)}
                aria-pressed={selected}
                className={`relative aspect-square overflow-hidden rounded-xl transition ${
                  selected
                    ? "ring-2 ring-terra ring-offset-2"
                    : "opacity-80 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.caption ?? p.eventTitle}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {selected && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-terra text-[11px] font-bold text-white">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <span className="text-[12px] text-muted">
          {totalSelected} elemento{totalSelected === 1 ? "" : "s"} seleccionado
          {totalSelected === 1 ? "" : "s"}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="intent"
            value="draft"
            onClick={(ev) => {
              if (
                isPublished &&
                !window.confirm(
                  "El boletín volverá a borrador y los creyentes dejarán de verlo. ¿Continuar?"
                )
              ) {
                ev.preventDefault();
              }
            }}
            className="tap rounded-xl border border-black/10 bg-card px-4 py-2 text-[13px] font-semibold text-dark hover:bg-bg"
          >
            {isPublished ? "Volver a borrador" : "Guardar borrador"}
          </button>
          <button
            type="submit"
            name="intent"
            value="publish"
            onClick={(ev) => {
              if (
                !isPublished &&
                !window.confirm(
                  "Se publicará el boletín y se avisará por notificación a los creyentes de la comunidad. ¿Continuar?"
                )
              ) {
                ev.preventDefault();
              }
            }}
            className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft"
          >
            {isPublished ? "Guardar cambios" : "Publicar"}
          </button>
        </div>
      </div>
    </form>
  );
}

function SectionCard({
  title,
  hint,
  emptyText,
  count,
  isEmpty,
  children,
}: {
  title: string;
  hint: string;
  emptyText: string;
  count: number;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[16px] font-semibold text-dark">
            {title}
          </h2>
          <p className="text-[11.5px] text-muted">{hint}</p>
        </div>
        {count > 0 && (
          <span className="rounded-full bg-terra/15 px-2 py-0.5 text-[11px] font-bold text-terra">
            {count}
          </span>
        )}
      </div>
      {isEmpty ? (
        <p className="py-3 text-center text-[12.5px] text-muted">{emptyText}</p>
      ) : (
        <div className="grid gap-1.5">{children}</div>
      )}
    </Card>
  );
}

function CheckRow({
  checked,
  onToggle,
  title,
  detail,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 transition ${
        checked ? "bg-terra/[0.06]" : "hover:bg-bg"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 accent-terra"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-dark">
          {title}
        </span>
        {detail && (
          <span className="block truncate text-[11.5px] text-muted">
            {detail}
          </span>
        )}
      </span>
    </label>
  );
}
