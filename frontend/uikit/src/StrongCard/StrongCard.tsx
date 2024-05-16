import type { ReactElement, ReactNode } from "react";

import { a, useSpring } from "@react-spring/web";
import { forwardRef, useState } from "react";
import { css, cx } from "../../styled-system/css";
import { IconArrowRight } from "../icons";

type Cell = {
  label: ReactNode;
  value: ReactNode;
};

type ElementOrString = ReactElement | string;

export const StrongCard = forwardRef<HTMLAnchorElement, {
  heading: ElementOrString | ElementOrString[];
  href?: string;
  rows: [
    [Cell | null, Cell | null],
    [Cell | null, Cell | null],
  ];
}>(function StrongCard({
  heading,
  href,
  rows,
}, ref) {
  const [heading1, heading2] = Array.isArray(heading) ? heading : [heading];

  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  const hoverSpring = useSpring({
    progress: hovered ? 1 : 0,
    transform: active
      ? "scale(1)"
      : hovered
      ? "scale(1.01)"
      : "scale(1)",
    boxShadow: hovered && !active
      ? "0 2px 4px rgba(0, 0, 0, 0.1)"
      : "0 2px 4px rgba(0, 0, 0, 0)",
    immediate: active,
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
  });

  return (
    <a.a
      ref={ref}
      href={href}
      onBlur={() => setActive(false)}
      onMouseDown={() => setActive(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseUp={() => setActive(false)}
      className={cx(
        "group",
        css({
          display: "flex",
          flexDirection: "column",
          padding: 16,
          background: "strongSurface",
          borderRadius: 8,
        }),
      )}
      style={hoverSpring}
    >
      <section
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 20,
        })}
      >
        <header
          className={css({
            display: "flex",
            justifyContent: "space-between",
            color: "strongSurfaceContentAlt",
          })}
        >
          <h1
            className={css({
              fontSize: 12,
              textTransform: "uppercase",
            })}
          >
            {heading1}
          </h1>

          {heading2 && (
            <div
              className={css({
                fontSize: 14,
                color: "strongSurfaceContent",
              })}
            >
              {heading2}
            </div>
          )}
          <div
            className={css({
              transition: "transform 100ms",
              _groupHover: {
                transform: `
                  translate3d(0, 0, 0)
                  scale3d(1.2, 1.2, 1)
                `,
              },
              _groupFocus: {
                transform: `
                  translate3d(4px, 0, 0)
                `,
              },
            })}
          >
            <IconArrowRight size={20} />
          </div>
        </header>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 12,
          })}
        >
          {rows.map((row, i) => (
            <Row
              key={i}
              cells={row}
            />
          ))}
        </div>
      </section>
    </a.a>
  );
});

function Row({
  cells,
}: {
  cells: [Cell | null, Cell | null];
}) {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        color: "strongSurfaceContent",
      })}
    >
      {cells.map((cell, i) => (
        cell && (
          <div
            key={i}
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: i === 0 ? "flex-start" : "flex-end",
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                height: 30,
                fontSize: i === 0 ? 20 : 14,
                color: "strongSurfaceContent",
              })}
            >
              {cell.value}
            </div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                height: 18,
                fontSize: 14,
                color: "strongSurfaceContentAlt",
              })}
            >
              {cell.label}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
