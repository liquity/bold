"use client";

import type { ReactNode } from "react";

import { a, useSpring } from "@react-spring/web";
import { match } from "ts-pattern";

type IconProps = {
  state: "initial" | "idle" | "active";
};

export const springConfig = {
  mass: 1,
  tension: 800,
  friction: 40,
};

export function AppIcon({
  iconType,
  state,
}: {
  iconType: "borrow" | "leverage" | "earn";
  state: IconProps["state"];
}) {
  return match(iconType)
    .with("borrow", () => <AppIconBorrow state={state} />)
    .with("leverage", () => <AppIconLeverage state={state} />)
    .with("earn", () => <AppIconEarn state={state} />)
    .exhaustive();
}

function AppIconBorrow({ state }: IconProps) {
  const { t1, t2 } = useSpring({
    t1: state === "active"
      ? "translate(36 0) scale(1.1)"
      : "translate(0 0) scale(1)",
    t2: state === "active"
      ? "translate(-36 0) scale(1.1)"
      : "translate(0 0) scale(1)",
    config: springConfig,
  });
  return (
    <IconBase>
      <a.path
        fill="#fff"
        d="
          M 20 48
          A 28 28 0 0 1 0 56
          V 0
          a 28 28 0 0 1 20 48
        "
        transform={t1}
        style={{ transformOrigin: "50% 50%" }}
      />
      <a.path
        fill="#fff"
        d="
          M 28 28
          A 28 28 0 0 1 56 0
          v 56
          a 28 28 0 0 1 -28 -28
        "
        transform={t2}
        style={{ transformOrigin: "50% 50%" }}
      />
    </IconBase>
  );
}

function AppIconLeverage({ state }: IconProps) {
  const { t1, t2 } = useSpring({
    t1: state === "active"
      ? "translate(0 56) scale(0)"
      : "translate(0 36) scale(2)",
    t2: state === "active"
      ? "translate(-6 -6) scale(6.8)"
      : "translate(20 0) scale(3.6)",
    config: springConfig,
  });

  return (
    <IconBase>
      <a.path
        fill="#121B44"
        d="
          M0 0
          h 10
          v 10
          h -10
          z
        "
        transform={t1}
      />
      <a.path
        fill="#121B44"
        d="
          M0 0
          h 10
          v 10
          h -10
          z
        "
        transform={t2}
      />
    </IconBase>
  );
}

function AppIconEarn({ state }: IconProps) {
  const { squareT, squareRadius, circleT } = useSpring({
    squareT: state === "active" ? "scale(1.4)" : "scale(1)",
    squareRadius: state === "active" ? "28" : "0",
    circleT: state === "active" ? "scale(0.8)" : "scale(1)",
    config: springConfig,
  });
  return (
    <IconBase>
      <a.rect
        fill="#fff"
        width="56"
        height="56"
        rx={squareRadius}
        transform={squareT}
        style={{ transformOrigin: "50% 50%" }}
      />
      <a.circle
        fill="#405AE5"
        cx="28"
        cy="28"
        r="16"
        transform={circleT}
        style={{ transformOrigin: "50% 50%" }}
      />
    </IconBase>
  );
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      width="56"
      height="56"
      style={{ overflow: "visible" }}
    >
      {children}
    </svg>
  );
}
