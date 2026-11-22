"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card, DateInput, Field, TextArea, TextInput } from "@/components/admin/ui";
import { compressImage } from "@/components/gallery/compress-image";
import {
  INVITATION_ART,
  INVITATION_SIZE,
  pickInvitationArt,
  type InvitationArtKind,
  invitationDateLabel,
  invitationFileName,
  invitationTimeLabel,
  missingFields,
  type InvitationData,
  type InvitationFormat,
  type InvitationInitial,
  type InvitationQuote,
  type InvitationStyle,
} from "@/lib/invitation";
import { nodeToJpegFile, shareNodeAsImage } from "@/lib/share-image";
import type { InvitationDesign } from "@/lib/invitation-design";
import { generateInvitationDesignAction } from "./actions";
import { InvitationCard } from "./InvitationCard";

// El editor de la invitación: a la izquierda los datos (prellenados desde
// el evento), a la derecha la imagen tal cual va a salir.
//
// Nada se guarda: lo que se cambia acá vale para la imagen y no toca el
// evento. La imagen se arma en el navegador.

type CorpusTopic = {
  id: string;
  name: string;
  quotes: Array<{ id: string; text: string; reference: string }>;
};

/** Una cita más larga no entra en la tarjeta. */
const QUOTE_MAX = 230;

const STYLES: Array<{ id: InvitationStyle; label: string }> = [
  { id: "claro", label: "Claro" },
  { id: "noche", label: "Noche" },
  { id: "foto", label: "Foto de fondo" },
];

const FORMATS: Array<{ id: InvitationFormat; label: string; hint: string }> = [
  { id: "cuadrada", label: "Cuadrada", hint: "para un chat o grupo" },
  { id: "vertical", label: "Vertical", hint: "para los Estados" },
];

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Lo que devuelve el alta de la actividad (el server action del calendario). */
export type InvitationCreateResult = {
  ok: boolean;
  id?: string;
  error?: string;
  imageFailed?: boolean;
  notified?: boolean;
};

type Props = {
  initial: InvitationInitial;
  /**
   * Modo alta: la invitación se arma ANTES que el evento, y de acá nace
   * la actividad del calendario. Sin esto, el editor solo hace la imagen
   * de un evento que ya existe.
   */
  create?: {
    action: (formData: FormData) => Promise<InvitationCreateResult>;
    /** Con una estructura puesta (082) no hay aviso: se elige si se
     *  muestra en el calendario de la comunidad (085). */
    structure: boolean;
  };
};

export function InvitationEditor({ initial, create }: Props) {
  const [data, setData] = useState<InvitationData>({
    eyebrow: initial.eyebrow,
    title: initial.title,
    date: initial.date,
    time: initial.time,
    place: initial.place,
    text: initial.text,
    footer: initial.footer,
  });
  const [format, setFormat] = useState<InvitationFormat>("cuadrada");
  const [style, setStyle] = useState<InvitationStyle>("claro");
  const [photo, setPhoto] = useState<string | null>(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [quote, setQuote] = useState<InvitationQuote | null>(null);
  // Sin foto, la invitación lleva una ilustración acorde al evento.
  const [artChoice, setArtChoice] = useState<InvitationArtKind | "auto" | "ninguna">("auto");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [scale, setScale] = useState(1);
  // Modo alta: compartir con la comunidad, y el resultado del alta.
  const [share, setShare] = useState(!create?.structure);
  const [audience, setAudience] = useState<"todos" | "creyentes">("todos");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<InvitationCreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  // El diseño con AI: Claude dibuja, la tarjeta escribe. Los intentos de
  // una misma invitación comparten la clave (el límite es por institución).
  const invitationKey = useRef("");
  const [design, setDesign] = useState<InvitationDesign | null>(null);
  const [useDesign, setUseDesign] = useState(true);
  const [designing, setDesigning] = useState(false);
  const [designNote, setDesignNote] = useState<string | null>(null);
  const [styleNote, setStyleNote] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<InvitationData>) => setData((d) => ({ ...d, ...patch }));

  // La foto del evento se baja una vez y se guarda como data: URI.
  useEffect(() => {
    if (!initial.imageUrl) return;
    let cancelled = false;
    fetch(initial.imageUrl)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then(fileToDataUrl)
      .then((url) => {
        if (!cancelled) setPhoto(url);
      })
      .catch(() => {
        if (!cancelled)
          setPhotoNote("No se pudo traer la foto del evento. Podés subir una acá.");
      });
    return () => {
      cancelled = true;
    };
  }, [initial.imageUrl]);

  // La vista previa se achica para entrar en una pantalla angosta; la
  // captura sale igual a tamaño real, porque el que se escala es el
  // envoltorio y no la tarjeta.
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / INVITATION_SIZE.cuadrada.w));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activeDesign = useDesign && design && design.format === format ? design : null;
  const shownPhoto = usePhoto ? photo : null;
  const autoArt = pickInvitationArt(`${data.eyebrow} ${data.title}`);
  const art: InvitationArtKind | null = shownPhoto
    ? null
    : artChoice === "auto"
      ? autoArt
      : artChoice === "ninguna"
        ? null
        : artChoice;

  // ¿Entra todo? Si el contenido es más alto que la tarjeta, se avisa:
  // la imagen saldría cortada sin que nadie lo note.
  useLayoutEffect(() => {
    const body = cardRef.current?.querySelector<HTMLElement>("[data-inv-body]");
    if (!body) return;
    const check = () => setOverflow(body.scrollHeight > body.clientHeight + 1);
    check();
    // Las fuentes pueden llegar después del primer render.
    document.fonts?.ready.then(check).catch(() => {});
  }, [data, format, style, shownPhoto, quote, art, activeDesign]);

  async function generateDesign() {
    if (designing || !data.title.trim()) return;
    if (!invitationKey.current) invitationKey.current = crypto.randomUUID();
    setDesigning(true);
    setDesignNote(null);
    try {
      const result = await generateInvitationDesignAction({
        invitationKey: invitationKey.current,
        format,
        ...data,
        styleNote,
      });
      if (typeof result.remaining === "number") setAttemptsLeft(result.remaining);
      if (result.ok && result.design) {
        setDesign(result.design);
        setUseDesign(true);
      } else {
        setDesignNote(result.error ?? "No se pudo generar el diseño.");
      }
    } catch {
      setDesignNote("No se pudo generar el diseño. Probá de nuevo en un momento.");
    }
    setDesigning(false);
  }

  const missing = missingFields(data);
  const ready = missing.length === 0;
  const size = INVITATION_SIZE[format];

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoNote(null);
    try {
      const small = await compressImage(file, 1400, 0.85);
      setPhoto(await fileToDataUrl(small));
      setUsePhoto(true);
    } catch {
      setPhotoNote("No se pudo leer esa imagen.");
    }
  }

  async function send(downloadOnly: boolean) {
    if (!cardRef.current || !ready) return;
    setBusy(true);
    setNotice(null);
    const filename = invitationFileName(data.title);
    const result = await shareNodeAsImage(cardRef.current, {
      filename,
      title: data.title,
      text: [
        data.title.trim(),
        invitationDateLabel(data.date),
        invitationTimeLabel(data.time),
        data.place.trim().replace(/\s*\n\s*/g, ", "),
      ].join(" · "),
      width: size.w,
      height: size.h,
      downloadOnly,
    });
    setBusy(false);
    if (result === "downloaded") setNotice(`Se descargó ${filename}.`);
    if (result === "error") setNotice("No se pudo generar la imagen. Probá de nuevo.");
  }

  async function createEvent() {
    if (!create || !cardRef.current || !ready || creating) return;
    setCreating(true);
    setCreateError(null);
    // La imagen se guarda como la del evento: es lo que la comunidad ve
    // al abrir la actividad en su calendario.
    const image = await nodeToJpegFile(cardRef.current, {
      filename: invitationFileName(data.title).replace(".png", ".jpg"),
      width: size.w,
      height: size.h,
    });
    const fd = new FormData();
    fd.set("title", data.title.trim());
    fd.set("date", data.date);
    fd.set("time", data.time.trim());
    fd.set("location", data.place.trim().split("\n").map((l) => l.trim()).filter(Boolean).join(", "));
    fd.set("description", data.text.trim());
    if (share) fd.set("share", "on");
    fd.set("audience", audience);
    if (image) fd.set("image_file", image);
    try {
      const result = await create.action(fd);
      if (result.ok) setCreated(result);
      else setCreateError(result.error ?? "No se pudo crear la actividad.");
    } catch {
      setCreateError("No se pudo crear la actividad. Probá de nuevo.");
    }
    setCreating(false);
  }

  const pendingCreate = Boolean(create) && !created;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-5">
        <Card>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Lo que siempre lleva
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Título" name="inv_title" required>
                <TextInput
                  id="inv_title"
                  value={data.title}
                  maxLength={90}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Fecha" name="inv_date" required>
              <DateInput id="inv_date" value={data.date} onValueChange={(iso) => set({ date: iso })} />
            </Field>
            <Field label="Hora" name="inv_time" required hint="24 horas, ej. 19:30">
              <TextInput
                id="inv_time"
                value={data.time}
                maxLength={30}
                onChange={(e) => set({ time: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Lugar" name="inv_place" required hint="Nombre y dirección">
                <TextArea
                  id="inv_place"
                  rows={2}
                  value={data.place}
                  maxLength={140}
                  onChange={(e) => set({ place: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            {create
              ? created
                ? "La actividad ya quedó en el calendario: lo que cambies ahora vale solo para la imagen."
                : "Con estos datos se arma la imagen y se crea la actividad en el calendario."
              : "Lo que cambies acá vale solo para la imagen: el evento queda como está."}
          </p>
        </Card>

        <Card>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Opcional
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Encabezado" name="inv_eyebrow" hint="Arriba del título">
              <TextInput
                id="inv_eyebrow"
                value={data.eyebrow}
                maxLength={40}
                onChange={(e) => set({ eyebrow: e.target.value })}
              />
            </Field>
            <Field label="Pie" name="inv_footer" hint="Quién invita">
              <TextInput
                id="inv_footer"
                value={data.footer}
                maxLength={60}
                onChange={(e) => set({ footer: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Texto breve" name="inv_text" hint={`${data.text.length}/160`}>
                <TextArea
                  id="inv_text"
                  rows={2}
                  value={data.text}
                  maxLength={160}
                  placeholder="Una o dos líneas: de qué se trata, qué llevar…"
                  onChange={(e) => set({ text: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 border-t border-black/[0.06] pt-4">
            <div className="text-[12px] font-semibold text-dark">Foto</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-14 w-14 rounded-lg object-cover" />
              )}
              {photo && (
                <label className="flex items-center gap-2 text-[12px] text-dark">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={usePhoto}
                    onChange={(e) => setUsePhoto(e.target.checked)}
                  />
                  Usarla en la invitación
                </label>
              )}
              <label className="tap cursor-pointer rounded-xl border border-terra/30 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra">
                {photo ? "Cambiar la foto" : "Subir una foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void onPickPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {photoNote && <p className="mt-2 text-[11px] text-amber-700">{photoNote}</p>}
            {!shownPhoto && (
              <div className="mt-3">
                <p className="text-[11px] text-muted">
                  Sin foto, la invitación lleva una ilustración. La propone la app según el
                  evento; podés elegir otra.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip active={artChoice === "auto"} onClick={() => setArtChoice("auto")}>
                    Automática
                  </Chip>
                  {INVITATION_ART.map((a) => (
                    <Chip key={a.id} active={artChoice === a.id} onClick={() => setArtChoice(a.id)}>
                      {a.label}
                    </Chip>
                  ))}
                  <Chip active={artChoice === "ninguna"} onClick={() => setArtChoice("ninguna")}>
                    Ninguna
                  </Chip>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-black/[0.06] pt-4">
            <div className="text-[12px] font-semibold text-dark">Cita de los Escritos</div>
            <QuotePicker value={quote} onChange={setQuote} />
          </div>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6">
        <Card>
          <div className="mb-4 rounded-xl border border-gold/40 bg-gold/[0.07] p-3">
            <div className="text-[12px] font-semibold text-dark">Diseño con AI</div>
            <p className="mt-1 text-[11px] text-muted">
              La AI dibuja una ilustración y elige los colores para este evento; el
              texto lo escribe la app, exacto. Una invitación por hora, con hasta 3
              intentos.
            </p>
            <label htmlFor="inv_style" className="mt-3 block text-[12px] font-semibold text-dark">
              Indicaciones de estilo <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id="inv_style"
              rows={2}
              value={styleNote}
              maxLength={300}
              onChange={(e) => setStyleNote(e.target.value)}
              placeholder="Ej.: colores cálidos, que haya un mate y un jardín, más sobrio, de noche…"
              className="mt-1 w-full rounded-xl border border-black/10 bg-card px-3 py-2 font-body text-[13px] leading-[1.4] text-dark outline-none placeholder:text-muted focus:border-terra"
            />
            <button
              type="button"
              disabled={designing || !data.title.trim() || attemptsLeft === 0}
              onClick={() => void generateDesign()}
              className="tap mt-2 w-full rounded-xl bg-dark px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {designing
                ? "Diseñando… puede tardar un minuto"
                : design
                  ? "Generar otra versión"
                  : "Generar con AI"}
            </button>
            {attemptsLeft !== null && !designNote && (
              <p className="mt-2 text-[11px] text-muted">
                {attemptsLeft === 0
                  ? "No quedan intentos para esta invitación."
                  : `Te ${attemptsLeft === 1 ? "queda 1 intento" : `quedan ${attemptsLeft} intentos`} para esta invitación.`}
              </p>
            )}
            {!data.title.trim() && (
              <p className="mt-2 text-[11px] text-muted">Escribí el título para poder diseñar.</p>
            )}
            {designNote && <p className="mt-2 text-[12px] text-rose-700">{designNote}</p>}
            {design && (
              <label className="mt-2 flex items-center gap-2 text-[12px] text-dark">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={useDesign}
                  onChange={(e) => setUseDesign(e.target.checked)}
                />
                Usar el diseño de la AI
              </label>
            )}
            {design && useDesign && design.format !== format && (
              <p className="mt-2 text-[11px] text-amber-700">
                El diseño de la AI se hizo para la {design.format}: en este formato se ve
                el diseño fijo. Volvé al otro formato o generá otra versión acá.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>
                {f.label} <span className="font-normal opacity-70">· {f.hint}</span>
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Chip
                key={s.id}
                active={style === s.id}
                disabled={Boolean(activeDesign) || (s.id === "foto" && !shownPhoto)}
                onClick={() => setStyle(s.id)}
              >
                {s.label}
              </Chip>
            ))}
          </div>

          <div ref={fitRef} className="mt-4 w-full">
            <div
              className="mx-auto overflow-hidden rounded-lg shadow-card-soft"
              style={{ width: size.w * scale, height: size.h * scale }}
            >
              <div
                style={{
                  width: size.w,
                  height: size.h,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <InvitationCard
                  ref={cardRef}
                  data={data}
                  format={format}
                  style={style}
                  photo={shownPhoto}
                  quote={quote}
                  art={art}
                  design={activeDesign}
                />
              </div>
            </div>
          </div>

          {overflow && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              No entra todo y la imagen saldría cortada. Acortá el texto, quitá la
              cita{format === "cuadrada" ? " o usá el formato vertical" : ""}.
            </p>
          )}
          {!ready && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
              Falta {joinList(missing)}.
            </p>
          )}

          {create && !created && (
            <div className="mt-4 rounded-xl border border-black/[0.08] bg-bg/40 p-3">
              <div className="text-[12px] font-semibold text-dark">Actividad en el calendario</div>
              <label className="mt-2 flex items-start gap-2 text-[12px] text-dark">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={share}
                  onChange={(e) => setShare(e.target.checked)}
                />
                <span>
                  {create.structure
                    ? "Mostrarla en el calendario de la comunidad"
                    : "Compartir con la comunidad: mandar un aviso al crearla"}
                </span>
              </label>
              {!create.structure && share && (
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as "todos" | "creyentes")}
                  aria-label="A quién se le avisa"
                  className="mt-2 w-full rounded-xl border border-black/10 bg-card px-3 py-2 text-[12px] text-dark"
                >
                  <option value="todos">A toda la comunidad (creyentes y Amigos de la Fe)</option>
                  <option value="creyentes">Solo a los creyentes</option>
                </select>
              )}
              {!create.structure && (
                <p className="mt-2 text-[11px] text-muted">
                  La actividad se ve en el calendario de la comunidad con esta imagen,
                  se avise o no.
                </p>
              )}
              <button
                type="button"
                disabled={!ready || creating}
                onClick={() => void createEvent()}
                className="tap mt-3 w-full rounded-xl bg-terra px-4 py-2.5 text-[13px] font-semibold text-white shadow-card-soft disabled:opacity-50"
              >
                {creating ? "Creando…" : "Crear la actividad y la invitación"}
              </button>
              {createError && <p className="mt-2 text-[12px] text-rose-700">{createError}</p>}
            </div>
          )}

          {created && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800">
              <strong>La actividad quedó en el calendario.</strong>{" "}
              {created.notified && "Se avisó a la comunidad. "}
              {created.imageFailed && "La imagen no se pudo guardar en el evento. "}
              <a href={`/admin/calendario/${created.id}`} className="font-semibold underline">
                Abrir la actividad
              </a>
            </div>
          )}

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => void send(false)}
              className={`tap rounded-xl px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50 ${
                pendingCreate
                  ? "border border-terra/30 bg-terra/[0.05] text-terra"
                  : "bg-terra text-white shadow-card-soft"
              }`}
            >
              {busy ? "Generando…" : "Enviar por WhatsApp"}
            </button>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => void send(true)}
              className="tap rounded-xl border border-terra/30 bg-terra/[0.05] px-4 py-2.5 text-[13px] font-semibold text-terra disabled:opacity-50"
            >
              Descargar la imagen
            </button>
          </div>
          {notice && <p className="mt-2 text-[12px] text-muted">{notice}</p>}
          <p className="mt-3 text-[11px] text-muted">
            En el teléfono se abre el menú de compartir; en la PC, si no aparece
            WhatsApp, descargá la imagen. Sale de {size.w * 3} × {size.h * 3} px.
          </p>
        </Card>
      </div>
    </div>
  );
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`tap rounded-full border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40 ${
        active
          ? "border-terra bg-terra text-white"
          : "border-black/10 bg-card text-dark"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Elegir una cita del corpus de la app (`public/citas.json`, el de la
 * Lectura de hoy). Se elige, nunca se escribe: ninguna cita de los
 * Escritos se tipea a mano. El archivo (~360 KB) se pide recién al abrir.
 */
function QuotePicker({
  value,
  onChange,
}: {
  value: InvitationQuote | null;
  onChange: (q: InvitationQuote | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<CorpusTopic[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || topics) return;
    fetch("/citas.json")
      .then((r) => r.json())
      .then((json: { topics: CorpusTopic[] }) => {
        setTopics(json.topics);
        setTopicId(json.topics[0]?.id ?? "");
      })
      .catch(() => setFailed(true));
  }, [open, topics]);

  const results = useMemo(() => {
    if (!topics) return [];
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = norm(query).split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const out: CorpusTopic["quotes"] = [];
    const source = words.length ? topics : topics.filter((t) => t.id === topicId);
    for (const topic of source) {
      for (const q of topic.quotes) {
        if (q.text.length > QUOTE_MAX || seen.has(q.text)) continue;
        if (words.length) {
          const hay = norm(`${q.text} ${q.reference}`);
          if (!words.every((w) => hay.includes(w))) continue;
        }
        seen.add(q.text);
        out.push(q);
        if (out.length >= 40) return out;
      }
    }
    return out;
  }, [topics, topicId, query]);

  return (
    <div className="mt-2">
      {value && (
        <div className="mb-3 rounded-xl border border-black/[0.06] bg-bg/40 p-3">
          <p className="font-display text-[14px] italic leading-snug text-dark">«{value.text}»</p>
          <p className="mt-1 text-[11px] text-muted">{value.reference}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="tap rounded-xl border border-terra/30 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra"
        >
          {open ? "Cerrar" : value ? "Elegir otra" : "Elegir una cita"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="tap rounded-xl border border-black/10 px-3.5 py-2 text-[12px] font-semibold text-muted"
          >
            Quitar la cita
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3">
          {failed && <p className="text-[12px] text-rose-700">No se pudieron cargar las citas.</p>}
          {!topics && !failed && <p className="text-[12px] text-muted">Cargando…</p>}
          {topics && (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  disabled={query.trim() !== ""}
                  aria-label="Tema"
                  className="w-full rounded-xl border border-black/10 bg-card px-3 py-2 text-[13px] text-dark disabled:opacity-50"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="O buscar en todos los temas…"
                  aria-label="Buscar una cita"
                  className="w-full rounded-xl border border-black/10 bg-card px-3 py-2 text-[13px] text-dark outline-none placeholder:text-muted focus:border-terra"
                />
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Solo las citas cortas, que son las que entran en la imagen.
              </p>
              <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                {results.length === 0 && (
                  <li className="text-[12px] text-muted">No hay citas cortas con eso.</li>
                )}
                {results.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ text: q.text, reference: q.reference });
                        setOpen(false);
                      }}
                      className="tap w-full rounded-xl border border-black/[0.06] bg-card p-3 text-left hover:border-terra/40"
                    >
                      <span className="block font-display text-[14px] italic leading-snug text-dark">
                        «{q.text}»
                      </span>
                      <span className="mt-1 block text-[11px] text-muted">{q.reference}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
