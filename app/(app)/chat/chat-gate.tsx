import Link from "next/link";
import { BahaiStar } from "@/components/BahaiStar";
import { IconChevronLeft } from "@/components/Icons";
import {
  CHAT_TOPIC_LABELS,
  CHAT_TOPIC_PATHS,
  type ChatTopic,
} from "@/lib/types";

/**
 * Login wall mostrado dentro del shell de la app cuando un usuario
 * no autenticado abre el chat. Mantiene el header dorado para no romper
 * el lenguaje visual.
 */
export function ChatGate({ topic }: { topic: ChatTopic }) {
  const isTreasury = topic === "tesoreria";
  return (
    <>
      <header
        className="relative shrink-0 overflow-hidden bg-gold-grad px-5 pb-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)" }}
      >
        <div className="pointer-events-none absolute right-[-12px] top-5 opacity-[0.05]">
          <BahaiStar size={100} color="#fff" />
        </div>
        <Link
          href="/"
          className="tap relative mb-3 inline-flex items-center gap-2 text-white/60"
        >
          <IconChevronLeft size={14} className="text-white/70" />
          <span className="font-body text-[13px]">Inicio</span>
        </Link>
        <h1 className="relative font-display text-[27px] font-semibold leading-tight text-white">
          {CHAT_TOPIC_LABELS[topic]}
        </h1>
        <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[2.5px] text-white/50">
          {isTreasury ? "Chat con el tesorero" : "Chat con la Asamblea"}
        </div>
      </header>

      <div className="scroll-area flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-terra/10 text-terra">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-dark">
          Inicia sesión para chatear
        </h2>
        <p className="mt-2 max-w-xs font-body text-[13px] text-muted">
          {isTreasury
            ? "Necesitamos identificarte para que el tesorero sepa quién hizo el aporte y pueda responderte en privado."
            : "Necesitamos identificarte para que la Secretaría pueda responderte en privado."}
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(CHAT_TOPIC_PATHS[topic])}`}
          className="tap mt-5 inline-flex rounded-xl bg-terra px-5 py-2.5 text-[13px] font-semibold text-white shadow-card-soft"
        >
          Iniciar sesión con correo
        </Link>
      </div>
    </>
  );
}
