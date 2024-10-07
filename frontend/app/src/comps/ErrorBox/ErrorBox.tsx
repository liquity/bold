import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { IconChevronDown } from "@liquity2/uikit";
import { useState } from "react";

export function ErrorBox({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      className={css({
        background: "negativeSurface",
        color: "negative",
        fontSize: 14,
        border: "1px solid token(colors.negativeSurfaceBorder)",
        borderRadius: 8,
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 48,
          padding: "0 0 0 24px",
        })}
      >
        <h1>{title}</h1>
        <button
          onClick={() => setExpanded(!expanded)}
          className={css({
            display: "flex",
            alignItems: "center",
            height: "100%",
            padding: "0 32px 0 8px",
            gap: 4,
            cursor: "pointer",
            _focusVisible: {
              outline: "2px solid token(colors.focused)",
            },
          })}
        >
          {expanded ? "Less" : "More"} details
          <IconChevronDown size={16} />
        </button>
      </div>
      {expanded && (
        <div
          className={css({
            padding: "8px 24px 24px",
            color: "negativeSurfaceContent",
            overflow: "auto",
            _focusVisible: {
              outline: "2px solid token(colors.focused)",
            },
          })}
        >
          {children}
        </div>
      )}
    </section>
  );
}
