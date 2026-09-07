"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BahaiStar } from "@/components/BahaiStar";
import type {
  FeastProgram,
  FeastProgramNewsSection,
  FeastProgramPrayer,
} from "@/lib/feast-program";

/**
 * El programa de la Fiesta de los Diecinueve Días como presentación: una
 * diapositiva por pantalla, para proyectar en la Fiesta y para leer en el
 * celular. Fondo noche y dorado, distinto del resto de la app a propósito:
 * es lo que se ve en la pared, no una pantalla más.
 *
 * No decide contenido: lo recibe armado de buildFeastProgram() (la misma
 * estructura que lee el folleto PDF). Acá solo se elige qué secciones
 * tienen algo y merecen una diapositiva.
 *
 * Mecánica igual a la del deck de Tesorería (ReportDeck): flechas y
 * espacio, swipe, pantalla completa, y TODAS las diapositivas en el DOM
 * ocultando la que no toca. Sin botón de imprimir: el PDF de la Fiesta es
 * el folleto (FeastBooklet), no una copia de las diapositivas oscuras.
 */

type Slide = { key: string; node: React.ReactNode };

export function FeastDeck({
  program,
  backHref,
  pdfHref,
}: {
  program: FeastProgram;
  backHref: string;
  pdfHref: string;
}) {
  const slides = useMemo(() => buildSlides(program), [program]);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const total = slides.length;

  const go = useCallback(
    (n: number) => setIndex((prev) => Math.min(Math.max(n, 0), total - 1)),
    [total]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIndex((p) => Math.min(p + 1, total - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((p) => Math.max(p - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  // Al cambiar de diapositiva, la nueva arranca desde arriba (una oración
  // larga en el celular scrollea; la siguiente no tiene que heredarlo).
  useEffect(() => {
    const active = stageRef.current?.querySelector<HTMLElement>(".fd-active");
    if (!active) return;
    active.scrollTo(0, 0);
    // Reiniciar la aparición escalonada de los textos. Al pasar de
    // display:none a flex el navegador suele reiniciar las animaciones,
    // pero no siempre (varias diapositivas seguidas rápido, pestaña de
    // fondo): forzarlo con un reflow es barato y determinístico.
    active.querySelectorAll<HTMLElement>(".fd-reveal").forEach((el) => {
      el.style.animation = "none";
      void el.offsetHeight;
      el.style.animation = "";
    });
  }, [index]);

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Safari en iPhone no lo permite: el botón queda sin efecto.
    }
  }

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(index + (dx < 0 ? 1 : -1));
  }

  return (
    <div className="fd-root">
      {/* Como HTML crudo: React escapa las comillas de `content: ""` dentro
          de <style> y el servidor y el cliente dejan de coincidir. */}
      <style dangerouslySetInnerHTML={{ __html: DECK_CSS }} />
      <Rosette />

      <div className="fd-brand">
        <BahaiStar size={14} color="#d9b674" />
        <span>A.E.L. de los Bahá&apos;ís de {program.localityName}</span>
        {program.status === "draft" && <em className="fd-draft">Borrador</em>}
      </div>

      <div className="fd-tools">
        <span className="fd-counter">
          <b>{index + 1}</b> — {total}
        </span>
        <button
          type="button"
          className="fd-tool fd-tool-wide"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {fullscreen ? "Salir" : "Pantalla completa"}
        </button>
        <a
          href={pdfHref}
          target="_blank"
          rel="noopener"
          className="fd-tool"
          aria-label="Descargar el folleto en PDF"
        >
          PDF
        </a>
        <Link href={backHref} className="fd-tool" aria-label="Cerrar la presentación">
          ✕
        </Link>
      </div>

      <div
        className="fd-stage"
        ref={stageRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((s, i) => (
          <section
            key={s.key}
            className={i === index ? "fd-slide fd-active" : "fd-slide fd-off"}
            aria-hidden={i !== index}
          >
            {s.node}
          </section>
        ))}
      </div>

      <div className="fd-nav">
        <button
          type="button"
          aria-label="Anterior"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          ‹
        </button>
        <div className="fd-track">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Ir a la diapositiva ${i + 1}`}
              className={i <= index ? "on" : ""}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Siguiente"
          disabled={index === total - 1}
          onClick={() => go(index + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Armado de las diapositivas ──────────────────────────────────

function buildSlides(p: FeastProgram): Slide[] {
  const slides: Slide[] = [];

  slides.push({ key: "cover", node: <Cover p={p} /> });
  slides.push({ key: "program", node: <ProgramOutline p={p} /> });

  slides.push({
    key: "div-1",
    node: (
      <Divider
        numeral="I"
        title="Porción Devocional"
        text={devotionalIntro(p)}
      />
    ),
  });
  p.prayers.forEach((prayer, i) => {
    slides.push({ key: `prayer-${i}`, node: <Prayer prayer={prayer} /> });
  });
  if (p.deepening) {
    slides.push({
      key: "deepening",
      node: (
        <Scroll
          label="Profundización"
          theme={p.deepening.theme}
          body={p.deepening.content ?? ""}
          size={sizeFor(p.deepening.content ?? "")}
        />
      ),
    });
  }

  slides.push({
    key: "div-2",
    node: (
      <Divider
        numeral="II"
        title="Porción Administrativa"
        text="Noticias de la comunidad mundial, nacional y local · Informe de Tesorería · Consulta y aportes de la comunidad."
      />
    ),
  });
  p.news.forEach((section) => {
    slides.push({ key: `news-${section.scope}`, node: <News section={section} /> });
  });
  if (p.communique) {
    slides.push({
      key: "communique",
      node: (
        <Scroll
          label="Comunicado de la Asamblea"
          theme={null}
          body={p.communique}
          size={sizeFor(p.communique)}
          source={`Asamblea Espiritual Local de los Bahá'ís de ${p.localityName}`}
        />
      ),
    });
  }
  if (p.treasury) {
    slides.push({ key: "treasury", node: <Treasury p={p} /> });
  }

  slides.push({ key: "closing", node: <Closing p={p} /> });
  return slides;
}

function devotionalIntro(p: FeastProgram): string {
  const parts: string[] = [];
  const n = p.prayers.length;
  if (n === 1) parts.push("una oración");
  else if (n > 1) parts.push(`${NUMBER_WORDS[n] ?? n} oraciones`);
  if (p.deepening) parts.push("un pasaje de los Escritos para profundizar");
  if (parts.length === 0) return "Oraciones y lectura de los Escritos Sagrados.";
  const joined = parts.join(" y ");
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}${
    p.monthMeaning ? `, en el mes de ${p.monthName}, «${p.monthMeaning}».` : "."
  }`;
}

const NUMBER_WORDS: Record<number, string> = {
  2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve",
};

function sizeFor(text: string): "lg" | "md" | "sm" {
  if (text.length < 380) return "lg";
  if (text.length < 900) return "md";
  return "sm";
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Diapositivas ────────────────────────────────────────────────

function Cover({ p }: { p: FeastProgram }) {
  return (
    <div className="fd-cover">
      <div className="fd-kicker fd-reveal d1">Fiesta de los Diecinueve Días</div>
      <h1 className="fd-reveal d2">{p.monthName}</h1>
      <div className="fd-translit fd-reveal d3">
        {p.monthMeaning ? `«${p.monthMeaning}» · ` : ""}
        {p.monthOrdinal} del año {p.bahaiYear} E.B.
      </div>
      <div className="fd-meta fd-reveal d4">
        <div>Asamblea Espiritual Local de los Bahá&apos;ís de {p.localityName}</div>
        {p.celebrationLabel && <b>{p.celebrationLabel}</b>}
      </div>
      {p.locations.length > 0 && (
        <ul className="fd-places fd-reveal d5">
          {p.locations.map((l, i) => (
            <li key={i}>
              <span>{l.name}</span>
              {l.address && <span className="fd-dim"> · {l.address}</span>}
              <span className="fd-dim"> · {l.when}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgramOutline({ p }: { p: FeastProgram }) {
  return (
    <>
      <div className="fd-head">
        <div className="fd-kicker fd-reveal d1">Bienvenidos</div>
        <h2 className="fd-reveal d2">Programa de la Fiesta</h2>
        <p className="fd-sub fd-reveal d3">Tres porciones, un solo espíritu</p>
      </div>
      <div className="fd-cols fd-reveal d4">
        <div className="fd-col">
          <div className="fd-n">I</div>
          <h3>Devocional</h3>
          <p>Oraciones y lectura de los Escritos Sagrados.</p>
        </div>
        <div className="fd-col">
          <div className="fd-n">II</div>
          <h3>Administrativa</h3>
          <p>Noticias de la comunidad mundial, nacional y local. Informe de Tesorería y consulta.</p>
        </div>
        <div className="fd-col">
          <div className="fd-n">III</div>
          <h3>Social</h3>
          <p>Compañerismo, música y refrigerio compartido.</p>
        </div>
      </div>
      {p.monthMeaning && (
        <div className="fd-footnote fd-center fd-reveal d5">
          <div>
            <b>{p.monthName}</b> significa «{p.monthMeaning}». Cada mes del
            calendario bahá&apos;í lleva el nombre de un atributo de Dios, y nos
            invita a reflejarlo en nuestras acciones y en la vida de esta
            comunidad.
          </div>
        </div>
      )}
    </>
  );
}

function Divider({
  numeral,
  title,
  text,
}: {
  numeral: string;
  title: string;
  text: string;
}) {
  return (
    <div className="fd-divider">
      <div className="fd-roman fd-reveal d1">{numeral}</div>
      <h2 className="fd-reveal d2">{title}</h2>
      <div className="fd-hair fd-reveal d3" />
      <p className="fd-reveal d4">{text}</p>
    </div>
  );
}

function Prayer({ prayer }: { prayer: FeastProgramPrayer }) {
  return (
    <Scroll
      label={prayer.label}
      theme={prayer.title ? `«${prayer.title}»` : null}
      body={prayer.body}
      size={prayer.size}
      source={prayer.reference}
    />
  );
}

function Scroll({
  label,
  theme,
  body,
  size,
  source,
}: {
  label: string;
  theme: string | null;
  body: string;
  size: "lg" | "md" | "sm";
  source?: string | null;
}) {
  const paras = paragraphs(body);
  return (
    <div className="fd-scroll">
      <div className="fd-label fd-reveal d1">{label}</div>
      {theme && <div className="fd-theme fd-reveal d2">{theme}</div>}
      <div className={`fd-body fd-body-${size} ${paras.length > 1 ? "fd-para" : ""} fd-reveal d3`}>
        {paras.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
      {source && <div className="fd-src fd-reveal d4">{source}</div>}
    </div>
  );
}

function News({ section }: { section: FeastProgramNewsSection }) {
  return (
    <>
      <div className="fd-head">
        <div className="fd-kicker fd-reveal d1">{section.kicker}</div>
        <h2 className="fd-reveal d2">{section.title}</h2>
        <p className="fd-sub fd-reveal d3">{section.sub}</p>
      </div>
      <div className="fd-tl fd-reveal d4">
        {section.items.map((n) => (
          <div className="fd-tl-item" key={n.id}>
            <div className="fd-tl-copy">
              {n.date_label && <div className="fd-tl-date">{n.date_label}</div>}
              <div className="fd-tl-title">{n.title}</div>
              {n.body && <div className="fd-tl-body">{n.body}</div>}
            </div>
            {n.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="fd-tl-thumb"
                src={n.image_url}
                alt=""
                loading="eager"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Treasury({ p }: { p: FeastProgram }) {
  const t = p.treasury!;
  return (
    <>
      <div className="fd-head">
        <div className="fd-kicker fd-reveal d1">Porción Administrativa</div>
        <h2 className="fd-reveal d2">Informe de Tesorería</h2>
        <p className="fd-sub fd-reveal d3">
          {t.kind === "report"
            ? [t.title, t.subtitle].filter(Boolean).join(" · ")
            : "Fondo Local · movimiento del mes"}
        </p>
      </div>
      {t.kind === "report" ? (
        <div className="fd-center fd-reveal d4">
          <a className="fd-cta" href={t.href} target="_blank" rel="noopener">
            Abrir el informe →
          </a>
          <p className="fd-note">
            El informe se proyecta como presentación aparte y queda
            disponible en la app para toda la comunidad.
          </p>
        </div>
      ) : (
        <div className="fd-stats fd-reveal d4">
          <Stat label="Ingresos" value={t.income} />
          <Stat label="Egresos" value={t.expenses} />
          <Stat label="Estado final" value={t.final} strong />
          {t.pdfUrl && (
            <a className="fd-cta fd-cta-sm" href={t.pdfUrl} target="_blank" rel="noopener">
              Informe completo (PDF) →
            </a>
          )}
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  return (
    <div className={`fd-stat ${strong ? "fd-stat-strong" : ""}`}>
      <div className="fd-stat-value">
        {value != null ? value.toLocaleString("es-UY", { maximumFractionDigits: 0 }) : "—"}
      </div>
      <div className="fd-stat-label">{label}</div>
    </div>
  );
}

function Closing({ p }: { p: FeastProgram }) {
  return (
    <div className="fd-divider fd-closing">
      <div className="fd-roman fd-reveal d1">III</div>
      <h2 className="fd-reveal d2">Porción Social</h2>
      <div className="fd-hair fd-reveal d3" />
      <p className="fd-reveal d4">
        Compartamos ahora el compañerismo, la música y el refrigerio que
        preparó la comunidad.
      </p>
      <div className="fd-sig fd-reveal d5">
        Con amor
        <div className="fd-sig-name">
          Asamblea Espiritual Local de los Bahá&apos;ís de {p.localityName}
        </div>
      </div>
    </div>
  );
}

/** Rosetón de nueve círculos, girando muy despacio detrás de todo. */
function Rosette() {
  const cx = 200;
  const cy = 200;
  const R = 170;
  const N = 9;
  const circles = Array.from({ length: N }, (_, i) => {
    const a = (2 * Math.PI * i) / N - Math.PI / 2;
    return (
      <circle
        key={`c${i}`}
        cx={(cx + R * 0.5 * Math.cos(a)).toFixed(2)}
        cy={(cy + R * 0.5 * Math.sin(a)).toFixed(2)}
        r={(R * 0.5).toFixed(2)}
        fill="none"
        stroke="#d4af6a"
        strokeWidth="0.5"
      />
    );
  });
  const lines = Array.from({ length: N }, (_, i) => {
    const a1 = (2 * Math.PI * i) / N - Math.PI / 2;
    const a2 = (2 * Math.PI * ((i + 4) % N)) / N - Math.PI / 2;
    return (
      <line
        key={`l${i}`}
        x1={(cx + R * Math.cos(a1)).toFixed(2)}
        y1={(cy + R * Math.sin(a1)).toFixed(2)}
        x2={(cx + R * Math.cos(a2)).toFixed(2)}
        y2={(cy + R * Math.sin(a2)).toFixed(2)}
        stroke="#d4af6a"
        strokeWidth="0.4"
      />
    );
  });
  return (
    <svg className="fd-rosette" viewBox="0 0 400 400" aria-hidden="true">
      {circles}
      {lines}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#d4af6a" strokeWidth="0.6" />
    </svg>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────
//
// Inline porque son de esta pantalla sola y porque la estética (noche y
// dorado, tipografía grande con clamp) no tiene nada que ver con el
// resto de la app. Las fuentes son las que ya carga el layout raíz.

const DECK_CSS = `
.fd-root {
  --night: #0d1426; --night-2: #131d36;
  --line: rgba(212,175,106,.24); --line-2: rgba(212,175,106,.13);
  --ivory: #f4efe5; --mist: #a3aeca;
  --gold: #d9b674; --gold-bright: #eed090; --gold-dim: #b0925a;
  position: fixed; inset: 0; z-index: 50; overflow: hidden;
  color: var(--ivory);
  font-family: var(--font-outfit), system-ui, sans-serif;
  background:
    radial-gradient(900px 620px at 50% -8%, rgba(60,82,140,.42) 0%, transparent 62%),
    radial-gradient(700px 520px at 92% 104%, rgba(212,175,106,.13) 0%, transparent 60%),
    linear-gradient(175deg, var(--night-2) 0%, var(--night) 58%, #080e1c 100%);
  -webkit-font-smoothing: antialiased;
}
.fd-root::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image:
    radial-gradient(1.4px 1.4px at 12% 22%, rgba(255,255,255,.55), transparent),
    radial-gradient(1px 1px at 78% 14%, rgba(255,255,255,.4), transparent),
    radial-gradient(1.2px 1.2px at 33% 78%, rgba(255,255,255,.35), transparent),
    radial-gradient(1px 1px at 64% 62%, rgba(255,255,255,.3), transparent),
    radial-gradient(1.6px 1.6px at 88% 74%, rgba(255,255,255,.28), transparent),
    radial-gradient(1px 1px at 22% 52%, rgba(255,255,255,.25), transparent);
}
.fd-rosette {
  position: absolute; top: 50%; left: 50%; width: min(150vh,150vw); height: min(150vh,150vw);
  transform: translate(-50%,-50%); pointer-events: none; opacity: .12;
  animation: fdSpin 320s linear infinite;
}
@keyframes fdSpin { to { transform: translate(-50%,-50%) rotate(360deg); } }

.fd-stage { position: absolute; inset: 0; }
.fd-slide {
  position: absolute; inset: 0; display: none; flex-direction: column;
  align-items: center; justify-content: flex-start;
  padding: clamp(64px,9vh,88px) clamp(20px,5vw,80px) clamp(84px,11vh,104px);
  overflow-y: auto; overflow-x: hidden;
  padding-top: calc(clamp(64px,9vh,88px) + var(--safe-top, 0px));
  padding-bottom: calc(clamp(84px,11vh,104px) + var(--safe-bottom, 0px));
}
.fd-slide::before { content: ""; margin-top: auto; flex: none; }
.fd-slide::after { content: ""; margin-bottom: auto; flex: none; }
.fd-slide.fd-active { display: flex; animation: fdFade .8s cubic-bezier(.16,.8,.3,1) both; }
@keyframes fdFade { from { opacity: 0; } to { opacity: 1; } }
.fd-slide::-webkit-scrollbar { width: 5px; }
.fd-slide::-webkit-scrollbar-thumb { background: var(--line); border-radius: 3px; }

.fd-reveal { opacity: 0; animation: fdRise .8s cubic-bezier(.16,.8,.3,1) forwards; }
@keyframes fdRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.d1 { animation-delay: .08s } .d2 { animation-delay: .20s } .d3 { animation-delay: .32s }
.d4 { animation-delay: .44s } .d5 { animation-delay: .56s }

.fd-kicker {
  font-weight: 500; font-size: clamp(.8rem,1.6vw,.98rem);
  letter-spacing: .4em; text-transform: uppercase; color: var(--gold);
}
.fd-root h1, .fd-root h2 {
  font-family: var(--font-cormorant), Georgia, serif; font-weight: 400;
  color: var(--ivory); line-height: 1.04; margin: 0;
}
.fd-hair { height: 1px; width: 100%; background: linear-gradient(90deg,transparent,var(--line) 12%,var(--line) 88%,transparent); }
.fd-dim { color: var(--mist); }
.fd-center { text-align: center; }

/* Portada */
.fd-cover { text-align: center; max-width: 940px; }
.fd-cover h1 { font-size: clamp(4.2rem,15vw,10.5rem); letter-spacing: .02em; text-shadow: 0 0 70px rgba(212,175,106,.3); }
.fd-translit {
  font-family: var(--font-cormorant), Georgia, serif; font-style: italic; font-weight: 400;
  font-size: clamp(1.3rem,3.2vw,2.1rem); color: var(--gold-bright); margin-top: .35rem; letter-spacing: .04em;
}
.fd-meta {
  margin-top: clamp(26px,4.2vh,42px); display: flex; flex-direction: column; gap: .7rem; align-items: center;
  font-size: clamp(.92rem,1.9vw,1.15rem); letter-spacing: .14em; text-transform: uppercase; color: var(--mist);
}
.fd-meta b { color: var(--ivory); font-weight: 500; }
.fd-places {
  list-style: none; margin: clamp(18px,3vh,28px) auto 0; padding: 0;
  font-size: clamp(.95rem,1.8vw,1.12rem); color: var(--ivory); line-height: 1.8;
}

/* Encabezado de sección */
.fd-head { text-align: center; margin-bottom: clamp(28px,4.5vh,46px); width: 100%; max-width: 960px; }
.fd-head h2 { font-size: clamp(2.2rem,5.8vw,3.8rem); margin-top: .7rem; }
.fd-sub { color: var(--mist); margin: .8rem 0 0; font-size: clamp(1rem,2.1vw,1.28rem); font-weight: 300; }

/* Divisor */
.fd-divider { text-align: center; max-width: 720px; }
.fd-roman {
  font-family: var(--font-cormorant), Georgia, serif; font-weight: 400;
  font-size: clamp(4.5rem,13vw,8rem); color: var(--gold); opacity: .35; line-height: .9;
}
.fd-divider h2 { font-size: clamp(2.4rem,6.4vw,4rem); margin-top: .2rem; }
.fd-divider .fd-hair { margin: clamp(22px,3.4vh,34px) 0; }
.fd-divider p { color: var(--mist); font-size: clamp(1.1rem,2.4vw,1.45rem); line-height: 1.7; font-weight: 300; margin: 0; }

/* Programa en tres columnas */
.fd-cols { display: grid; grid-template-columns: repeat(3,1fr); width: 100%; max-width: 1020px; }
.fd-col { padding: clamp(18px,2.6vw,30px) clamp(18px,2.6vw,34px); border-left: 1px solid var(--line-2); }
.fd-col:first-child { border-left: none; }
@media (max-width: 900px) {
  .fd-cols { grid-template-columns: 1fr; }
  .fd-col { border-left: none; border-top: 1px solid var(--line-2); }
  .fd-col:first-child { border-top: none; }
}
.fd-n { font-family: var(--font-cormorant), Georgia, serif; font-size: 2.1rem; color: var(--gold); opacity: .5; line-height: 1; }
.fd-col h3 { font-family: var(--font-cormorant), Georgia, serif; font-weight: 500; font-size: clamp(1.7rem,3.4vw,2.2rem); margin: .35rem 0 0; color: var(--ivory); }
.fd-col p { color: var(--mist); font-size: clamp(1.02rem,2vw,1.22rem); line-height: 1.65; margin: .7rem 0 0; font-weight: 300; }

.fd-footnote {
  width: 100%; max-width: 800px; margin-top: clamp(22px,3vh,32px);
  color: var(--mist); font-size: clamp(1.02rem,2vw,1.22rem); font-weight: 300; line-height: 1.7;
}
.fd-footnote b { color: var(--ivory); font-weight: 500; }

/* Texto sagrado / comunicado */
.fd-scroll { width: 100%; max-width: 1000px; text-align: center; }
.fd-label { font-weight: 500; font-size: clamp(.8rem,1.6vw,.98rem); letter-spacing: .36em; text-transform: uppercase; color: var(--gold-dim); }
.fd-theme {
  font-family: var(--font-cormorant), Georgia, serif; font-style: italic; font-weight: 400;
  font-size: clamp(1.4rem,3.1vw,2.05rem); color: var(--gold-bright); margin-top: .55rem; line-height: 1.3;
}
.fd-body {
  margin: clamp(24px,3.6vh,38px) 0; padding: clamp(28px,4vh,48px) clamp(10px,2.4vw,32px);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  font-family: var(--font-cormorant), Georgia, serif; font-weight: 400;
  font-size: clamp(1.5rem,3.3vw,2.5rem); line-height: 1.6; color: var(--ivory);
  min-height: clamp(160px,26vh,280px);
  display: flex; flex-direction: column; justify-content: center; gap: .85em;
  position: relative;
}
.fd-body p { margin: 0; }
.fd-body-md { font-size: clamp(1.3rem,2.7vw,1.95rem); line-height: 1.62; }
.fd-body-sm { font-size: clamp(1.15rem,2.3vw,1.65rem); line-height: 1.65; }
.fd-para { text-align: left; }
.fd-para p { max-width: 64ch; margin: 0 auto; }
.fd-body::before, .fd-body::after {
  content: ""; position: absolute; left: 50%; width: 6px; height: 6px; margin-left: -3px;
  background: var(--gold); transform: rotate(45deg);
}
.fd-body::before { top: -3.5px; } .fd-body::after { bottom: -3.5px; }
.fd-src { font-weight: 500; font-size: clamp(.86rem,1.7vw,1.05rem); letter-spacing: .3em; text-transform: uppercase; color: var(--gold); }

/* Línea de tiempo de noticias */
.fd-tl { width: 100%; max-width: 1000px; padding-left: clamp(14px,3vw,34px); border-left: 1px solid var(--line); }
.fd-tl-item {
  position: relative; padding: clamp(16px,2.4vh,26px) 0 clamp(16px,2.4vh,26px) clamp(18px,3vw,36px);
  display: flex; align-items: flex-start; gap: clamp(16px,2.4vw,28px);
}
.fd-tl-item + .fd-tl-item { border-top: 1px solid var(--line-2); }
.fd-tl-item::before {
  content: ""; position: absolute; left: calc(-1 * clamp(18px,3vw,36px) - 4px); top: calc(clamp(16px,2.4vh,26px) + .45em);
  width: 8px; height: 8px; background: var(--gold); transform: rotate(45deg);
}
.fd-tl-copy { flex: 1; min-width: 0; }
.fd-tl-thumb {
  flex: none; width: clamp(96px,11vw,140px); aspect-ratio: 1/1; object-fit: cover;
  border: 1px solid var(--line); filter: saturate(.82) brightness(.92); background: rgba(255,255,255,.03);
}
@media (max-width: 700px) { .fd-tl-thumb { display: none; } }
.fd-tl-date { font-weight: 600; font-size: clamp(.8rem,1.6vw,.98rem); letter-spacing: .24em; text-transform: uppercase; color: var(--gold); }
.fd-tl-title {
  font-family: var(--font-cormorant), Georgia, serif; font-weight: 500;
  font-size: clamp(1.5rem,3.1vw,2.1rem); color: var(--ivory); margin-top: .35rem; line-height: 1.28;
}
.fd-tl-body { color: var(--mist); font-size: clamp(1.05rem,2.1vw,1.32rem); line-height: 1.65; margin-top: .55rem; font-weight: 300; max-width: 58ch; white-space: pre-line; }

/* Tesorería */
.fd-cta {
  display: inline-block; padding: .9rem 1.8rem; border: 1px solid var(--gold); border-radius: 999px;
  color: var(--gold-bright); text-decoration: none; letter-spacing: .12em; text-transform: uppercase;
  font-size: clamp(.9rem,1.8vw,1.05rem); font-weight: 500; transition: background .2s, color .2s;
}
.fd-cta:hover { background: var(--gold); color: var(--night); }
.fd-cta-sm { margin-top: 1.6rem; font-size: clamp(.8rem,1.5vw,.92rem); padding: .7rem 1.4rem; }
.fd-note { color: var(--mist); font-weight: 300; margin: 1.4rem auto 0; max-width: 46ch; font-size: clamp(1rem,2vw,1.2rem); line-height: 1.65; }
.fd-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: clamp(20px,4vw,48px); text-align: center; }
.fd-stat-value { font-family: var(--font-cormorant), Georgia, serif; font-size: clamp(2.2rem,5vw,3.6rem); color: var(--ivory); line-height: 1; }
.fd-stat-strong .fd-stat-value { color: var(--gold-bright); }
.fd-stat-label { margin-top: .5rem; font-size: clamp(.8rem,1.6vw,.95rem); letter-spacing: .24em; text-transform: uppercase; color: var(--mist); }

/* Cierre */
.fd-closing p { max-width: 32ch; margin: 0 auto; }
.fd-sig { margin-top: clamp(32px,5vh,56px); color: var(--mist); font-size: clamp(.88rem,1.7vw,1.02rem); letter-spacing: .16em; text-transform: uppercase; }
.fd-sig-name {
  font-family: var(--font-cormorant), Georgia, serif; font-style: italic; text-transform: none; letter-spacing: 0;
  color: var(--ivory); font-size: clamp(1.3rem,2.6vw,1.6rem); margin-top: .55rem; line-height: 1.35;
}

/* Cromo: marca, herramientas, navegación */
.fd-brand {
  position: absolute; top: calc(clamp(18px,3.2vh,30px) + var(--safe-top, 0px)); left: clamp(20px,4vw,44px); z-index: 60;
  display: flex; align-items: center; gap: .6rem; color: var(--mist);
  font-size: clamp(.72rem,1.4vw,.85rem); letter-spacing: .2em; text-transform: uppercase;
}
.fd-draft { font-style: normal; color: var(--night); background: var(--gold); border-radius: 999px; padding: .15rem .6rem; font-size: .7rem; letter-spacing: .12em; }
.fd-tools {
  position: absolute; top: calc(clamp(14px,2.8vh,24px) + var(--safe-top, 0px)); right: clamp(16px,3vw,40px); z-index: 60;
  display: flex; align-items: center; gap: .5rem;
}
.fd-counter { font-family: var(--font-cormorant), Georgia, serif; font-size: clamp(1.05rem,2vw,1.25rem); color: var(--mist); letter-spacing: .1em; margin-right: .4rem; }
.fd-counter b { color: var(--gold); font-weight: 500; }
.fd-tool {
  display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 34px; padding: 0 .75rem;
  border: 1px solid var(--line); border-radius: 999px; background: rgba(13,20,38,.55); color: var(--gold);
  font: inherit; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; text-decoration: none; cursor: pointer;
  backdrop-filter: blur(6px); transition: background .2s, color .2s;
}
.fd-tool:hover { background: var(--gold); color: var(--night); }
@media (max-width: 640px) { .fd-brand span { display: none; } .fd-tool-wide { display: none; } }

.fd-nav {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 60;
  display: flex; align-items: center; gap: clamp(14px,3vw,28px);
  padding: clamp(16px,2.4vh,24px) clamp(20px,4vw,44px) calc(clamp(16px,2.4vh,24px) + var(--safe-bottom, 0px));
  background: linear-gradient(180deg,transparent,rgba(8,14,28,.85));
}
.fd-nav > button {
  border: none; background: none; color: var(--gold); cursor: pointer;
  font-family: var(--font-cormorant), Georgia, serif; font-size: 2.2rem; line-height: 1;
  padding: 0 .3rem; transition: opacity .2s, transform .2s; opacity: .8;
}
.fd-nav > button:hover { opacity: 1; transform: scale(1.15); }
.fd-nav > button:disabled { opacity: .2; cursor: default; transform: none; }
.fd-track { flex: 1; display: flex; gap: 4px; }
.fd-track button {
  flex: 1; height: 2px; padding: 0; border: none; background: var(--line); cursor: pointer;
  transition: background .3s, height .3s;
}
.fd-track button.on { background: var(--gold); height: 3px; }
.fd-track button:hover { background: var(--gold-bright); }

@media (prefers-reduced-motion: reduce) {
  .fd-rosette { animation: none; }
  .fd-slide.fd-active, .fd-reveal { animation: none !important; opacity: 1 !important; transform: none !important; }
}
`;
