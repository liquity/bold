"use client";

import { ErrorBox } from "@/src/comps/ErrorBox/ErrorBox";
import { sleep } from "@/src/utils";
import { css } from "@/styled-system/css";
import { AnchorButton, Button } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          width: "100%",
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
          An unexpected error occurred
        </h1>
        <div className={css({ height: 32 })} />
        <div
          className={css({
            display: "flex",
            gap: 16,
          })}
        >
          <Link
            href="/"
            passHref
            legacyBehavior
          >
            <AnchorButton
              mode="secondary"
              label="Go to dashboard"
            />
          </Link>
          <Button
            mode="primary"
            label="Reset state"
            onClick={reset}
          />
        </div>
        <div className={css({ height: 40 })} />
        <div
          className={css({
            display: "flex",
            maxWidth: 600,
          })}
        >
          <ErrorBox title={`Error: ${error.message}`}>
            <pre>
{error.message}<br /><br />
{error.stack}
            </pre>
          </ErrorBox>
        </div>
      </div>
    </div>
  );
}

function Illustration() {
  const spring = useSpring({
    from: {
      discOpacity: 0,
      discTransform: "scale(0.5)",
      barOpacity: 0,
      barTransform: `
        rotate(-20deg)
        scale(0)
      `,
    },
    to: async (next) => {
      await Promise.all([
        next({
          discOpacity: 1,
          discTransform: "scale(1)",
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
          opacity: spring.discOpacity,
          transform: spring.discTransform,
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
