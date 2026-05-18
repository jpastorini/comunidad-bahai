import { cookies } from "next/headers";

const COOKIE = "flash-toast";

export type ToastTone = "success" | "error" | "info";
export type Toast = { tone: ToastTone; message: string };

/**
 * Persist a one-shot toast in a cookie. Called from server actions just
 * before redirect. The next page render reads and clears it via
 * `consumeFlashToast()`.
 */
export function setFlashToast(toast: Toast) {
  cookies().set({
    name: COOKIE,
    value: JSON.stringify(toast),
    httpOnly: false, // readable from server only; we render server-side
    sameSite: "lax",
    path: "/",
    maxAge: 30,
  });
}

/** Read and clear the flash toast cookie. Returns null when none is set. */
export function consumeFlashToast(): Toast | null {
  const jar = cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Toast;
    // Clear immediately so the toast only shows once.
    try {
      jar.delete(COOKIE);
    } catch {
      /* read-only context */
    }
    return parsed;
  } catch {
    return null;
  }
}
