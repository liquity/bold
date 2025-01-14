import { sleep } from "@/src/utils";
import { useTransition } from "@react-spring/web";
import { useState } from "react";

export function useFlashTransition(duration: number = 500) {
  const [show, setShow] = useState(false);
  return {
    flash: () => setShow(true),
    transition: useTransition(show, {
      from: { opacity: 0, transform: "scale(0.9)" },
      enter: () => async (next) => {
        await next({ opacity: 1, transform: "scale(1)" });
        setShow(false);
      },
      leave: () => async (next) => {
        await sleep(duration);
        await next({ opacity: 0, transform: "scale(1)" });
      },
      config: { mass: 1, tension: 2000, friction: 80 },
    }),
  };
}

export function useAppear(show: boolean) {
  return useTransition(show, {
    from: { opacity: 0, transform: "scale(0.9)" },
    enter: { opacity: 1, transform: "scale(1)" },
    leave: { opacity: 0, transform: "scale(1)", immediate: true },
    config: { mass: 1, tension: 2000, friction: 80 },
  });
}
