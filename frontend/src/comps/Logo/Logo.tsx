import type { SpringConfig } from "@react-spring/web";

import { a, useSprings } from "@react-spring/web";
import * as stylex from "@stylexjs/stylex";

const objects: {
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
}[] = [
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

const styles = stylex.create({
  main: {
    display: "flex",
    position: "relative",
    width: 34,
    height: 48,
    overflow: "hidden",
  },
});

export function Logo() {
  const [springs] = useSprings(objects.length, (index) => ({
    config: objects[index].config,
    from: objects[index].from,
    to: objects[index].to,
    delay: objects[index].delay,
  }));

  return (
    <a.div {...stylex.props(styles.main)}>
      {springs.map((spring, index) => {
        return (
          <a.div
            key={index}
            style={{
              position: "absolute",
              top: objects[index].y,
              left: objects[index].x,
              width: objects[index].w,
              height: objects[index].h,
              background: objects[index].color,
              ...spring,
            }}
          />
        );
      })}
    </a.div>
  );
}
