import * as utils from "./utils.js";

/*
 * 0x8000-0x8fff: sprite pattern table
 * 0x8000-0x97ff: ??? VRAM tile data
 * 0xfe00-0xfe9f: sprite attribute table aka object attribute memory (OAM)
 */
export class Memory {
  bytes: Uint8Array;
  loadedBytes: number;

  constructor(rom: Uint8Array) {
    this.bytes = new Uint8Array(0xffff);
    this.bytes.set(rom, 0);
    this.loadedBytes = rom.length;

    // fake nintendo logo in cart
    this.bytes[0x104] = 0xce;
    this.bytes[0x105] = 0xed;
    this.bytes[0x106] = 0x66;
    this.bytes[0x107] = 0x66;
    this.bytes[0x108] = 0xcc;
    this.bytes[0x109] = 0xd;
    this.bytes[0x10a] = 0x0;
    this.bytes[0x10b] = 0xb;
    this.bytes[0x10c] = 0x3;
    this.bytes[0x10d] = 0x73;
    this.bytes[0x10e] = 0x0;
    this.bytes[0x10f] = 0x83;
    this.bytes[0x110] = 0x0;
    this.bytes[0x111] = 0xc;
    this.bytes[0x112] = 0x0;
    this.bytes[0x113] = 0xd;
    this.bytes[0x114] = 0x0;
    this.bytes[0x115] = 0x8;
    this.bytes[0x116] = 0x11;
    this.bytes[0x117] = 0x1f;
    this.bytes[0x118] = 0x88;
    this.bytes[0x119] = 0x89;
    this.bytes[0x11a] = 0x0;
    this.bytes[0x11b] = 0xe;
    this.bytes[0x11c] = 0xdc;
    this.bytes[0x11d] = 0xcc;
    this.bytes[0x11e] = 0x6e;
    this.bytes[0x11f] = 0xe6;
    this.bytes[0x120] = 0xdd;
    this.bytes[0x121] = 0xdd;
    this.bytes[0x122] = 0xd9;
    this.bytes[0x123] = 0x99;
    this.bytes[0x124] = 0xbb;
    this.bytes[0x125] = 0xbb;
    this.bytes[0x126] = 0x67;
    this.bytes[0x127] = 0x63;
    this.bytes[0x128] = 0x6e;
    this.bytes[0x129] = 0xe;
    this.bytes[0x12a] = 0xec;
    this.bytes[0x12b] = 0xcc;
    this.bytes[0x12c] = 0xdd;
    this.bytes[0x12d] = 0xdc;
    this.bytes[0x12e] = 0x99;
    this.bytes[0x12f] = 0x9f;
    this.bytes[0x130] = 0xbb;
    this.bytes[0x131] = 0xb9;
    this.bytes[0x132] = 0x33;
    this.bytes[0x133] = 0x3e;
  }

  getSize() {
    return this.bytes.length;
  }

  getByte(address: number): number {
    // if (address === 0xff44) {
    //   if (this.bytes[address] === 0)
    //     console.log("Waiting for screen frame...");
    // }

    return this.bytes[address];
  }

  setByte(address: number, value: number) {
    switch (address) {
      case 0xff46:
        const sourceStart = value * 0x100;
        utils.log(
          value,
          `starting DMA transfer of ${sourceStart}-${sourceStart + 0x9f}`
        );
    }

    if (value === undefined) debugger;

    this.bytes[address] = value;
  }

  getSCY() {
    return this.bytes[0xff42];
  }

  getSCX() {
    return this.bytes[0xff43];
  }

  setLY(x: number) {
    this.bytes[0xff44] = x;
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

  getLCDC() {
    return this.bytes[0xff40];
  }
}
