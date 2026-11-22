import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationEditor } from "@/components/invitations/InvitationEditor";
import { Banner, PageHeader } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { getFeast, getFeastLocations } from "@/lib/data";
import { feastCelebration } from "@/lib/feast-schedule";
import { invitationFooter } from "@/lib/invitation";

// La invitación a una Fiesta de los 19 Días: una imagen por lugar de
// celebración. Fecha y hora salen de la MISMA regla que el calendario y el
// recordatorio (`feastCelebration`), para que la imagen no diga otro día.
export default async function FeastInvitationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { lugar?: string };
}) {
  const session = await requirePermission("fiestas");
  const [feast, locations] = await Promise.all([
    getFeast(params.id),
    getFeastLocations(params.id),
  ]);
  if (!feast) notFound();

  const location =
    locations.find((l) => l.id === searchParams?.lugar) ?? locations[0] ?? null;
  const when = feast.gregorian_date
    ? feastCelebration(feast.gregorian_date, location?.starts_at)
    : null;

  return (
    <>
      <PageHeader
        back={{ href: `/admin/fiestas/${feast.id}`, label: `Fiesta de ${feast.bahai_month_name}` }}
        eyebrow="Vida comunitaria"
        title="Invitación a la Fiesta"
        description="Una imagen con el lugar, la fecha y la hora, para los grupos de la comunidad. La Fiesta de los 19 Días es para los creyentes."
      />

      {locations.length === 0 && (
        <div className="mb-5">
          <Banner tone="warning">
            Esta Fiesta todavía no tiene lugares cargados: completá acá el lugar y
            la hora, o cargalos primero en la Fiesta para que salgan solos.
          </Banner>
        </div>
      )}

      {locations.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-dark">Lugar:</span>
          {locations.map((l) => (
            <Link
              key={l.id}
              href={`/admin/fiestas/${feast.id}/invitacion?lugar=${l.id}`}
              className={`tap rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                l.id === location?.id
                  ? "border-terra bg-terra text-white"
                  : "border-black/10 bg-card text-dark"
              }`}
            >
              {l.name}
            </Link>
          ))}
        </div>
      )}

      <InvitationEditor
        // Otro lugar es otra invitación: el editor arranca de nuevo.
        key={location?.id ?? "sin-lugar"}
        initial={{
          eyebrow: "Fiesta de los 19 Días",
          title: `Fiesta de ${feast.bahai_month_name}`,
          date: when?.date ?? "",
          time: when?.time ?? "",
          place: location
            ? [location.name, location.address].filter(Boolean).join("\n")
            : "",
          text: "",
          footer: invitationFooter(session.locality),
          imageUrl: null,
        }}
      />
    </>
  );
}
