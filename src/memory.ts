import * as utils from "./utils.js";
import { BOOTROM } from "./roms.js";

/*
 * 0x8000-0x8fff: sprite pattern table
 * 0x8000-0x97ff: ??? VRAM tile data
 * 0xfe00-0xfe9f: sprite attribute table aka object attribute memory (OAM)
 */
export class Memory {
  booting: boolean;
  bootROM: Uint8Array;
  cartridge: Uint8Array;

  constructor(rom: Uint8Array) {
    this.booting = true;
    this.bootROM = new Uint8Array(BOOTROM);
    this.cartridge = new Uint8Array(rom);
  }

  get bytes(): Uint8Array {
    if (this.booting) {
      return this.bootROM;
    } else {
      return this.cartridge;
    }
  }

  switchToCart() {
    this.booting = false;
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
