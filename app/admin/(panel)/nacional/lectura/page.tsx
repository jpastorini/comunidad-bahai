import {
  Banner,
  Button,
  Card,
  Field,
  PageHeader,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { civilDateISO, civilDateLabel, getCitaDelDia } from "@/lib/citas";
import { addDaysISO, type DailyReadingOverride } from "@/lib/daily-reading";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  clearTomorrowReadingAction,
  saveTomorrowReadingAction,
} from "./actions";

/**
 * Lectura de mañana: reemplazar la cita calculada del día siguiente por
 * una escrita a mano (081). Vale para todo el país, en la app y en el
 * aviso de las 8:00. Por ahora solo mañana; la tabla ya admite cualquier
 * fecha para cuando se agenden las fechas especiales.
 */
export default async function LecturaPage() {
  await requireNationalAdmin();

  const tomorrowISO = addDaysISO(civilDateISO(), 1);
  // Mediodía UTC de esa fecha cae el mismo día civil en Montevideo.
  const tomorrowDate = new Date(`${tomorrowISO}T15:00:00Z`);
  const automatic = getCitaDelDia(tomorrowDate);

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("daily_reading_overrides")
    .select("reading_date, text, reference, title")
    .eq("reading_date", tomorrowISO)
    .maybeSingle();
  const missing =
    error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "42703";
  const current = (data as DailyReadingOverride | null) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Admin Nacional"
        title="Lectura de mañana"
        description="Reemplazá la Lectura de hoy del día siguiente por una cita que escribas vos. La ven todos los creyentes del país, en la app y en el aviso de las 8:00."
      />

      {missing && (
        <div className="mb-5">
          <Banner tone="warning">
            Falta aplicar la migración 081: hasta entonces no se puede guardar
            y la Lectura de hoy sigue saliendo sola.
          </Banner>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <Card>
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
            {current ? "Mañana se lee tu cita" : "Mañana sale sola"} ·{" "}
            {civilDateLabel(tomorrowDate)}
          </div>
          {current ? (
            <>
              {current.title && (
                <div className="mb-1 text-[13px] font-semibold text-dark">
                  {current.title}
                </div>
              )}
              <p className="whitespace-pre-line font-display text-[16px] italic leading-[1.55] text-dark">
                “{current.text}”
              </p>
              <div className="mt-2 font-body text-[12px] text-muted">
                — {current.reference}
              </div>
              <form action={clearTomorrowReadingAction} className="mt-4">
                <Button type="submit" variant="secondary">
                  Volver a la cita automática
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-1 text-[13px] font-semibold text-dark">
                {automatic.topic.name}
              </div>
              <p className="whitespace-pre-line font-display text-[16px] italic leading-[1.55] text-dark">
                “{automatic.cita.text}”
              </p>
              <div className="mt-2 font-body text-[12px] text-muted">
                — {automatic.cita.reference}
              </div>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-[20px] font-semibold text-dark">
            {current ? "Cambiar la cita de mañana" : "Escribir la cita de mañana"}
          </h2>
          <form action={saveTomorrowReadingAction} className="flex flex-col gap-4">
            <Field
              label="Título"
              name="title"
              hint="Opcional: va en lugar del tema"
            >
              <TextInput
                id="title"
                name="title"
                maxLength={80}
                defaultValue={current?.title ?? ""}
                placeholder="Día del Convenio"
              />
            </Field>
            <Field label="Texto" name="text" required>
              <TextArea
                id="text"
                name="text"
                required
                rows={7}
                maxLength={4000}
                defaultValue={current?.text ?? ""}
              />
            </Field>
            <Field label="Referencia" name="reference" required>
              <TextInput
                id="reference"
                name="reference"
                required
                maxLength={300}
                defaultValue={current?.reference ?? ""}
                placeholder="Bahá'u'lláh, Pasajes de los Escritos de Bahá'u'lláh, CXXXII"
              />
            </Field>
            <div>
              <Button type="submit" disabled={missing}>
                Guardar para mañana
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
