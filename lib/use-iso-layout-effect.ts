import { useEffect, useLayoutEffect } from "react";

/**
 * useLayoutEffect en el navegador, useEffect en el servidor. Los
 * componentes cliente también se renderizan en el servidor, donde
 * useLayoutEffect no hace nada y React lo avisa en cada request. Se usa
 * para medir y ubicar algo ANTES del primer pintado (la marca de la barra
 * de pestañas y de los segmentos), así no se ve saltar.
 */
export const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
