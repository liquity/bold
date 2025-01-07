"use client";

import { sleep } from "@/src/utils";
import { css } from "@/styled-system/css";
import { AnchorButton } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        })}
      >
        <Illustration />
        <div className={css({ height: 60 })} />
        <h1
          className={css({
            fontSize: 28,
            color: "content",
          })}
        >
          Sorry, there’s nothing here
        </h1>
        <div className={css({ height: 12 })} />
        <p
          className={css({
            color: "contentAlt",
          })}
        >
          Let’s get you back on track.
        </p>
        <div className={css({ height: 32 })} />
        <Link
          href="/"
          passHref
          legacyBehavior
        >
          <AnchorButton
            mode="primary"
            label="Go to dashboard"
          />
        </Link>
      </div>
    </div>
  );
}

function Illustration() {
  const spring = useSpring({
    from: {
      leftTriangleTransform: "translate(-208px, 0px)",
      rightTriangleTransform: "translate(208px, 0px)",
      discOpacity: 0,
      discTransform: "translate(0px, 300px) scale(0.5)",
    },
    to: async (next) => {
      await Promise.all([
        next({
          discOpacity: 1,
          discTransform: "translate(0px, 0px) scale(1)",
        }),
        sleep(80).then(() => (
          next({ leftTriangleTransform: "translate(0px, 0px)" })
        )),
        sleep(160).then(() => (
          next({ rightTriangleTransform: "translate(0px, 0px)" })
        )),
      ]);
    },
    delay: 200,
    config: {
      mass: 2,
      tension: 1000,
      friction: 90,
    },
  });

  const size = 208;
  const padding = 24; // top & bottom padding

  const width = size // left triangle
    + 28 // gap
    + size // disc
    - 21 // gap
    + size; // right triangle

  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width,
        height: size,
      })}
    >
      <svg
        width={width}
        height={size + padding * 2}
        viewBox={`0 0 ${width} ${size + padding * 2}`}
      >
        <a.circle
          cx={size + 28 + size / 2}
          cy={padding + size / 2}
          r={size / 2}
          className={css({
            fill: "token(colors.brandDarkBlue)",
            transformOrigin: "50% 50%",
          })}
          style={{
            opacity: spring.discOpacity,
            transform: spring.discTransform,
          }}
        />
        <a.path
          d={`
            M 0 ${padding + size}
            L ${size} ${padding}
            L ${size} ${padding + size}
            Z
          `}
          className={css({
            fill: "token(colors.brandGreen)",
            transformOrigin: "50% 50%",
          })}
          style={{
            transform: spring.leftTriangleTransform,
          }}
        />
        <a.path
          d={`
            M ${width - size} ${padding + size}
            L ${width} ${padding}
            L ${width} ${padding + size}
            Z
          `}
          className={css({
            fill: "token(colors.brandCoral)",
            transformOrigin: "50% 50%",
          })}
          style={{
            transform: spring.rightTriangleTransform,
          }}
        />
      </svg>
    </div>
  );
}
