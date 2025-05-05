"use client";

import { LinkButton } from "@/src/comps/LinkButton/LinkButton";
import { sleep } from "@/src/utils";
import { css } from "@/styled-system/css";
import { a, useSpring } from "@react-spring/web";

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
        <LinkButton
          href="/"
          label="Go to dashboard"
          mode="primary"
        />
      </div>
    </div>
  );
}

const ILLUSTRATION_SIZE = 208; // width & height
const ILLUSTRATION_PADDING = 24; // top & bottom padding

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

  const width = ILLUSTRATION_SIZE // left triangle
    + 28 // gap
    + ILLUSTRATION_SIZE // disc
    - 21 // gap
    + ILLUSTRATION_SIZE; // right triangle

  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width,
        height: ILLUSTRATION_SIZE,
      })}
    >
      <svg
        width={width}
        height={ILLUSTRATION_SIZE + ILLUSTRATION_PADDING * 2}
        viewBox={`0 0 ${width} ${ILLUSTRATION_SIZE + ILLUSTRATION_PADDING * 2}`}
      >
        <a.circle
          cx={ILLUSTRATION_SIZE + 28 + ILLUSTRATION_SIZE / 2}
          cy={ILLUSTRATION_PADDING + ILLUSTRATION_SIZE / 2}
          r={ILLUSTRATION_SIZE / 2}
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
            M 0 ${ILLUSTRATION_PADDING + ILLUSTRATION_SIZE}
            L ${ILLUSTRATION_SIZE} ${ILLUSTRATION_PADDING}
            L ${ILLUSTRATION_SIZE} ${ILLUSTRATION_PADDING + ILLUSTRATION_SIZE}
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
            M ${width - ILLUSTRATION_SIZE} ${ILLUSTRATION_PADDING + ILLUSTRATION_SIZE}
            L ${width} ${ILLUSTRATION_PADDING}
            L ${width} ${ILLUSTRATION_PADDING + ILLUSTRATION_SIZE}
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
