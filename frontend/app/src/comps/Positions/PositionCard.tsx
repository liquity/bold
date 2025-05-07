import type { HTMLAttributes, ReactElement, ReactNode, RefObject } from "react";

import { IconArrowRight, LoadingSurface } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useState } from "react";
import { css, cx } from "../../../styled-system/css";

type Cell = {
  label: ReactNode;
  value: ReactNode;
};

type ElementOrString = ReactElement | string;

const ALink = a(Link);

export function PositionCard({
  contextual,
  heading,
  href,
  loading,
  main,
  ref,
  secondary,
  ...anchorProps
}:
  & HTMLAttributes<HTMLAnchorElement>
  & (
    & {
      contextual?: ReactNode;
      heading?: ElementOrString | ElementOrString[];
      main?: Cell;
      ref?: RefObject<HTMLAnchorElement>;
      secondary?: ReactNode;
    }
    & (
      | { href: string; loading?: boolean }
      | { href?: string; loading: true }
    )
  ))
{
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
    <ALink
      ref={ref}
      href={href ?? ""}
      {...anchorProps}
      onBlur={() => setActive(false)}
      onMouseDown={() => setActive(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseUp={() => setActive(false)}
      className={cx(
        "group",
        anchorProps.className,
        css({
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "12px 16px",
          borderRadius: 8,
          outline: "none",
          "--background": "token(colors.position)",
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
            color: "positionContentAlt",
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
                color: "positionContent",
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
                color: "positionContent",
                fontSize: 28,
              })}
            >
              {main.value}
            </div>
            <div
              className={css({
                fontSize: 14,
                color: "positionContentAlt",
              })}
            >
              {main.label}
            </div>
          </div>
        )}
        {secondary}
      </section>
    </ALink>
  );
}
