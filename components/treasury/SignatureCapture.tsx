"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cómo entra la firma del Tesorero/a al recibo sin tener un PNG a mano,
 * que casi nadie tiene. Dos caminos, y los dos terminan en lo mismo: un
 * PNG con fondo transparente, recortado al trazo, que es lo que mejor
 * queda en el renglón de la firma (170 × 46 px en la hoja).
 *
 *  · **Dibujar**: con el dedo en el celular o con el mouse. El trazo se
 *    suaviza con curvas entre los puntos medios y engorda un poco cuando
 *    el movimiento es lento, como una lapicera.
 *  · **Foto o imagen**: la firma en un papel blanco, fotografiada con el
 *    celular (o una imagen ya escaneada). Se le saca el fondo en el
 *    navegador: cada píxel se compara contra el fondo de SU zona —una
 *    versión muy borrosa de la misma foto—, así una sombra o un papel
 *    amarillento no se confunden con tinta. Lo oscuro respecto de su zona
 *    queda, con su color (la birome azul sigue azul); el resto se vuelve
 *    transparente. Un control deja pedir más o menos trazo.
 *
 * Nada de esto sube nada: entrega el archivo y quien lo usa decide.
 */
export function SignatureCapture({
  onChange,
  disabled,
}: {
  /** El PNG listo, o null si se descartó. */
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"dibujar" | "foto">("dibujar");

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="mb-3 inline-flex rounded-lg bg-bg p-0.5 text-[12px] font-semibold">
        {(
          [
            ["dibujar", "Dibujarla"],
            ["foto", "Foto de la firma en papel"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            aria-pressed={mode === key}
            className={`tap rounded-md px-3 py-1.5 transition ${
              mode === key ? "bg-white text-dark shadow-card-soft" : "text-muted hover:text-dark"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "dibujar" ? (
        <DrawPad onChange={onChange} disabled={disabled} />
      ) : (
        <PhotoCleaner onChange={onChange} disabled={disabled} />
      )}
    </div>
  );
}

const INK = "#1b2240";

// ─── Dibujar ─────────────────────────────────────────────────────

type Pt = { x: number; y: number; t: number };

function DrawPad({
  onChange,
  disabled,
}: {
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const current = useRef<Pt[] | null>(null);
  const [empty, setEmpty] = useState(true);
  const [used, setUsed] = useState(false);

  /** Ajusta el lienzo a su tamaño en pantalla y a la densidad de píxeles,
   *  y vuelve a dibujar lo que haya (girar el teléfono no lo borra). */
  const fit = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw(ctx, strokes.current, r.width);
  }, []);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  function point(e: React.PointerEvent<HTMLCanvasElement>): Pt {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = [point(e)];
    strokes.current.push(current.current);
    setEmpty(false);
    setUsed(false);
    paint();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return;
    // Los eventos agrupados dan un trazo más fino en celulares rápidos.
    // Algunos navegadores devuelven la lista vacía: entonces vale el evento.
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const events = coalesced.length > 0 ? coalesced : [e.nativeEvent];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of events) {
      current.current.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, t: ev.timeStamp });
    }
    paint();
  }

  function onUp() {
    current.current = null;
  }

  function paint() {
    const c = canvasRef.current;
    if (!c) return;
    redraw(c.getContext("2d")!, strokes.current, c.getBoundingClientRect().width);
  }

  function clear() {
    strokes.current = [];
    setEmpty(true);
    setUsed(false);
    paint();
    onChange(null);
  }

  async function use() {
    const c = canvasRef.current;
    if (!c || empty) return;
    const file = await canvasToTrimmedPng(c, "firma-dibujada.png");
    if (!file) return;
    onChange(file);
    setUsed(true);
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="block aspect-[3/1] w-full cursor-crosshair rounded-lg border border-dashed border-black/20 bg-white"
          style={{ touchAction: "none" }}
          aria-label="Espacio para dibujar la firma"
        />
        {/* El renglón, para que la firma no salga torcida o diminuta. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-[22%] border-b border-black/15" />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-muted">
            Firmá acá, con el dedo o el mouse
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted">
          En el celular conviene girarlo: queda más espacio para firmar.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clear}
            disabled={empty || disabled}
            className="tap rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-dark hover:bg-bg disabled:opacity-50"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={use}
            disabled={empty || disabled}
            className="tap rounded-lg bg-terra px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-terra-light disabled:opacity-50"
          >
            {used ? "✓ En la vista previa" : "Usar esta firma"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ancho del trazo según la velocidad: lento engorda, rápido afina. */
function widthFor(a: Pt, b: Pt, base: number): number {
  const dt = Math.max(1, b.t - a.t);
  const v = Math.hypot(b.x - a.x, b.y - a.y) / dt; // px por ms
  return Math.max(base * 0.55, Math.min(base * 1.35, base * (1.35 - v * 0.35)));
}

function redraw(ctx: CanvasRenderingContext2D, strokes: Pt[][], cssWidth: number) {
  const c = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.restore();
  // El grosor sigue al ancho del lienzo: firmar en el celular y en la PC
  // da una firma proporcionada igual.
  const base = Math.max(2.4, cssWidth / 125);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.length === 1) {
      ctx.beginPath();
      ctx.arc(s[0].x, s[0].y, base / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // Curvas entre puntos medios: el trazo no se ve como una poligonal.
    for (let i = 1; i < s.length; i++) {
      const p0 = s[i - 1];
      const p1 = s[i];
      const prev = i > 1 ? s[i - 2] : p0;
      ctx.beginPath();
      ctx.lineWidth = widthFor(p0, p1, base);
      ctx.moveTo((prev.x + p0.x) / 2, (prev.y + p0.y) / 2);
      ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      if (i === s.length - 1) ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }
}

// ─── Foto o imagen ───────────────────────────────────────────────

function PhotoCleaner({
  onChange,
  disabled,
}: {
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [source, setSource] = useState<ImageData | null>(null);
  const [background, setBackground] = useState<Uint8ClampedArray | null>(null);
  /** Cuánto más oscuro que su zona tiene que ser un píxel para ser tinta. */
  const [strength, setStrength] = useState(50);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const urlRef = useRef<string | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    setWorking(true);
    try {
      const img = await loadImage(f);
      const { data, bg } = prepare(img);
      setSource(data);
      setBackground(bg);
    } catch {
      setError("No se pudo leer la imagen. Probá con otra foto.");
    } finally {
      setWorking(false);
    }
  }

  // Cada vez que cambia la foto o el control, se vuelve a limpiar.
  useEffect(() => {
    if (!source || !background) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const file = await cleanToPng(source, background, strength);
      if (cancelled) return;
      if (!file) {
        setResult(null);
        setError("No se encontró ningún trazo. Probá con más trazo o con una foto más cerca.");
        onChange(null);
        return;
      }
      setError(null);
      const url = URL.createObjectURL(file);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setResult(url);
      onChange(file);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // onChange cambia en cada render del padre; no es un disparador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, background, strength]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-muted">
        Firmá en un papel blanco con birome oscura, sacale una foto de cerca y
        con buena luz, sin sombra encima. La app le saca el fondo sola. También
        sirve una firma ya escaneada.
      </p>
      <label className="tap inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-terra/25 bg-terra/[0.05] px-3 py-2 text-[12.5px] font-semibold text-terra hover:bg-terra/10">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {working ? "Leyendo la foto…" : source ? "Usar otra foto" : "Sacar la foto o elegir una imagen"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled || working}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {source && (
        <>
          <div
            className="flex min-h-[90px] items-center justify-center rounded-lg border border-line p-3"
            // Damero: así se ve que el fondo quedó transparente de verdad.
            style={{
              backgroundImage:
                "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
            }}
          >
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result} alt="Firma con el fondo quitado" className="max-h-[120px] max-w-full object-contain" />
            ) : (
              <span className="text-[12px] text-muted">…</span>
            )}
          </div>
          <label className="flex items-center gap-3 text-[12px] text-dark">
            <span className="shrink-0 text-muted">Menos trazo</span>
            <input
              type="range"
              min={0}
              max={100}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className="w-full accent-terra"
            />
            <span className="shrink-0 text-muted">Más trazo</span>
          </label>
          <p className="text-[11px] text-muted">
            Si aparecen manchas o el borde del papel, mové hacia «menos trazo»;
            si la firma sale cortada o muy fina, hacia «más trazo».
          </p>
        </>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</p>}
    </div>
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagen"));
    };
    img.src = url;
  });
}

/** Lado mayor de trabajo: alcanza para el renglón y no traba un celular. */
const WORK_SIZE = 1400;

/**
 * La foto achicada y el fondo de cada zona. El fondo sale de dibujar la
 * foto muy chica (1/24) con suavizado y volver a agrandarla: el trazo
 * desaparece y queda solo cómo varía la luz del papel.
 */
function prepare(img: HTMLImageElement): { data: ImageData; bg: Uint8ClampedArray } {
  const scale = Math.min(1, WORK_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  // Sobre blanco: un PNG que ya era transparente tiene el fondo en negro
  // con alfa 0, y sin esto saldría todo como tinta.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);

  const sw = Math.max(2, Math.round(w / 24));
  const sh = Math.max(2, Math.round(h / 24));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingQuality = "high";
  // Un poco de "cierre": dibujar la foto aclarada evita que un trazo
  // grueso tiña el fondo de su zona.
  sctx.filter = "blur(1px) brightness(1.05)";
  sctx.drawImage(c, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, w, h);
  ctx.filter = "blur(6px)";
  ctx.drawImage(small, 0, 0, w, h);
  ctx.filter = "none";
  const bgData = ctx.getImageData(0, 0, w, h).data;
  const bg = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; j < bg.length; i += 4, j++) {
    bg[j] = lum(bgData[i], bgData[i + 1], bgData[i + 2]);
  }
  return { data, bg };
}

function lum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Tinta = lo bastante más oscuro que el fondo de su zona. `strength` (0 a
 * 100) mueve el umbral: con más, entra trazo más claro. La transparencia
 * es gradual en una franja angosta, para que el borde no salga dentado.
 */
async function cleanToPng(
  src: ImageData,
  bg: Uint8ClampedArray,
  strength: number
): Promise<File | null> {
  const { width: w, height: h, data } = src;
  const out = new ImageData(w, h);
  const o = out.data;
  // Proporción de oscuridad respecto del fondo a partir de la cual es tinta.
  const cut = 0.22 - (strength / 100) * 0.16; // 0.22 (poco) … 0.06 (mucho)
  const band = 0.08;
  for (let i = 0, j = 0; j < bg.length; i += 4, j++) {
    const b = Math.max(1, bg[j]);
    const dark = 1 - lum(data[i], data[i + 1], data[i + 2]) / b;
    const a = Math.max(0, Math.min(1, (dark - cut) / band));
    if (a === 0) continue;
    // El color de la tinta, oscurecido: la birome azul sigue azul pero
    // con cuerpo, aunque la foto haya salido lavada.
    o[i] = data[i] * 0.55;
    o[i + 1] = data[i + 1] * 0.55;
    o[i + 2] = data[i + 2] * 0.55;
    o[i + 3] = Math.round(a * 255);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(out, 0, 0);
  return canvasToTrimmedPng(c, "firma-foto.png", true);
}

/**
 * Recorta el lienzo al trazo (con un margen) y lo devuelve como PNG.
 * `ignoreSpecks`: en una foto, una mota suelta en una esquina no puede
 * estirar el recorte. Se mira la imagen en una grilla gruesa y se buscan
 * las zonas de tinta conectadas: el trazo de una firma es continuo y forma
 * zonas grandes; el ruido, chicas. (Contar píxeles por columna no sirve:
 * una firma de trazo fino tiene pocos por columna y se recortaba.)
 */
async function canvasToTrimmedPng(
  canvas: HTMLCanvasElement,
  name: string,
  ignoreSpecks = false
): Promise<File | null> {
  const w = canvas.width;
  const h = canvas.height;
  const px = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const cell = ignoreSpecks ? Math.max(4, Math.round(Math.max(w, h) / 180)) : 1;
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid = new Uint16Array(gw * gh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 96) grid[((y / cell) | 0) * gw + ((x / cell) | 0)]++;
    }
  }
  const inked = (gx: number, gy: number) =>
    gx >= 0 && gy >= 0 && gx < gw && gy < gh && grid[gy * gw + gx] >= (ignoreSpecks ? 2 : 1);

  // Zonas conectadas de la grilla (8 vecinos). Con la limpieza de una
  // foto quedan la firma —una o pocas zonas grandes— y motas de ruido: se
  // conservan las zonas que pesan al menos un 8 % de la mayor.
  const label = new Int32Array(gw * gh).fill(-1);
  const comps: { size: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let start = 0; start < gw * gh; start++) {
    if (label[start] !== -1 || !inked(start % gw, (start / gw) | 0)) continue;
    const comp = { size: 0, x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
    const stack = [start];
    label[start] = comps.length;
    while (stack.length) {
      const k = stack.pop()!;
      const gx = k % gw;
      const gy = (k / gw) | 0;
      comp.size++;
      comp.x0 = Math.min(comp.x0, gx);
      comp.y0 = Math.min(comp.y0, gy);
      comp.x1 = Math.max(comp.x1, gx);
      comp.y1 = Math.max(comp.y1, gy);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (!inked(nx, ny)) continue;
          const nk = ny * gw + nx;
          if (label[nk] !== -1) continue;
          label[nk] = comps.length;
          stack.push(nk);
        }
    }
    comps.push(comp);
  }
  if (comps.length === 0) return null;
  const biggest = Math.max(...comps.map((c) => c.size));
  const keep = ignoreSpecks ? comps.filter((c) => c.size >= Math.max(2, biggest * 0.08)) : comps;
  const x0 = Math.min(...keep.map((c) => c.x0)) * cell;
  const y0 = Math.min(...keep.map((c) => c.y0)) * cell;
  const x1 = Math.min(w - 1, Math.max(...keep.map((c) => c.x1)) * cell + cell - 1);
  const y1 = Math.min(h - 1, Math.max(...keep.map((c) => c.y1)) * cell + cell - 1);
  if (x0 >= x1 || y0 >= y1) return null;

  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04) + 2;
  const sx = Math.max(0, x0 - pad);
  const sy = Math.max(0, y0 - pad);
  const sw = Math.min(w, x1 + pad) - sx;
  const sh = Math.min(h, y1 + pad) - sy;

  // Más de 1200 px de ancho no suma nada en un renglón de 170.
  const k = Math.min(1, 1200 / sw);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * k));
  out.height = Math.max(1, Math.round(sh * k));
  const octx = out.getContext("2d")!;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);

  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/png"));
  return blob ? new File([blob], name, { type: "image/png" }) : null;
}
