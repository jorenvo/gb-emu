import * as utils from "./utils.js";
import { BOOTROM } from "./roms.js";
import { Instruction } from "./instruction.js";
import { Disassembler } from "./disassembler.js";
import { Controller } from "./controller.js";
import ThrottledLogger from "./throttledlogger.js";

enum JoyPadState {
  INACTIVE,
  DIRECTION,
  ACTION,
}

/*
 * 0x8000-0x8fff: sprite pattern table
 * 0x8000-0x97ff: ??? VRAM tile data
 * 0xfe00-0xfe9f: sprite attribute table aka object attribute memory (OAM)
 */
export class Memory {
  // Memory register addresses
  static IO = 0xff00;
  static DIV = 0xff04;
  static TIMA = 0xff05;
  static TMA = 0xff06;
  static TAC = 0xff07;
  static LCDC = 0xff40;
  static STAT = 0xff41;
  static SCY = 0xff42;
  static SCX = 0xff43;
  static LY = 0xff44;
  static LYC = 0xff45;
  static BGP = 0xff47;
  static OBP0 = 0xff48;
  static OBP1 = 0xff49;
  static WY = 0xff4a;
  static WX = 0xff4b;
  static IF = 0xff0f;
  static IE = 0xffff;

  static BANKSIZE = 16_384; // 16 KiB
  static RAMSTART = 0x8000; // TODO this should really be 0xa000
  static WORKRAMSTART = 0xc000;
  static WORKRAMSIZE = 0x1fff; // This is the maximum number of bytes that will be disassembled
  static OAMSTART = 0xfe00;

  static INT_COINCIDENCE_MASK = 0b100;
  static INT_COINCIDENCE_ENABLED_MASK = 0b0100_0000;
  static INT_OAM_MASK = 0b0000_0011;
  static INT_OAM_ENABLED_MASK = 0b0010_0000;

  static DIVIDER_FREQ_HZ = 16_384;
  static DIVIDER_MS = 1_000 / Memory.DIVIDER_FREQ_HZ;

  controller: Controller;
  bank: number; // -1 means bootROM
  ramMode: boolean;
  nrBanks: number;
  bootROM: Uint8Array;
  cartridge: Uint8Array;
  romBanks: Uint8Array[];
  memory: Uint8Array; // TODO this is also switchable I think
  bankToAddressToInstruction: Map<number, Map<number, Instruction>>;

  private ioJoyPadState: JoyPadState;
  private ioKeyB: boolean;
  private ioKeyA: boolean;
  private ioKeyStart: boolean;
  private ioKeySelect: boolean;
  private ioKeyRight: boolean;
  private ioKeyLeft: boolean;
  private ioKeyUp: boolean;
  private ioKeyDown: boolean;

  constructor(rom: Uint8Array, controller: Controller) {
    this.controller = controller;
    this.bank = -1;
    this.ramMode = false;
    this.bootROM = new Uint8Array(BOOTROM);
    this.cartridge = new Uint8Array(rom);
    this.romBanks = this.splitCartridge();

    // RAM starts at 0x7fff: total size - 2 rom banks => 0xffff - (0x4000 * 2)
    // This could be size 0x7fff but then we need to translate addresses (- 0x7fff):
    // 0x7fff => 0x0000
    this.memory = new Uint8Array(0xffff + 1);

    if (rom.length === 0) {
      this.mockNintendoCartLogo();
    }

    this.bankToAddressToInstruction = new Map();
    this.nrBanks = this.romBanks.length;

    this.ioJoyPadState = JoyPadState.INACTIVE;
    this.ioKeyB = false;
    this.ioKeyA = false;
    this.ioKeyStart = false;
    this.ioKeySelect = false;
    this.ioKeyRight = false;
    this.ioKeyLeft = false;
    this.ioKeyUp = false;
    this.ioKeyDown = false;
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

  disassemble() {
    if (this.bankToAddressToInstruction.has(0)) {
      return;
    }

    this.bankToAddressToInstruction.set(-1, new Map());
    let i = 0;
    while (i < this.bootROM.length) {
      const newInstruction = Disassembler.buildInstruction(i, i, this.bootROM);
      const size = newInstruction.size();
      if (size === 0) {
        const s = newInstruction.disassemble(new Memory(new Uint8Array(), this.controller));
        throw new Error(`Encountered unimplemented instruction: ${s}`);
      }

      this.bankToAddressToInstruction.get(-1)!.set(i, newInstruction);
      i += size;
    }

    for (let bankNr = 0; bankNr < this.romBanks.length; ++bankNr) {
      this.bankToAddressToInstruction.set(bankNr, new Map());

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
        const newInstruction = Disassembler.buildInstruction(addr, addr, bank);
        const size = newInstruction.size();
        if (size === 0) {
          const s = newInstruction.disassemble(new Memory(new Uint8Array(), this.controller));
          throw new Error(`Encountered unimplemented instruction: ${s}`);
        }

        this.bankToAddressToInstruction.get(bankNr)!.set(addr, newInstruction);
        addr += size;
      }
    }
  }

  bypassBoot() {
    this.setROMBankLower(1);
  }

  getMapperType() {
    const byteToType = new Map([
      [0x00, "ROM ONLY"],
      [0x01, "MBC1"],
      [0x02, "MBC1+RAM"],
      [0x03, "MBC1+RAM+BATTERY"],
      [0x05, "MBC2"],
      [0x06, "MBC2+BATTERY"],
      [0x08, "ROM+RAM 1"],
      [0x09, "ROM+RAM+BATTERY 1"],
      [0x0b, "MMM01"],
      [0x0c, "MMM01+RAM"],
      [0x0d, "MMM01+RAM+BATTERY"],
      [0x0f, "MBC3+TIMER+BATTERY"],
      [0x10, "MBC3+TIMER+RAM+BATTERY 2"],
      [0x11, "MBC3"],
      [0x12, "MBC3+RAM 2"],
      [0x13, "MBC3+RAM+BATTERY 2"],
      [0x19, "MBC5"],
      [0x1a, "MBC5+RAM"],
      [0x1b, "MBC5+RAM+BATTERY"],
      [0x1c, "MBC5+RUMBLE"],
      [0x1d, "MBC5+RUMBLE+RAM"],
      [0x1e, "MBC5+RUMBLE+RAM+BATTERY"],
      [0x20, "MBC6"],
      [0x22, "MBC7+SENSOR+RUMBLE+RAM+BATTERY"],
      [0xfc, "POCKET CAMERA"],
      [0xfd, "BANDAI TAMA5"],
      [0xfe, "HuC3"],
      [0xff, "HuC1+RAM+BATTERY"],
    ]);

    const byte = this.getByte(0x147);
    const res = byteToType.get(byte);
    if (!res) {
      throw new Error(`Undefined mapper type ${utils.hexString(byte)}`);
    }
    return res;
  }

  clearDisassembledRam() {
    this.bankToAddressToInstruction.set(-2, new Map());
  }

  disassembleRam(startAddress: number) {
    // Clear previous disassembled RAM
    this.clearDisassembledRam();

    let addr = startAddress;
    while (addr < startAddress + Memory.WORKRAMSIZE && addr <= 0xffff) {
      let instruction = Disassembler.buildInstruction(addr, addr, this.memory);
      this.bankToAddressToInstruction.get(-2)!.set(addr, instruction);
      addr += instruction.size();
    }
  }

  inBootMode(): boolean {
    // TODO: this should be moved to emu?
    return this.bank === -1;
  }

  getBankNrBasedOnAddress(address: number): number {
    if (this.inBootMode()) {
      if (address < 0x100) {
        return -1;
      } else {
        return 0;
      }
    } else if (address < Memory.BANKSIZE) {
      return 0;
    } else if (address >= Memory.RAMSTART) {
      return -2;
    } else {
      return this.bank;
    }
  }

  getBankBasedOnNr(bankNr: number): Uint8Array {
    switch (bankNr) {
      case -2:
        return this.memory;
      case -1:
        return this.bootROM;
      default:
        return this.romBanks[bankNr];
    }
  }

  getBankBasedOnAddr(addr: number): Uint8Array {
    return this.getBankBasedOnNr(this.getBankNrBasedOnAddress(addr));
  }

  // This takes into account the offset to read the actual byte in memory, e.g. 0x4000 is this.romBank[0][0].
  getByteOffsetBasedOnAddr(addr: number): number {
    switch (this.getBankNrBasedOnAddress(addr)) {
      case -2: // the ramBank has padding in the beginning at the moment
      case 0:
        return addr;
      default:
        // romBanks > 0
        return addr - Memory.BANKSIZE;
    }
  }

  // specify bank to force a bank instead of taking the current one
  getInstruction(address: number, bank?: number): Instruction | undefined {
    if (bank === undefined) {
      bank = this.getBankNrBasedOnAddress(address);
    }

    const addressToInstruction = this.bankToAddressToInstruction.get(bank);
    if (!addressToInstruction) {
      // Could be RAM which wasn't disassembled
      return undefined;
    }
    return addressToInstruction.get(address);
  }

  setROMBankLower(newLower: number) {
    // Special case for the debugging tools. They sometimes need to switch back and forth between the boot ROM.
    if (newLower === -1) {
      this.bank = -1;
      return;
    }

    newLower = newLower & 0b0001_1111;
    if (newLower === 0) {
      newLower = 1;
    }

    if (newLower > this.romBanks.length - 1) {
      newLower &= Math.ceil(Math.log(this.romBanks.length) / Math.log(2)); // TODO: precompute
    }

    if (this.bank === -1) {
      this.bank = 0;
    }
    this.bank = (this.bank & 0b0110_0000) | newLower;
    this.controller.changedBank(this.bank);
  }

  setROMBankHigher(newHigher: number) {
    if (this.bank === -1) {
      this.bank = 0;
    }
    this.bank = (newHigher & 0b0110_0000) | (this.bank & 0b0001_1111);
    this.controller.changedBank(this.bank);
  }

  getByte(address: number): number {
    if (address === Memory.IO) {
      return this.getIORegister();
    }

    if (address >= Memory.RAMSTART) {
      // TODO: selected RAM bank
      return this.memory[address];
    }

    let byte;
    if (address < 0x100 && this.inBootMode()) {
      byte = this.bootROM[address];
    } else if (address < 0x4000) {
      byte = this.romBanks[0][address];
    } else {
      byte = this.romBanks[this.bank][address - Memory.BANKSIZE];
    }

    if (byte === undefined) {
      throw new Error(`Trying to read byte @${utils.hexString(address, 16)} which is out of range`);
    }

    return byte;
  }

  setByte(address: number, value: number) {
    utils.assert(
      value >= 0 && value <= 255,
      `${value} written to ${utils.hexString(address, 16)} is out of range`,
    );
    utils.assert(value !== undefined, `writing undefined to ${utils.hexString(address, 16)}`);

    if (address === Memory.TIMA) {
      return; // 01-read_timing.gb continually writes 0 to TIMA, I assume it should be ignored.
    }

    if (address === Memory.IO) {
      // Use the inverted value because to select a mode a bit is set to 0.
      const invertedValue = value ^ 0xff;
      const selectDirectionKeys = invertedValue & 0b0001_0000;
      const selectActionKeys = invertedValue & 0b0010_0000;
      if (selectDirectionKeys && selectActionKeys) {
        this.ioJoyPadState = JoyPadState.INACTIVE;
      } else if (selectActionKeys) {
        this.ioJoyPadState = JoyPadState.ACTION;
      } else if (selectDirectionKeys) {
        this.ioJoyPadState = JoyPadState.DIRECTION;
      }
      return;
    }

    if (address === Memory.DIV) {
      this.memory[Memory.DIV] = 0;
      return;
    }

    // DMA transfer
    if (address === 0xff46) {
      const sourceStart = value * 0x100;
      // utils.log(
      //   value,
      //   `starting DMA transfer of ${sourceStart}-${sourceStart + 0x9f} to ${
      //     Memory.OAMSTART
      //   }-${Memory.OAMSTART + 0x9f}`
      // );

      for (let i = 0; i < 0xa0; i++) {
        this.setByte(Memory.OAMSTART + i, this.getByte(sourceStart + i));
      }
      return;
    }

    // ROM bank select (lower 5 bits)
    if (address >= 0x2000 && address <= 0x3fff) {
      this.setROMBankLower(value);
      return;
    }

    // ROM bank higher 2 bits or RAM bank select
    if (address >= 0x4000 && address <= 0x5fff) {
      if (this.ramMode) {
        // this.setRAMBank(value);
        console.warn(`Switching to RAM bank ${utils.hexString(value)} not supported`);
      } else {
        this.setROMBankHigher(value);
      }
      return;
    }

    // ROM/RAM mode select
    if (address >= 0x6000 && address <= 0x7fff) {
      this.ramMode = Boolean(value & 1);
      debugger;
      console.warn(`Changed RAM mode to ${this.ramMode}`);
      return;
    }

    if (address < Memory.RAMSTART) {
      console.debug(`Writing to non-writeable @${utils.hexString(address, 16)}`);
      return;
    }

    if (address >= 0x8000 && address <= 0x97ff) {
      const startOfTile = Math.floor(address / 16) * 16;
      this.controller.updatedTileData(startOfTile);
    } else if (address >= 0x9800 && address <= 0x9fff) {
      this.controller.updatedTileMapPointers();
    } else if (address >= 0xff00 && address <= 0xff70) {
      this.controller.updatedMemReg(address);
      if (address === Memory.LCDC) {
        // This can change how tiles are rendered
        this.controller.updatedAllTileData();
      }
    } else if (
      address >= Memory.WORKRAMSTART &&
      address <= Memory.WORKRAMSTART + Memory.WORKRAMSIZE
    ) {
      // Clear RAM that has been disassembled for debug purposes
      this.clearDisassembledRam();
      // this.controller.updatedWorkRam(); // TODO: this is way too expensive
    }

    // Debug logging
    if (address === Memory.IE) {
      const bitToIntStr = ["vblank", "lcd stat", "timer", "serial", "joypad"];

      let valCopy = value;
      for (const intStr of bitToIntStr) {
        if (valCopy & 1) {
          console.log(`enabling ${intStr} interrupt`);
        }
        valCopy >>= 1;
      }
    }

    this.memory[address] = value;
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

  getBGP() {
    return this.getByte(Memory.BGP);
  }

  getOBP0() {
    return this.getByte(Memory.OBP0);
  }

  getOBP1() {
    return this.getByte(Memory.OBP1);
  }

  incDivider() {
    // Cannot use setByte because when a program writes to DIV it will be reset to 0.
    this.memory[Memory.DIV] = utils.wrapping8BitAdd(this.memory[Memory.DIV], 1);
    this.controller.updatedMemReg(Memory.DIV);
  }

  timerEnabled() {
    return Boolean(this.getByte(Memory.TAC) & 0b100);
  }

  cyclesPerInc() {
    // In Hz
    switch (this.getByte(Memory.TAC) & 0b11) {
      case 0b00:
        return 1_024; // 4_096 Hz
      case 0b01:
        return 16; // 262_144 Hz
      case 0b10:
        return 64; // 65_536 Hz
      default:
        return 256; // 16_384 Hz
    }
  }

  incTimer(): boolean {
    let overflowed = false;
    const tima = this.getByte(Memory.TIMA);

    if (tima === 0xff) {
      overflowed = true;
      this.memory[Memory.TIMA] = this.getByte(Memory.TMA);
    } else {
      this.memory[Memory.TIMA] = tima + 1;
    }

    return overflowed;
  }

  private getIORegister() {
    let io = 0;
    switch (this.ioJoyPadState) {
      case JoyPadState.DIRECTION:
        io =
          (Number(this.ioKeyDown) << 3) |
          (Number(this.ioKeyUp) << 2) |
          (Number(this.ioKeyLeft) << 1) |
          Number(this.ioKeyRight);
        break;
      case JoyPadState.ACTION:
        io =
          (Number(this.ioKeyStart) << 3) |
          (Number(this.ioKeySelect) << 2) |
          (Number(this.ioKeyB) << 1) |
          Number(this.ioKeyA);
        break;
      case JoyPadState.INACTIVE:
        break;
    }

    // Apparently when reading this register the 2 most significant bits are set.
    // TODO: what is the value of bit 4 and 5
    return 0b1100_0000 | (io ^ 0b1111);
  }

  setIOKeyB(down: boolean) {
    this.ioKeyB = down;
  }

  setIOKeyA(down: boolean) {
    this.ioKeyA = down;
  }

  setIOKeyStart(down: boolean) {
    this.ioKeyStart = down;
  }

  setIOKeySelect(down: boolean) {
    this.ioKeySelect = down;
  }

  setIOKeyRight(right: boolean) {
    this.ioKeyRight = right;
  }

  setIOKeyLeft(left: boolean) {
    this.ioKeyLeft = left;
  }

  setIOKeyUp(up: boolean) {
    this.ioKeyUp = up;
  }

  setIOKeyDown(down: boolean) {
    this.ioKeyDown = down;
  }

  // Interrupt function convention
  // interruptFoo         : interrupt occured and the CPU needs to handle it
  // interruptFooClear    : interrupt no longer needs to be handled
  // interruptFooRequested: does interrupt need to be handled by the CPU (initiated with interruptFoo)
  // interruptFooEnabled  : has this interrupt been enabled (if disabled these interrupts occur but are not handled by the CPU)

  // VBlank interrupt
  interruptVBlank() {
    const interruptFlag = this.getByte(Memory.IF);
    this.setByte(Memory.IF, interruptFlag | 1);
  }

  interruptVBlankClear() {
    const interruptFlag = this.getByte(Memory.IF);
    this.setByte(Memory.IF, interruptFlag & 0b1111_1110);
  }

  interruptVBlankRequested() {
    return Boolean(this.getByte(Memory.IF) & 1);
  }

  interruptVBlankEnabled() {
    return Boolean(this.getByte(Memory.IE) & 1);
  }

  // LYC=LY coincidence interrupt
  interruptCoincidence() {
    const stat = this.getByte(Memory.STAT);
    this.setByte(Memory.STAT, stat | Memory.INT_COINCIDENCE_MASK);
  }

  interruptCoincidenceClear() {
    const stat = this.getByte(Memory.STAT);
    this.setByte(Memory.STAT, stat & (Memory.INT_COINCIDENCE_MASK ^ 0xff));
  }

  interruptCoincidenceRequested() {
    return Boolean(this.getByte(Memory.STAT) & Memory.INT_COINCIDENCE_MASK);
  }

  interruptCoincidenceEnabled() {
    return Boolean(this.getByte(Memory.STAT) & Memory.INT_COINCIDENCE_ENABLED_MASK);
  }

  // OAM interrupt
  interruptOAM() {
    let stat = this.getByte(Memory.STAT) & (Memory.INT_OAM_MASK ^ 0xff);
    this.setByte(Memory.STAT, stat | 2);
  }

  interruptOAMClear() {
    const stat = this.getByte(Memory.STAT);
    this.setByte(Memory.STAT, stat & (Memory.INT_OAM_MASK ^ 0xff));
  }

  interruptOAMRequested() {
    return Boolean((this.getByte(Memory.STAT) & Memory.INT_OAM_MASK) === 2);
  }

  interruptOAMEnabled() {
    return Boolean(this.getByte(Memory.STAT) & Memory.INT_OAM_ENABLED_MASK);
  }

  // Timer interrupt
  interruptTimer() {
    const interruptFlag = this.getByte(Memory.IF);
    this.setByte(Memory.IF, interruptFlag | 0b100);
  }

  interruptTimerClear() {
    const interruptFlag = this.getByte(Memory.IF);
    this.setByte(Memory.IF, interruptFlag & 0b1111_1011);
  }

  interruptTimerRequested() {
    const interruptFlag = this.getByte(Memory.IF);
    return Boolean(interruptFlag & 0b100);
  }

  interruptTimerEnabled() {
    const interruptEnabled = this.getByte(Memory.IE);
    return Boolean(interruptEnabled & 0b100);
  }
}
