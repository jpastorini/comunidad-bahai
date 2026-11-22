import type { InvitationArtKind } from "@/lib/invitation";

// La ilustración que lleva una invitación SIN foto: un motivo de línea,
// sobrio, elegido según el tipo de evento (`pickInvitationArt`).
//
// Es SVG en línea, no un archivo: html-to-image lo captura sin pedir nada
// por red, y toma los colores del estilo de la tarjeta.
//
// ⚠️ Se dibuja sobre un lienzo de 360 × 232 y se recorta al centro
// (`slice`): en la tarjeta cuadrada solo se ve la franja y 72–160, así que
// lo que importa de cada motivo vive ahí.

type Props = {
  kind: InvitationArtKind;
  height: number;
  /** Trazo principal. */
  accent: string;
  /** Trazo secundario, más tenue. */
  line: string;
  /** Fondo de la franja (degradé de dos tonos). */
  from: string;
  to: string;
};

function star(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 18; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / 9 - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export function InvitationArt({ kind, height, accent, line, from, to }: Props) {
  const id = `inv-art-${kind}`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox="0 0 360 232"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="360" height="232" fill={`url(#${id})`} />
      <g fill="none" stroke={accent} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        {kind === "amanecer" && <Amanecer accent={accent} line={line} />}
        {kind === "libro" && <Libro accent={accent} line={line} />}
        {kind === "arcos" && <Arcos accent={accent} line={line} />}
        {kind === "estrella" && <Estrella accent={accent} line={line} />}
      </g>
    </svg>
  );
}

type Tone = { accent: string; line: string };

/** Un sol que asoma sobre las colinas: oración, devocional. */
function Amanecer({ accent, line }: Tone) {
  const rays = [];
  for (let i = 1; i < 12; i++) {
    const a = Math.PI + (Math.PI * i) / 12;
    rays.push(
      <line
        key={i}
        x1={180 + 58 * Math.cos(a)}
        y1={146 + 58 * Math.sin(a)}
        x2={180 + (i % 2 ? 72 : 84) * Math.cos(a)}
        y2={146 + (i % 2 ? 72 : 84) * Math.sin(a)}
        stroke={line}
      />
    );
  }
  return (
    <>
      {rays}
      <path d="M132 146a48 48 0 0 1 96 0" stroke={line} />
      <path d="M146 146a34 34 0 0 1 68 0Z" fill={accent} fillOpacity="0.28" />
      <path d="M-10 150c50-22 96-22 140-4s96 20 130 2 70-16 110 0v90H-10Z" fill={accent} fillOpacity="0.14" stroke="none" />
      <path d="M-10 150c50-22 96-22 140-4s96 20 130 2 70-16 110 0" />
      <path d="M-10 176c70-18 130-14 190 0s120 12 190-4" stroke={line} />
      <path d="M-10 200c80-14 150-10 200 0s110 8 180-6" stroke={line} />
    </>
  );
}

/** Un libro abierto del que sale luz: estudio, clases, profundización. */
function Libro({ accent, line }: Tone) {
  const rays = [-60, -40, -20, 0, 20, 40, 60].map((deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return (
      <line
        key={deg}
        x1={180 + 30 * Math.cos(a)}
        y1={128 + 30 * Math.sin(a)}
        x2={180 + (deg % 40 === 0 ? 62 : 50) * Math.cos(a)}
        y2={128 + (deg % 40 === 0 ? 62 : 50) * Math.sin(a)}
        stroke={line}
      />
    );
  });
  return (
    <>
      {rays}
      <polygon points={star(180, 86, 7, 3.4)} fill={accent} stroke="none" />
      <path d="M180 132c-16-10-38-12-58-8v34c20-4 42-2 58 8Z" fill={accent} fillOpacity="0.16" />
      <path d="M180 132c16-10 38-12 58-8v34c-20-4-42-2-58 8Z" fill={accent} fillOpacity="0.16" />
      <path d="M180 132v34" />
      <path d="M132 136c14-2 28 0 40 5M132 145c14-2 28 0 40 5M188 141c12-5 26-7 40-5M188 150c12-5 26-7 40-5" stroke={line} />
      <path d="M40 186h280" stroke={line} />
      <path d="M90 196h180" stroke={line} />
    </>
  );
}

/** Una arcada persa con cipreses: reuniones, encuentros, servicio. */
function Arcos({ accent, line }: Tone) {
  const arch = (cx: number, key: number, filled: boolean) => (
    <g key={key}>
      <path
        d={`M${cx - 30} 168V118c0-22 18-30 30-46 12 16 30 24 30 46v50`}
        fill={filled ? accent : "none"}
        fillOpacity={filled ? 0.14 : 0}
      />
      <path d={`M${cx - 21} 168V122c0-14 12-21 21-32 9 11 21 18 21 32v46`} stroke={line} />
    </g>
  );
  const cypress = (cx: number, key: number) => (
    <path
      key={key}
      d={`M${cx} 168v-8M${cx} 160c-7-10-6-30 0-44 6 14 7 34 0 44Z`}
      fill={accent}
      fillOpacity="0.22"
      stroke={line}
    />
  );
  return (
    <>
      {[60, 180, 300].map((cx, i) => arch(cx, i, i === 1))}
      {[120, 240, 0, 360].map((cx, i) => cypress(cx, i))}
      <polygon points={star(180, 136, 8, 3.8)} fill={accent} stroke="none" />
      <path d="M-10 168h380" />
      <path d="M-10 176h380" stroke={line} />
      <path d="M20 54h320M60 44h240" stroke={line} />
    </>
  );
}

/** Una estrella de nueve puntas entre anillos: Fiestas y Días Sagrados. */
function Estrella({ accent, line }: Tone) {
  const dots = [];
  for (let i = 0; i < 9; i++) {
    const a = (2 * Math.PI * i) / 9 - Math.PI / 2;
    dots.push(
      <circle
        key={i}
        cx={180 + 52 * Math.cos(a)}
        cy={116 + 52 * Math.sin(a)}
        r="1.8"
        fill={accent}
        stroke="none"
      />
    );
  }
  return (
    <>
      <circle cx="180" cy="116" r="62" stroke={line} />
      <circle cx="180" cy="116" r="43" stroke={line} />
      {dots}
      <polygon points={star(180, 116, 38, 21)} fill={accent} fillOpacity="0.16" />
      <polygon points={star(180, 116, 20, 11)} stroke={line} />
      <circle cx="180" cy="116" r="3" fill={accent} stroke="none" />
      <path d="M0 116h104M256 116h104" stroke={line} />
      <polygon points={star(70, 116, 6, 2.9)} fill={accent} stroke="none" />
      <polygon points={star(290, 116, 6, 2.9)} fill={accent} stroke="none" />
    </>
  );
}
