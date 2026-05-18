"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BahaiStar } from "./BahaiStar";
import { IconChevronLeft } from "./Icons";

type GoldHeaderProps = {
  title: string;
  subtitle?: string;
  /** Pass a href (e.g. "/") to render a back-to-home link. */
  backHref?: string;
  /** Custom right-side content (date, status, etc.). */
  rightSlot?: ReactNode;
  /** Extra content below subtitle (search bar, avatar row…). */
  children?: ReactNode;
  /** Big star (130px) for landing header; small (100px) for inner screens. */
  starSize?: number;
};

export function GoldHeader({
  title,
  subtitle,
  backHref,
  rightSlot,
  children,
  starSize = 100,
}: GoldHeaderProps) {
  return (
    <header
      className="relative shrink-0 overflow-hidden bg-gold-grad px-5 pb-5"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)" }}
    >
      <div
        className="pointer-events-none absolute"
        style={{
          top: starSize >= 120 ? 28 : 20,
          right: -12,
          opacity: starSize >= 120 ? 0.07 : 0.05,
        }}
      >
        <BahaiStar size={starSize} color="#fff" />
      </div>

      {backHref && (
        <Link
          href={backHref}
          className="tap relative mb-3 inline-flex items-center gap-2 text-white/60"
        >
          <IconChevronLeft size={14} className="text-white/70" />
          <span className="font-body text-[13px]">Inicio</span>
        </Link>
      )}

      <h1 className="relative font-display text-[27px] font-semibold leading-tight tracking-[0.3px] text-white">
        {title}
      </h1>

      {(subtitle || rightSlot) && (
        <div className="mt-1.5 flex items-center justify-between">
          {subtitle && (
            <span className="text-[10px] font-semibold uppercase tracking-[2.5px] text-white/50">
              {subtitle}
            </span>
          )}
          {rightSlot && (
            <span className="font-body text-[11px] text-white/45">
              {rightSlot}
            </span>
          )}
        </div>
      )}

      {children}
    </header>
  );
}
