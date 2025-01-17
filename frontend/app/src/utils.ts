export function noop() {}

export function debounce<T extends unknown[]>(
  callback: (...args: T) => void,
  wait: number,
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
      timeoutId = null;
    }, wait);
  };
}

export function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export function capitalizeFirstLetter(string: string) {
  return (string[0] ?? "").toUpperCase() + string.slice(1);
}

export function roundToDecimal(value: number, decimals: number) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

export function jsonStringifyWithBigInt(data: unknown) {
  return JSON.stringify(data, (_, value) => (
    typeof value === "bigint" ? String(value) : value
  ));
}
