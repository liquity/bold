"use client";

import type { SpringConfig } from "@react-spring/web";

import { css } from "@/styled-system/css";
import { a, useSprings } from "@react-spring/web";

type Illustration = {
  color: string;
  w: number;
  h: number;
  x: number;
  y: number;
  from: {
    transformOrigin?: string;
    borderRadius?: string;
    transform: string;
  };
  to: {
    transform: string;
  };
  config?: SpringConfig;
  delay?: number;
};

const illustration: Illustration[] = [
  {
    // big rectangle
    color: "#121B44",
    w: 34,
    h: 24,
    x: 0,
    y: 0,
    from: {
      transformOrigin: "50% 100%",
      transform: "scale(0)",
    },
    to: {
      transform: "scale(1)",
    },
    config: {
      mass: 1,
      tension: 800,
      friction: 40,
    },
  },
  {
    // big rectangle
    color: "#F5D93A",
    w: 34,
    h: 24,
    x: 0,
    y: 24,
    from: {
      transformOrigin: "0 0",
      transform: "scale(0)",
    },
    to: {
      transform: "scale(1)",
    },
    config: {
      mass: 1,
      tension: 800,
      friction: 40,
    },
  },
  {
    // small rectangle 1
    color: "#FB7C59",
    w: 10,
    h: 24,
    x: 0,
    y: 0,
    from: {
      transform: "translateX(-10px)",
    },
    to: {
      transform: "translateX(0)",
    },
    config: {
      mass: 1,
      tension: 600,
      friction: 40,
    },
    delay: 200,
  },
  {
    // small rectangle 2
    color: "#405AE5",
    w: 10,
    h: 24,
    x: 0,
    y: 24,
    from: {
      transform: "translateX(-100%)",
    },
    to: {
      transform: "translateX(0)",
    },
    config: {
      mass: 1,
      tension: 500,
      friction: 40,
    },
    delay: 100,
  },
  {
    // circle 1
    color: "#39B457",
    w: 24,
    h: 24,
    x: 10,
    y: 0,
    from: {
      borderRadius: "50%",
      transform: "scale(0)",
    },
    to: {
      transform: "scale(1)",
    },
    config: {
      mass: 1,
      tension: 500,
      friction: 40,
    },
    delay: 150,
  },
  {
    // circle 2
    color: "#121B44",
    w: 24,
    h: 24,
    x: 10,
    y: 24,
    from: {
      borderRadius: "50%",
      transform: "scale(0)",
    },
    to: {
      transform: "scale(1)",
    },
    config: {
      mass: 1,
      tension: 500,
      friction: 40,
    },
    delay: 50,
  },
];

export function Logo() {
  const [springs] = useSprings(illustration.length, (index) => ({
    config: illustration[index].config,
    from: illustration[index].from,
    to: illustration[index].to,
    delay: illustration[index].delay,
  }));
  return (
    <a.div
      className={css({
        display: "flex",
        position: "relative",
        width: 34,
        height: 48,
        overflow: "hidden",
      })}
    >
      {springs.map((spring, index) => (
        <a.div
          key={index}
          style={{
            position: "absolute",
            top: illustration[index].y,
            left: illustration[index].x,
            width: illustration[index].w,
            height: illustration[index].h,
            background: illustration[index].color,
            ...spring,
          }}
        />
      ))}
    </a.div>
  );
}
