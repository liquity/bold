"use client";

import type { CSSProperties } from "react";

import { a, useSpring } from "@react-spring/web";
import { css, cx } from "../../styled-system/css";

export function LoadingSurface({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const loadingGradientSpring = useSpring({
    from: { progress: 0 },
    to: { progress: 1 },
    loop: true,
    config: {
      duration: 2_000,
    },
  });

  return (
    <a.div
      className={cx(
        className,
        css({
          position: "absolute",
          inset: 0,
          backgroundColor: "loadingGradient1",
          backgroundImage: `linear-gradient(
            var(--loading-angle),
            token(colors.loadingGradient1) 0%,
            token(colors.loadingGradient2) var(--loading-midpoint1),
            token(colors.loadingGradient2) var(--loading-midpoint2),
            token(colors.loadingGradient1) 100%
          )`,
          willChange: "transform background-image",
        }),
      )}
      style={{
        transform: loadingGradientSpring.progress
          .to([0, 0.5, 1], [0, 1, 0])
          .to((p) => `scale3d(${1 + p}, ${1 + p}, 1)`),
        ...{
          "--loading-angle": loadingGradientSpring.progress.to(
            (p) => `${p * 360 - 45}deg`,
          ),
          "--loading-midpoint1": loadingGradientSpring.progress
            .to([0, 0.5, 1], ["50%", "20%", "50%"]),
          "--loading-midpoint2": loadingGradientSpring.progress
            .to([0, 0.5, 1], ["50%", "80%", "50%"]),
        } as CSSProperties,
        ...style,
      }}
    />
  );
}
