import { useEffect, useState } from "react";

export function useDebounced<T>(value: T, delayMs = 200): [debounced: T, bouncing: boolean] {
  const [{ debounced, bouncing }, set] = useState({ debounced: value, bouncing: false });

  useEffect(() => {
    set((state) => state.bouncing ? state : { ...state, bouncing: true });

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timeoutId = null;
      set({ debounced: value, bouncing: false });
    }, delayMs);

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return [debounced, bouncing];
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
