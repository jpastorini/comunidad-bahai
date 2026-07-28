"use client";

/**
 * Botón de submit que pide confirmación antes de enviar el form.
 * Se usa para deshabilitar miembros (acción reversible pero que corta el
 * acceso, conviene un freno). Si el usuario cancela, se aborta el submit.
 */
export function ConfirmSubmit({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
