import * as utils from "./utils.js";

/*
 * 0x8000-0x8fff: sprite pattern table
 * 0xfe00-0xfe9f: sprite attribute table aka object attribute memory (OAM)
 */
export class Memory {
  bytes: Uint8Array;

  constructor(rom: Uint8Array) {
    this.bytes = new Uint8Array(0xffff);
    this.bytes.set(rom, 0);

    // hacks
    this.bytes[0xff44] = 0x90; // indicate screen frame is done
  }

  getSize() {
    return this.bytes.length;
  }

  getByte(address: number): number {
    return this.bytes[address];
  }

  setByte(address: number, value: number) {
    switch (address) {
      case 0xff46:
        const sourceStart = value * 0x100;
        utils.log(
          address,
          `starting DMA transfer of ${sourceStart}-${sourceStart + 0x9f}`
        );
    }

    this.bytes[address] = value;
  }

  getSCY() {
    return this.bytes[0xff42];
  }

  getSCX() {
    return this.bytes[0xff43];
  }

  getLY() {
    return this.bytes[0xff44];
  }

  getLYC() {
    return this.bytes[0xff45];
  }

  getWY() {
    return this.bytes[0xff4a];
  }

  getWX() {
    return this.bytes[0xff4b];
  }
}
