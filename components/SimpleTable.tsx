import type { ReactNode } from "react";

type Column = { label: string; align?: "left" | "right" };

/** A plain responsive table: scrolls sideways on narrow screens instead of squashing its columns. */
export function SimpleTable({
  columns,
  rows,
}: {
  columns: Column[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-surface-muted text-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={`px-4 py-2 font-medium ${column.align === "right" ? "text-right" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, i) => (
                <td key={i} className={`px-4 py-2 ${columns[i]?.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
