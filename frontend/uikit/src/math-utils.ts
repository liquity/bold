export function lerp(start: number, stop: number, value: number) {
  return ((stop - start) * value) + start;
}

export function map(value: number, istart: number, istop: number, ostart: number, ostop: number) {
  return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
}

export function norm(value: number, start: number, stop: number) {
  return (value - start) / (stop - start);
}
