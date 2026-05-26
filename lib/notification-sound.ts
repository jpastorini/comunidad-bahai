/**
 * Sonido de notificación de chat — un "ding" suave de dos notas,
 * sintetizado con la Web Audio API (sin archivo de audio).
 *
 * Los navegadores suspenden el AudioContext hasta que hay un gesto del
 * usuario; como el miembro/admin está usando la app, normalmente ya hubo
 * interacción y el sonido se reproduce. Si no, falla en silencio.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function playChime(): void {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});

    const now = c.currentTime;
    const notes: Array<[freq: number, delay: number]> = [
      [880, 0],     // A5
      [1174.66, 0.12], // D6
    ];

    for (const [freq, delay] of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(c.destination);

      const start = now + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

      osc.start(start);
      osc.stop(start + 0.4);
    }
  } catch {
    /* sin sonido si el navegador lo bloquea */
  }
}
