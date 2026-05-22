import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight } from "@/components/Icons";

// ──────────────── Page header ────────────────
type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between md:gap-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1 font-display text-[30px] font-bold leading-[1.1] text-dark md:text-[40px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl font-body text-[14px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

// ──────────────── Buttons ────────────────
type ButtonProps = {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  href?: string;
  type?: "button" | "submit";
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  formAction?: (formData: FormData) => void;
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT = {
  primary: "bg-terra text-white shadow-card-soft hover:bg-terra-light",
  secondary: "border border-black/10 bg-card text-dark hover:bg-bg",
  danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  ghost: "text-dark hover:bg-bg",
} as const;

export function Button({
  variant = "primary",
  href,
  type = "button",
  children,
  className = "",
  disabled,
  onClick,
  formAction,
}: ButtonProps) {
  const cls = `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled}
      onClick={onClick}
      formAction={formAction}
    >
      {children}
    </button>
  );
}

// ──────────────── Card ────────────────
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card md:p-7 ${className}`}
    >
      {children}
    </div>
  );
}

/** Envoltorio centrado para formularios. Limita el ancho en pantallas grandes
 *  para que los inputs no queden gigantescos en una laptop ancha. */
export function FormShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl">{children}</div>;
}

// ──────────────── Form fields ────────────────
type FieldProps = {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  children?: ReactNode;
};

export function Field({ label, name, hint, required, children }: FieldProps) {
  return (
    <label htmlFor={name} className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-dark">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </span>
        {hint && <span className="text-[10px] text-muted">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const INPUT_BASE =
  "w-full rounded-xl border border-black/10 bg-card px-3.5 py-2.5 text-[13px] text-dark outline-none placeholder:text-muted focus:border-terra";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_BASE} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={5}
      {...props}
      className={`${INPUT_BASE} font-body leading-[1.5] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${INPUT_BASE} appearance-none bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat pr-8 ${
        props.className ?? ""
      }`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%237A7670' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='1 1 6 6 11 1'/></svg>\")",
      }}
    >
      {props.children}
    </select>
  );
}

export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 h-4 w-4 rounded border-black/20 text-terra focus:ring-terra"
      />
      <span className="text-[13px] text-dark">{label}</span>
    </label>
  );
}

// ──────────────── Data table ────────────────
type DataTableProps<T> = {
  rows: T[];
  empty?: ReactNode;
  columns: {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
    width?: string;
  }[];
  rowKey: (row: T) => string;
  /** Optional per-row class for highlights (e.g. próxima Fiesta). */
  rowClassName?: (row: T) => string | undefined;
};

export function DataTable<T>({
  rows,
  columns,
  empty,
  rowKey,
  rowClassName,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg text-muted">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="text-[14px] text-muted">
          {empty ?? "No hay registros todavía."}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-black/[0.05] bg-bg/40 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-4 py-3.5 first:pl-6 last:pr-6"
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`transition-colors hover:bg-bg/50 ${
                  rowClassName?.(row) ?? ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className="px-4 py-4 text-[13px] text-dark first:pl-6 last:pr-6"
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ──────────────── Empty / banner ────────────────
export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    info: "border-terra/20 bg-terra/[0.04] text-terra",
    warning: "border-amber-300 bg-amber-50 text-amber-800",
    danger: "border-rose-300 bg-rose-50 text-rose-700",
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 text-[13px] ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[12px] font-semibold text-terra hover:underline"
    >
      {label}
      <IconArrowRight size={12} />
    </Link>
  );
}
