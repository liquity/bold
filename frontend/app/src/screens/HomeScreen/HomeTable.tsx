import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { Fragment } from "react";

type HomeTableProps<Cols extends readonly ReactNode[]> = {
  columns: Cols;
  icon: ReactNode;
  loading?: ReactNode;
  rows: Array<ReactNode | { [K in keyof Cols]: ReactNode }>;
  subtitle: ReactNode;
  title: ReactNode;
};

export function HomeTable<Cols extends readonly ReactNode[]>({
  columns,
  icon,
  loading,
  rows,
  subtitle,
  title,
}: HomeTableProps<Cols>) {
  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 32,
        padding: 16,
        background: "surface",
        border: "1px solid token(colors.tableBorder)",
        borderRadius: 8,
      })}
    >
      <header
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
        })}
      >
        <h1
          className={css({
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            fontSize: 20,
          })}
        >
          <span>{title}</span>
          <span>{icon}</span>
        </h1>
        <div
          className={css({
            color: "contentAlt",
            fontSize: 14,
            fontWeight: 400,
          })}
        >
          {subtitle}
        </div>
      </header>
      {loading
        ? (
          <div
            className={css({
              display: "flex",
              gap: 16,
              justifyContent: "center",
              height: 48,
            })}
          >
            {loading}
          </div>
        )
        : (
          <table
            className={css({
              width: "100%",
              fontSize: 14,
              "& th, & td": {
                fontWeight: "inherit",
                whiteSpace: "nowrap",
                textAlign: "right",
              },
              "& th": {
                paddingBottom: 8,
                color: "contentAlt2",
              },
              "& td": {
                padding: "12px 0",
                borderTop: "1px solid token(colors.tableBorder)",
              },
              "& th:first-of-type, & td:first-of-type": {
                textAlign: "left",
              },
              "& thead tr + tr th": {
                color: "contentAlt2",
              },
            })}
          >
            <thead>
              <tr>
                {columns.map((col, index) => (
                  <th key={index}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <Fragment key={rowIndex}>
                  {!Array.isArray(row) ? row : (
                    <tr>
                      {row.map((cell, colIndex) => (
                        <td key={colIndex}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
    </section>
  );
}
