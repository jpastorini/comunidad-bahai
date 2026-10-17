import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPreference,
  getPayment,
  searchPaymentsByReference,
  type MpPayment,
} from "@/lib/mercadopago";
import { getChatAdminIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveContributorForProfile } from "@/lib/treasury-contributor-resolve";
import { formatMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";
import { treasuryYearForDate } from "@/lib/treasury-year";

/**
 * Aportes por Mercado Pago (079).
 *
 * El recorrido: la persona elige monto y fondo en /tesoreria/aportar →
 * `startOnlineContribution()` guarda el intento y crea el cobro en
 * Mercado Pago con el id del intento como `external_reference` → la
 * persona paga allá → Mercado Pago avisa (webhook) y la persona vuelve a
 * /tesoreria/aportar/gracias. Los DOS caminos terminan en
 * `applyPayment()`, que consulta el pago a la API y, si está aprobado,
 * lo registra en el libro. El que llega segundo encuentra el trabajo
 * hecho: el número de pago es único y el intento se "toma" antes de
 * escribir.
 *
 * Todo corre con service-role: el webhook no tiene sesión, y el monto y
 * el estado no pueden venir del navegador. Por eso cada consulta dice la
 * comunidad a mano.
 */

export type MpSettings = {
  locality_id: string;
  enabled: boolean;
  access_token: string | null;
  webhook_secret: string | null;
  account_id: string | null;
  income_subcategory_id: string | null;
  fee_subcategory_id: string | null;
  updated_at: string | null;
};

export type OnlineContribution = {
  id: string;
  locality_id: string;
  profile_id: string;
  fund_id: string | null;
  amount: number;
  currency: "UYU" | "USD";
  receipt_name: string | null;
  status: "creado" | "pendiente" | "aprobado" | "rechazado" | "devuelto";
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status_detail: string | null;
  fee_amount: number | null;
  entry_id: string | null;
  fee_entry_id: string | null;
  claimed_at: string | null;
  error: string | null;
  created_at: string;
};

/** Monto mínimo y máximo por aporte, en pesos. El máximo es una red
 *  contra un cero de más, no un límite de la generosidad: quien quiere
 *  dar más lo hace en dos veces o por transferencia. */
export const MIN_AMOUNT = 50;
export const MAX_AMOUNT = 500_000;

function admin(): SupabaseClient {
  const a = createSupabaseAdmin();
  if (!a) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return a;
}

export function isMpSchemaMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204";
}

/** Los ajustes de la comunidad. `ready: false` si la 079 no corrió. */
export async function getMpSettings(
  localityId: string
): Promise<{ ready: boolean; settings: MpSettings | null }> {
  const { data, error } = await admin()
    .from("treasury_mp_settings")
    .select("*")
    .eq("locality_id", localityId)
    .maybeSingle();
  if (error) {
    if (isMpSchemaMissing(error.code)) return { ready: false, settings: null };
    throw new Error(error.message);
  }
  return { ready: true, settings: (data as MpSettings | null) ?? null };
}

/** ¿Está todo lo necesario para cobrar y registrar? */
export function isMpUsable(s: MpSettings | null): s is MpSettings & { access_token: string } {
  return Boolean(
    s &&
      s.enabled &&
      s.access_token &&
      s.account_id &&
      s.income_subcategory_id &&
      s.fee_subcategory_id
  );
}

export type OfferFund = { id: string; name: string };

/**
 * Lo que la pantalla del creyente necesita: si se puede aportar y a qué
 * fondos. Los fondos son los activos con la casilla del Catálogo; si
 * ninguno la tiene, no se ofrece nada (no hay a dónde mandar el aporte).
 */
export async function getOnlineOffer(
  localityId: string
): Promise<{ available: boolean; funds: OfferFund[] }> {
  try {
    const { settings } = await getMpSettings(localityId);
    if (!isMpUsable(settings)) return { available: false, funds: [] };
    const { data, error } = await admin()
      .from("treasury_funds")
      .select("id, name, sort_order")
      .eq("locality_id", localityId)
      .eq("is_active", true)
      .eq("online_contributions", true)
      .order("sort_order")
      .order("name");
    if (error) return { available: false, funds: [] };
    const funds = ((data ?? []) as Array<{ id: string; name: string }>).map((f) => ({
      id: f.id,
      name: f.name,
    }));
    // El Local primero: es el que la mayoría quiere y el que se nombra
    // cuando se habla "del Fondo".
    funds.sort((a, b) => Number(/local/i.test(b.name)) - Number(/local/i.test(a.name)));
    return { available: funds.length > 0, funds };
  } catch (err) {
    console.error("[getOnlineOffer]", err);
    return { available: false, funds: [] };
  }
}

/** Crea el intento y el cobro; devuelve el link de Mercado Pago. */
export async function startOnlineContribution(args: {
  localityId: string;
  localityName: string;
  profileId: string;
  payerEmail: string | null;
  payerName: string | null;
  fundId: string;
  amount: number;
  receiptName: string | null;
  origin: string;
}): Promise<string> {
  const db = admin();
  const { settings } = await getMpSettings(args.localityId);
  if (!isMpUsable(settings)) {
    throw new Error("La Tesorería todavía no habilitó los aportes por Mercado Pago.");
  }
  const offer = await getOnlineOffer(args.localityId);
  const fund = offer.funds.find((f) => f.id === args.fundId);
  if (!fund) throw new Error("Ese fondo no recibe aportes desde la app.");

  const { data: created, error } = await db
    .from("treasury_online_contributions")
    .insert({
      locality_id: args.localityId,
      profile_id: args.profileId,
      fund_id: fund.id,
      amount: args.amount,
      currency: "UYU",
      receipt_name: args.receiptName,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo iniciar el aporte: ${error.message}`);
  const id = (created as { id: string }).id;

  const base = (process.env.MP_PUBLIC_URL || args.origin).replace(/\/$/, "");
  const pref = await createPreference(settings.access_token, {
    // Lo que la persona ve en Mercado Pago y en su resumen.
    title: `Aporte al ${fund.name} · ${args.localityName}`.slice(0, 250),
    amount: args.amount,
    currency: "UYU",
    externalReference: id,
    payerEmail: args.payerEmail,
    payerName: args.payerName,
    notificationUrl: `${base}/api/mercadopago/webhook?loc=${args.localityId}`,
    backUrl: `${base}/tesoreria/aportar/gracias?id=${id}`,
  });

  await db
    .from("treasury_online_contributions")
    .update({ mp_preference_id: pref.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  return pref.checkoutUrl;
}

async function loadContribution(id: string): Promise<OnlineContribution | null> {
  const { data } = await admin()
    .from("treasury_online_contributions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as OnlineContribution | null) ?? null;
}

/** El aviso de Mercado Pago: un número de pago de la cuenta de `localityId`. */
export async function handlePaymentNotice(localityId: string, paymentId: string): Promise<void> {
  const { settings } = await getMpSettings(localityId);
  if (!settings?.access_token) return;
  const payment = await getPayment(settings.access_token, paymentId);
  if (!payment.externalReference) return; // un cobro del POS, no de la app
  const row = await loadContribution(payment.externalReference);
  if (!row || row.locality_id !== localityId) return;
  await applyPayment(settings, row, payment);
}

/**
 * La vuelta de la persona: si el aviso todavía no llegó (o se perdió),
 * se busca el pago por la referencia y se registra igual. Devuelve el
 * intento actualizado.
 */
export async function syncContribution(id: string): Promise<OnlineContribution | null> {
  const row = await loadContribution(id);
  if (!row) return null;
  if (row.status === "aprobado" || row.status === "devuelto") return row;
  const { settings } = await getMpSettings(row.locality_id);
  if (!settings?.access_token) return row;
  try {
    const payments = await searchPaymentsByReference(settings.access_token, row.id);
    // Si hubo un rechazo y después un pago aprobado, manda el aprobado.
    const pick = payments.find((p) => p.status === "approved") ?? payments[0];
    if (pick) await applyPayment(settings, row, pick);
  } catch (err) {
    console.error("[syncContribution]", err);
  }
  return loadContribution(id);
}

const PENDING = new Set(["pending", "in_process", "authorized", "in_mediation"]);
const FAILED = new Set(["rejected", "cancelled"]);
const REVERSED = new Set(["refunded", "charged_back"]);

async function applyPayment(
  settings: MpSettings,
  row: OnlineContribution,
  payment: MpPayment
): Promise<void> {
  const db = admin();
  const touch = (patch: Record<string, unknown>) =>
    db
      .from("treasury_online_contributions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", row.id);

  if (payment.status === "approved") {
    if (row.entry_id) return; // ya está en el libro
    await registerApproved(settings, row, payment);
    return;
  }

  if (REVERSED.has(payment.status)) {
    // Mercado Pago devolvió la plata. El libro NO se corrige solo: según
    // el mes, el aporte se anula o se revierte con contra-asiento (054),
    // y esa decisión es del tesorero. Se le avisa una vez.
    if (row.status === "devuelto") return;
    await touch({ status: "devuelto", mp_status_detail: payment.statusDetail });
    if (row.entry_id) {
      const ids = await getChatAdminIds(row.locality_id, undefined, "tesoreria");
      await sendPushToUsers(ids, {
        title: "Mercado Pago devolvió un aporte",
        body: `${formatMoney(payment.amount, payment.currency)} · pago N.º ${payment.id}. Anulá o revertí el aporte en el libro.`,
        url: `/admin/tesoreria/libro?ids=${row.entry_id}`,
        tag: `mp-devuelto-${row.id}`,
      });
    }
    return;
  }

  if (row.entry_id) return; // un aviso viejo de un pago que ya se aprobó
  if (PENDING.has(payment.status)) {
    await touch({ status: "pendiente", mp_payment_id: payment.id, mp_status_detail: payment.statusDetail });
  } else if (FAILED.has(payment.status)) {
    // El rechazo no ocupa el número de pago: la persona puede reintentar
    // con la misma preferencia y el pago bueno trae otro número.
    await touch({ status: "rechazado", mp_status_detail: payment.statusDetail });
  }
}

async function registerApproved(
  settings: MpSettings,
  row: OnlineContribution,
  payment: MpPayment
): Promise<void> {
  const db = admin();

  // Lo que se cobró tiene que ser lo que se pidió. Si no, no se registra
  // a ciegas: el tesorero mira.
  if (payment.currency !== row.currency || Math.abs(payment.amount - Number(row.amount)) > 0.01) {
    const msg = `El pago N.º ${payment.id} fue por ${formatMoney(payment.amount, payment.currency)} y el aporte era de ${formatMoney(Number(row.amount), row.currency)}.`;
    await db.from("treasury_online_contributions").update({ error: msg }).eq("id", row.id);
    const ids = await getChatAdminIds(row.locality_id, undefined, "tesoreria");
    await sendPushToUsers(ids, {
      title: "Un aporte por Mercado Pago no coincide",
      body: `${msg} Registralo a mano.`,
      url: "/admin/tesoreria/mercadopago",
      tag: `mp-difiere-${row.id}`,
    });
    return;
  }

  // Tomar el intento. El aviso y la vuelta de la persona pueden llegar a
  // la vez; el que no lo toma se va. Una toma de hace más de cinco
  // minutos se da por caída y se puede volver a tomar.
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: claimed, error: claimError } = await db
    .from("treasury_online_contributions")
    .update({ claimed_at: new Date().toISOString(), mp_payment_id: payment.id })
    .eq("id", row.id)
    .is("entry_id", null)
    .or(`claimed_at.is.null,claimed_at.lt.${stale}`)
    .select("id");
  if (claimError) {
    // 23505: ese número de pago ya está registrado en otro intento.
    console.error("[registerApproved] claim", claimError);
    return;
  }
  if (!claimed || claimed.length === 0) return;

  try {
    const { data: sub } = await db
      .from("treasury_subcategories")
      .select("category_id, default_fund_id")
      .eq("id", settings.income_subcategory_id!)
      .maybeSingle();
    const { data: feeSub } = await db
      .from("treasury_subcategories")
      .select("category_id")
      .eq("id", settings.fee_subcategory_id!)
      .maybeSingle();
    if (!sub || !feeSub) throw new Error("Los rubros de Mercado Pago del libro ya no existen.");
    const income = sub as { category_id: string; default_fund_id: string | null };
    const fundId = row.fund_id ?? income.default_fund_id;

    // La fecha es la del cobro, en el huso de la comunidad. Si ese mes ya
    // se cerró (un aviso que llegó muy tarde), entra con la de hoy y la
    // original en el detalle, como los gastos de las cajas chicas.
    const paidOn = todayISO(payment.dateApproved ? new Date(payment.dateApproved) : new Date());
    let entryDate = paidOn;
    let dateNote = "";
    // Directo a la tabla y no por `treasury_month_is_closed()`: esa RPC
    // solo se le concedió a `authenticated` (054) y acá no hay sesión.
    const { data: closedRows } = await db
      .from("treasury_closings")
      .select("id")
      .eq("locality_id", row.locality_id)
      .eq("status", "closed")
      .eq("period_month", `${paidOn.slice(0, 7)}-01`)
      .limit(1);
    if ((closedRows ?? []).length > 0) {
      entryDate = todayISO();
      dateNote = ` (cobrado el ${paidOn})`;
    }

    const contributorId = await resolveContributorForProfile(db, row.profile_id, row.locality_id);

    const base = {
      locality_id: row.locality_id,
      entry_date: entryDate,
      bahai_year: treasuryYearForDate(entryDate),
      account_id: settings.account_id,
      fund_id: fundId,
      currency: row.currency,
      created_by: null,
    };

    // El aporte, por el bruto, con el próximo recibo. Reintenta si otro
    // tesorero tomó el número en el mismo instante.
    let entryId: string | null = null;
    let receiptNumber: number | null = null;
    for (let attempt = 0; attempt < 3 && !entryId; attempt++) {
      const { data: next, error: nErr } = await db.rpc("next_receipt_number", { loc: row.locality_id });
      if (nErr) throw new Error(nErr.message);
      receiptNumber = Number(next) || 1;
      const { data: saved, error } = await db
        .from("treasury_entries")
        .insert({
          ...base,
          subcategory_id: settings.income_subcategory_id,
          category_id: income.category_id,
          amount: payment.amount,
          description: `Aporte por Mercado Pago · pago N.º ${payment.id}${dateNote}`,
          receipt_number: receiptNumber,
          contributions_count: 1,
          contributor_id: contributorId,
          receipt_name: row.receipt_name,
          receipt_issued: false,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505" && error.message.includes("receipt")) continue;
        throw new Error(error.message);
      }
      entryId = (saved as { id: string }).id;
    }
    if (!entryId) throw new Error("No se pudo asignar un número de recibo.");

    // La comisión y la retención, como gasto del mismo fondo. Si falla,
    // el aporte queda (perderlo sería peor) y se avisa.
    let feeEntryId: string | null = null;
    let feeError: string | null = null;
    if (payment.fee > 0) {
      const { data: feeSaved, error } = await db
        .from("treasury_entries")
        .insert({
          ...base,
          subcategory_id: settings.fee_subcategory_id,
          category_id: (feeSub as { category_id: string }).category_id,
          amount: -payment.fee,
          description: `Comisión y retención de Mercado Pago · pago N.º ${payment.id} (recibo N.º ${receiptNumber})${
            payment.feeDetail ? ` · ${payment.feeDetail}` : ""
          }`.slice(0, 500),
        })
        .select("id")
        .single();
      if (error) feeError = `Falta registrar la comisión (${formatMoney(payment.fee, row.currency)}): ${error.message}`;
      else feeEntryId = (feeSaved as { id: string }).id;
    }

    await db
      .from("treasury_online_contributions")
      .update({
        status: "aprobado",
        mp_status_detail: payment.statusDetail,
        fee_amount: payment.fee,
        entry_id: entryId,
        fee_entry_id: feeEntryId,
        claimed_at: null,
        error: feeError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    // Avisos: a la persona, su recibo; al tesorero, que entró un aporte.
    // Un aviso que no sale no toca lo registrado.
    try {
      const { data: loc } = await db
        .from("localities")
        .select("name")
        .eq("id", row.locality_id)
        .maybeSingle();
      const localityName = (loc as { name: string } | null)?.name ?? "";
      await sendPushToUsers([row.profile_id], {
        title: "Se registró tu aporte",
        body: `${formatMoney(payment.amount, row.currency)} al Fondo · ${localityName} · Recibo N.º ${receiptNumber}. Gracias.`,
        url: `/perfil/aportes/recibo/${entryId}`,
        tag: `aporte-${entryId}`,
      });
      const ids = (await getChatAdminIds(row.locality_id, undefined, "tesoreria")).filter(
        (u) => u !== row.profile_id
      );
      await sendPushToUsers(ids, {
        title: feeError ? "Aporte por Mercado Pago: falta la comisión" : "Entró un aporte por Mercado Pago",
        body: `${formatMoney(payment.amount, row.currency)} · Recibo N.º ${receiptNumber}${
          feeError ? ". Cargá la comisión a mano." : ", ya registrado en el libro."
        }`,
        url: `/admin/tesoreria/libro?ids=${entryId}`,
        tag: `mp-aporte-${row.id}`,
      });
    } catch (err) {
      console.error("[registerApproved] push", err);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[registerApproved]", err);
    // Se suelta la toma para que el próximo aviso reintente.
    await db
      .from("treasury_online_contributions")
      .update({ claimed_at: null, error: msg, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    throw err;
  }
}

/** Los últimos intentos de la comunidad, para la pantalla del tesorero. */
export async function getRecentContributions(
  localityId: string,
  limit = 30
): Promise<Array<OnlineContribution & { person: string; fund: string | null }>> {
  const db = admin();
  const { data, error } = await db
    .from("treasury_online_contributions")
    .select("*, profiles(full_name, email), treasury_funds(name)")
    .eq("locality_id", localityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  type Raw = OnlineContribution & {
    profiles: { full_name: string | null; email: string | null } | null;
    treasury_funds: { name: string } | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    ...r,
    amount: Number(r.amount),
    person: r.profiles?.full_name || r.profiles?.email || "—",
    fund: r.treasury_funds?.name ?? null,
  }));
}
