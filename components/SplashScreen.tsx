import { BahaiStar } from "@/components/BahaiStar";

// Splash de arranque de la PWA. La pantalla que muestra Android al abrir la
// app instalada la genera el sistema desde el manifest (ícono + color de
// fondo) y NO admite animación; esta capa la continúa sin costura —misma
// crema, mismo mosaico dorado con la estrella— y le da vida (halo, nombre,
// marca de agua girando) antes de desvanecerse y revelar la app.
//
// Tres decisiones que conviene no romper:
// - Quién la ve lo decide el script inline ANTES del primer paint (pone
//   data-splash en <html>): solo al abrir la app instalada (standalone) y
//   una vez por arranque (sessionStorage). `?splash=1` la fuerza en el
//   navegador, que es como se prueba sin instalar.
// - Se apaga sola por CSS (`animation … forwards` en globals.css), sin JS
//   de por medio: si algo del hydrate fallara, la pantalla igual se va.
//   `pointer-events: none` por la misma razón.
// - Con prefers-reduced-motion no se muestra (regla en globals.css).
const SPLASH_GATE = `(function () {
  try {
    var standalone =
      (window.matchMedia && matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
    var forced = location.search.indexOf("splash=1") !== -1;
    if (forced || (standalone && !sessionStorage.getItem("cb-splash-shown"))) {
      sessionStorage.setItem("cb-splash-shown", "1");
      document.documentElement.setAttribute("data-splash", "");
    }
  } catch (e) {}
})();`;

export function SplashScreen() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_GATE }} />
      <div id="cb-splash" aria-hidden="true">
        <BahaiStar
          size={560}
          color="#96790E"
          opacity={0.05}
          className="cb-splash-watermark"
        />
        <div className="cb-splash-center">
          <div className="cb-splash-halo" />
          {/* Mismo dibujo que el ícono del manifest: cuadrado redondeado al
              22 %, degradé dorado, estrella blanca al 64 % del lado. */}
          <div className="cb-splash-tile">
            <BahaiStar size={72} color="#FFFFFF" />
          </div>
        </div>
        <div className="cb-splash-name">Comunidad Bahá&rsquo;í</div>
        <div className="cb-splash-rule" />
      </div>
    </>
  );
}
