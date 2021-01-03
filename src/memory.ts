import * as utils from "./utils.js";
import { BOOTROM } from "./roms.js";
import { Instruction } from "./instruction.js";
import { Disassembler } from "./disassembler.js";
import { Controller } from "./controller.js";

/*
 * 0x8000-0x8fff: sprite pattern table
 * 0x8000-0x97ff: ??? VRAM tile data
 * 0xfe00-0xfe9f: sprite attribute table aka object attribute memory (OAM)
 */
export class Memory {
  // Memory register addresses
  static LCDC = 0xff40;
  static SCY = 0xff42;
  static SCX = 0xff43;
  static LY = 0xff44;
  static LYC = 0xff45;
  static WY = 0xff4a;
  static WX = 0xff4b;

  static BANKSIZE = 16_384; // 16 KiB
  static RAMSTART = 0x8000; // TODO this should really be 0xa000
  static WORKRAMSIZE = 0x1fff;

  controller: Controller;
  bank: number; // -1 means bootROM
  nrBanks: number;
  bootROM: Uint8Array;
  cartridge: Uint8Array;
  romBanks: Uint8Array[];
  ram: Uint8Array; // TODO this is also switchable I think
  bankToAddressToInstruction: Map<number, Map<number, Instruction>>;

  constructor(rom: Uint8Array, controller: Controller) {
    this.controller = controller;
    this.bank = -1;
    this.bootROM = new Uint8Array(BOOTROM);
    this.cartridge = new Uint8Array(rom);
    this.romBanks = this.splitCartridge();

    // RAM starts at 0x7fff: total size - 2 rom banks => 0xffff - (0x4000 * 2)
    // This could be size 0x7fff but then we need to translate addresses (- 0x7fff):
    // 0x7fff => 0x0000
    this.ram = new Uint8Array(0xffff + 1);

    if (rom.length === 0) {
      this.mockNintendoCartLogo();
    }

    this.bankToAddressToInstruction = this.disassemble();
    this.nrBanks = this.romBanks.length;
  }

  private mockNintendoCartLogo() {
    // the logo ends at 0x133
    // the bootrom also checks if 0x19 + data in 0x134-0x14d adds up to 0
    const extendedBootROM = new Uint8Array(0x14d + 1);
    extendedBootROM.set(this.bootROM);
    this.bootROM = extendedBootROM;

    this.bootROM[0x104] = 0xce;
    this.bootROM[0x105] = 0xed;
    this.bootROM[0x106] = 0x66;
    this.bootROM[0x107] = 0x66;
    this.bootROM[0x108] = 0xcc;
    this.bootROM[0x109] = 0xd;
    this.bootROM[0x10a] = 0x0;
    this.bootROM[0x10b] = 0xb;
    this.bootROM[0x10c] = 0x3;
    this.bootROM[0x10d] = 0x73;
    this.bootROM[0x10e] = 0x0;
    this.bootROM[0x10f] = 0x83;
    this.bootROM[0x110] = 0x0;
    this.bootROM[0x111] = 0xc;
    this.bootROM[0x112] = 0x0;
    this.bootROM[0x113] = 0xd;
    this.bootROM[0x114] = 0x0;
    this.bootROM[0x115] = 0x8;
    this.bootROM[0x116] = 0x11;
    this.bootROM[0x117] = 0x1f;
    this.bootROM[0x118] = 0x88;
    this.bootROM[0x119] = 0x89;
    this.bootROM[0x11a] = 0x0;
    this.bootROM[0x11b] = 0xe;
    this.bootROM[0x11c] = 0xdc;
    this.bootROM[0x11d] = 0xcc;
    this.bootROM[0x11e] = 0x6e;
    this.bootROM[0x11f] = 0xe6;
    this.bootROM[0x120] = 0xdd;
    this.bootROM[0x121] = 0xdd;
    this.bootROM[0x122] = 0xd9;
    this.bootROM[0x123] = 0x99;
    this.bootROM[0x124] = 0xbb;
    this.bootROM[0x125] = 0xbb;
    this.bootROM[0x126] = 0x67;
    this.bootROM[0x127] = 0x63;
    this.bootROM[0x128] = 0x6e;
    this.bootROM[0x129] = 0xe;
    this.bootROM[0x12a] = 0xec;
    this.bootROM[0x12b] = 0xcc;
    this.bootROM[0x12c] = 0xdd;
    this.bootROM[0x12d] = 0xdc;
    this.bootROM[0x12e] = 0x99;
    this.bootROM[0x12f] = 0x9f;
    this.bootROM[0x130] = 0xbb;
    this.bootROM[0x131] = 0xb9;
    this.bootROM[0x132] = 0x33;
    this.bootROM[0x133] = 0x3e;
  }

  private splitCartridge(): Uint8Array[] {
    const banks = [];
    for (let i = 0; i < this.cartridge.length; i += Memory.BANKSIZE) {
      banks.push(this.cartridge.subarray(i, i + Memory.BANKSIZE));
    }

    return banks;
  }

  private disassemble(): Map<number, Map<number, Instruction>> {
    const bankToAddressToInstruction: Map<
      number,
      Map<number, Instruction>
    > = new Map();

    bankToAddressToInstruction.set(-1, new Map());
    let i = 0;
    while (i < this.bootROM.length) {
      const newInstruction = Disassembler.buildInstruction(i, this.bootROM);
      const size = newInstruction.size();
      if (size === 0) {
        const s = newInstruction.disassemble(
          new Memory(new Uint8Array(), this.controller)
        );
        throw new Error(`Encountered unimplemented instruction: ${s}`);
      }

      bankToAddressToInstruction.get(-1)!.set(i, newInstruction);
      i += size;
    }

    for (let bankNr = 0; bankNr < this.romBanks.length; ++bankNr) {
      bankToAddressToInstruction.set(bankNr, new Map());

      let bank = this.romBanks[bankNr];
      let addr = 0;
      let lastAddr = 0x4000;
      if (bankNr > 0) {
        // all banks > 0 are mapped to 0x4000 - 0x7fff
        addr += 0x4000;
        lastAddr += 0x4000;
        const paddedBank = new Uint8Array(0x8000); // initialized to 0
        paddedBank.set(bank, addr);
        bank = paddedBank;
      }

      while (addr < lastAddr) {
        const newInstruction = Disassembler.buildInstruction(addr, bank);
        const size = newInstruction.size();
        if (size === 0) {
          const s = newInstruction.disassemble(
            new Memory(new Uint8Array(), this.controller)
          );
          throw new Error(`Encountered unimplemented instruction: ${s}`);
        }

        bankToAddressToInstruction.get(bankNr)!.set(addr, newInstruction);
        addr += size;
      }
    }

    return bankToAddressToInstruction;
  }

  disassembleRam(startAddress: number) {
    // Clear previous disassembled RAM
    this.bankToAddressToInstruction.set(-2, new Map());

    let addr = startAddress;
    while(addr < startAddress + Memory.WORKRAMSIZE) {
      let instruction = Disassembler.buildInstruction(addr, this.ram);
      this.bankToAddressToInstruction.get(-2)!.set(addr, instruction);
      addr += instruction.size();
    }
  }

  getBankBasedOnAddress(address: number): number {
    if (this.bank === -1) {
      if (address < 0x100) {
        return -1;
      } else {
        return 0;
      }
    } else if (address < Memory.BANKSIZE) {
      return 0;
    } else {
      return this.bank;
    }
  }

  // specify bank to force a bank instead of taking the current one
  getInstruction(address: number, bank?: number): Instruction | undefined {
    if (bank === undefined) {
      bank = this.getBankBasedOnAddress(address);
    }

    const addressToInstruction = this.bankToAddressToInstruction.get(bank);
    if (!addressToInstruction) {
      throw new Error(`Unknown bank: ${bank}`);
    }
    return addressToInstruction.get(address);
  }

  setBank(bank: number) {
    this.controller.changedBank();
    this.bank = bank;
  }

  getByte(address: number): number {
    if (address >= Memory.RAMSTART) {
      return this.ram[address];
    }

    const bank = this.getBankBasedOnAddress(address);
    if (bank >= 1) {
      address -= Memory.BANKSIZE;
    }

    let byte;
    if (bank === -1) {
      byte = this.bootROM[address];
    } else {
      byte = this.romBanks[bank][address];
    }

    if (byte === undefined) {
      throw new Error(
        `Trying to read byte @${utils.hexString(
          address,
          16
        )} which is out of range`
      );
    }

    return byte;
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

    if (address >= 0x2000 && address <= 0x3fff) {
      this.setBank(value);
      return;
    }

    if (address < Memory.RAMSTART) {
      throw new Error(`Can't write to rom @${utils.hexString(address, 16)}`);
    }

    if (
      (address >= 0x8000 && address <= 0x8fff) ||
      (address >= 0x8800 && address <= 0x97ff)
    ) {
      this.controller.updatedTileData();
    } else if (
      (address >= 0x9800 && address <= 0x9bff) ||
      (address >= 0x9c00 && address <= 0x9fff)
    ) {
      this.controller.updatedTileMapPointers();
    } else if (address >= 0xff00 && address <= 0xff70) {
      this.controller.updatedMemReg(address);
    }

    this.ram[address] = value;
    this.controller.updatedStack();
  }

  getSCY() {
    return this.getByte(Memory.SCY);
  }

  getSCX() {
    return this.getByte(Memory.SCX);
  }

  setLY(x: number) {
    this.setByte(Memory.LY, x);
  }

  getLY() {
    return this.getByte(Memory.LY);
  }

  getLYC() {
    return this.getByte(Memory.LYC);
  }

  getWY() {
    return this.getByte(Memory.WY);
  }

  getWX() {
    return this.getByte(Memory.WX);
  }

  getLCDC() {
    return this.getByte(Memory.LCDC);
  }
}
