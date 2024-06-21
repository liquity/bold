import { sleep } from "@/src/utils";
import { css } from "@/styled-system/css";
import { a, useSpring } from "@react-spring/web";
import Image from "next/image";
import preview from "./preview.png";

const IMG_HEIGHT = 200;
const MESSAGE_HEIGHT = 120;
const SPACING_TOP = 48;
const SPACING_BETWEEN = 32;

export function Forecast({ opened }: { opened: boolean }) {
  const springStyles = useSpring({
    from: {
      height: 0,
      opacity: 0,
      transform: "scale(0.8)",
    },
    to: opened
      ? async (next) => {
        await Promise.all([
          next({
            height: IMG_HEIGHT + MESSAGE_HEIGHT + SPACING_BETWEEN + SPACING_TOP,
            transform: "scale(1)",
          }),
          sleep(50).then(() => next({ opacity: 1 })),
        ]);
      }
      : async (next) => {
        await next({
          height: 0,
          opacity: 0,
          transform: "scale(0.8)",
        });
      },
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
  });

  return (
    <a.div
      style={{
        overflow: "hidden",
        ...springStyles,
      }}
    >
      <div
        className={css({
          paddingTop: SPACING_TOP,
          paddingBottom: SPACING_BETWEEN,
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            height: MESSAGE_HEIGHT,
            padding: 24,
            textAlign: "justify",
            background: "secondary",
            fontSize: 16,
            borderRadius: 8,
          })}
        >
          Positions with the lowest interest rates will be redeemed first. In this graph, you can see how large the
          redemptions need to be before your position is affected.
        </div>
      </div>
      <div
        className={css({
          display: "flex",
          alignItems: "flex-start",
        })}
      >
        <Image src={preview} alt="" height={IMG_HEIGHT} />
      </div>
    </a.div>
  );
}
