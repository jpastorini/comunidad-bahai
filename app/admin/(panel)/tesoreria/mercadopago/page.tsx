import Link from "next/link";
import { headers } from "next/headers";
import { Banner, Button, Card, Field, PageHeader, Select } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { isTestToken } from "@/lib/mercadopago";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/treasury-format";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { getMpSettings, getRecentContributions, isMpUsable } from "@/lib/treasury-online";
import { saveMpSettingsAction } from "./actions";
import { EnabledSwitch, SecretField } from "./settings-controls";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  creado: "Abrió el pago",
  pendiente: "Pendiente",
  aprobado: "En el libro",
  rechazado: "Rechazado",
  devuelto: "Devuelto",
};

const STATUS_TONE: Record<string, string> = {
  creado: "bg-black/[0.05] text-muted",
  pendiente: "bg-amber-50 text-amber-800",
  aprobado: "bg-green/15 text-green",
  rechazado: "bg-rose-50 text-rose-700",
  devuelto: "bg-rose-50 text-rose-700",
};

/**
 * Tesorería → Mercado Pago (079): la cuenta con que cobra la comunidad,
 * con qué cuenta y rubros del libro se registran los aportes, y los
 * últimos intentos de la gente.
 */
export default async function MercadoPagoPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const [{ ready, settings }, accounts, subs, funds, recent] = await Promise.all([
    getMpSettings(localityId),
    supabase.from("treasury_accounts").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase
      .from("treasury_subcategories")
      .select("id, name, treasury_categories(name)")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("treasury_funds")
      .select("name, online_contributions")
      .eq("is_active", true)
      .order("sort_order"),
    getRecentContributions(localityId),
  ]);

  const accountRows = (accounts.data ?? []) as Array<{ id: string; name: string }>;
  const subRows = ((subs.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    treasury_categories: { name: string } | null;
  }>).map((s) => ({ id: s.id, label: s.treasury_categories ? `${s.treasury_categories.name} › ${s.name}` : s.name }));
  const fundRows = (funds.data ?? []) as Array<{ name: string; online_contributions?: boolean }>;
  const onlineFunds = fundRows.filter((f) => f.online_contributions).map((f) => f.name);

  // Propuestas para quien configura por primera vez.
  const guessAccount = accountRows.find((a) => /mercado\s*pago/i.test(a.name))?.id ?? "";
  const guessIncome = subRows.find((s) => /contribuci|aporte/i.test(s.label))?.id ?? "";
  const guessFee = subRows.find((s) => /comisi/i.test(s.label))?.id ?? "";

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${process.env.MP_PUBLIC_URL?.replace(/\/$/, "") || `${proto}://${host}`}/api/mercadopago/webhook?loc=${localityId}`;

  const usable = isMpUsable(settings);
  const testMode = settings?.access_token ? isTestToken(settings.access_token) : false;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.mercadopago}
        title="Mercado Pago"
        description="Los creyentes aportan desde la app con el monto que desean, y cada aporte acreditado entra solo al libro: el ingreso por el bruto con su recibo, y un gasto por la comisión."
      />

      {!ready && (
        <div className="mb-4">
          <Banner tone="warning">
            <strong>Falta aplicar la migración 079.</strong> Hasta entonces no se
            puede guardar nada y la comunidad no ve el botón.
          </Banner>
        </div>
      )}

      {ready && usable && (
        <div className="mb-4">
          <Banner tone={testMode ? "warning" : "info"}>
            {testMode ? (
              <>
                <strong>Modo prueba.</strong> Las credenciales son de prueba: los pagos no mueven plata
                real, pero SÍ entran al libro. Borralos (o anulalos) al terminar de probar.
              </>
            ) : (
              <>La comunidad ya ve «Aportar con Mercado Pago» en Tesorería.</>
            )}{" "}
            {onlineFunds.length > 0
              ? `Fondos habilitados: ${onlineFunds.join(", ")}.`
              : "Ningún fondo está habilitado: marcalos en el Catálogo."}
          </Banner>
        </div>
      )}

      <Card className="mb-5">
        <form action={saveMpSettingsAction} className="flex flex-col gap-4">
          <EnabledSwitch defaultOn={settings?.enabled ?? false} />

          <Field label="Access token" name="access_token" help={TREASURY_HELP.fields.mpToken}>
            <SecretField
              id="access_token"
              name="access_token"
              savedHint={settings?.access_token ? settings.access_token.slice(-4) : null}
              placeholder="APP_USR-… o TEST-…"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Cuenta del libro" name="account_id" help={TREASURY_HELP.fields.mpAccount}>
              <Select id="account_id" name="account_id" defaultValue={settings?.account_id ?? guessAccount}>
                <option value="">Elegí…</option>
                {accountRows.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Rubro del aporte" name="income_subcategory_id" help={TREASURY_HELP.fields.mpIncome}>
              <Select id="income_subcategory_id" name="income_subcategory_id" defaultValue={settings?.income_subcategory_id ?? guessIncome}>
                <option value="">Elegí…</option>
                {subRows.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Rubro de la comisión" name="fee_subcategory_id" help={TREASURY_HELP.fields.mpFee}>
              <Select id="fee_subcategory_id" name="fee_subcategory_id" defaultValue={settings?.fee_subcategory_id ?? guessFee}>
                <option value="">Elegí…</option>
                {subRows.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-[12px] text-muted">
            Si falta la cuenta «Mercado Pago» o un rubro para la comisión, crealos primero en el{" "}
            <Link href="/admin/tesoreria/catalogo" className="font-semibold text-terra underline">
              Catálogo
            </Link>
            , donde también se marca qué fondos se ofrecen.
          </p>

          {/* Los avisos ya funcionan sin configurar nada: cada cobro le dice
              a Mercado Pago adónde avisar (notification_url). Lo del panel
              es opcional y solo suma la verificación de firma; por eso va
              plegado y al final, para no parecer un paso obligatorio. */}
          <details className="group rounded-xl border border-black/10 bg-bg/30 px-4 py-3" open={Boolean(settings?.webhook_secret)}>
            <summary className="cursor-pointer list-none text-[13px] font-semibold text-dark">
              <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">›</span>
              Avisos de Mercado Pago (webhooks) · opcional
              {settings?.webhook_secret && <span className="ml-2 text-[11.5px] font-normal text-green">✓ firma verificada</span>}
            </summary>
            <div className="mt-3 flex flex-col gap-3 text-[12.5px] leading-snug text-muted">
              <p>
                <strong className="text-dark">Ya funcionan sin hacer nada.</strong> Cada cobro le indica a
                Mercado Pago adónde avisar cuando el pago se acredita, y la app lo registra aunque la persona
                no vuelva a la app: si cierra el navegador, si el iPhone la devuelve a Safari, o si paga en
                Abitab o RedPagos y el dinero se acredita horas después.
              </p>
              <p>
                Configurar Webhooks en el panel de Mercado Pago (Tus integraciones → la aplicación →
                Webhooks, evento «Pagos», con esta URL) agrega una sola cosa: una clave secreta con la que la
                app comprueba que cada aviso viene de Mercado Pago. Es una capa extra; sin ella la app igual
                consulta cada pago a Mercado Pago antes de registrarlo.
              </p>
              <div className="rounded-lg bg-card px-3 py-2 font-mono text-[11.5px] text-dark break-all">{webhookUrl}</div>
              <Field label="Clave secreta de Webhooks" name="webhook_secret" help={TREASURY_HELP.fields.mpWebhook}>
                <SecretField
                  id="webhook_secret"
                  name="webhook_secret"
                  savedHint={settings?.webhook_secret ? settings.webhook_secret.slice(-4) : null}
                />
              </Field>
            </div>
          </details>

          <div>
            <Button type="submit" disabled={!ready}>Guardar</Button>
          </div>
        </form>
      </Card>

      <h2 className="mb-2.5 text-[15px] font-semibold text-dark">Últimos aportes por la app</h2>
      {recent.length === 0 ? (
        <Card className="text-center text-[13px] text-muted">Todavía no hay ninguno.</Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-black/[0.05] bg-bg/40 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 pl-6">Fecha</th>
                  <th className="px-4 py-3">Creyente</th>
                  <th className="px-4 py-3">Fondo</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Comisión</th>
                  <th className="px-4 py-3 pr-6">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 pl-6 text-muted">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-3 text-dark">{r.person}</td>
                    <td className="px-4 py-3 text-muted">{r.fund ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-dark">{formatMoney(r.amount, r.currency)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted">
                      {r.fee_amount != null ? formatMoney(Number(r.fee_amount), r.currency) : "—"}
                    </td>
                    <td className="px-4 py-3 pr-6">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status] ?? ""}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      {r.entry_id && (
                        <Link href={`/admin/tesoreria/libro?ids=${r.entry_id}`} className="ml-2 text-[12px] font-semibold text-terra underline">
                          ver
                        </Link>
                      )}
                      {r.error && <div className="mt-1 text-[11.5px] text-rose-700">{r.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
