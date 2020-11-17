import * as utils from "./utils.js";
import { BOOTROM } from "./roms.js";
import { Instruction } from "./instruction.js";
import { Disassembler } from "./disassembler.js";

/*
 * 0x8000-0x8fff: sprite pattern table
 * 0x8000-0x97ff: ??? VRAM tile data
 * 0xfe00-0xfe9f: sprite attribute table aka object attribute memory (OAM)
 */
export class Memory {
  static BANKSIZE = 16_384; // 16 KiB

  bank: number; // -1 means bootROM
  nrBanks: number;
  bootROM: Uint8Array;
  cartridge: Uint8Array;
  romBanks: Uint8Array[];
  bankToAddressToInstruction: Map<number, Map<number, Instruction>>;

  constructor(rom: Uint8Array) {
    this.bank = -1;
    this.bootROM = new Uint8Array(BOOTROM);
    this.cartridge = new Uint8Array(rom);
    this.romBanks = this.splitCartridge();
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
        const s = newInstruction.disassemble(new Memory(new Uint8Array()));
        throw new Error(`Encountered unimplemented instruction: ${s}`);
      }

      i += size;
      bankToAddressToInstruction.get(-1)!.set(i, newInstruction);
    }

    for (let bankNr = 0; bankNr < this.romBanks.length; ++bankNr) {
      const bank = this.romBanks[bankNr];
      bankToAddressToInstruction.set(bankNr, new Map());
      let i = 0;
      while (i < bank.length) {
        const newInstruction = Disassembler.buildInstruction(i, bank);
        const size = newInstruction.size();
        if (size === 0) {
          const s = newInstruction.disassemble(new Memory(new Uint8Array()));
          throw new Error(`Encountered unimplemented instruction: ${s}`);
        }

        i += size;
        bankToAddressToInstruction.get(bankNr)!.set(i, newInstruction);
      }
    }

    return bankToAddressToInstruction;
  }

  private get bytes(): Uint8Array {
    if (this.bank === -1) {
      console.log("Getting bootrom");
      return this.bootROM;
    } else {
      return this.cartridge;
    }
  }

  // specify bank to force a bank instead of taking the current one
  getInstruction(address: number, bank?: number): Instruction {
    const addressToInstruction = this.bankToAddressToInstruction.get(
      bank || this.bank
    );
    if (!addressToInstruction) {
      throw new Error(`Unknown bank: ${bank || this.bank}`);
    }

    const instruction = addressToInstruction.get(address);
    if (!instruction) {
      throw new Error(`Unknown address: ${address}`);
    }

    return instruction;
  }

  getActiveBank() {
    return this.bank;
  }

  setBank(bank: number) {
    this.bank = bank;
  }

  getByte(address: number): number {
    // if (address === 0xff44) {
    //   if (this.bytes[address] === 0)
    //     console.log("Waiting for screen frame...");
    // }
    if (address < 0 || address >= this.bytes.length) {
      throw new Error(
        `${utils.hexString(
          address,
          16
        )} is out of memory range (max ${utils.hexString(
          this.bytes.length,
          16
        )})`
      );
    }

    // Each bank is 16 KiB, 2 banks can be addressed without an
    // MBC (half of the 16 bit address space is for the cartridge).
    let offset = 0;
    if (this.bank >= 0) {
      offset = (this.bank >> 1) * Math.pow(2, 16);
    }

    return this.bytes[offset + address];
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
