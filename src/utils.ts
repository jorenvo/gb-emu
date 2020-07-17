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
