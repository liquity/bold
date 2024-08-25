export function noop() {}

export function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export function capitalizeFirstLetter(string: string) {
  return string[0].toUpperCase() + string.slice(1);
}

export function roundToDecimal(value: number, decimals: number) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}
