import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

export function useElementSize<T extends HTMLElement>(ref?: RefObject<T>): {
  size: ResizeObserverSize | null;
  ref: RefObject<T>;
} {
  const [size, setSize] = useState<ResizeObserverSize | null>(null);

  // use the created ref if none gets passed
  const createdRef = useRef<T>(null);
  const ref_ = ref || createdRef;

  useEffect(() => {
    if (!ref_.current) {
      return;
    }

    const observer = new ResizeObserver(([{ contentBoxSize }]) => {
      setSize(contentBoxSize[0] ?? null);
    });
    observer.observe(ref_.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { size, ref: ref_ };
}
