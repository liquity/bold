import type { ReactNode } from "react";

import { css, cx } from "@/styled-system/css";
import { LoadingSurface } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import { match } from "ts-pattern";

const LOADING_CARD_WIDTH = 468;
const FINAL_CARD_WIDTH = 534;
const CARD_HEIGHT = 310;

export function ScreenCard({
  children,
  className,
  finalHeight = CARD_HEIGHT,
  mode,
}: {
  children: ReactNode;
  className?: string;
  finalHeight?: number;
  mode: "ready" | "loading" | "error";
}) {
  const scaleRatio = LOADING_CARD_WIDTH / FINAL_CARD_WIDTH;

  const spring = useSpring({
    to: mode === "ready"
      ? {
        cardtransform: "scale3d(1, 1, 1)",
        containerHeight: finalHeight,
      }
      : {
        cardtransform: `scale3d(${scaleRatio}, ${scaleRatio}, 1)`,
        containerHeight: Math.max(
          finalHeight,
          window.innerHeight
            - 120 // top bar
            - 24 * 2 // padding
            - 48 // bottom bar 1
            - 40,
        ),
      },
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
  });

  return (
    <a.div
      className={cx(
        className,
        css({
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
          maxWidth: {
            medium: FINAL_CARD_WIDTH
          },
        }),
      )}
      style={{
        height: spring.containerHeight,
      }}
    >
      <a.div
        className={css({
          position: "relative",
          width: "100%",
          userSelect: "none",
        })}
        style={{
          height: finalHeight,
          transform: spring.cardtransform,
          willChange: "transform",
        }}
      >
        {match(mode)
          .with("ready", () => children)
          .with("loading", () => (
            <div
              className={css({
                overflow: "hidden",
                position: "absolute",
                inset: 0,
                color: "loadingGradientContent",
                background: "loadingGradient1",
                borderRadius: 8,
              })}
              style={{
                fontSize: 14 * (1 / scaleRatio),
              }}
            >
              <LoadingSurface />
              <div
                className={css({
                  position: "absolute",
                  zIndex: 2,
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                })}
              >
                {children}
              </div>
            </div>
          ))
          .with("error", () => (
            <div
              className={css({
                overflow: "hidden",
                position: "absolute",
                inset: 0,
                color: "negativeSurfaceContentAlt",
                background: "negativeSurface",
                borderRadius: 8,
              })}
              style={{
                fontSize: 14 * (1 / scaleRatio),
              }}
            >
              <div
                className={css({
                  position: "absolute",
                  zIndex: 2,
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                })}
              >
                {children}
              </div>
            </div>
          ))
          .exhaustive()}
      </a.div>
    </a.div>
  );
}
