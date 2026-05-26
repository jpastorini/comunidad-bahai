/**
 * loading.tsx — Admin panel skeleton
 *
 * Feedback instantáneo al navegar entre secciones del panel admin.
 */

export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      {/* PageHeader skeleton */}
      <div className="mb-7 md:mb-10">
        <div className="h-2.5 w-16 rounded bg-gold-dark/20" />
        <div className="mt-2 h-8 w-64 rounded-lg bg-dark/10" />
        <div className="mt-3 h-3 w-80 rounded bg-muted/10" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-terra/8" />
              <div className="h-8 w-10 rounded bg-dark/8" />
            </div>
            <div>
              <div className="h-3.5 w-20 rounded bg-dark/8" />
              <div className="mt-1.5 h-2.5 w-14 rounded bg-muted/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
