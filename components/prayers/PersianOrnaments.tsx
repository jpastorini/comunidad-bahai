// Ornamentos de la sección de oraciones. Mínimos, a propósito: una línea
// fina con una estrella de NUEVE puntas al centro, y una roseta de nueve
// pétalos para cerrar la oración. Oro y lapislázuli, como la iluminación de los
// manuscritos.
//
// ⚠️ La primera versión (enredaderas con hojas, una flor distinta por
// oración) le pareció recargada al usuario (2026-11-11). Si se agrega
// algo, que sea este mismo motivo y no uno nuevo.
//
// Sin hooks ni animaciones: sirven en servidor y en cliente.

const GOLD = "#C4A235";
const LAPIS = "#2A3F8F";

/** Estrella de nueve puntas, centrada en (0,0). */
const STAR = Array.from({ length: 18 }, (_, i) => {
  const r = i % 2 === 0 ? 7.5 : 4.2;
  const a = (i * Math.PI) / 9 - Math.PI / 2;
  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

/** Línea fina con la estrella al centro. Abre una oración o separa. */
export function MedallionRule({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="-80 -9 160 18"
      className={`mx-auto block h-[18px] w-[160px] max-w-full ${className}`}
      aria-hidden
    >
      <g fill="none" stroke={GOLD} strokeLinecap="round">
        <path d="M-76 0h53M23 0h53" strokeWidth="0.8" opacity="0.7" />
      </g>
      {/* ⚠️ Un óvalo apuntado con un punto adentro se lee como un OJO: por
          eso el centro es una estrella y no el medallón de alfombra. */}
      <polygon
        points={STAR}
        fill={GOLD}
        fillOpacity="0.2"
        stroke={GOLD}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <circle cx="-17" r="1.1" fill={LAPIS} />
      <circle cx="17" r="1.1" fill={LAPIS} />
    </svg>
  );
}

/** Roseta de nueve pétalos: cierra la oración, antes del autor. */
export function RosetteMark({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="-12.5 -12.5 25 25"
      width={size}
      height={size}
      className={`mx-auto block ${className}`}
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d="M0-2C-3.3-5-2.5-9.2 0-11.5 2.5-9.2 3.3-5 0-2Z"
          transform={`rotate(${i * 40})`}
          fill={GOLD}
          fillOpacity="0.16"
          stroke={GOLD}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      ))}
      <circle r="1.9" fill={LAPIS} />
    </svg>
  );
}
