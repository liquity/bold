import type { HTMLAttributes, ReactElement, ReactNode } from "react";

import { a, useSpring } from "@react-spring/web";
import { forwardRef, useState } from "react";
import { css, cx } from "../../styled-system/css";
import { IconArrowRight } from "../icons";
import { LoadingSurface } from "../LoadingSurface/LoadingSurface";

type Cell = {
  label: ReactNode;
  value: ReactNode;
};

type ElementOrString = ReactElement | string;

export const StrongCard = forwardRef<
  HTMLAnchorElement,
  {
    contextual?: ReactNode;
    heading?: ElementOrString | ElementOrString[];
    loading?: boolean;
    main?: Cell;
    secondary?: ReactNode;
  } & HTMLAttributes<HTMLAnchorElement>
>(function StrongCard({
  contextual,
  heading,
  loading,
  main,
  secondary,
  ...anchorProps
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
      {...anchorProps}
      onBlur={() => setActive(false)}
      onMouseDown={() => setActive(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseUp={() => setActive(false)}
      className={cx(
        "group",
        css({
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "16px 16px 12px",
          borderRadius: 8,
          outline: "none",
          "--background": "token(colors.strongSurface)",
          _focusVisible: {
            outline: "2px solid token(colors.focused)",
          },
        }),
      )}
      style={loading ? {} : {
        transform: hoverSpring.transform,
        boxShadow: hoverSpring.boxShadow,
        background: "var(--background)",
      }}
    >
      {loading && <LoadingSurface />}
      <section
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 20,
        })}
        style={{
          opacity: loading ? 0 : 1,
          pointerEvents: loading ? "none" : "auto",
        }}
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
          {contextual || (
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
          )}
        </header>
        {main && (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              marginTop: -24,
            })}
          >
            <div
              className={css({
                color: "strongSurfaceContent",
                fontSize: 28,
              })}
            >
              {main.value}
            </div>
            <div
              className={css({
                fontSize: 14,
                color: "strongSurfaceContentAlt",
              })}
            >
              {main.label}
            </div>
          </div>
        )}
        {secondary}
      </section>
    </a.a>
  );
});
