import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { Fragment } from "react";

type HomeTableProps<Cols extends readonly ReactNode[]> = {
  columns: Cols;
  icon?: ReactNode;
  loading?: ReactNode;
  placeholder?: ReactNode;
  rows: Array<ReactNode | { [K in keyof Cols]: ReactNode }>;
  subtitle?: ReactNode;
  title: ReactNode;
};

export function HomeTable<Cols extends readonly ReactNode[]>({
  columns,
  icon,
  loading,
  placeholder,
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
        padding: "12px 16px 16px",
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
            gap: 8,
            fontSize: {
              base: 16,
              medium: 20,
            },
          })}
        >
          <span
            className={css({
              display: "flex",
              alignItems: "center",
              minHeight: 24,
            })}
          >
            {title}
          </span>
          {icon && <span
            className={css({
              transformOrigin: "50% 50%",
              transform: {
                base: "scale(0.8)",
                medium: "none",
              },
            })}
          >
            {icon}
          </span>}
        </h1>
        {subtitle && <div
          className={css({
            color: "contentAlt",
            fontSize: 14,
            fontWeight: 400,
          })}
        >
          {subtitle}
        </div>}
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
        : rows.length === 0
        ? (
          <div
            className={css({
              display: "grid",
              placeItems: "center",
              height: 64,
              margin: "-16px 0",
              padding: "0 0 16px",
              fontSize: 14,
              color: "contentAlt",
              userSelect: "none",
            })}
          >
            <div
              className={css({
                display: "grid",
                placeItems: "center",
                width: "100%",
                padding: "12px 16px",
                color: "disabledContent",
                background: "disabledSurface",
                borderRadius: 8,
              })}
            >
              {placeholder ?? "No data"}
            </div>
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
                userSelect: "none",
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
