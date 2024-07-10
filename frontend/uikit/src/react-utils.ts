import type { RefObject } from "react";

import { useEffect, useState } from "react";

export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T>,
  callback?: (size: ResizeObserverSize) => void,
): {
  size: ResizeObserverSize | null;
  ref: RefObject<T>;
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
