import Link from "next/link";
import { formatMessageDate } from "@/lib/format";
import { isPollOpen } from "@/lib/polls-shared";
import type { Message, MessagePoll, MessageRead, MyPollVote } from "@/lib/types";

type Props = {
  message: Message;
  read: MessageRead | null;
  /** "Nuevo" ya resuelto en el servidor (por persona, ver isNewForReader). */
  isNew: boolean;
  featured: boolean;
  poll?: MessagePoll | null;
  myVote?: MyPollVote | null;
};

/**
 * La tarjeta COMPACTA de la lista de Comunicados: imagen, fecha y
 * chapitas, título y asunto, y toda ella es un link al comunicado
 * (`/comunicados/[id]`). El texto, el PDF, la encuesta y el botón
 * "Enterado/a" viven en la pantalla propia.
 *
 * Al pie, solo cuando corresponde, una línea dice qué hay para hacer
 * adentro —confirmar la lectura, votar, bajar el PDF—: con la tarjeta
 * cerrada nadie se enteraría hasta abrirla, y lo que pide una acción
 * es justamente lo que no puede pasar desapercibido.
 *
 * Es un componente de servidor sin estado: el "visto" (048) se marca al
 * abrir el comunicado, no al verlo pasar en la lista.
 */
export function ComunicadoListItem({
  message: m,
  read,
  isNew,
  featured,
  poll = null,
  myVote = null,
}: Props) {
  // 057 · El nacional es la única tarjeta oscura de la lista (ver
  // ComunicadoCard para el porqué del verde pino).
  const national = m.source === "asamblea_nacional";
  const hints = hintsFor(m, read, poll, myVote);

  return (
    <Link
      href={`/comunicados/${m.id}`}
      id={`c-${m.id}`}
      aria-label={`Abrir comunicado: ${m.title}`}
      className={`tap block overflow-hidden rounded-2xl ${
        national
          ? "bg-pine shadow-card-elevated"
          : featured
            ? "shadow-card-elevated ring-1 ring-gold/45"
            : "bg-card shadow-card"
      }`}
      style={
        !national && featured
          ? { background: "linear-gradient(160deg, #FBF6E4, #FFFDF7)" }
          : undefined
      }
    >
      {m.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.image_url} alt="" className="h-40 w-full object-cover" />
      )}
      <div className="p-4">
        <div className="mb-1.5 flex items-center gap-2">
          {national && (
            <span className="rounded bg-gold px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-pine">
              Nacional
            </span>
          )}
          <span
            className={`text-[10px] font-semibold tracking-[0.3px] ${
              national ? "text-gold-light" : "text-terra"
            }`}
          >
            {formatMessageDate(m.date)}
          </span>
          {isNew && (
            <span
              className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                national
                  ? "bg-gold/25 text-gold-light ring-1 ring-gold/40"
                  : "bg-terra text-white"
              }`}
            >
              Nuevo
            </span>
          )}
          {/* El chevron dice "esto se abre" sin leer una palabra. */}
          <svg
            className={`ml-auto shrink-0 ${national ? "text-gold-light/70" : "text-muted"}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        <h2
          className={`font-display text-[19px] font-semibold leading-[1.25] ${
            national ? "text-white" : "text-dark"
          }`}
        >
          {m.title}
        </h2>
        {m.subject && (
          <p
            className={`mt-0.5 text-[12px] font-medium uppercase tracking-wide ${
              national ? "text-gold-light/90" : "text-amber"
            }`}
          >
            {m.subject}
          </p>
        )}
        {hints.length > 0 && (
          <ul
            className={`mt-3 flex flex-wrap gap-x-3.5 gap-y-1 border-t pt-2.5 text-[11.5px] font-medium ${
              national ? "border-white/10" : "border-black/[0.06]"
            }`}
          >
            {hints.map((h) => (
              <li
                key={h.label}
                className={`inline-flex items-center gap-1.5 ${toneClass(h.tone, national)}`}
              >
                <HintIcon kind={h.icon} />
                {h.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}

type Hint = {
  label: string;
  icon: "check" | "poll" | "pdf";
  /** "todo": pide algo; "done": ya hecho; "info": neutro. */
  tone: "todo" | "done" | "info";
};

function hintsFor(
  m: Message,
  read: MessageRead | null,
  poll: MessagePoll | null,
  myVote: MyPollVote | null
): Hint[] {
  const hints: Hint[] = [];
  if (m.ask_confirmation) {
    hints.push(
      read?.confirmed_at
        ? { label: "Lectura confirmada", icon: "check", tone: "done" }
        : { label: "Pide confirmar lectura", icon: "check", tone: "todo" }
    );
  }
  if (poll) {
    if (!isPollOpen(poll)) {
      hints.push({ label: "Encuesta cerrada", icon: "poll", tone: "info" });
    } else if (myVote) {
      hints.push({ label: "Encuesta abierta · votaste", icon: "poll", tone: "done" });
    } else {
      hints.push({ label: "Encuesta abierta", icon: "poll", tone: "todo" });
    }
  }
  if (m.pdf_url) hints.push({ label: "PDF adjunto", icon: "pdf", tone: "info" });
  return hints;
}

function toneClass(tone: Hint["tone"], national: boolean): string {
  if (national) {
    return tone === "todo"
      ? "text-gold-light"
      : tone === "done"
        ? "text-white/70"
        : "text-white/60";
  }
  return tone === "todo" ? "text-terra" : tone === "done" ? "text-green" : "text-muted";
}

function HintIcon({ kind }: { kind: Hint["icon"] }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "check") {
    return (
      <svg {...common}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (kind === "poll") {
    return (
      <svg {...common}>
        <line x1="4" y1="20" x2="20" y2="20" />
        <rect x="6" y="10" width="3" height="10" />
        <rect x="11" y="4" width="3" height="16" />
        <rect x="16" y="13" width="3" height="7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
