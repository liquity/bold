import { useCallback, useState } from "react";
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
