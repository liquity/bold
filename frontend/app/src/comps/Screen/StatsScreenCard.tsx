import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { LoadingSurface } from "@liquity2/uikit";
import { a } from "@react-spring/web";
import { match } from "ts-pattern";

const LOADING_CARD_WIDTH = 968;
const FINAL_CARD_WIDTH = 634;

export function StatsScreenCard({
  children,
  finalHeight = 252,
  mode,
}: {
  children: ReactNode;
  finalHeight?: number;
  mode: "ready" | "loading" | "error";
}) {
  const scaleRatio = LOADING_CARD_WIDTH / FINAL_CARD_WIDTH;

  return (
    <a.div
      className={css({
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
      })}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <a.div
        className={css({
          position: "relative",
          width: "100%",
          userSelect: "none",
        })}
        style={{
          height: "100%",
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

export function StatsTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingBottom: 55,
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
        {title}
      </h1>
      {subtitle && (
        <div
          className={css({
            maxWidth: 540,
            textAlign: "center",
            color: "contentAlt",
          })}
        >
          {subtitle}
        </div>
      )}
    </header>
  );
}
