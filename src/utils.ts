export function hexString(x: number, bits = 8): string {
  const negative = x < 0;
  let hex = Math.abs(x).toString(16);
  hex = hex.padStart(bits / 4, "0");

  if (negative) {
    return `-0x${hex}`;
  } else {
    return `0x${hex}`;
  }
}

export function binString(x: number): string {
  let bin = x.toString(2);
  bin = bin.padStart(8, "0");
  return `0b${bin}`;
}

export function decString(x: number, length: number): string {
  return x.toString(10).padStart(length, "0");
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
  console.log(`${hexString(byte)}: ${msg}`);
}

// 0b10101010
//   ^      ^
//  to:7 from:0
export function getBits(byte: number, from: number, to: number): number {
  const length = to - from;
  const mask = (1 << (length + 1)) - 1;
  return (byte >> from) & mask;
}

export function getBit(byte: number, bit: number): number {
  return getBits(byte, bit, bit);
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

function wrappingAdd(a: number, b: number, bits: number): number {
  assert(a >= 0 && a < 1 << bits, `${a} cannot be represented in ${bits} bits`);
  // allow for one extra to handle +- carry.
  assert(
    b >= -1 << bits && b <= 1 << bits,
    `${b} cannot be represented in ${bits} bits`
  );
  return (a + b) & ((1 << bits) - 1);
}

// TODO: turn these into variadic functions?
export function wrapping8BitAdd(a: number, b: number): number {
  return wrappingAdd(a, b, 8);
}

export function wrapping16BitAdd(a: number, b: number): number {
  return wrappingAdd(a, b, 16);
}

const tCyclesPerSecond = 4_194_304;
const tCyclesPerMillisecond = tCyclesPerSecond / 1_000;

export function tCyclesToMs(tCycles: number): number {
  return tCycles / tCyclesPerMillisecond;
}

// TODO: this isn't fully accurate
export function mCyclesToMs(mCycles: number): number {
  return tCyclesToMs(mCycles * 4);
}

export function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`assertion failed: ${msg}`);
  }
}
