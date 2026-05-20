import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { getFeasts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FiestasPage() {
  const feasts = await getFeasts();
  const inProgress = feasts.find((f) => f.status === "in_progress");
  const upcoming = feasts.filter(
    (f) => f.status === "upcoming" && f.id !== inProgress?.id
  );
  const past = feasts.filter(
    (f) => f.status === "in_progress" && f.id !== inProgress?.id
  );

  return (
    <>
      <GoldHeader
        title="Fiestas de 19 Días"
        subtitle="Vida espiritual de la comunidad"
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pb-4 pt-4">
        {feasts.length === 0 && (
          <div className="py-12 text-center text-[13px] text-muted">
            Aún no hay Fiestas programadas.
          </div>
        )}

        {inProgress && (
          <FeastCard feast={inProgress} highlight />
        )}

        {upcoming.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted">
              Próximamente
            </h2>
            <div className="flex flex-col gap-2.5">
              {upcoming.map((f) => (
                <FeastCard key={f.id} feast={f} />
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted">
              Fiestas pasadas
            </h2>
            <div className="flex flex-col gap-2.5">
              {past.map((f) => (
                <FeastCard key={f.id} feast={f} muted />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

type Feast = Awaited<ReturnType<typeof getFeasts>>[number];

function FeastCard({
  feast,
  highlight = false,
  muted = false,
}: {
  feast: Feast;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={`/fiestas/${feast.id}`}
      className={`tap block rounded-2xl p-4 shadow-card ${
        highlight
          ? "bg-terra-grad text-white"
          : muted
            ? "bg-card opacity-70"
            : "bg-card"
      }`}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-[1.5px] ${
          highlight ? "text-white/70" : "text-gold-dark"
        }`}
      >
        {highlight ? "✦ Programa disponible" : `Mes ${feast.bahai_month_index}`}
      </div>
      <div
        className={`mt-1 font-display text-[22px] font-semibold leading-tight ${
          highlight ? "text-white" : "text-dark"
        }`}
      >
        Fiesta de {feast.bahai_month_name}
      </div>
      <div
        className={`mt-0.5 font-body text-[12px] ${
          highlight ? "text-white/75" : "text-muted"
        }`}
      >
        Año {feast.bahai_year} de la Era Bahá'í
      </div>
    </Link>
  );
}
