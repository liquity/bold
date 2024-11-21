import { useEffect, useState } from "react";

// this hook can be used to debounce React Query key changes
export function useDebouncedQueryKey<T extends Array<unknown>>(values: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(values);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(values);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [...values, delay]);
  return debouncedValue;
}
