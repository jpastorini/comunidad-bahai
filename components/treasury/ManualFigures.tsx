import React from "react";
/**
 * Los dibujos del Manual del tesorero: SVG inline, sin librerías, en
 * `currentColor` para que hereden el color del texto en pantalla y al
 * imprimir. Cada figura muestra UN mecanismo que en prosa costaría
 * armar: el ciclo del mes, cómo se mueve la plata (y el camino que no se
 * toma), los estados de una rendición, y qué pasa con un mes cerrado.
 *
 * El único color con significado es el rojo del camino prohibido (no
 * pagar gastos con lo recaudado); el dorado marca el hito del mes.
 */

const GOLD = "#96790E";
const RED = "#b42318";
const GREEN = "#4f7a45";

function Arrow({ id = "arrow" }: { id?: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
      </marker>
      <marker id={`${id}-red`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={RED} />
      </marker>
    </defs>
  );
}

function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="10"
        fill={accent ? "rgba(150,121,14,0.10)" : "rgba(0,0,0,0.03)"}
        stroke={accent ? GOLD : "currentColor"}
        strokeOpacity={accent ? 1 : 0.35}
        strokeWidth="1.2"
      />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 4)} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="currentColor">
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.7">
          {sub}
        </text>
      )}
    </g>
  );
}

/** ─── 1 · El ciclo del mes ─────────────────────────────────────── */
export function FigureMonthCycle() {
  const steps = [
    { title: "Cargar", sub: "recibo o comprobante", when: "todos los días" },
    { title: "Conciliar", sub: "extracto vs. libro", when: "cada 15 días" },
    { title: "Rendir y arquear", sub: "las cajas chicas", when: "fin de mes" },
    { title: "Auditar y cerrar", sub: "el mes se congela", when: "primeros días" },
    { title: "Compartir", sub: "Fondo e informes", when: "antes de la Fiesta" },
    { title: "Compromisos", sub: "agradecer y recordar", when: "pasado el 10" },
  ];
  const w = 120;
  const gap = 8;
  const x0 = 6;
  return (
    <figure className="my-4 text-dark">
      <svg viewBox="0 0 780 150" role="img" aria-label="El ciclo del mes en seis etapas: cargar, conciliar, rendir y arquear, auditar y cerrar, compartir, y compromisos (agradecer y recordar); al terminar vuelve a empezar." style={{ maxWidth: "100%", height: "auto" }}>
        <Arrow id="a1" />
        {steps.map((s, i) => {
          const x = x0 + i * (w + gap);
          return (
            <g key={s.title}>
              <Box x={x} y={34} w={w} h={56} title={s.title} sub={s.sub} accent={i === 3} />
              <text x={x + w / 2} y={22} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.6">
                {s.when}
              </text>
              {i < steps.length - 1 && (
                <line x1={x + w + 2} y1={62} x2={x + w + gap - 2} y2={62} stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a1)" />
              )}
            </g>
          );
        })}
        {/* vuelta al inicio */}
        <path
          d={`M ${x0 + 5 * (w + gap) + w / 2} 92 L ${x0 + 5 * (w + gap) + w / 2} 122 L ${x0 + w / 2} 122 L ${x0 + w / 2} 94`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="4 4"
          markerEnd="url(#a1)"
        />
        <text x="390" y="140" textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.7">
          y el mes siguiente empieza de nuevo
        </text>
      </svg>
      <figcaption className="mt-1 text-[12px] text-muted">
        El ciclo del mes. El cierre (dorado) es el hito: después de él, ese mes ya no se toca.
      </figcaption>
    </figure>
  );
}

/** ─── 2 · Cómo se mueve la plata ──────────────────────────────── */
export function FigureMoneyFlow() {
  return (
    <figure className="my-4 text-dark">
      <svg viewBox="0 0 780 300" role="img" aria-label="Los aportes por giro entran a la cuenta; los aportes en efectivo entran a la caja chica del tesorero y desde ahí se pagan los gastos chicos; la cuenta paga los gastos grandes y repone las cajas. Consejo: depositar el efectivo en Prex para que el extracto lo verifique." style={{ maxWidth: "100%", height: "auto" }}>
        <Arrow id="a2" />
        <defs>
          <marker id="a2-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={GOLD} />
          </marker>
        </defs>
        {/* Aportes */}
        <Box x={10} y={40} w={150} h={50} title="Aporte por giro" sub="Prex, BROU, POS" />
        <Box x={10} y={205} w={150} h={50} title="Aporte en efectivo" sub="Fiesta, en mano" />
        {/* Cuenta */}
        <Box x={315} y={70} w={170} h={64} title="Cuenta" sub="Prex · BROU · Mercado Pago" accent />
        {/* Caja chica */}
        <Box x={315} y={205} w={170} h={50} title="Caja chica" sub="del tesorero, o con responsable" />
        {/* Gastos */}
        <Box x={620} y={70} w={150} h={50} title="Gasto" sub="pago desde la cuenta" />
        <Box x={620} y={205} w={150} h={50} title="Gasto chico" sub="con comprobante" />

        {/* giro → cuenta */}
        <path d="M 160 65 C 240 65, 240 95, 313 95" fill="none" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a2)" />
        <text x="232" y="64" textAnchor="middle" fontSize="10.5" fill="currentColor">entra directo</text>
        {/* efectivo → caja */}
        <line x1="160" y1="230" x2="313" y2="230" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a2)" />
        <text x="236" y="223" textAnchor="middle" fontSize="10.5" fill="currentColor">entra directo</text>
        {/* cuenta → gasto */}
        <line x1="486" y1="95" x2="618" y2="95" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a2)" />
        <text x="552" y="88" textAnchor="middle" fontSize="10.5" fill="currentColor">paga</text>
        {/* cuenta → caja (reposición) */}
        <line x1="400" y1="135" x2="400" y2="203" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a2)" />
        <text x="410" y="172" fontSize="10.5" fill="currentColor">repone lo rendido</text>
        {/* caja → gasto chico */}
        <line x1="486" y1="230" x2="618" y2="230" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a2)" />
        <text x="552" y="223" textAnchor="middle" fontSize="10.5" fill="currentColor">paga</text>
        {/* consejo: efectivo → cuenta */}
        <path d="M 85 205 C 85 150, 200 118, 313 112" fill="none" stroke={GOLD} strokeWidth="1.3" strokeDasharray="5 4" markerEnd="url(#a2-gold)" />
        <text x="172" y="186" fontSize="10.5" fontWeight="700" fill={GOLD}>consejo: depositarlo en Prex</text>
        <text x="172" y="199" fontSize="10" fill={GOLD}>así el extracto verifica cada aporte</text>
        <text x="390" y="288" textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.7">
          Lo que entra y sale en efectivo no lo verifica ningún extracto: solo el arqueo de la caja.
        </text>
      </svg>
      <figcaption className="mt-1 text-[12px] text-muted">
        Cómo se mueve la plata hoy. El efectivo de la Fiesta entra a la caja chica del tesorero y desde ahí se pagan los
        gastos chicos; es lo más sencillo. El camino punteado dorado es el consejo: cuando puedas, depositalo en Prex y
        pagá desde la cuenta, porque un extracto bancario es la única verificación externa del libro.
      </figcaption>
    </figure>
  );
}

/** ─── 3 · Los estados de una rendición ─────────────────────────── */
export function FigureReportStates() {
  return (
    <figure className="my-4 text-dark">
      <svg viewBox="0 0 780 170" role="img" aria-label="Una rendición pasa de en preparación a enviada y de ahí a aprobada, cuando sus gastos entran al libro; si el tesorero la devuelve, vuelve a preparación." style={{ maxWidth: "100%", height: "auto" }}>
        <Arrow id="a3" />
        <Box x={20} y={40} w={190} h={56} title="En preparación" sub="el responsable carga gastos con foto" />
        <Box x={295} y={40} w={190} h={56} title="Enviada" sub="contó la plata y la declaró" />
        <Box x={570} y={40} w={190} h={56} title="Aprobada" sub="entra al libro + reposición" accent />
        <line x1="212" y1="68" x2="293" y2="68" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a3)" />
        <text x="252" y="60" textAnchor="middle" fontSize="10.5" fill="currentColor">rinde</text>
        <line x1="487" y1="68" x2="568" y2="68" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a3)" />
        <text x="527" y="60" textAnchor="middle" fontSize="10.5" fill="currentColor">aprueba</text>
        {/* devuelta */}
        <path d="M 390 98 L 390 130 L 115 130 L 115 98" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" markerEnd="url(#a3)" />
        <text x="252" y="146" textAnchor="middle" fontSize="10.5" fill="currentColor">
          devuelta con una nota: corrige y vuelve a enviar
        </text>
        <text x="390" y="22" textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.7">
          Mientras no esté aprobada, sus gastos no están en el libro.
        </text>
      </svg>
      <figcaption className="mt-1 text-[12px] text-muted">
        La rendición de una caja chica. El libro lo escribe solo el tesorero: los gastos del responsable entran todos
        juntos al aprobar, cada uno con su comprobante.
      </figcaption>
    </figure>
  );
}

/** ─── 4 · Un mes cerrado no se toca ───────────────────────────── */
export function FigureClosedMonth() {
  const months = ["Junio", "Julio", "Agosto", "Setiembre"];
  return (
    <figure className="my-4 text-dark">
      <svg viewBox="0 0 780 180" role="img" aria-label="Los meses cerrados quedan congelados; un error de julio se corrige con un contra-asiento en el mes abierto, setiembre, sin tocar julio." style={{ maxWidth: "100%", height: "auto" }}>
        <Arrow id="a4" />
        {months.map((m, i) => {
          const x = 20 + i * 190;
          const closed = i < 3;
          return (
            <g key={m}>
              <rect x={x} y={40} width={170} height={70} rx="10" fill={closed ? "rgba(0,0,0,0.06)" : "rgba(150,121,14,0.10)"} stroke={closed ? "currentColor" : GOLD} strokeOpacity={closed ? 0.3 : 1} strokeWidth="1.2" />
              <text x={x + 85} y={66} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="currentColor">{m}</text>
              <text x={x + 85} y={84} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.7">
                {closed ? "cerrado · congelado" : "abierto · se puede cargar"}
              </text>
              {closed && (
                <g transform={`translate(${x + 150} 50)`}>
                  <rect x="-5" y="-1" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
                  <path d="M -3 -1 v -3 a 3 3 0 0 1 6 0 v 3" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.3" />
                </g>
              )}
            </g>
          );
        })}
        {/* error en julio → contra-asiento en setiembre */}
        <circle cx="295" cy="128" r="5" fill={RED} />
        <text x="305" y="132" fontSize="10.5" fill={RED}>un gasto mal cargado en julio</text>
        <path d="M 295 133 L 295 150 L 675 150 L 675 112" fill="none" stroke="currentColor" strokeWidth="1.3" markerEnd="url(#a4)" />
        <text x="520" y="166" textAnchor="middle" fontSize="10.5" fill="currentColor">
          se revierte con un contra-asiento fechado en setiembre, con motivo; julio queda como se cerró
        </text>
        <circle cx="675" cy="98" r="5" fill={GREEN} />
      </svg>
      <figcaption className="mt-1 text-[12px] text-muted">
        Un mes cerrado no se toca (es lo que pide el MEC: sin correcciones ni tachaduras). Los dos asientos quedan a la
        vista: el original tal como se cerró y la corrección en el mes abierto.
      </figcaption>
    </figure>
  );
}
