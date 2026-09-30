import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "./format";
import {
  monthKeyOf,
  monthLabel,
  monthRange,
  previousMonthKey,
} from "./treasury-cashbook";
import {
  closedMonthKeys,
  closingFor,
  getClosings,
  getFirstEntryMonth,
  nextMonthToClose,
} from "./treasury-closings";
import { todayISO } from "./treasury-ledger";
import { getCurrentPublication } from "./treasury-publications";
import { getAdminReports } from "./treasury-reports";
import { getCashBoxes, getCashReports, getLastCounts } from "./treasury-cash";
import {
  getImports,
  getMatches,
  getStoredLines,
  monthReconciliation,
} from "./treasury-statements";

/**
 * La Guía del mes: los pasos del ciclo de la Tesorería, en orden, con el
 * estado de cada uno para el mes que se está cerrando. Es la
 * documentación que hasta ahora vivía en la cabeza del tesorero, puesta
 * donde el próximo la va a necesitar: en la app, con el link a la
 * pantalla donde se hace cada cosa y tildado con lo que ya está hecho.
 *
 * El mes de referencia es el MES ANTERIOR al de hoy (el que ya terminó y
 * hay que dejar cerrado). Cada estado se deriva de las tablas que ya
 * existen; nada se guarda acá. Las fuentes fallan a "no se pudo saber",
 * nunca a "hecho": tildar algo que no se hizo es el error caro.
 */

export type StepStatus = "hecho" | "pendiente" | "manual" | "desconocido";

export type GuideStep = {
  key: string;
  /** "1", "2"… */
  order: number;
  title: string;
  /** Qué es y por qué se hace, en dos o tres frases. */
  why: string;
  /** Cómo se hace en la app, paso a paso. */
  how: string[];
  href: string;
  cta: string;
  status: StepStatus;
  /** Lo que la app sabe del estado ("Cerrado el 3/9 por Jorge"). */
  note: string | null;
};

export type TreasuryGuide = {
  /** El mes que se está cerrando, "2026-08". */
  month: string;
  monthLabel: string;
  steps: GuideStep[];
};

/** La fecha de la reunión del acta es texto libre del editor del informe
 *  ("15/09/2026", "reunión del 15"): se formatea solo si es una fecha ISO,
 *  si no se muestra tal cual. Un texto libre en formatDate() tira RangeError
 *  y tumba la pantalla entera. */
function looseDate(raw: string): string {
  return /^d{4}-d{2}-d{2}/.test(raw) ? formatDate(raw.slice(0, 10)) : raw;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function safe<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    console.warn(`[treasury-guide] ${label}:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

export async function getTreasuryGuide(
  supabase: SupabaseClient,
  opts: { localityId: string; localityKind: string; today?: string }
): Promise<TreasuryGuide> {
  const today = opts.today ?? todayISO();
  const month = previousMonthKey(monthKeyOf(today));
  const range = monthRange(month);
  const label = monthLabel(month);

  const [closings, firstMonth, entriesRes, imports, lastAudit, publication, reports] =
    await Promise.all([
      safe("closings", getClosings(supabase), []),
      safe("firstMonth", getFirstEntryMonth(supabase), null),
      supabase
        .from("treasury_entries")
        .select("id, account_id, entry_date, voided_at, is_opening_balance, receipt_number, receipt_issued, amount")
        .gte("entry_date", range.from)
        .lte("entry_date", range.to),
      safe("imports", getImports(supabase), { rows: [], missing: true }),
      supabase
        .from("treasury_audits")
        .select("id, run_at, high_count")
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      safe("publication", getCurrentPublication(supabase, opts.localityId), null),
      safe("reports", getAdminReports(supabase, opts.localityId), []),
    ]);

  type E = {
    id: string;
    account_id: string;
    entry_date: string;
    voided_at: string | null;
    is_opening_balance: boolean;
    receipt_number: number | null;
    receipt_issued: boolean;
    amount: number;
  };
  const entries = (entriesRes.data ?? []) as E[];
  const live = entries.filter((e) => !e.voided_at);
  const closing = closingFor(closings, month);
  const isClosed = closedMonthKeys(closings).includes(month);
  const nextToClose = nextMonthToClose(closings, firstMonth, today);

  const steps: GuideStep[] = [];

  // 1 · Cargar
  steps.push({
    key: "cargar",
    order: 1,
    title: `Cargar todos los movimientos de ${label.toLowerCase()}`,
    why: "El libro es la fuente de verdad: el saldo, el recibo, el informe y el balance salen de acá. Un aporte que no se cargó no existe para nadie.",
    how: [
      "Cada aporte con su contribuyente elegido del buscador (si es un creyente de la app, le aparece en Mis aportes y le llega el aviso).",
      "Cada gasto con su comprobante adjunto: la foto de la factura alcanza.",
      "Las transferencias entre cuentas (cambio de caja, compra de dólares) como transferencia, no como ingreso y gasto.",
    ],
    href: "/admin/tesoreria/libro",
    cta: "Ir al Libro",
    status: "manual",
    note:
      live.length === 0
        ? `Todavía no hay movimientos cargados en ${label.toLowerCase()}.`
        : `${plural(live.length, "movimiento cargado", "movimientos cargados")} en ${label.toLowerCase()}.`,
  });

  // 2 · Recibos emitidos
  const unissued = live.filter((e) => e.amount > 0 && e.receipt_number && !e.receipt_issued).length;
  steps.push({
    key: "recibos",
    order: 2,
    title: "Emitir el recibo de cada aporte",
    why: "La DGI pide numeración correlativa y un recibo por donación. En la app el número lo pone el sistema; lo que falta es abrir el recibo, compartirlo con quien aportó y marcarlo emitido.",
    how: [
      "Desde el Libro, en la fila del aporte: Recibo.",
      "Compartir por WhatsApp (imagen) o imprimir, y marcar «Emitido».",
      "Un aporte mal cargado con recibo emitido no se edita: se anula y se carga de nuevo.",
    ],
    href: "/admin/tesoreria/libro",
    cta: "Ir al Libro",
    status: unissued === 0 ? (live.some((e) => e.amount > 0) ? "hecho" : "manual") : "pendiente",
    note:
      unissued > 0
        ? `${plural(unissued, "recibo sin emitir", "recibos sin emitir")} en ${label.toLowerCase()}.`
        : null,
  });

  // 3 · Conciliar
  let reconStatus: StepStatus = "desconocido";
  let reconNote: string | null = null;
  if (imports.missing) {
    reconNote = "Falta aplicar la migración 061.";
  } else if (imports.rows.length === 0) {
    reconStatus = "pendiente";
    reconNote = "Nunca se importó un extracto.";
  } else {
    const accountsWithImports = new Set(imports.rows.map((i) => i.account_id));
    const [lines, matches, accountsRes] = await Promise.all([
      getStoredLines(supabase),
      getMatches(supabase),
      supabase.from("treasury_accounts").select("id, name"),
    ]);
    const names = new Map(
      ((accountsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name])
    );
    const statuses = monthReconciliation(month, lines, matches, live, names, accountsWithImports);
    const open = statuses.filter((s) => s.status !== "conciliado");
    reconStatus = open.length === 0 ? "hecho" : "pendiente";
    reconNote =
      open.length === 0
        ? `${plural(statuses.length, "cuenta conciliada", "cuentas conciliadas")}.`
        : open
            .map((s) =>
              s.status === "sin-extracto"
                ? `${s.accountName}: sin extracto`
                : `${s.accountName}: ${s.pendingLines + s.pendingEntries} pendientes`
            )
            .join(" · ");
  }
  steps.push({
    key: "conciliar",
    order: 3,
    title: "Importar los extractos y conciliar",
    why: "El extracto de Prex y del BROU es la única verificación externa del libro. Lo que está en la plataforma y no en el libro es un movimiento que falta; lo que está en el libro y no en la plataforma, uno que sobra o está mal.",
    how: [
      "Exportar el estado de cuenta de cada plataforma (Prex: Excel; BROU: «Saldos y movimientos», últimos 20, cada dos semanas).",
      "Importarlo en Conciliación, cuenta por cuenta. El motor aparea solo lo que coincide.",
      "Resolver lo que quede: vincular a un movimiento, cargarlo, o marcar «no corresponde» con motivo.",
    ],
    href: "/admin/tesoreria/conciliacion",
    cta: "Ir a Conciliación",
    status: reconStatus,
    note: reconNote,
  });

  // 4 · Auditoría
  const audit = (lastAudit.data as { id: string; run_at: string; high_count: number } | null) ?? null;
  const auditThisCycle = audit ? audit.run_at.slice(0, 10) >= range.from : false;
  steps.push({
    key: "auditar",
    order: 4,
    title: "Correr la auditoría",
    why: "Son reglas sobre el libro (huecos de recibos, meses sin cerrar, transferencias sin su otra pata, gastos sin comprobante). Encuentra antes lo que el auditor encontraría después.",
    how: [
      "En Auditoría, «Correr». Es instantáneo y no cambia nada.",
      "Cada hallazgo dice qué está mal, contra qué norma y cómo se arregla. Los graves se corrigen; los que no aplican se despachan con un motivo, que queda guardado.",
    ],
    href: "/admin/tesoreria/auditoria",
    cta: "Ir a Auditoría",
    status: lastAudit.error
      ? "desconocido"
      : !audit
        ? "pendiente"
        : auditThisCycle
          ? audit.high_count > 0
            ? "pendiente"
            : "hecho"
          : "pendiente",
    note: lastAudit.error
      ? "Falta aplicar la migración 059."
      : !audit
        ? "Nunca se corrió."
        : `Última corrida el ${formatDate(audit.run_at)}${
            audit.high_count > 0 ? ` con ${plural(audit.high_count, "hallazgo grave", "hallazgos graves")}` : ""
          }.`,
  });

  // 5 · Cerrar
  steps.push({
    key: "cerrar",
    order: 5,
    title: `Cerrar ${label.toLowerCase()}`,
    why: "El cierre congela el mes: nada entra, cambia ni sale. Es lo que pide el MEC (sin correcciones ni tachaduras) y lo que hace que el Libro de Caja impreso sea definitivo. Se corrige después con un contra-asiento, nunca tocando el original.",
    how: [
      "En Cierres, el único mes que se puede cerrar es el siguiente al último cerrado: se cierra en orden.",
      "Antes: los pasos 1 a 4. La pantalla avisa si la conciliación quedó pendiente, pero no bloquea.",
      "Si hace falta, reabrir vale solo para el último cerrado y con motivo.",
    ],
    href: "/admin/tesoreria/libro/cierres",
    cta: "Ir a Cierres",
    status: isClosed ? "hecho" : "pendiente",
    note: closing
      ? `Cerrado el ${formatDate(closing.closed_at)}.`
      : nextToClose && nextToClose < month
        ? `Antes hay que cerrar ${monthLabel(nextToClose).toLowerCase()}.`
        : null,
  });

  // 6 · Libro de Caja
  steps.push({
    key: "libro-caja",
    order: 6,
    title: "Imprimir el Libro de Caja y archivarlo",
    why: "El formato del MEC: una hoja resumen del mes y una por cuenta y moneda (Día · Concepto · Ingresos · Egresos · Saldo). Impreso sobre un mes cerrado sale en limpio; sobre uno abierto, con marca de BORRADOR.",
    how: [
      "Desde Cierres, «Libro de Caja» del mes. Imprimir o guardar el PDF.",
      "Pegarlo en el libro de tapas duras, firmado por Tesorero/a y Secretario/a.",
    ],
    href: isClosed ? `/admin/libro-caja/${month}` : "/admin/tesoreria/libro/cierres",
    cta: isClosed ? "Abrir el Libro de Caja" : "Ir a Cierres",
    status: isClosed ? "manual" : "pendiente",
    note: isClosed ? "El mes está cerrado: se puede imprimir en limpio." : "Recién después de cerrar.",
  });

  // 7 · Publicar
  const pubDay = publication?.published_at?.slice(0, 10) ?? null;
  const pubAfterMonth = pubDay ? pubDay > range.to : false;
  steps.push({
    key: "publicar",
    order: 7,
    title: "Calcular y compartir el estado del Fondo",
    why: "Es lo ÚNICO que la comunidad ve de la Tesorería, en la app y en la Fiesta. No se recalcula solo: el tesorero calcula, revisa y comparte una cifra con fecha.",
    how: [
      "En Publicar, «Calcular» hasta el fin del último mes bahá'í (el atajo para la Fiesta).",
      "Revisar la vista previa: es exactamente lo que va a ver la comunidad.",
      "«Compartir», con aviso push si corresponde. La Fiesta se queda con la foto vigente al iniciarla.",
    ],
    href: "/admin/tesoreria/publicar",
    cta: "Ir a Publicar",
    status: pubAfterMonth ? "hecho" : "pendiente",
    note: pubDay ? `Última compartida el ${formatDate(pubDay)}.` : "Nunca se compartió.",
  });

  // 8 · Informe interno
  const internal = reports.find(
    (r) => r.audience === "internos" && r.status === "published" && r.period_to >= range.from && r.period_from <= range.to
  );
  steps.push({
    key: "informe",
    order: 8,
    title: "Emitir el informe interno para la Asamblea",
    why: "La hoja que se adjunta al acta y la Asamblea aprueba en reunión: totales por rubro, conciliación, movimientos internos, bloque de aprobación. No lleva nombres.",
    how: [
      "En Informes, nuevo informe para «la Asamblea» con el mes como período.",
      "Completar observaciones y emitir. La Asamblea lo ve en Registro de informes.",
      "Después de la reunión, anotar fecha y N.º de acta: con eso queda «Aprobado».",
    ],
    href: "/admin/tesoreria/informes",
    cta: "Ir a Informes",
    status: internal ? "hecho" : "pendiente",
    note: internal
      ? internal.editorial.approval?.meetingDate
        ? `Emitido y aprobado en la reunión del ${looseDate(internal.editorial.approval.meetingDate)}.`
        : "Emitido; falta anotar la reunión que lo aprobó."
      : null,
  });

  // 9 · Compromisos
  steps.push({
    key: "compromisos",
    order: 9,
    title: "Pasado el 10: agradecer y recordar",
    why: "Quien declaró un compromiso mensual recibe el aviso del 10 solo. El informe del mes dice a quién agradecer y a quién recordar; los que aportaron sin compromiso también merecen el gracias.",
    how: [
      "En Compromisos, elegir el mes. Los grupos son para llamar: agradecer, recordar, y «no se puede saber» (contribuyentes sin vincular a la app).",
      "Escribirle desde Tesorería con el botón de la ficha: el mensaje llega por el chat de la app.",
    ],
    href: "/admin/tesoreria/compromisos",
    cta: "Ir a Compromisos",
    status: "manual",
    note: null,
  });

  // Cajas chicas (074): rendiciones aprobadas y arqueo hecho, antes de cerrar.
  const cash = await safe("cajas", getCashBoxes(supabase), { boxes: [], missing: true });
  if (!cash.missing) {
    const [pending, lastCounts] = await Promise.all([
      safe("rendiciones", getCashReports(supabase, { statuses: ["enviada"] }), []),
      safe("arqueos", getLastCounts(supabase), new Map()),
    ]);
    const boxes = cash.boxes;
    const uncounted = boxes.filter((b) => {
      const c = lastCounts.get(b.id);
      return !c || c.counted_on < range.from;
    });
    const status: StepStatus =
      boxes.length === 0 ? "manual" : pending.length > 0 || uncounted.length > 0 ? "pendiente" : "hecho";
    steps.splice(4, 0, {
      key: "cajas",
      order: 0,
      title: "Aprobar las rendiciones y hacer el arqueo de las cajas chicas",
      why: "Cada caja tiene un fondo fijo y un responsable. Sus gastos entran al libro cuando aprobás la rendición; el arqueo (contar la plata y compararla con el libro) es lo que prueba que el efectivo está. Los aportes en efectivo se depositan íntegros: la caja solo gasta lo que se le repone.",
      how: [
        "En Cajas chicas, revisar cada rendición enviada: comprobantes, montos y el arqueo que declaró el responsable. Aprobar carga los gastos y la reposición; devolver pide la corrección.",
        "Hacer el arqueo de cada caja (también la tuya) y registrarlo. Si no cuadra, el ajuste va al libro con su motivo.",
      ],
      href: "/admin/tesoreria/cajas",
      cta: "Ir a Cajas chicas",
      status,
      note:
        boxes.length === 0
          ? "No hay cajas chicas cargadas. Si manejás efectivo, conviene registrar al menos la del tesorero con su fondo fijo."
          : [
              pending.length > 0 ? plural(pending.length, "rendición por revisar", "rendiciones por revisar") : null,
              uncounted.length > 0 ? plural(uncounted.length, "caja sin arqueo este mes", "cajas sin arqueo este mes") : null,
            ]
              .filter(Boolean)
              .join(" · ") || `${plural(boxes.length, "caja al día", "cajas al día")}.`,
    });
  }
  steps.forEach((st, i) => {
    st.order = i + 1;
  });

  return { month, monthLabel: label, steps };
}

/** Los pasos del cambio de tesorero: no dependen de ningún mes. */
export const HANDOVER_STEPS: Array<{ title: string; detail: string; href: string; cta: string }> = [
  {
    title: "Darle el permiso de Tesorería a quien entra",
    detail:
      "Creyentes → Creyentes, en su ficha, la casilla «Tesorería». Es lo que abre el libro, los nombres de contribuyentes y todo este grupo del menú. Es por comunidad: en la Comunidad Nacional se marca aparte.",
    href: "/admin/miembros",
    cta: "Ir a Creyentes",
  },
  {
    title: "Registrar el cambio en la composición de la Asamblea, con fecha",
    detail:
      "Datos de la Asamblea → en la fila del Tesorero/a, «Reemplazar» y la fecha del cambio. Quien se va queda con su «hasta»: los recibos que firmó siguen con su nombre; los de después salen con el del nuevo.",
    href: "/admin/asamblea",
    cta: "Datos de la Asamblea",
  },
  {
    title: "Cambiar la firma del recibo",
    detail:
      "Recibo y medios de pago: subir la firma escaneada del nuevo tesorero (PNG con fondo transparente, ideal). El nombre sale solo de la composición; no hay que escribirlo.",
    href: "/admin/tesoreria/recibo/ajustes",
    cta: "Recibo y medios de pago",
  },
  {
    title: "Quitarle el permiso a quien sale",
    detail:
      "Mientras conserve la casilla «Tesorería», sigue viendo el libro entero y los nombres. Se quita en la misma ficha, cuando el traspaso esté hecho.",
    href: "/admin/miembros",
    cta: "Ir a Creyentes",
  },
  {
    title: "Dejar los meses cerrados y el legajo preparado",
    detail:
      "Cerrar hasta el último mes completo, correr la auditoría, y preparar el legajo del ejercicio en curso: quien entra recibe el libro cuadrado y una carpeta con todo, y el auditor también.",
    href: "/admin/tesoreria/legajo",
    cta: "Preparar el legajo",
  },
];
