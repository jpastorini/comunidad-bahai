import type { Posture } from "@/lib/obligatory-prayers";
import { POSTURE_LABELS } from "@/lib/obligatory-prayers";

// Dibujos de las posturas de las oraciones obligatorias.
//
// ⚠️ Van junto a la oración obligatoria: tienen que ser sobrios. Hubo
// cuatro versiones dibujadas a mano en SVG (2026-11-11) —palotes, siluetas
// con túnica en un nicho persa, íconos de contorno, siluetas geométricas— y
// ninguna gustó: les faltaba detalle. Lo que quedó son SILUETAS generadas
// con Magnific (una sola lámina con las cinco posturas, para que sean la
// misma persona), recortadas a PNG transparente en
// public/oraciones/posturas/. Las cinco comparten escala y línea de suelo:
// todas miden 300 px de alto y se alinean abajo.
//
// Las abluciones no llevan figura: llevan el aguamanil, que sí es SVG.

/** El azul de las siluetas (medido en las imágenes). */
const NAVY = "#12263F";
const GOLD = "#C4A235";

/** Ancho de cada PNG; el alto es siempre 300. */
const IMAGES = {
  "de-pie": 65,
  suplica: 111,
  inclinarse: 164,
  postrarse: 181,
  sentarse: 113,
} as const;
const IMAGE_HEIGHT = 300;

/** Qué parte del alto queda vacía arriba de cada figura (las bajas). */
const EMPTY_TOP: Partial<Record<keyof typeof IMAGES, number>> = {
  inclinarse: 0.24,
  postrarse: 0.62,
  sentarse: 0.36,
};

/** Qué imagen usa cada postura. Las tres "de pie" comparten figura. */
const IMAGE_OF: Partial<Record<Posture, keyof typeof IMAGES>> = {
  "de-pie": "de-pie",
  alquibla: "de-pie",
  mirar: "de-pie",
  suplica: "suplica",
  inclinarse: "inclinarse",
  postrarse: "postrarse",
  sentarse: "sentarse",
};

function Ewer({ height }: { height: number }) {
  return (
    <svg
      viewBox="14 30 38 38"
      width={(height * 0.62 * 38) / 38}
      height={height * 0.62}
      aria-hidden
    >
      <path
        d="M27 63c-6.5-3.5-8-14-1.5-20v-5h7v5c6.5 6 5 16.5-1.5 20Z"
        fill={NAVY}
      />
      <circle cx="29" cy="35" r="2" fill={NAVY} />
      <g fill="none" stroke={NAVY} strokeLinecap="round">
        <path d="M23.5 64.5h11" strokeWidth="2" />
        <path d="M34.5 50c5-2 7-7 8.5-13.5" strokeWidth="2.6" />
        <path d="M22.5 48c-6.5-1.5-6-10 2.5-9" strokeWidth="2" />
      </g>
      <g fill={GOLD}>
        <path d="M45 41c1.5 2.1 2.2 3.4 2.2 4.4a2.2 2.2 0 0 1-4.4 0c0-1 .7-2.3 2.2-4.4Z" />
        <path d="M47.5 50c1.2 1.7 1.8 2.8 1.8 3.6a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.9 1.8-3.6Z" opacity="0.75" />
        <path d="M44 57c1 1.4 1.5 2.3 1.5 3a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-3Z" opacity="0.55" />
      </g>
    </svg>
  );
}

/** Flechita dorada: hacia dónde mirar o volverse. */
function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 8 12"
      width="7"
      height="11"
      aria-hidden
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M2 2l4 4-4 4"
        fill="none"
        stroke={GOLD}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PostureFigure({
  posture,
  height = 84,
  tight = false,
}: {
  posture: Posture;
  height?: number;
  /** Recorta el aire de arriba de una figura baja. Solo cuando va sola:
   *  con otra al lado, las dos conservan el alto para compartir el suelo. */
  tight?: boolean;
}) {
  const image = IMAGE_OF[posture];
  const label = POSTURE_LABELS[posture];

  if (!image) {
    return (
      <div
        role="img"
        aria-label={label}
        className="flex items-end"
        style={{ height }}
      >
        <Ewer height={height} />
      </div>
    );
  }

  const width = Math.round((IMAGES[image] * height) / IMAGE_HEIGHT);
  const cut = tight ? Math.round((EMPTY_TOP[image] ?? 0) * height) : 0;
  return (
    <div
      className="flex items-start gap-1 overflow-hidden"
      style={{ height: height - cut }}
    >
      {/* La cabeza queda arriba: las flechas van a esa altura. */}
      {posture === "mirar" && (
        <span className="mt-[9%]">
          <Chevron flip />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/oraciones/posturas/${image}.png`}
        alt={label}
        width={width}
        height={height}
        draggable={false}
        className="max-w-none select-none"
        style={{ marginTop: -cut }}
      />
      {(posture === "mirar" || posture === "alquibla") && (
        <span className="mt-[9%]">
          <Chevron />
        </span>
      )}
    </div>
  );
}
