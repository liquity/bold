"use client";

import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { a, useTransition } from "@react-spring/web";

export function Indicator({
  message,
}: {
  message: ReactNode | null;
}) {
  const indicatorTransition = useTransition(message, {
    keys: (item) => String(item !== null),
    from: {
      opacity: 0,
      transform: "translate3d(0px, 0px, 0px)",
    },
    enter: {
      opacity: 1,
      transform: "translate3d(0px, -64px, 0px)",
    },
    leave: {
      opacity: 0,
      transform: "translate3d(0px, 0px, 0px)",
    },
    config: {
      mass: 1,
      tension: 2200,
      friction: 100,
    },
  });

  return (
    <div
      className={css({
        zIndex: 2,
        position: "fixed",
        inset: {
          base: "auto 16px -64px",
          medium: "auto 16px -64px auto",
        },
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        maxWidth: "calc(100% - 32px)",
        height: 64,
      })}
    >
      {indicatorTransition((style, message) => (
        message && (
          <a.div
            className={css({
              overflow: "hidden",
              minWidth: 0,
              maxWidth: "100%",
              height: 64,
              paddingBottom: 16,
              borderRadius: "8px",
            })}
            style={style}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                height: 48,
                padding: "8px 16px",
                color: "strongSurfaceContent",
                background: "strongSurface",
                borderRadius: 8,
                opacity: 0.9,
              })}
            >
              <div
                className={css({
                  overflow: "hidden",
                  minWidth: 0,
                  maxWidth: "100%",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                })}
              >
                {message}
              </div>
            </div>
          </a.div>
        )
      ))}
    </div>
  );
}
