import { BahaiStar } from "@/components/BahaiStar";
import { Returner } from "./returner";

/**
 * Adonde manda `requireMember` a quien entra a la app del creyente con
 * una estructura puesta (082). No llama a ningún guard —volvería a
 * mandar acá— y no cambia nada al renderizar: el cambio lo hace el
 * cliente al montarse.
 */
export default function VolverPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next ?? "/";
  return (
    <div className="relative flex min-h-[calc(100dvh/var(--ui-zoom,1))] flex-col items-center justify-center overflow-hidden bg-gold-grad px-6 text-center">
      <div className="pointer-events-none absolute -right-20 -top-24 opacity-[0.07]">
        <BahaiStar size={300} color="#fff" />
      </div>
      <div className="mx-auto mb-4 inline-flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
        <BahaiStar size={36} color="#fff" />
      </div>
      <h1 className="font-display text-[24px] font-bold leading-tight text-white">
        Volviendo a tu comunidad
      </h1>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-white/80">
        Tenías puesta una estructura del panel. La app de la comunidad se ve
        con tu comunidad.
      </p>
      <Returner next={next} />
    </div>
  );
}
