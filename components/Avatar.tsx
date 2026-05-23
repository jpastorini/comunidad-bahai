type Props = {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  className?: string;
};

/**
 * Avatar circular con fallback a iniciales sobre un fondo neutro.
 * Se usa en el header del home, en la página de perfil, y en avatares
 * pequeños de uploaders en otras vistas.
 */
export function Avatar({ url, name, size = 36, className = "" }: Props) {
  const initials = getInitials(name);
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-terra/15 ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name ?? "Avatar"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className="font-display font-semibold text-terra"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
