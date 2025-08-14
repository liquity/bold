import type { ReactNode } from "react";

import { css, cx } from "@/styled-system/css";
import { a, useSpring } from "@react-spring/web";
import { isValidElement } from "react";

// A section within Screen component, with its own heading and content area.
export function SubScreen({
  children,
  className,
  gap = 48,
  heading = null,
  paddingTop = 0,
  width = "100%",
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  heading?: ReactNode | {
    title: ReactNode;
    subtitle?: ReactNode;
  };
  width?: number | "100%";
  paddingTop?: number;
}) {
  const headingSpring = useSpring({
    from: {
      opacity: 0,
      transform: `
        scale3d(0.95, 0.95, 1)
        translate(0, 12px)
      `,
    },
    to: {
      opacity: 1,
      transform: `
        scale3d(1, 1, 1)
        translate(0, 0px)
      `,
    },
    config: {
      mass: 1,
      tension: 2200,
      friction: 120,
    },
  });

  const screenSpring = useSpring({
    from: {
      opacity: 0,
      transform: `
        scale3d(0.95, 0.95, 1)
        translate3d(0, 20px, 0)
      `,
    },
    to: {
      opacity: 1,
      transform: `
        scale3d(1, 1, 1)
        translate3d(0, 0px, 0)
      `,
    },
    delay: 100,
    config: {
      mass: 1,
      tension: 2200,
      friction: 120,
    },
  });

  const headingElt = typeof heading === "object"
      && heading !== null
      && "title" in heading
      && !isValidElement(heading)
    ? (
      <header
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          paddingBottom: 8,
        })}
      >
        <h1
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          })}
        >
          {heading.title}
        </h1>
        {heading.subtitle && (
          <div
            className={css({
              maxWidth: 540,
              textAlign: "center",
              color: "contentAlt",
            })}
          >
            {heading.subtitle}
          </div>
        )}
      </header>
    )
    : (
      <div style={{ width }}>
        {heading}
      </div>
    );

  return (
    <div
      className={cx(
        css({
          position: "relative",
          flexGrow: 1,
          display: "flex",
          gap: 48,
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          transformOrigin: "50% 0",
        }),
        className,
      )}
      style={{
        paddingTop,
      }}
    >
      {headingElt && (
        <a.div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            alignItems: "center",
          })}
          style={headingSpring}
        >
          {headingElt}
        </a.div>
      )}
      <a.div
        className={css({
          display: "flex",
          flexDirection: "column",
          position: "relative",
          transformOrigin: "50% 0",
          willChange: "transform, opacity",
        })}
        style={{
          gap,
          width,
          ...screenSpring,
        }}
      >
        {children}
      </a.div>
    </div>
  );
}