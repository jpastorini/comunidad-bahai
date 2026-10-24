import "server-only";

import { effectiveEventColor, type CalendarEventKind } from "./calendar-kinds";
import type { UnifiedCalendarItem } from "./data";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { Locality } from "./types";

/**
 * El calendario entre instituciones (085), solo para el panel: los
 * eventos de las otras instituciones de las familias de la persona (su
 * Asamblea y sus Comités, Departamentos, Instituto) y de la familia
 * nacional. Sale de `institutional_calendar()`, una función aparte y no
 * de la RLS de `calendar_events`: si fuera por RLS, el calendario del
 * creyente, el Inicio y los recordatorios también los mostrarían.
 *
 * Se ven, no se editan: cada institución edita los suyos.
 */

export type CalendarScope = "locales" | "nacionales" | "ambas";

export function parseCalendarScope(raw: string | undefined): CalendarScope {
  return raw === "locales" || raw === "nacionales" ? raw : "ambas";
}

type Row = {
  id: string;
  locality_id: string;
  institution: string;
  family: "local" | "nacional";
  day: number;
  month: number;
  year: number;
  title: string;
  time: string;
  kind: string;
  color: string;
  location: string | null;
  community_visible: boolean;
};

export async function getInstitutionalItems(
  from: string,
  to: string
): Promise<UnifiedCalendarItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("institutional_calendar", {
    p_from: from,
    p_to: to,
  });
  if (error) {
    // Sin la 085 el calendario sigue con lo propio, como antes.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("[institutional-calendar]", error.message);
    }
    return [];
  }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    source: "calendar_event",
    href: `/calendario/${r.id}`,
    adminHref: "",
    day: r.day,
    month: r.month,
    year: r.year,
    title: r.title,
    time: r.time,
    kind: (r.kind as CalendarEventKind) ?? "actividad_general",
    color: effectiveEventColor(r.kind as CalendarEventKind, r.color),
    location: r.location,
    image_url: null,
    isSystemSeeded: false,
    feastStatus: null,
    institution: r.institution,
    family: r.family,
    readOnly: true,
    localityId: r.locality_id,
  }));
}

/** El id de la Comunidad Nacional (056), o null si no existe. */
export async function getNationalLocalityId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createSupabaseServer()
    .from("localities")
    .select("id")
    .eq("kind", "nacional")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** La familia de la institución puesta: la nacional si su raíz es la AEN. */
export function familyOf(
  locality: Pick<Locality, "kind" | "parent_id">,
  nationalId: string | null
): "local" | "nacional" {
  if (locality.kind === "nacional") return "nacional";
  if (locality.kind === "estructura" && locality.parent_id && locality.parent_id === nationalId) {
    return "nacional";
  }
  return "local";
}
