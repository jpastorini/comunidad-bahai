"use client";

import { useEffect, useState } from "react";

type Tone = "success" | "error" | "info";
type Props = { toast: { tone: Tone; message: string } | null };

const TONE_STYLES: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-terra/20 bg-terra/[0.05] text-terra",
};

const ICON: Record<Tone, JSX.Element> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

/**
 * Flash toast. The server passes a single toast (read from cookie) on
 * each render. Auto-dismisses after 4s; also dismissable manually.
 */
export function Toaster({ toast }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto flex max-w-md justify-center px-4 transition-all duration-200 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
    >
      <div
        className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-card-elevated ${TONE_STYLES[toast.tone]}`}
      >
        <div className="mt-0.5 shrink-0">{ICON[toast.tone]}</div>
        <div className="flex-1 text-[13px] font-medium leading-snug">
          {toast.message}
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Cerrar"
          className="-mr-1 -mt-1 shrink-0 rounded p-1 opacity-60 hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
