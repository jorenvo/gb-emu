export function hexString(x: number): string {
  let bin = x.toString(16);
  bin = bin.padStart(2, "0");
  return `0x${bin}`;
}

export function formatArrayAsHex(array: Uint8Array): string {
  return array
    .reduce(
      (prev: string, current: number) => prev + current.toString(16) + " ",
      ""
    )
    .trimEnd();
}
