import Link from "next/link";
import type { ReactNode } from "react";

/**
 * El markdown que escribe el asistente de Tesorería, dibujado a mano:
 * párrafos, negrita, código, links, listas, tablas y títulos. Es lo único
 * que el modelo usa, y no vale una dependencia para eso. Nada se inserta
 * como HTML: todo pasa por elementos de React, así que un texto raro del
 * modelo no puede inyectar marcado.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.92em]">
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      const label = tok.slice(1, tok.indexOf("]("));
      const href = tok.slice(tok.indexOf("](") + 2, -1);
      // Solo links al propio panel o a https: nada de javascript: ni data:.
      if (href.startsWith("/")) {
        out.push(
          <Link key={key} href={href} className="font-medium text-terra underline underline-offset-2">
            {label}
          </Link>
        );
      } else if (href.startsWith("https://")) {
        out.push(
          <a key={key} href={href} target="_blank" rel="noreferrer" className="font-medium text-terra underline underline-offset-2">
            {label}
          </a>
        );
      } else {
        out.push(label);
      }
    }
    last = start + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function AssistantMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const key = `b${k++}`;

    // Tabla: una fila con | y la siguiente de guiones.
    if (line.includes("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|")) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {head.map((h, j) => (
                  <th key={j} className="border-b border-black/10 px-2 py-1.5 text-left font-semibold">
                    {inline(h, `${key}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j} className="border-b border-black/[0.05] px-2 py-1.5 align-top">
                      {inline(c, `${key}r${ri}c${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={key} className="mb-1 mt-3 font-semibold text-dark">
          {inline(heading[1], key)}
        </p>
      );
      i++;
      continue;
    }

    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const re = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      const cls = `my-1.5 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`;
      const children = items.map((it, j) => <li key={j}>{inline(it, `${key}i${j}`)}</li>);
      blocks.push(ordered ? <ol key={key} className={cls}>{children}</ol> : <ul key={key} className={cls}>{children}</ul>);
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !bullet.test(lines[i]) &&
      !numbered.test(lines[i]) &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !(lines[i].includes("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? ""))
    ) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={key} className="my-1.5">
        {para.flatMap((p, j) => (j === 0 ? inline(p, `${key}p${j}`) : [<br key={`${key}br${j}`} />, ...inline(p, `${key}p${j}`)]))}
      </p>
    );
  }
  return <>{blocks}</>;
}
