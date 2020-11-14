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
    this.bootROM = new Uint8Array(0xffff);
    this.bootROM.set(BOOTROM, 0);
    this.cartridge = new Uint8Array(rom);
  }

  private get bytes(): Uint8Array {
    if (this.booting) {
      return this.bootROM;
    } else {
      return this.cartridge;
    }
  }

  switchToCart() {
    this.booting = false;
  }

  getLastCode() {
    if (this.booting) {
      return 0x100;
    } else {
      throw new Error("idk");
    }
  }

  getByte(address: number): number {
    // if (address === 0xff44) {
    //   if (this.bytes[address] === 0)
    //     console.log("Waiting for screen frame...");
    // }
    if (address < 0 || address >= this.bytes.length) {
      throw new Error(`${utils.hexString(address, 16)} is out of memory range (max ${utils.hexString(this.bytes.length, 16)})`);
    }

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
    return this.getByte(0xff42);
  }

  getSCX() {
    return this.getByte(0xff43);
  }

  setLY(x: number) {
    this.setByte(0xff44, x);
  }

  getLY() {
    return this.getByte(0xff44);
  }

  getLYC() {
    return this.getByte(0xff45);
  }

  getWY() {
    return this.getByte(0xff4a);
  }

  getWX() {
    return this.getByte(0xff4b);
  }

  getLCDC() {
    return this.getByte(0xff40);
  }
}
