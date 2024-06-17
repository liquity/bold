import { sleep } from "@/src/utils";
import { css } from "@/styled-system/css";
import { a, useSpring } from "@react-spring/web";
import Image from "next/image";
import preview from "./preview.png";

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
            height: 248,
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
          display: "flex",
          alignItems: "flex-start",
          height: 248,
          paddingTop: 48,
        })}
      >
        <Image src={preview} alt="" />
      </div>
    </a.div>
  );
}
