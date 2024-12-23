import type { ReactNode } from "react";

import { a, useSpring } from "@react-spring/web";
import { match } from "ts-pattern";

type IconProps = {
  background: string;
  foreground: string;
  state: "initial" | "idle" | "active";
};

export const springConfig = {
  mass: 1,
  tension: 800,
  friction: 40,
};

export function ActionIcon({
  colors,
  iconType,
  state,
}: {
  colors: {
    background: string;
    foreground: string;
  };
  iconType: "borrow" | "multiply" | "earn" | "stake";
  state: IconProps["state"];
}) {
  const Icon = match(iconType)
    .with("borrow", () => ActionIconBorrow)
    .with("multiply", () => ActionIconLeverage)
    .with("earn", () => ActionIconEarn)
    .with("stake", () => ActionIconStake)
    .exhaustive();

  return (
    <Icon
      background={colors.background}
      foreground={colors.foreground}
      state={state}
    />
  );
}

function ActionIconBorrow({ foreground, state }: IconProps) {
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
        fill={foreground}
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
        fill={foreground}
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

function ActionIconLeverage({ foreground, state }: IconProps) {
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
        fill={foreground}
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
        fill={foreground}
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

function ActionIconEarn({ foreground, background, state }: IconProps) {
  const { squareT, squareRadius, circleT } = useSpring({
    squareT: state === "active" ? "scale(1.4)" : "scale(1)",
    squareRadius: state === "active" ? "28" : "0",
    circleT: state === "active" ? "scale(0.8)" : "scale(1)",
    config: springConfig,
  });
  return (
    <IconBase>
      <a.rect
        fill={foreground}
        width="56"
        height="56"
        rx={squareRadius}
        transform={squareT}
        style={{ transformOrigin: "50% 50%" }}
      />
      <a.circle
        fill={background}
        cx="28"
        cy="28"
        r="16"
        transform={circleT}
        style={{ transformOrigin: "50% 50%" }}
      />
    </IconBase>
  );
}

export function ActionIconStake({ foreground, state }: IconProps) {
  const active = state === "active";

  // style transform
  const tr = (x: number, y: number, w: number = 1, h: number = 1) => `
    translate(${x * 56 / 3}px, ${y * 56 / 3}px)
    scale(${w}, ${h})
  `;

  const { sq1, sq2, sq3, sq4 } = useSpring({
    sq1: active ? tr(2, 0, 1, 3) : tr(1, 0),
    sq2: active ? tr(0, 0, 3, 1) : tr(2, 1),
    sq3: active ? tr(0, 0, 1, 3) : tr(1, 2),
    sq4: active ? tr(0, 2, 3, 1) : tr(0, 1),
    config: springConfig,
  });

  // square
  // const { sq1, sq2, sq3, sq4 } = useSpring({
  //   sq1: active ? tr(0, 0) : tr(1, 0),
  //   sq2: active ? tr(2, 0) : tr(2, 1),
  //   sq3: active ? tr(2, 2) : tr(1, 2),
  //   sq4: active ? tr(0, 2) : tr(0, 1),
  //   config: springConfig,
  // });

  // arrow compact
  // const { sq1, sq2, sq3, sq4 } = useSpring({
  //   sq1: active ? pos(0.5, 0.5) : pos(1, 0),
  //   sq2: active ? pos(1.5, 0.5) : pos(2, 1),
  //   sq3: active ? pos(1.5, 1.5) : pos(1, 2),
  //   sq4: active ? pos(0, 2) : pos(0, 1),
  //   config: springConfig,
  // });

  // arrow wide
  // const { sq1, sq2, sq3, sq4 } = useSpring({
  //   sq1: active ? tr(1, 0, 1) : tr(1, 0, 1),
  //   sq2: active ? tr(2, 0, 1) : tr(2, 1, 1),
  //   sq3: active ? tr(2, 1, 1) : tr(1, 2, 1),
  //   sq4: active ? tr(0, 2, 1) : tr(0, 1, 1),
  //   config: springConfig,
  // });

  return (
    <IconBase>
      {[sq1, sq2, sq3, sq4].map((transform, index) => (
        <a.rect
          key={index}
          fill={foreground}
          width={56 / 3}
          height={56 / 3}
          style={{
            transform,
            transformOrigin: "0 0",
          }}
        />
      ))}
    </IconBase>
  );
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 56 56"
      style={{ overflow: "visible" }}
    >
      {children}
    </svg>
  );
}
