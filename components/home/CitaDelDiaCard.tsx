import Link from "next/link";
import { BahaiStar } from "../BahaiStar";
import { IconArrowRight } from "../Icons";
import { excerpt, type Cita, type CitaTopic } from "@/lib/citas";

type Props = {
  cita: Cita;
  topic: CitaTopic;
  /** Fecha civil legible. La calcula el servidor para que no haya
   *  desajuste de hidratación ni dependa del huso del dispositivo. */
  dateLabel: string;
};

/**
 * "Lectura de hoy": la cita del día en Inicio. Cumple con la práctica de
 * leer los Escritos Sagrados por la mañana sin que haya que ir a buscarla.
 * Es la misma para toda la comunidad cada día (ver lib/citas.ts).
 */
export function CitaDelDiaCard({ cita, topic, dateLabel }: Props) {
  return (
    <Link
      href="/citas"
      className="tap relative mb-3 block overflow-hidden rounded-[18px] bg-card px-[18px] py-[15px] shadow-card-elevated ring-1 ring-gold/15"
    >
      <div className="pointer-events-none absolute -right-3 -top-4 opacity-[0.05]">
        <BahaiStar size={92} color="#96790E" />
      </div>
      <div className="mb-[7px] flex items-baseline justify-between gap-2 text-[9px] font-semibold uppercase tracking-[1.5px]">
        <span className="min-w-0 truncate text-gold-dark/70">
          ✦ Lectura de hoy · {topic.name}
        </span>
        <span className="shrink-0 text-muted/70">{dateLabel}</span>
      </div>
      <p className="mb-2 line-clamp-4 font-display text-[15px] italic leading-[1.55] text-dark">
        “{excerpt(cita.text, 150)}”
      </p>
      <div className="mb-2.5 font-body text-[11px] text-muted">
        — {cita.reference}
      </div>
      <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-gold-dark">
        Leer y compartir
        <IconArrowRight size={12} />
      </div>
    </Link>
  );
}
