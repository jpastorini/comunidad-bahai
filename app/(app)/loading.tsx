/**
 * loading.tsx — App shell skeleton
 *
 * Se muestra INSTANTÁNEAMENTE al navegar entre tabs, eliminando la
 * percepción de "pantalla congelada" mientras los Server Components
 * cargan datos de Supabase.
 *
 * Next.js App Router muestra este componente automáticamente como
 * fallback de Suspense para cualquier página dentro de app/(app)/.
 */

export default function Loading() {
  return (
    <>
      {/* Gold header skeleton */}
      <div
        className="shrink-0 overflow-hidden rounded-b-[20px] bg-gold-grad px-5 pb-5 animate-pulse"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)" }}
      >
        <div className="h-7 w-48 rounded-lg bg-white/20" />
        <div className="mt-2 h-3 w-24 rounded bg-white/10" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto px-4 pt-4 animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-terra/10" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 w-3/4 rounded bg-dark/8" />
                  <div className="h-3 w-1/2 rounded bg-muted/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
