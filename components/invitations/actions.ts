"use server";

import { requirePanelAccess } from "@/lib/auth";
import { hasPermission } from "@/lib/delegations";
import {
  checkInvitationQuota,
  generateInvitationDesign,
  recordInvitationGeneration,
  INVITATION_ATTEMPTS,
} from "@/lib/invitation-ai";
import type { InvitationFormat } from "@/lib/invitation";
import type { InvitationDesign } from "@/lib/invitation-design";

/**
 * Le pide a Claude el diseño de una invitación. Lo puede pedir quien
 * arma invitaciones: la Asamblea o un ayudante del Calendario o de las
 * Fiestas (088). El límite es por institución (094).
 */
export async function generateInvitationDesignAction(input: {
  invitationKey: string;
  format: InvitationFormat;
  eyebrow: string;
  title: string;
  date: string;
  time: string;
  place: string;
  text: string;
  footer: string;
}): Promise<{
  ok: boolean;
  design?: InvitationDesign;
  error?: string;
  /** Intentos que quedan para esta invitación. */
  remaining?: number;
}> {
  const session = await requirePanelAccess();
  if (
    !hasPermission(session.profile, "calendario") &&
    !hasPermission(session.profile, "fiestas")
  ) {
    return { ok: false, error: "No tenés permiso para crear invitaciones." };
  }

  const key = String(input.invitationKey ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(key)) return { ok: false, error: "Pedido inválido." };
  const format: InvitationFormat = input.format === "vertical" ? "vertical" : "cuadrada";
  const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const title = clip(input.title, 90);
  if (!title) return { ok: false, error: "Escribí el título antes de diseñar." };

  const quota = await checkInvitationQuota(session.locality.id, key);
  if (!quota.allowed) return { ok: false, error: quota.reason, remaining: 0 };

  const result = await generateInvitationDesign(
    {
      format,
      title,
      eyebrow: clip(input.eyebrow, 40),
      date: clip(input.date, 10),
      time: clip(input.time, 30),
      place: clip(input.place, 140),
      text: clip(input.text, 160),
      footer: clip(input.footer, 60),
    },
    INVITATION_ATTEMPTS - quota.remaining + 1
  );
  // Un intento que falló no gasta el cupo.
  if (!result.ok) return { ok: false, error: result.error, remaining: quota.remaining };

  await recordInvitationGeneration(session.locality.id, session.user.id, key);
  return { ok: true, design: result.design, remaining: quota.remaining - 1 };
}
