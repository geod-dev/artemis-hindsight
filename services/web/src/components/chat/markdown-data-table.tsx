"use client";

import { Children, isValidElement, type ComponentPropsWithoutRef, type FC, type ReactNode } from "react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/assistant-ui/elements/data-table";
import { cn } from "@/lib/utils";

// Markdown tables render as the registry's DataTable (sortable columns, numbers aligned and formatted). The table
// component receives the rendered table: sections (thead, tbody), their rows, and the rows' cells. A table with any
// formatting in a cell (bold, italics, code, a link) stays a plain markdown table: DataTable cells are plain values, and
// the formatting would be lost. Comparison tables bold their best values, so they are plain tables.

type Props = ComponentPropsWithoutRef<"table">;

const elementsOf = (children: ReactNode) =>
  Children.toArray(children).filter(isValidElement<{ children?: ReactNode }>);

/** The text of rendered cell content, without its formatting. */
const textOf = (children: ReactNode): string =>
  Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return textOf(child.props.children);
      return "";
    })
    .join("")
    .trim();

/** The table's cells, header row first: each row a list of the cells' rendered content. */
const cellsOf = (children: ReactNode): ReactNode[][] =>
  elementsOf(children).flatMap((section) =>
    elementsOf(section.props.children).map((row) => elementsOf(row.props.children).map((cell) => cell.props.children)),
  );

/** True when a cell holds formatting: its content has an element (strong, em, code, a link), not only text. */
const isFormatted = (content: ReactNode) => elementsOf(content).length > 0;

// Plain numbers only (1234, -3.5): "1 234" or "1,234" read differently by locale, so they stay text.
const NUMBER = /^-?\d+(\.\d+)?$/;

/** The same look as the registry's markdown table, for the tables DataTable does not take. */
const PlainTable: FC<Props> = ({ className, ...props }) => (
  <div className="aui-md-table-wrapper my-3 overflow-x-auto">
    <table className={cn("aui-md-table w-full border-separate border-spacing-0", className)} {...props} />
  </div>
);

export const MarkdownDataTable: FC<Props> = (props) => {
  const cells = cellsOf(props.children);
  if (cells.some((row) => row.some(isFormatted))) return <PlainTable {...props} />;
  const [header, ...body] = cells.map((row) => row.map(textOf));
  if (!header || header.length === 0 || body.length === 0) return <PlainTable {...props} />;

  const keys = header.map((_, index) => `c${index}`);
  const numeric = keys.map((_, column) => body.every((row) => (row[column] ?? "") === "" || NUMBER.test(row[column] ?? "")));
  const columns: DataTableColumn[] = header.map((label, index) => ({
    key: keys[index]!,
    label: label || " ",
    sortable: true,
    ...(numeric[index] ? { format: { kind: "number" as const }, align: "end" as const } : {}),
  }));
  const rows: DataTableRow[] = body.map((cells) =>
    Object.fromEntries(
      keys.map((key, index) => {
        const cell = cells[index] ?? "";
        return [key, numeric[index] && cell !== "" ? Number(cell) : cell];
      }),
    ),
  );

  return <DataTable className="my-3 first:mt-0" columns={columns} rows={rows} />;
};
