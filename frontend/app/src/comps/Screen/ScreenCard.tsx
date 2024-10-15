import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import { a, useSpring } from "@react-spring/web";

const LOAN_CARD_HEIGHT = 246;

export function ScreenCard({
  // cardHeight: s === "error" ? 180 : 120,
  baseCardHeight = 180,
  cardHeight = LOAN_CARD_HEIGHT,
  children,
  heading,
  padding = "16px 16px 24px",
  ready,
}: {
  baseCardHeight?: number;
  cardHeight?: number;
  children: ReactNode;
  heading: ReactNode;
  padding?: string | number;
  ready: boolean;
}) {
  const spring = useSpring({
    to: ready
      ? {
        cardtransform: "scale3d(1, 1, 1)",
        containerHeight: cardHeight,
        cardHeight: cardHeight,
        cardBackground: token("colors.blue:950"),
        cardColor: token("colors.white"),
      }
      : {
        cardtransform: "scale3d(0.95, 0.95, 1)",
        containerHeight: (
          window.innerHeight
          - 120 // top bar
          - 24 * 2 // padding
          - 48 // bottom bar 1
          - 40
        ),
        cardHeight: baseCardHeight,
        cardBackground: token("colors.blue:50"),
        cardColor: token("colors.blue:950"),
      },
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
  });

  return (
    <a.div
      className={css({
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
      })}
      style={{
        height: spring.containerHeight,
      }}
    >
      <a.section
        className={css({
          overflow: "hidden",
          width: "100%",
          borderRadius: 8,
          userSelect: "none",
        })}
        style={{
          background: spring.cardBackground,
          color: spring.cardColor,
          height: ready ? cardHeight : spring.cardHeight,
          padding,
          transform: spring.cardtransform,
          willChange: "transform",
        }}
      >
        {heading && (
          <h1
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
              paddingBottom: 12,
            })}
            style={{
              opacity: Number(ready),
              pointerEvents: ready ? "auto" : "none",
            }}
          >
            {heading}
          </h1>
        )}
        {ready
          ? <div>{children}</div>
          : (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontSize: 18,
              })}
            >
              {children}
            </div>
          )}
      </a.section>
    </a.div>
  );
}
