import { celebrationDateFor, getBahaiMonth } from "./bahai-calendar";
import type {
  Feast,
  FeastLocation,
  FeastNewsItem,
  FeastNewsScope,
  FeastPrayer,
  FeastStatus,
} from "./types";

/**
 * El programa de la Fiesta de los Diecinueve Días como DATO, listo para
 * dos salidas: el deck de diapositivas que se proyecta
 * (components/feast/FeastDeck.tsx) y el folleto PDF que el creyente se
 * baja (components/feast/FeastBooklet.tsx). Las dos leen esta misma
 * estructura, así que no pueden divergir.
 *
 * No consulta nada: recibe lo que la página ya trajo (la Fiesta, sus
 * oraciones, sus noticias, sus lugares, el informe de Tesorería del mes)
 * y decide qué secciones tienen contenido.
 */

export type FeastProgramLocation = {
  name: string;
  address: string | null;
  when: string;
};

export type FeastProgramPrayer = {
  /** "Primera oración", "Segunda oración"… o "Oración 9". */
  label: string;
  title: string | null;
  reference: string | null;
  body: string;
  /** Tamaño de letra sugerido para la diapositiva, según el largo. */
  size: "lg" | "md" | "sm";
};

export type FeastProgramNewsSection = {
  scope: FeastNewsScope;
  kicker: string;
  title: string;
  sub: string;
  items: FeastNewsItem[];
};

export type FeastProgramTreasury =
  | {
      kind: "report";
      title: string;
      subtitle: string | null;
      /** Link público del informe (/i/<token>). */
      href: string;
    }
  | {
      kind: "figures";
      income: number | null;
      expenses: number | null;
      final: number | null;
      pdfUrl: string | null;
    };

export type FeastProgram = {
  feastId: string;
  status: FeastStatus;
  localityName: string;
  monthName: string;
  monthIndex: number;
  /** "Nombres", "Luz"… null si el índice no existe. */
  monthMeaning: string | null;
  /** "Noveno mes". */
  monthOrdinal: string;
  bahaiYear: number;
  /** ISO de la víspera (la noche en que se celebra). */
  celebrationDate: string | null;
  /** "24 de agosto de 2026". */
  celebrationLabel: string | null;
  locations: FeastProgramLocation[];
  prayers: FeastProgramPrayer[];
  deepening: { theme: string; content: string | null } | null;
  /** Solo los ámbitos con al menos una noticia. */
  news: FeastProgramNewsSection[];
  communique: string | null;
  treasury: FeastProgramTreasury | null;
};

export type TreasuryReportRef = {
  title: string;
  subtitle: string | null;
  period_to: string;
  share_token: string;
};

const NEWS_SCOPES: {
  scope: FeastNewsScope;
  kicker: (localityName: string) => string;
  title: string;
  sub: string;
}[] = [
  {
    scope: "internacional",
    kicker: () => "Comunidad Mundial",
    title: "Noticias Internacionales",
    sub: "De los últimos diecinueve días",
  },
  {
    scope: "nacional",
    kicker: () => "Comunidad Nacional",
    title: "Noticias Nacionales",
    sub: "Asamblea Espiritual Nacional",
  },
  {
    scope: "local",
    kicker: (localityName) => localityName,
    title: "Noticias Locales",
    sub: "Nuestra Asamblea Espiritual Local",
  },
];

export const NEWS_SCOPE_LABELS: Record<FeastNewsScope, string> = {
  internacional: "Internacionales",
  nacional: "Nacionales",
  local: "Locales",
};

export const NEWS_SCOPE_ORDER: FeastNewsScope[] = ["internacional", "nacional", "local"];

const MONTH_ORDINALS = [
  "Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Séptimo",
  "Octavo", "Noveno", "Décimo", "Undécimo", "Duodécimo", "Decimotercer",
  "Decimocuarto", "Decimoquinto", "Decimosexto", "Decimoséptimo",
  "Decimoctavo", "Decimonoveno",
];

const PRAYER_ORDINALS = [
  "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava",
];

export function buildFeastProgram(input: {
  feast: Feast;
  localityName: string;
  locations: FeastLocation[];
  prayers: FeastPrayer[];
  news: FeastNewsItem[];
  /** Informes publicados para la comunidad; se elige el del mes que cierra. */
  reports: TreasuryReportRef[];
}): FeastProgram {
  const { feast, localityName, locations, prayers, news, reports } = input;
  const month = getBahaiMonth(feast.bahai_month_index);
  const celebrationDate = feast.gregorian_date
    ? celebrationDateFor(feast.gregorian_date)
    : null;

  const newsSections: FeastProgramNewsSection[] = NEWS_SCOPES.map((s) => ({
    scope: s.scope,
    kicker: s.kicker(localityName),
    title: s.title,
    sub: s.sub,
    items: news
      .filter((n) => n.scope === s.scope)
      .sort((a, b) => a.position - b.position),
  })).filter((s) => s.items.length > 0);

  const report = feast.gregorian_date
    ? pickReportForFeast(reports, feast.gregorian_date)
    : null;

  let treasury: FeastProgramTreasury | null = null;
  if (report) {
    treasury = {
      kind: "report",
      title: report.title,
      subtitle: report.subtitle,
      href: `/i/${report.share_token}`,
    };
  } else if (
    feast.treasury_income != null ||
    feast.treasury_expenses != null ||
    feast.treasury_final != null ||
    feast.treasury_pdf_url
  ) {
    treasury = {
      kind: "figures",
      income: feast.treasury_income,
      expenses: feast.treasury_expenses,
      final: feast.treasury_final,
      pdfUrl: feast.treasury_pdf_url,
    };
  }

  return {
    feastId: feast.id,
    status: feast.status,
    localityName,
    monthName: feast.bahai_month_name,
    monthIndex: feast.bahai_month_index,
    monthMeaning: month?.meaning ?? null,
    monthOrdinal: `${MONTH_ORDINALS[feast.bahai_month_index - 1] ?? `${feast.bahai_month_index}.º`} mes`,
    bahaiYear: feast.bahai_year,
    celebrationDate,
    celebrationLabel: celebrationDate ? formatLongDateEs(celebrationDate) : null,
    locations: [...locations]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((l) => ({
        name: l.name,
        address: l.address,
        when: formatLocationWhen(l.starts_at),
      })),
    prayers: [...prayers]
      .sort((a, b) => a.position - b.position)
      .map((p, i) => ({
        label: PRAYER_ORDINALS[i]
          ? `${PRAYER_ORDINALS[i]} oración`
          : `Oración ${i + 1}`,
        title: p.title,
        reference: p.reference,
        body: p.body,
        size: bodySize(p.body),
      })),
    deepening: feast.deepening_theme
      ? { theme: feast.deepening_theme, content: feast.deepening_content }
      : null,
    news: newsSections,
    communique: feast.assembly_communique?.trim() || null,
    treasury,
  };
}

/**
 * En la Fiesta del mes M se presenta el informe del mes que TERMINA: el
 * que cierra el día anterior a la fecha oficial de M. Se toma el informe
 * publicado con `period_to` más cercano por debajo de esa fecha, con una
 * tolerancia de 45 días para que un informe de dos meses también entre.
 */
export function pickReportForFeast<T extends { period_to: string }>(
  reports: T[],
  gregorianDate: string
): T | null {
  const candidates = reports
    .filter((r) => r.period_to < gregorianDate && daysBetween(r.period_to, gregorianDate) <= 45)
    .sort((a, b) => b.period_to.localeCompare(a.period_to));
  return candidates[0] ?? null;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** Largo del texto → tamaño de letra de la diapositiva. */
export function bodySize(text: string): "lg" | "md" | "sm" {
  const n = text.length;
  if (n < 380) return "lg";
  if (n < 900) return "md";
  return "sm";
}

/** "24 de agosto de 2026" a partir de un ISO de fecha. */
export function formatLongDateEs(iso: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/**
 * "Lunes 24 de agosto · 19:30". El horario se guardó sin zona
 * (`YYYY-MM-DDTHH:MM:00`) y Postgres lo interpretó en UTC, así que se
 * lee en UTC para que salga la hora que escribió la Asamblea.
 */
export function formatLocationWhen(startsAt: string): string {
  const d = new Date(startsAt);
  const day = new Intl.DateTimeFormat("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
  const time = new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/** "Fiesta-Asma-183.pdf": sin diacríticos ni apóstrofos, apto para nombre de archivo. */
export function feastProgramFileName(program: FeastProgram): string {
  const plain = program.monthName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
  return `Fiesta-${plain || program.monthIndex}-${program.bahaiYear}.pdf`;
}
