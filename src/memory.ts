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
  static BANKSIZE = 16_384; // 16 KiB
  static RAMSTART = 0x8000; // TODO this should really be 0xa000

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

    this.bankToAddressToInstruction = this.disassemble();
    this.nrBanks = this.romBanks.length;
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
      const bank = this.romBanks[bankNr];
      bankToAddressToInstruction.set(bankNr, new Map());
      let i = 0;
      while (i < bank.length) {
        const newInstruction = Disassembler.buildInstruction(i, bank);
        const size = newInstruction.size();
        if (size === 0) {
          const s = newInstruction.disassemble(
            new Memory(new Uint8Array(), this.controller)
          );
          throw new Error(`Encountered unimplemented instruction: ${s}`);
        }

        bankToAddressToInstruction.get(bankNr)!.set(i, newInstruction);
        i += size;
      }
    }

    return bankToAddressToInstruction;
  }

  // specify bank to force a bank instead of taking the current one
  getInstruction(address: number, bank?: number): Instruction | undefined {
    if (bank === undefined) {
      bank = this.bank;
    }

    const addressToInstruction = this.bankToAddressToInstruction.get(bank);
    if (!addressToInstruction) {
      throw new Error(`Unknown bank: ${bank}`);
    }
    return addressToInstruction.get(address);
  }

  setBank(bank: number) {
    this.bank = bank;
  }

  getByte(address: number): number {
    if (address >= Memory.RAMSTART) {
      return this.ram[address];
    }

    let byte;
    if (this.bank === -1) {
      byte = this.bootROM[address];
    } else {
      byte = this.romBanks[this.bank][address];
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
    if (address < Memory.RAMSTART) {
      throw new Error(`Can't write to rom @${utils.hexString(address, 16)}`);
    }

    this.ram[address] = value;
    this.controller.updatedStack();
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
