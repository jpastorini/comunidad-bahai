/**
 * Ilustraciones del folleto «Qué es la Fe Bahá'í»: SVG inline, en
 * `currentColor` más dorado, animadas con las clases de globals.css
 * (cb-draw, cb-spin-slow, cb-float, cb-pulse-dot, cb-pop). Sin librerías.
 * Son componentes de servidor: no tienen estado; la animación es CSS.
 *
 * Paleta: la de la app (terra #2A3F8F, dorado #C4A235, pino #1F3A2C).
 */

const GOLD = "#C4A235";
const GOLD_DARK = "#96790E";
const TERRA = "#2A3F8F";
const PINE = "#1F3A2C";

/** Puntos de una estrella de n puntas (cadena para <polygon>). */
function starPoints(cx: number, cy: number, outer: number, inner: number, n: number) {
  const pts: string[] = [];
  const step = 360 / n;
  for (let i = 0; i < n; i++) {
    const a = ((i * step - 90) * Math.PI) / 180;
    const b = ((i * step + step / 2 - 90) * Math.PI) / 180;
    pts.push(`${(cx + outer * Math.cos(a)).toFixed(2)},${(cy + outer * Math.sin(a)).toFixed(2)}`);
    pts.push(`${(cx + inner * Math.cos(b)).toFixed(2)},${(cy + inner * Math.sin(b)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export type FigureName = "estrella" | "unidad" | "uruguay" | "alianza" | "principios" | "actividades";

export function FolletoFigure({ name, className }: { name: FigureName; className?: string }) {
  switch (name) {
    case "estrella":
      return <FigStar className={className} />;
    case "unidad":
      return <FigUnity className={className} />;
    case "uruguay":
      return <FigUruguay className={className} />;
    case "alianza":
      return <FigCovenant className={className} />;
    case "principios":
      return <FigPrinciples className={className} />;
    case "actividades":
      return <FigActivities className={className} />;
  }
}

/** La estrella de nueve puntas con dos anillos que giran despacio y
 *  rayos que se dibujan: la portada. */
function FigStar({ className }: { className?: string }) {
  const rays = Array.from({ length: 9 }, (_, i) => {
    const a = ((i * 40 - 90) * Math.PI) / 180;
    return {
      x1: (100 + 58 * Math.cos(a)).toFixed(1),
      y1: (100 + 58 * Math.sin(a)).toFixed(1),
      x2: (100 + 78 * Math.cos(a)).toFixed(1),
      y2: (100 + 78 * Math.sin(a)).toFixed(1),
      delay: 300 + i * 90,
    };
  });
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <g className="cb-spin-slow">
        <circle cx="100" cy="100" r="88" stroke={GOLD} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 7" />
      </g>
      <g className="cb-spin-slow" style={{ animationDirection: "reverse", animationDuration: "70s" }}>
        <circle cx="100" cy="100" r="66" stroke={GOLD} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="1 5" />
      </g>
      {rays.map((r, i) => (
        <line
          key={i}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke={GOLD}
          strokeWidth="1.5"
          strokeLinecap="round"
          className="cb-draw"
          style={{ ["--cb-len" as string]: "24", ["--cb-delay" as string]: `${r.delay}ms` }}
        />
      ))}
      <polygon
        points={starPoints(100, 100, 46, 24, 9)}
        fill={GOLD}
        fillOpacity="0.12"
        stroke={GOLD_DARK}
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="cb-pop"
        style={{ ["--cb-delay" as string]: "80ms" }}
      />
      <polygon
        points={starPoints(100, 100, 30, 15, 9)}
        fill={GOLD}
        className="cb-pop cb-float"
        style={{ ["--cb-delay" as string]: "260ms" }}
      />
    </svg>
  );
}

/** Tres círculos que se dibujan y se entrelazan: un solo Dios, una sola
 *  religión, una sola humanidad. */
function FigUnity({ className }: { className?: string }) {
  const circles = [
    { cx: 100, cy: 78, color: GOLD_DARK, delay: 0 },
    { cx: 76, cy: 118, color: TERRA, delay: 350 },
    { cx: 124, cy: 118, color: PINE, delay: 700 },
  ];
  const len = (2 * Math.PI * 42).toFixed(0);
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      {circles.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r="42"
          stroke={c.color}
          strokeWidth="1.75"
          fill={c.color}
          fillOpacity="0.07"
          className="cb-draw"
          style={{ ["--cb-len" as string]: len, ["--cb-delay" as string]: `${c.delay}ms` }}
        />
      ))}
      <polygon
        points={starPoints(100, 105, 11, 5.5, 9)}
        fill={GOLD}
        className="cb-pop cb-float"
        style={{ ["--cb-delay" as string]: "1500ms" }}
      />
    </svg>
  );
}

/** Uruguay, simplificado, con las comunidades encendiéndose. Es una
 *  ilustración, no un mapa: los puntos marcan Montevideo y la Costa. */
function FigUruguay({ className }: { className?: string }) {
  // Contorno trazado desde coordenadas reales (lon −58,5…−53 → x 20…180;
  // lat −30…−35 → y 20…180): Bella Unión arriba a la izquierda, Chuy a la
  // derecha, Montevideo abajo, Colonia abajo a la izquierda.
  const outline =
    "M46 26 L93 49 L122 58 L145 81 L166 106 L168 138 L154 161 L125 178 L87 177 L64 164 L38 162 L23 145 L29 116 L35 94 L38 65 Z";
  const dots = [
    { x: 87, y: 172, label: "Montevideo", delay: 900 },
    { x: 99, y: 171, label: "Ciudad de la Costa", delay: 1300 },
  ];
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <path
        d={outline}
        stroke={PINE}
        strokeWidth="1.75"
        fill={PINE}
        fillOpacity="0.06"
        strokeLinejoin="round"
        className="cb-draw"
        style={{ ["--cb-len" as string]: "520" }}
      />
      {/* Río de la Plata y el Atlántico: dos líneas de agua que entran. */}
      <path d="M28 182 C55 188 85 192 118 190" stroke={TERRA} strokeOpacity="0.5" strokeWidth="1.25" strokeLinecap="round" className="cb-draw" style={{ ["--cb-len" as string]: "100", ["--cb-delay" as string]: "600ms" }} />
      <path d="M140 184 C158 176 172 162 184 146" stroke={TERRA} strokeOpacity="0.5" strokeWidth="1.25" strokeLinecap="round" className="cb-draw" style={{ ["--cb-len" as string]: "60", ["--cb-delay" as string]: "800ms" }} />
      {dots.map((d) => (
        <g key={d.label}>
          <circle cx={d.x} cy={d.y} r="5" fill={GOLD} fillOpacity="0.45" className="cb-pulse-dot" style={{ ["--cb-delay" as string]: `${d.delay}ms` }} />
          <circle cx={d.x} cy={d.y} r="3.5" fill={GOLD_DARK} className="cb-pop" style={{ ["--cb-delay" as string]: `${d.delay}ms` }} />
        </g>
      ))}
    </svg>
  );
}

/** La Alianza: una línea que baja de la estrella a tres puntos (el Báb,
 *  Bahá'u'lláh, ‘Abdu'l-Bahá) y sigue a las instituciones. */
function FigCovenant({ className }: { className?: string }) {
  const stops = [36, 76, 116, 156];
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <line x1="100" y1="36" x2="100" y2="176" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" className="cb-draw" style={{ ["--cb-len" as string]: "140" }} />
      {stops.map((y, i) => (
        <g key={y}>
          <circle cx="100" cy={y} r={i === 3 ? 7 : 5} fill="#fff" stroke={i === 3 ? TERRA : GOLD_DARK} strokeWidth="1.75" className="cb-pop" style={{ ["--cb-delay" as string]: `${300 + i * 320}ms` }} />
          <line x1={i % 2 === 0 ? 108 : 92} y1={y} x2={i % 2 === 0 ? 150 : 50} y2={y} stroke={GOLD} strokeOpacity="0.6" strokeWidth="1" strokeDasharray="2 4" className="cb-fade-in" style={{ ["--cb-delay" as string]: `${500 + i * 320}ms` }} />
        </g>
      ))}
      <polygon points={starPoints(100, 36, 12, 6, 9)} fill={GOLD} className="cb-pop" />
    </svg>
  );
}

/** Principios: una constelación de nueve puntos unidos por líneas finas. */
function FigPrinciples({ className }: { className?: string }) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = ((i * 40 - 90) * Math.PI) / 180;
    const r = i % 2 === 0 ? 70 : 52;
    return { x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) };
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <path d={path} stroke={TERRA} strokeOpacity="0.5" strokeWidth="1" className="cb-draw" style={{ ["--cb-len" as string]: "560" }} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill={i % 2 === 0 ? GOLD : TERRA} className="cb-pop" style={{ ["--cb-delay" as string]: `${150 + i * 110}ms` }} />
      ))}
      <circle cx="100" cy="100" r="9" fill={GOLD} fillOpacity="0.2" stroke={GOLD_DARK} strokeWidth="1.5" className="cb-pop cb-float" style={{ ["--cb-delay" as string]: "1200ms" }} />
    </svg>
  );
}

/** Actividades: cuatro círculos (personas) alrededor de una luz. */
function FigActivities({ className }: { className?: string }) {
  const seats = [
    { x: 100, y: 48 },
    { x: 152, y: 100 },
    { x: 100, y: 152 },
    { x: 48, y: 100 },
  ];
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <circle cx="100" cy="100" r="60" stroke={GOLD} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 6" className="cb-spin-slow" />
      {seats.map((s, i) => (
        <g key={i} className="cb-pop cb-float" style={{ ["--cb-delay" as string]: `${200 + i * 180}ms` }}>
          <circle cx={s.x} cy={s.y - 6} r="7" fill={TERRA} fillOpacity="0.9" />
          <path d={`M${s.x - 13} ${s.y + 14} a13 13 0 0 1 26 0`} fill={TERRA} fillOpacity="0.35" />
        </g>
      ))}
      <g className="cb-pop" style={{ ["--cb-delay" as string]: "900ms" }}>
        <circle cx="100" cy="100" r="14" fill={GOLD} fillOpacity="0.18" />
        <path d="M100 90 c-5 7 -5 11 0 15 c5 -4 5 -8 0 -15 Z" fill={GOLD_DARK} />
      </g>
    </svg>
  );
}

/** Íconos chicos para los ítems de principios y actividades. */
export type ItemIcon =
  | "lupa" | "manos" | "balanza" | "atomo" | "libro" | "monedas" | "globo" | "paloma"
  | "vela" | "ninos" | "jovenes" | "circulo";

export function ItemIconSvg({ name, size = 22 }: { name: ItemIcon; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "lupa":
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /><path d="M8.5 11a2.5 2.5 0 0 1 2.5-2.5" /></svg>;
    case "manos":
      return <svg {...common}><circle cx="8" cy="7" r="3" /><circle cx="16" cy="7" r="3" /><path d="M2.5 20a5.5 5.5 0 0 1 11 0" /><path d="M10.5 20a5.5 5.5 0 0 1 11 0" /></svg>;
    case "balanza":
      return <svg {...common}><path d="M12 3v18M5 21h14M12 6l6 2M12 6 6 8" /><path d="M3 14a3 3 0 0 0 6 0L6 8ZM15 14a3 3 0 0 0 6 0l-3-6Z" /></svg>;
    case "atomo":
      return <svg {...common}><circle cx="12" cy="12" r="1.5" /><ellipse cx="12" cy="12" rx="9" ry="3.5" /><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)" /></svg>;
    case "libro":
      return <svg {...common}><path d="M3 5.5A2 2 0 0 1 5 4h5a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H3Z" /><path d="M21 5.5A2 2 0 0 0 19 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7Z" /></svg>;
    case "monedas":
      return <svg {...common}><circle cx="9" cy="9" r="6" /><path d="M14.5 6.5A6 6 0 1 1 6.5 14.5" /></svg>;
    case "globo":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
    case "paloma":
      return <svg {...common}><path d="M3 11c3 1 6 0 8-3 1 3 4 5 9 4-1 4-5 7-10 7-4 0-7-3-7-8Z" /><path d="M11 8c0-2 1-4 3-5" /></svg>;
    case "vela":
      return <svg {...common}><path d="M12 3c-2 3-2 5 0 6 2-1 2-3 0-6Z" /><rect x="9" y="10" width="6" height="11" rx="1.5" /></svg>;
    case "ninos":
      return <svg {...common}><circle cx="12" cy="6" r="3" /><path d="M6 21v-5a6 6 0 0 1 12 0v5" /><path d="M9 14l3 3 3-3" /></svg>;
    case "jovenes":
      return <svg {...common}><circle cx="9" cy="6" r="2.5" /><circle cx="16" cy="8" r="2.5" /><path d="M4 20v-4a5 5 0 0 1 10 0v4M12 20v-3a4 4 0 0 1 8 0v3" /></svg>;
    case "circulo":
      return <svg {...common}><circle cx="12" cy="12" r="8" strokeDasharray="3 3" /><circle cx="12" cy="6" r="1.5" /><circle cx="17.5" cy="15" r="1.5" /><circle cx="6.5" cy="15" r="1.5" /></svg>;
  }
}
