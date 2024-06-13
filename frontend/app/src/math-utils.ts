export function lerp(value1: number, value2: number, amt: number) {
  return ((value2 - value1) * amt) + value1;
}

export function map(value: number, istart: number, istop: number, ostart: number, ostop: number) {
  return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
}

export function norm(aNumber: number, low: number, high: number) {
  return (aNumber - low) / (high - low);
}
