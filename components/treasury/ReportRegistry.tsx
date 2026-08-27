import Link from "next/link";
import { Banner, DataTable } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import {
  fmtAmount,
  fmtDayMonth,
  primaryCurrency,
} from "@/lib/treasury-report-content";
import type { TreasuryReport } from "@/lib/treasury-reports";

/**
 * Registro de informes de Tesorería — vista de SOLO LECTURA.
 *
 * Es la contracara de la pantalla del tesorero: acá no hay un solo botón
 * que modifique nada. Deliberadamente separado de la página para que la
 * página se ocupe de los datos y los permisos, y esto solo de mostrar.
 *
 * Dos secciones porque "estado" no significa lo mismo en las dos: un
 * informe a la Asamblea se aprueba en reunión; uno de la comunidad se
 * presenta en la Fiesta y no pasa por aprobación.
 */
export function ReportRegistry({
  internos,
  comunidad,
  esTesorero = false,
  borradores = 0,
}: {
  internos: TreasuryReport[];
  comunidad: TreasuryReport[];
  esTesorero?: boolean;
  borradores?: number;
}) {
  return (
    <>
      <section className="mb-8">
        <h2 className="mb-1 font-display text-[19px] font-semibold text-dark">
          Informes a la Asamblea
        </h2>
        <p className="mb-3 text-[12px] text-muted">
          Los que se adjuntan al acta. Un informe queda{" "}
          <strong className="text-dark">aprobado</strong> cuando la Tesorería
          registra la reunión en que la Asamblea lo aprobó.
        </p>

        <DataTable
          rows={internos}
          rowKey={(r) => r.id}
          empty="Todavía no hay informes emitidos a la Asamblea."
          columns={[
            { key: "informe", label: "Informe", render: (r) => <Titulo report={r} /> },
            { key: "periodo", label: "Período", render: (r) => <Periodo report={r} /> },
            {
              key: "emitido",
              label: "Emitido",
              render: (r) => <Fecha value={r.published_at} />,
            },
            { key: "cifras", label: "Resultado", render: (r) => <Figures report={r} /> },
            { key: "estado", label: "Estado", render: (r) => <ApprovalBadge report={r} /> },
            {
              key: "ver",
              label: "",
              render: (r) => <VerLink id={r.id} label="Ver hoja" />,
            },
          ]}
        />
      </section>

      {comunidad.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 font-display text-[19px] font-semibold text-dark">
            Presentados a la comunidad
          </h2>
          <p className="mb-3 text-[12px] text-muted">
            Los que se proyectan en la Fiesta de los Diecinueve Días. No pasan
            por aprobación de la Asamblea.
          </p>

          <DataTable
            rows={comunidad}
            rowKey={(r) => r.id}
            columns={[
              { key: "informe", label: "Informe", render: (r) => <Titulo report={r} /> },
              { key: "periodo", label: "Período", render: (r) => <Periodo report={r} /> },
              {
                key: "publicado",
                label: "Publicado",
                render: (r) => <Fecha value={r.published_at} />,
              },
              { key: "cifras", label: "Resultado", render: (r) => <Figures report={r} /> },
              {
                key: "ver",
                label: "",
                render: (r) => <VerLink id={r.id} label="Ver deck" />,
              },
            ]}
          />
        </section>
      )}

      {esTesorero && borradores > 0 && (
        <Banner tone="info">
          Tenés {borradores}{" "}
          {borradores === 1 ? "informe en borrador" : "informes en borrador"}, que
          no se listan acá hasta que los emitas. Están en{" "}
          <Link
            href="/admin/tesoreria/informes"
            className="font-semibold underline"
          >
            Tesorería → Informes
          </Link>
          .
        </Banner>
      )}
    </>
  );
}

function Titulo({ report }: { report: TreasuryReport }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-dark">{report.title}</div>
      {report.subtitle && (
        <div className="text-[11.5px] text-muted">{report.subtitle}</div>
      )}
    </div>
  );
}

function Periodo({ report }: { report: TreasuryReport }) {
  return (
    <div className="whitespace-nowrap">
      <div>
        {fmtDayMonth(report.period_from)} al {fmtDayMonth(report.period_to)}
      </div>
      {report.bahai_year && (
        <div className="text-[11.5px] text-muted">
          Ejercicio {report.bahai_year} E.B.
        </div>
      )}
    </div>
  );
}

function Fecha({ value }: { value: string | null }) {
  return (
    <span className="whitespace-nowrap text-[12.5px] text-muted">
      {value ? formatDate(value) : "—"}
    </span>
  );
}

function VerLink({ id, label }: { id: string; label: string }) {
  return (
    <Link
      href={`/admin/informe/${id}`}
      target="_blank"
      className="tap inline-flex whitespace-nowrap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
    >
      {label}
    </Link>
  );
}

/** Ingresos y egresos del período, en la moneda principal del informe. */
function Figures({ report }: { report: TreasuryReport }) {
  const s = report.snapshot;
  const main = primaryCurrency([...s.income, ...s.expenses]);
  const income = s.income.find((m) => m.currency === main);
  const expense = s.expenses.find((m) => m.currency === main);

  return (
    <div className="whitespace-nowrap tabular-nums text-[12.5px]">
      <span className="text-green">
        + {fmtAmount(income?.amount ?? 0, main)}
      </span>
      <span className="mx-1 text-muted">/</span>
      <span className="text-rose-700">
        − {fmtAmount(expense?.amount ?? 0, main)}
      </span>
    </div>
  );
}

/**
 * Aprobado / No aprobado. El dato es la reunión que la Tesorería registró
 * en el informe: sin fecha de reunión no hay aprobación que informar.
 */
function ApprovalBadge({ report }: { report: TreasuryReport }) {
  const appr = report.editorial.approval;

  if (!appr?.meetingDate) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-gold-dark">
        No aprobado
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <span className="inline-flex whitespace-nowrap rounded-full border border-green/30 bg-green/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-green">
        Aprobado
      </span>
      <div className="mt-1 text-[11.5px] leading-snug text-muted">
        Reunión del {appr.meetingDate}
        {appr.actaNumber && (
          <>
            <br />
            Acta N.º {appr.actaNumber}
          </>
        )}
      </div>
    </div>
  );
}
