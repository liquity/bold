"use client";

import type { RefObject } from "react";

import { useEffect, useState } from "react";

export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
  callback?: (size: ResizeObserverSize) => void,
): {
  size: ResizeObserverSize | null;
  ref: RefObject<T | null>;
} {
  const [size, setSize] = useState<ResizeObserverSize | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const observer = new ResizeObserver(([{ contentBoxSize }]) => {
      const updateFn = callback || setSize;
      const [size] = contentBoxSize;
      if (size) {
        updateFn(size);
      }
    });
    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [callback, ref]);

  return { size, ref };
}

export function useRaf(callback: (time: number) => void, fps = 60) {
  useEffect(() => {
    let rafId: number;
    let lastTime = 0;
    let fpsInterval = 1000 / fps;

    const loop = (time: number) => {
      rafId = requestAnimationFrame(loop);
      const deltaTime = time - lastTime;

      if (deltaTime > fpsInterval) {
        lastTime = time - (deltaTime % fpsInterval);
        callback(time);
      }
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [callback, fps]);
}
