"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { IconCheck, IconChevronLeft, IconSearch } from "../Icons";
import { compressImage } from "./compress-image";
import { uploadEventPhotoAction } from "./photo-actions";

export type PickerEvent = {
  key: string;
  eventType: "calendar" | "feast";
  eventId: string;
  title: string;
  day: number;
  month: number;
  year: number;
  kindShort: string;
  color: string;
};

type Props = {
  events: PickerEvent[];
};

type Picked = {
  id: string;
  file: File;
  preview: string;
};

const MAX_CAPTION_LEN = 140;
const MAX_FILES = 10;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MONTHS_ABBR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function ymd(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

export function PhotoUploadFlow({ events }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [picked, setPicked] = useState<Picked[]>([]);
  const [selected, setSelected] = useState<PickerEvent | null>(null);
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [consent, setConsent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Eventos ordenados por cercanía a hoy (los de hoy / recientes arriba),
  // que es lo más útil al subir fotos después de una actividad.
  const todayNum = useMemo(() => {
    const now = new Date();
    return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);

  const sortedEvents = useMemo(() => {
    const q = normalize(query.trim());
    const list = q
      ? events.filter((e) => normalize(e.title).includes(q))
      : events;
    return [...list].sort((a, b) => {
      const da = Math.abs(ymd(a.year, a.month, a.day) - todayNum);
      const db = Math.abs(ymd(b.year, b.month, b.day) - todayNum);
      return da - db;
    });
  }, [events, query, todayNum]);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const incoming: Picked[] = [];
    for (const f of Array.from(fileList)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_UPLOAD_BYTES) {
        setError(`"${f.name}" supera los 10 MB y se omitió.`);
        continue;
      }
      incoming.push({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
      });
    }
    setPicked((prev) => {
      const merged = [...prev, ...incoming];
      if (merged.length > MAX_FILES) {
        setError(`Máximo ${MAX_FILES} fotos por vez.`);
        for (const extra of merged.slice(MAX_FILES)) {
          URL.revokeObjectURL(extra.preview);
        }
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }

  function removePicked(id: string) {
    setPicked((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleUpload() {
    if (!selected) {
      setError("Elegí un evento.");
      return;
    }
    if (picked.length === 0) {
      setError("Agregá al menos una foto.");
      return;
    }
    if (!consent) {
      setError("Marcá el consentimiento antes de subir.");
      return;
    }
    setBusy(true);
    setError(null);
    setDoneCount(0);

    let failed = 0;
    let limitHit = false;
    for (const item of picked) {
      try {
        const compressed = await compressImage(item.file);
        const fd = new FormData();
        fd.set("event_type", selected.eventType);
        fd.set("event_id", selected.eventId);
        fd.set("caption", caption);
        fd.set("consent", "on");
        fd.set("file", compressed, compressed.name);
        const res = await uploadEventPhotoAction(fd);
        if (!res.ok) {
          failed += 1;
          if (res.error && /l[ií]mite/i.test(res.error)) {
            limitHit = true;
            setError(res.error);
            break;
          }
        } else {
          setDoneCount((c) => c + 1);
        }
      } catch {
        failed += 1;
      }
    }

    setBusy(false);

    if (!limitHit && failed === 0) {
      const dest =
        selected.eventType === "calendar"
          ? `/calendario/${selected.eventId}/galeria`
          : `/fiestas/${selected.eventId}/galeria`;
      router.push(dest);
      router.refresh();
    } else if (!limitHit) {
      setError(
        `Se subieron ${picked.length - failed} de ${picked.length}. ` +
          `Volvé a intentar las que faltaron.`
      );
    }
  }

  return (
    <div className="scroll-area flex-1 px-4 pb-28 pt-4">
      <StepIndicator step={step} />

      {step === 1 && (
        <section className="mt-4">
          <h2 className="font-display text-[17px] font-semibold text-dark">
            Elegí las fotos
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Podés agregar hasta {MAX_FILES} fotos · máximo 10 MB cada una.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="tap flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.1] bg-card px-3 py-3 text-[13px] font-semibold text-terra shadow-card-soft"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Galería
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="tap flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.1] bg-card px-3 py-3 text-[13px] font-semibold text-terra shadow-card-soft"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />

          {picked.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {picked.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square overflow-hidden rounded-xl border border-black/[0.06] bg-bg/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.preview}
                    alt="Vista previa"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePicked(p.id)}
                    aria-label="Quitar foto"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <ErrorBox>{error}</ErrorBox>}
        </section>
      )}

      {step === 2 && (
        <section className="mt-4">
          <h2 className="font-display text-[17px] font-semibold text-dark">
            ¿A qué evento pertenecen?
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Aparecen primero los más cercanos a hoy.
          </p>

          <div className="relative mt-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch size={16} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento…"
              className="w-full rounded-xl border border-black/[0.08] bg-card py-2.5 pl-9 pr-3 text-[13px] text-dark placeholder:text-muted focus:border-terra focus:outline-none"
            />
          </div>

          <ul className="mt-3 space-y-2">
            {sortedEvents.length === 0 && (
              <li className="rounded-xl border border-dashed border-black/[0.12] px-3 py-6 text-center text-[12.5px] text-muted">
                No se encontraron eventos.
              </li>
            )}
            {sortedEvents.map((ev) => {
              const isToday = ymd(ev.year, ev.month, ev.day) === todayNum;
              const isSel = selected?.key === ev.key;
              return (
                <li key={ev.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(ev)}
                    className={`tap flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                      isSel
                        ? "border-terra bg-terra/[0.06]"
                        : "border-black/[0.07] bg-card"
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: ev.color }}
                    >
                      <span className="text-[13px] font-bold leading-none">
                        {ev.day}
                      </span>
                      <span className="text-[8px] font-semibold uppercase leading-none">
                        {MONTHS_ABBR[ev.month - 1]}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-dark">
                        {ev.title}
                      </span>
                      <span className="text-[11px] text-muted">
                        {isToday ? "Hoy · " : ""}
                        {ev.kindShort}
                      </span>
                    </span>
                    {isSel && (
                      <span className="shrink-0 text-terra">
                        <IconCheck size={18} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {error && <ErrorBox>{error}</ErrorBox>}
        </section>
      )}

      {step === 3 && (
        <section className="mt-4">
          <h2 className="font-display text-[17px] font-semibold text-dark">
            Últimos detalles
          </h2>

          {selected && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-black/[0.07] bg-card px-3 py-2.5">
              <span
                className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: selected.color }}
              >
                <span className="text-[13px] font-bold leading-none">
                  {selected.day}
                </span>
                <span className="text-[8px] font-semibold uppercase leading-none">
                  {MONTHS_ABBR[selected.month - 1]}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-dark">
                  {selected.title}
                </span>
                <span className="text-[11px] text-muted">
                  {picked.length} {picked.length === 1 ? "foto" : "fotos"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="tap shrink-0 text-[12px] font-semibold text-terra"
              >
                Cambiar
              </button>
            </div>
          )}

          <div className="mt-3">
            <textarea
              value={caption}
              onChange={(e) =>
                setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))
              }
              rows={2}
              placeholder="Descripción breve para todas (opcional)"
              className="w-full rounded-xl border border-black/[0.08] bg-card px-3 py-2 text-[13px] text-dark placeholder:text-muted focus:border-terra focus:outline-none"
            />
            <div className="mt-1 text-right text-[10px] text-muted">
              {caption.length} / {MAX_CAPTION_LEN}
            </div>
          </div>

          <label className="mt-1 flex items-start gap-2 rounded-xl bg-bg/40 px-3 py-2.5 text-[11.5px] text-dark">
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

          {busy && (
            <div className="mt-3 rounded-xl border border-black/[0.07] bg-card px-3 py-2.5 text-[12.5px] text-dark">
              Subiendo {doneCount} de {picked.length}…
            </div>
          )}

          {error && <ErrorBox>{error}</ErrorBox>}

          <p className="mt-3 text-center text-[10px] text-muted">
            Las fotos son visibles solo para los creyentes de la comunidad.
          </p>
        </section>
      )}

      {/* Barra de acción fija */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-black/[0.06] bg-card/95 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <div className="flex items-center gap-2">
          {step > 1 && !busy && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => (s - 1) as 1 | 2 | 3);
              }}
              className="tap flex items-center gap-1 rounded-xl border border-black/[0.1] bg-card px-4 py-2.5 text-[13px] font-semibold text-dark"
            >
              <IconChevronLeft size={14} />
              Atrás
            </button>
          )}

          {step === 1 && (
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={() => {
                setError(null);
                setStep(2);
              }}
              className="tap flex-1 rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
              {picked.length > 0 ? ` (${picked.length})` : ""}
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              disabled={!selected}
              onClick={() => {
                setError(null);
                setStep(3);
              }}
              className="tap flex-1 rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              disabled={busy || !consent}
              onClick={handleUpload}
              className="tap flex-1 rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Subiendo…"
                : `Compartir ${picked.length} ${
                    picked.length === 1 ? "foto" : "fotos"
                  }`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Fotos", "Evento", "Detalles"];
  return (
    <div className="flex items-center gap-1.5">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n <= step;
        return (
          <div key={label} className="flex flex-1 items-center gap-1.5">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                active ? "bg-terra text-white" : "bg-black/[0.06] text-muted"
              }`}
            >
              {n}
            </div>
            <span
              className={`text-[11px] font-semibold ${
                active ? "text-dark" : "text-muted"
              }`}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <div className="h-px flex-1 bg-black/[0.08]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
      {children}
    </div>
  );
}
