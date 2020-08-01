export function hexString(x: number, bits = 8): string {
  let hex = x.toString(16);
  hex = hex.padStart(bits / 4, "0");
  return `0x${hex}`;
}

export function binString(x: number): string {
  let bin = x.toString(2);
  bin = bin.padStart(8, "0");
  return `0b${bin}`;
}

export function formatArrayAsHex(array: Uint8Array): string {
  return array
    .reduce(
      (prev: string, current: number) => prev + current.toString(16) + " ",
      ""
    )
    .trimEnd();
}

export function log(byte: number, msg: string) {
  console.log(`${byte}: ${msg}`);
}

// 0b10101010
//   ^      ^
//  to:7 from:0
export function getBits(byte: number, from: number, to: number): number {
  const length = to - from;
  const mask = (1 << (length + 1)) - 1;
  return (byte >> from) & mask;
}

export function twosComplementToNumber(x: number): number {
  const msb = x >> 7;
  if (msb === 1) {
    // don't use ~ because numbers are signed
    return -(x ^ 0xff) - 1;
  } else {
    return x;
  }
}
