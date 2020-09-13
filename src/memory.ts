export class Memory {
  bytes: Uint8Array;

  constructor(rom: Uint8Array) {
    this.bytes = new Uint8Array(0xffff);
    this.bytes.set(rom, 0);
  }

  getSize() {
    return this.bytes.length;
  }

  getByte(address: number): number {
    return this.bytes[address];
  }

  setByte(address: number, value: number) {
    this.bytes[address] = value;
  }
}
