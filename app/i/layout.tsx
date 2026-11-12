/**
 * Un documento no sigue el tema de color de la app (lib/ui-theme.ts):
 * `data-theme="clasico"` repone la paleta original para todo lo de adentro.
 * `contents` para que el envoltorio no participe del layout.
 */
export default function ClassicThemeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="clasico" className="contents">
      {children}
    </div>
  );
}
