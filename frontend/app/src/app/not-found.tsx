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
      diskOpacity: 0,
      diskTransform: "scale(0.5)",
      barOpacity: 0,
      barTransform: `
        rotate(-20deg)
        scale(0)
      `,
    },
    to: async (next) => {
      await Promise.all([
        next({
          diskOpacity: 1,
          diskTransform: "scale(1)",
        }),
        sleep(200).then(() =>
          next({
            barOpacity: 1,
            barTransform: `
              rotate(0deg)
              scale(1)
            `,
          })
        ),
      ]);
    },
    delay: 200,
    config: {
      mass: 2,
      tension: 1200,
      friction: 60,
    },
  });
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: 362,
        height: 208,
      })}
    >
      <a.div
        className={css({
          width: 208,
          height: 208,
          background: "#FB7C59",
          borderRadius: "50%",
        })}
        style={{
          opacity: spring.diskOpacity,
          transform: spring.diskTransform,
        }}
      />
      <a.div
        className={css({
          position: "absolute",
          width: 362,
          height: 24,
          background: "#121B44",
          transformOrigin: "50% 50%",
        })}
        style={{
          opacity: spring.barOpacity,
          transform: spring.barTransform,
        }}
      />
    </div>
  );
}
