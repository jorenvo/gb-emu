export class Memory {
  bytes: Uint8Array;

  constructor(rom: Uint8Array) {
    this.bytes = rom;
  }

  getByte(address: number): number {
    return this.bytes[address];
  }

  setByte(address: number, value: number) {
    this.bytes[address] = value;
  }
}
