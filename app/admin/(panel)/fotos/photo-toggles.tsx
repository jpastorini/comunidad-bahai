"use client";

import { useState } from "react";
import { setPhotoFeaturedAction, setPhotoNationalAction } from "./actions";

type Props = {
  photoId: string;
  featured: boolean;
  national: boolean;
};

/**
 * Dos pills de curaduría que guardan al instante: Destacar (tira del Home,
 * máx 3 por evento) y Boletín nacional. Optimista: si el server rechaza
 * (p. ej. tope de destacadas), revierte y avisa.
 */
export function PhotoToggles({ photoId, featured, national }: Props) {
  const [feat, setFeat] = useState(featured);
  const [nat, setNat] = useState(national);
  const [busy, setBusy] = useState(false);

  async function toggleFeatured() {
    if (busy) return;
    const next = !feat;
    setBusy(true);
    setFeat(next);
    const res = await setPhotoFeaturedAction(photoId, next);
    if (!res.ok) {
      setFeat(!next);
      if (res.error) alert(res.error);
    }
    setBusy(false);
  }

  async function toggleNational() {
    if (busy) return;
    const next = !nat;
    setBusy(true);
    setNat(next);
    const res = await setPhotoNationalAction(photoId, next);
    if (!res.ok) {
      setNat(!next);
      if (res.error) alert(res.error);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Pill active={feat} disabled={busy} onClick={toggleFeatured}>
        {feat ? "★ Destacada" : "Destacar"}
      </Pill>
      <Pill active={nat} disabled={busy} onClick={toggleNational} tone="gold">
        {nat ? "✦ En boletín" : "A boletín"}
      </Pill>
    </div>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  tone = "terra",
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone?: "terra" | "gold";
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "gold"
      ? "bg-gold-dark text-white"
      : "bg-terra text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
        active ? activeCls : "border border-black/10 bg-card text-muted hover:bg-bg"
      }`}
    >
      {children}
    </button>
  );
}
