import { Banner, Button, Card, PageHeader, Select } from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTerritory } from "@/lib/territory";
import type { Locality } from "@/lib/types";
import { saveTerritoryAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Admin Nacional → Zonas y agrupaciones (086). El mapa del país: qué
 * agrupación va en cada zona electoral y en qué agrupación está cada
 * Asamblea Local. Un solo formulario y un solo botón: se arma de una
 * sentada y casi no cambia.
 */
export default async function TerritorioPage() {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();
  const [territory, { data: locs }] = await Promise.all([
    getTerritory(supabase),
    supabase
      .from("localities")
      .select("*")
      .eq("kind", "ael")
      .order("name"),
  ]);
  const assemblies = (locs ?? []) as Locality[];
  const withoutZone = territory.agrupaciones.filter((a) => !a.zone_id).length;
  const withoutAgr = assemblies.filter((l) => !l.agrupacion_id).length;

  return (
    <>
      <PageHeader
        eyebrow="Admin Nacional"
        title="Zonas y agrupaciones"
        description="El mapa del país: las tres zonas electorales, las veinte agrupaciones y en cuál está cada Asamblea Local. Los creyentes de la Comunidad Nacional eligen su agrupación en su perfil."
      />

      {territory.missing ? (
        <Banner tone="warning">Falta aplicar la migración 086 en la base.</Banner>
      ) : (
        <form action={saveTerritoryAction} className="flex flex-col gap-4">
          {(withoutZone > 0 || withoutAgr > 0) && (
            <Banner tone="info">
              {[
                withoutZone > 0 &&
                  `${withoutZone} ${withoutZone === 1 ? "agrupación sin zona" : "agrupaciones sin zona"}`,
                withoutAgr > 0 &&
                  `${withoutAgr} ${withoutAgr === 1 ? "Asamblea sin agrupación" : "Asambleas sin agrupación"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              .
            </Banner>
          )}

          <Card>
            <h2 className="mb-3 font-display text-[18px] font-semibold text-dark">
              Agrupaciones por zona
            </h2>
            <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {territory.agrupaciones.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-[13.5px] font-medium text-dark">{a.name}</span>
                  <input type="hidden" name={`prev_zone_${a.id}`} value={a.zone_id ?? ""} />
                  <div className="w-[140px] shrink-0">
                    <Select name={`zone_${a.id}`} defaultValue={a.zone_id ?? ""} aria-label={`Zona de ${a.name}`}>
                      <option value="">Sin zona</option>
                      {territory.zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-[18px] font-semibold text-dark">
              Asambleas Locales por agrupación
            </h2>
            {assemblies.length === 0 ? (
              <p className="text-[13px] text-muted">No hay Asambleas Locales cargadas.</p>
            ) : (
              <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
                {assemblies.map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-[13.5px] font-medium text-dark">{l.name}</span>
                    <input type="hidden" name={`prev_agr_${l.id}`} value={l.agrupacion_id ?? ""} />
                    <div className="w-[180px] shrink-0">
                      <Select name={`agr_${l.id}`} defaultValue={l.agrupacion_id ?? ""} aria-label={`Agrupación de ${l.name}`}>
                        <option value="">Sin agrupación</option>
                        {territory.agrupaciones.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex justify-end">
            <Button type="submit">Guardar el mapa</Button>
          </div>
        </form>
      )}
    </>
  );
}
