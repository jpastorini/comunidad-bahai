/**
 * ¿La app corre instalada (pantalla de inicio) y no en una pestaña del
 * navegador? Vale en cliente solamente; en el servidor devuelve false.
 * En iOS el flag es `navigator.standalone`; en el resto, el media query.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}
