"use client";

/**
 * Botón de submit que pide confirmación antes de enviar el form.
 * Se usa para deshabilitar miembros (acción reversible pero que corta el
 * acceso, conviene un freno). Si el usuario cancela, se aborta el submit.
 */
export function ConfirmSubmit({
  message,
  className,
  formAction,
  children,
}: {
  message: string;
  className?: string;
  /** Para el segundo action de un mismo form (eliminar junto a guardar). */
  formAction?: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
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
