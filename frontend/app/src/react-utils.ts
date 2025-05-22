import { useCallback, useEffect, useState } from "react";
import { debounce } from "./utils";

export function useDebouncedQueryKey<T extends unknown[]>(
  values: T,
  delay: number,
): T {
  const [debouncedValue, setDebouncedValue] = useState(values);

  const debouncedSet = useCallback(
    debounce(setDebouncedValue, delay),
    [delay],
  );

  debouncedSet(values);

  return debouncedValue;
}

export function useWait(delay: number) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [delay]);

  return ready;
}
