import { notFound } from "next/navigation";
import { Banner, Button, Card, Checkbox, DateInput, Field, PageHeader, Select, TextArea } from "@/components/admin/ui";
import { HelpTip } from "@/components/HelpTip";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CASH_REPORT_STATUS_LABEL,
  cashDifferences,
  getCashBox,
  getCashLines,
  getCashReport,
  linesTotal,
  signCashLines,
} from "@/lib/treasury-cash";
import { formatMoney } from "@/lib/treasury-format";
import { getLedgerCatalog, todayISO } from "@/lib/treasury-ledger";
import { isNationalLocality } from "@/lib/types";
import { reviewCashReportAction } from "../../../actions";

export const dynamic = "force-dynamic";

/**
 * Revisar una rendición: los gastos con sus comprobantes, el arqueo que
 * declaró el responsable contra lo esperado, y las dos salidas: aprobar
 * (entra todo al libro + reposición) o devolver con nota.
 */
export default async function RendicionPage({ params }: { params: { id: string; rid: string } }) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const today = todayISO();

  const [box, report] = await Promise.all([getCashBox(supabase, params.id), getCashReport(supabase, params.rid)]);
  if (!box || !report || report.box_id !== box.id) notFound();

  const [catalog, lines] = await Promise.all([
    getLedgerCatalog(supabase, session.locality.id, { nationwide: isNationalLocality(session.locality) }),
    getCashLines(supabase, [report.id]).then((l) => signCashLines(supabase, l)),
  ]);
  const accountName = new Map(catalog.accounts.map((a) => [a.id, a.name]));
  const subName = new Map(catalog.subcategories.map((s) => [s.id, s.name]));
  const totals = linesTotal(lines);
  const counted = [
    { currency: "UYU", amount: report.counted_uyu ?? 0 },
    { currency: "USD", amount: report.counted_usd ?? 0 },
  ];
  const expected = [
    { currency: "UYU", amount: report.expected_uyu ?? 0 },
    { currency: "USD", amount: report.expected_usd ?? 0 },
  ];
  const diffs = cashDifferences(counted, expected);
  const reviewable = report.status === "enviada";
  const missingRubro = lines.filter((l) => !l.subcategory_id).length;
  const missingDoc = lines.filter((l) => !l.storage_path).length;

  // El rubro de la reposición: el de las transferencias entre cuentas.
  const transferSubs = catalog.subcategories.filter((s) => s.is_active);
  const guess =
    transferSubs.find((s) => /reposici|cambio de caja|transferencia interna|transferencia entre/i.test(s.name)) ??
    transferSubs.find((s) => /transferen|cambio/i.test(s.name));

  return (
    <>
      <PageHeader
        back={{ href: `/admin/tesoreria/cajas/${box.id}`, label: accountName.get(box.account_id) ?? "Caja chica" }}
        eyebrow="Tesorería · Cajas chicas"
        title={`Rendición · ${CASH_REPORT_STATUS_LABEL[report.status]}`}
        description={
          report.submitted_at
            ? `Enviada el ${formatDateTime(report.submitted_at)}.${report.reviewed_at ? ` Revisada el ${formatDateTime(report.reviewed_at)}.` : ""}`
            : `Abierta el ${formatDate(report.created_at)}; el responsable todavía no la envió.`
        }
      />

      {report.review_note && (
        <div className="mb-4">
          <Banner tone={report.status === "devuelta" ? "warning" : "info"}>
            <strong>Nota de la revisión:</strong> {report.review_note}
          </Banner>
        </div>
      )}
      {report.note && (
        <div className="mb-4">
          <Banner tone="info">
            <strong>Nota del responsable:</strong> {report.note}
          </Banner>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <h2 className="font-display text-[18px] font-semibold text-dark">
            Gastos{" "}
            <span className="text-[13px] font-normal text-muted">
              · {lines.length} · {totals.length ? totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ") : "—"}
            </span>
          </h2>
          {lines.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">Sin gastos cargados.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/[0.05]">
              {lines.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start gap-3 py-3">
                  {l.url && l.mime_type?.startsWith("image/") ? (
                    <a href={l.url} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.url} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10" />
                    </a>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg text-[10px] font-bold uppercase text-muted ring-1 ring-black/10">
                      {l.storage_path ? (l.url ? "PDF" : "…") : "sin"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-dark">
                        {l.subcategory_id ? subName.get(l.subcategory_id) ?? "Rubro" : <span className="text-rose-700">Sin rubro</span>}
                      </span>
                      <span className="tabular-nums text-[14px] font-semibold text-dark">{formatMoney(l.amount, l.currency)}</span>
                    </div>
                    <div className="text-[12.5px] text-muted">
                      {formatDate(l.line_date)}
                      {l.description ? ` · ${l.description}` : ""}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-muted">
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noreferrer" className="font-semibold text-terra hover:underline">
                          {l.file_name ?? "Ver comprobante"}
                        </a>
                      ) : l.storage_path ? (
                        "Comprobante (no se pudo firmar la URL)"
                      ) : (
                        <span className="text-rose-700">Sin comprobante</span>
                      )}
                      {l.entry_id && " · ya en el libro"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-dark">
              Arqueo declarado
              <HelpTip
                title="Arqueo del responsable"
                text="Al enviar, el responsable contó el efectivo que le quedaba. «Debería haber» es el saldo del libro de la caja menos estos gastos. Una diferencia no impide aprobar: se registra después como ajuste con motivo."
              />
            </h2>
            {report.submitted_at ? (
              <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                {["UYU", "USD"].map((c) => {
                  const ct = counted.find((x) => x.currency === c)!.amount;
                  const ex = expected.find((x) => x.currency === c)!.amount;
                  if (ct === 0 && ex === 0) return null;
                  const d = diffs.find((x) => x.currency === c);
                  return (
                    <div key={c} className="rounded-xl bg-bg/60 px-3 py-2">
                      <div className="flex justify-between">
                        <dt className="text-muted">Contó</dt>
                        <dd className="tabular-nums font-semibold">{formatMoney(ct, c)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Debería haber</dt>
                        <dd className="tabular-nums">{formatMoney(ex, c)}</dd>
                      </div>
                      <div className={`mt-1 text-right text-[12.5px] font-semibold ${d ? "text-rose-700" : "text-green"}`}>
                        {d ? `${d.amount > 0 ? "Sobran" : "Faltan"} ${formatMoney(Math.abs(d.amount), c)}` : "Cuadra"}
                      </div>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="mt-2 text-[13px] text-muted">Todavía no la envió.</p>
            )}
          </Card>

          {reviewable && (
            <>
              <Card>
                <h2 className="font-display text-[18px] font-semibold text-dark">Aprobar</h2>
                <p className="mt-1 text-[12.5px] text-muted">
                  Cada gasto entra al libro como un asiento en la cuenta de la caja, con su comprobante.
                  Un gasto fechado en un mes ya cerrado entra con la fecha de hoy y la original en el detalle.
                </p>
                {(missingRubro > 0 || missingDoc > 0) && (
                  <div className="mt-2">
                    <Banner tone="warning">
                      {missingRubro > 0 && `${missingRubro} ${missingRubro === 1 ? "gasto sin rubro (no se puede aprobar así)" : "gastos sin rubro (no se puede aprobar así)"}. `}
                      {missingDoc > 0 && `${missingDoc} ${missingDoc === 1 ? "gasto sin comprobante" : "gastos sin comprobante"}: se puede aprobar, pero la auditoría lo va a marcar.`}
                    </Banner>
                  </div>
                )}
                <form action={reviewCashReportAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="report_id" value={report.id} />
                  <input type="hidden" name="decision" value="aprobar" />
                  {box.source_account_id ? (
                    <>
                      <Checkbox
                        name="replenish"
                        defaultChecked
                        label={`Reponer lo gastado desde ${accountName.get(box.source_account_id) ?? "la cuenta de origen"} (${totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ") || "—"})`}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Rubro de la reposición" name="replenish_subcategory_id">
                          <Select id="replenish_subcategory_id" name="replenish_subcategory_id" defaultValue={guess?.id ?? ""}>
                            <option value="">— Elegir —</option>
                            {transferSubs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Fecha de la reposición" name="replenish_date">
                          <DateInput id="replenish_date" name="replenish_date" defaultValue={today} />
                        </Field>
                      </div>
                    </>
                  ) : (
                    <p className="text-[12.5px] text-muted">
                      La caja no tiene cuenta de origen: la reposición se carga a mano en el Libro como transferencia.
                    </p>
                  )}
                  <Field label="Nota para el responsable" name="review_note" hint="opcional">
                    <TextArea id="review_note_ok" name="review_note" rows={2} placeholder="Gracias, todo en orden…" />
                  </Field>
                  <Button type="submit" disabled={missingRubro > 0 || lines.length === 0}>
                    Aprobar y cargar al libro
                  </Button>
                </form>
              </Card>

              <Card>
                <h2 className="font-display text-[18px] font-semibold text-dark">Devolver para corregir</h2>
                <form action={reviewCashReportAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="report_id" value={report.id} />
                  <input type="hidden" name="decision" value="devolver" />
                  <Field label="Qué hay que corregir" name="review_note" required>
                    <TextArea id="review_note_no" name="review_note" rows={3} required placeholder="Falta el comprobante del gasto del 12/9; el de la librería tiene otro monto…" />
                  </Field>
                  <Button type="submit" variant="secondary">
                    Devolver
                  </Button>
                </form>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
