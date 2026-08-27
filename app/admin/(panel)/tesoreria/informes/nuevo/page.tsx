import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/treasury-ledger";
import { bahaiYearForDate, periodPresets } from "@/lib/treasury-reports";
import { createReportAction } from "../actions";
import { PeriodPicker } from "./period-picker";

export default async function NuevoInformePage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const today = todayISO();
  const bahaiYear = bahaiYearForDate(today);
  const presets = bahaiYear ? periodPresets(bahaiYear, today) : [];

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Nuevo informe"
        description="Elegí el período. Las cifras se leen del libro y quedan congeladas en el informe."
        actions={
          <Button variant="secondary" href="/admin/tesoreria/informes">
            Cancelar
          </Button>
        }
      />

      <form action={createReportAction}>
        <Card>
          <PeriodPicker
            presets={presets}
            today={today}
            defaultTitle="Fiesta de los Diecinueve Días"
          />
        </Card>

        <div className="mt-4">
          <Banner tone="info">
            Los <strong>ingresos y egresos</strong> son los del período. Los{" "}
            <strong>saldos</strong>, en cambio, son acumulados: todo el libro
            hasta la fecha de cierre, porque un saldo no tiene período. Las
            transferencias entre cuentas y las compras de divisas no cuentan
            como movimiento del Fondo.
          </Banner>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" href="/admin/tesoreria/informes">
            Cancelar
          </Button>
          <Button type="submit">Crear informe</Button>
        </div>
      </form>
    </>
  );
}
