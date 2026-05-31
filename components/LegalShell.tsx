import Link from "next/link";
import type { ReactNode } from "react";
import { BahaiStar } from "./BahaiStar";
import { LEGAL } from "@/lib/legal";

type Props = {
  title: string;
  intro?: string;
  children: ReactNode;
};

export function LegalShell({ title, intro, children }: Props) {
  return (
    <div className="min-h-[100dvh] bg-bg">
      <header
        className="relative overflow-hidden bg-gold-grad px-5 pb-7"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)" }}
      >
        <div className="pointer-events-none absolute -right-6 top-5 opacity-[0.06]">
          <BahaiStar size={120} color="#fff" />
        </div>
        <div className="mx-auto max-w-2xl">
          <Link
            href="/login"
            className="relative mb-3 inline-flex items-center gap-1.5 text-[13px] text-white/80 hover:text-white"
          >
            <span aria-hidden>←</span> Volver
          </Link>
          <h1 className="relative font-display text-[26px] font-semibold leading-tight text-white">
            {title}
          </h1>
          <p className="relative mt-1 text-[11px] uppercase tracking-[2px] text-white/55">
            {LEGAL.appName} · Actualizado el {LEGAL.lastUpdated}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-7">
        {intro && (
          <p className="mb-6 text-[14px] leading-relaxed text-dark">{intro}</p>
        )}
        <div className="space-y-6">{children}</div>

        <footer className="mt-10 border-t border-black/[0.08] pt-5 text-[12.5px] text-muted">
          <p>
            Dudas sobre este texto:{" "}
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="font-medium text-terra hover:underline"
            >
              {LEGAL.contactEmail}
            </a>
          </p>
          <nav className="mt-2 flex gap-4">
            <Link href="/privacidad" className="hover:text-terra">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:text-terra">
              Términos
            </Link>
            <Link href="/login" className="hover:text-terra">
              Inicio
            </Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1.5 font-display text-[16px] font-semibold text-dark">
        {heading}
      </h2>
      <div className="space-y-2 text-[14px] leading-relaxed text-dark/85">
        {children}
      </div>
    </section>
  );
}
