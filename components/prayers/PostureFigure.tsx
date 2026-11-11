import type { Posture } from "@/lib/obligatory-prayers";
import { POSTURE_LABELS } from "@/lib/obligatory-prayers";

// Dibujos de las posturas de las oraciones obligatorias.
//
// ⚠️ Van junto a la oración obligatoria: tienen que ser sobrios. Se probó
// con figuras de palotes y el usuario las rechazó por irreverentes
// (2026-11-11). Son siluetas plenas, con túnica y sin rasgos, de perfil
// hacia la derecha, dentro de un nicho con arco persa. Las abluciones no
// llevan figura: llevan el aguamanil.
//
// El cuerpo va en `currentColor`; el dorado es para lo que no es cuerpo
// (el nicho, el agua, la dirección).

const GOLD = "#C4A235";

/** Túnica de pie, centrada en x, con el ruedo en el suelo. */
function Standing({ x }: { x: number }) {
  return (
    <g transform={`translate(${x - 32} 0)`}>
      <circle cx="32" cy="21.5" r="5" />
      <path d="M32 28.5c-4.6 0-6.2 3.4-6.6 8.5L23.5 64h17l-1.9-27c-.4-5.1-2-8.5-6.6-8.5Z" />
    </g>
  );
}

function Ewer() {
  return (
    <>
      <path d="M27 62c-6.5-3.5-8-14-1.5-20v-5h7v5c6.5 6 5 16.5-1.5 20Z" />
      <circle cx="29" cy="34" r="2" />
      <path d="M24 63.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M34.5 49c5-2 7-7 8.5-13.5" strokeWidth="2.6" />
        <path d="M22.5 47c-6.5-1.5-6-10 2.5-9" strokeWidth="2" />
      </g>
      <g fill={GOLD}>
        <path d="M45 40c1.5 2.1 2.2 3.4 2.2 4.4a2.2 2.2 0 0 1-4.4 0c0-1 .7-2.3 2.2-4.4Z" />
        <path d="M47.5 49c1.2 1.7 1.8 2.8 1.8 3.6a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.9 1.8-3.6Z" opacity="0.75" />
        <path d="M44 56c1 1.4 1.5 2.3 1.5 3a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-3Z" opacity="0.55" />
      </g>
    </>
  );
}

function Body({ posture }: { posture: Posture }) {
  switch (posture) {
    case "lavar-manos":
    case "lavar-cara":
      return <Ewer />;
    case "de-pie":
      return <Standing x={32} />;
    case "alquibla":
      return (
        <>
          <Standing x={26} />
          <path
            d="M39 40h9m-3.5-3.5L48 40l-3.5 3.5"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case "mirar":
      return (
        <>
          <Standing x={32} />
          <path
            d="M23 18.5l-3 3 3 3M41 18.5l3 3-3 3"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case "suplica":
      return (
        <>
          <Standing x={28} />
          <path
            d="M30 33l9.5 2 3.5-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case "inclinarse":
      return (
        <>
          <path d="M22.5 64l2-21.5h9l2 21.5Z" />
          <path
            d="M29 43.5 42 36.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="9.5"
            strokeLinecap="round"
          />
          <circle cx="49.5" cy="34.5" r="5" />
          <path
            d="M41 39 33.5 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        </>
      );
    case "postrarse":
      return (
        <>
          <path d="M14 64c-.5-3.5 1-5.5 4-5.5 0-7 4.5-11.5 10-11.5 6.5 0 11 6 15.5 10.5L44 64Z" />
          <circle cx="48" cy="59" r="5" />
          <path
            d="M51.5 62.2h4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        </>
      );
    case "sentarse":
      return (
        <>
          <circle cx="31" cy="29" r="5" />
          <path d="M19 64c-.8-5.5 1.5-9 6-9.5l.8-10.5c.4-5.1 1.7-8 5.2-8s5 2.9 5.4 8l.8 10.5c5 .5 7.6 4 6.8 9.5Z" />
        </>
      );
  }
}

/** La figura dentro de su nicho. */
export function PostureFigure({
  posture,
  width = 60,
}: {
  posture: Posture;
  width?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 72"
      width={width}
      height={(width * 72) / 64}
      role="img"
      aria-label={POSTURE_LABELS[posture]}
    >
      {/* El nicho: arco persa. */}
      <path
        d="M7 71V30C7 17 21 13 32 3c11 10 25 14 25 27v41Z"
        fill="#FDFBF4"
        stroke={GOLD}
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M13 64.5h38" stroke={GOLD} strokeOpacity="0.45" strokeWidth="1" />
      {/* La opacidad va en el grupo: si fuera del color, las partes que se
          superponen (el brazo sobre la túnica) saldrían más oscuras. */}
      <g fill="currentColor" opacity="0.85">
        <Body posture={posture} />
      </g>
    </svg>
  );
}
