import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { IconChevronDown, useElementSize } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import { useRef, useState } from "react";

export function ErrorBox({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const { size } = useElementSize(contentRef);

  const contentStyles = useSpring({
    opacity: 1,
    height: expanded ? (size?.blockSize ?? 0) + 32 : 0,
    chevronTransform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
      clamp: true,
    },
  });

  return (
    <section
      className={css({
        width: "100%",
        background: "negativeSurface",
        color: "negative",
        fontSize: 14,
        border: "1px solid token(colors.negativeSurfaceBorder)",
        borderRadius: 8,
      })}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 46, // 48 - border width
          padding: "0 0 0 24px",
          cursor: "pointer",
          borderRadius: 8,
          _focusVisible: {
            outline: "2px solid token(colors.focused)",
          },
        })}
      >
        <h1
          className={css({
            textOverflow: "ellipsis",
            overflow: "hidden",
            whiteSpace: "nowrap",
          })}
        >
          {title}
        </h1>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            height: "100%",
            padding: "0 32px 0 8px",
            gap: 4,
            whiteSpace: "nowrap",
          })}
        >
          {expanded ? "Less" : "More"} details
          <a.div
            style={{
              transform: contentStyles.chevronTransform,
            }}
          >
            <IconChevronDown size={16} />
          </a.div>
        </div>
      </button>
      <a.div
        style={{
          overflow: "hidden",
          willChange: "height",
          ...contentStyles,
        }}
      >
        <div
          ref={contentRef}
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
      </a.div>
    </section>
  );
}
