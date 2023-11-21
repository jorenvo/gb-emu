import * as utils from "./utils.js";
import { Memory } from "./memory.js";
import { Controller } from "./controller.js";
import { Disassembler } from "./disassembler.js";

export class CPU {
  // reg indexes in regs
  static B = 0;
  static C = 1;
  static D = 2;
  static E = 3;
  static H = 4;
  static L = 5;
  static F = 6;
  static A = 7;

  // Interrupt Master Enable
  private IME: boolean;
  private enableIMETick: number;

  private _SP: number;
  private _PC: number;

  private _regs: Uint8Array;

  private tickCounter: number;
  private dividerCycleCounter: number;
  private timerCycleCounter: number;
  private isHalted: boolean;

  private _controller: Controller | undefined;

  constructor() {
    this._SP = 0xfffe;
    this.IME = false;
    this.enableIMETick = -1;
    this._PC = 0;
    // from 0x0 to 0x7
    // B (0x0)          C (0x1)
    // D (0x2)          E (0x3)
    // H (0x4)          L (0x5)
    // F (flags, 0x6)   A (accumulator, 0x7)
    this._regs = new Uint8Array(new Array(8));
    this.tickCounter = 0;
    this.dividerCycleCounter = 0;
    this.timerCycleCounter = 0;
    this.isHalted = false;
  }

  setController(controller: Controller) {
    this._controller = controller;
  }

  get controller() {
    if (!this._controller) {
      throw new Error("Controller not set");
    }
    return this._controller;
  }

  get SP() {
    return this._SP;
  }

  set SP(addr: number) {
    utils.assert(
      addr >= 0 && addr <= 0xffff,
      `Setting invalid address ${utils.hexString(addr, 16)} in SP`
    );
    this.controller.updatedSP();
    this._SP = addr;
  }

  getReg(r: number) {
    return this._regs[r];
  }

  setReg(r: number, val: number) {
    utils.assert(
      val >= 0 && val <= 0xff,
      `Setting invalid value ${val} in 8 bit register ${r}`
    );
    this._regs[r] = val;
    this.controller.updatedReg(r);
  }

  getCombinedRegister(r1: number, r2: number): number {
    return (this.getReg(r1) << 8) | this.getReg(r2);
  }

  setCombinedRegister(r1: number, r2: number, val: number) {
    this.setReg(r1, val >> 8);
    this.setReg(r2, val & 0xff);
  }

  set PC(newPC: number) {
    this.controller.movedPC(newPC);
    this._PC = newPC;
  }

  get PC() {
    return this._PC;
  }

  halt() {
    this.isHalted = true;
  }

  // Fake 16 bit registers
  getHL() {
    return this.getCombinedRegister(CPU.H, CPU.L);
  }

  setHL(x: number) {
    this.setCombinedRegister(CPU.H, CPU.L, x);
  }

  getAF() {
    return this.getCombinedRegister(CPU.A, CPU.F);
  }

  setAF(x: number) {
    this.setCombinedRegister(CPU.A, CPU.F, x);
  }

  setZeroFlag(zeroFlag: number) {
    this.setReg(CPU.F, (this.getReg(CPU.F) & 0b0111_1111) | (zeroFlag << 7));
  }

  getZeroFlag(): number {
    return this.getReg(CPU.F) >> 7;
  }

  setSubtractFlag(subFlag: number) {
    this.setReg(CPU.F, (this.getReg(CPU.F) & 0b1011_1111) | (subFlag << 6));
  }

  getSubtractFlag(): number {
    return (this.getReg(CPU.F) >> 6) & 1;
  }

  setHalfCarryFlagDirect(halfCarryFlag: number) {
    this.setReg(
      CPU.F,
      (this.getReg(CPU.F) & 0b1101_1111) | (halfCarryFlag << 5)
    );
  }

  setHalfCarryFlag16BitAdd(a: number, b: number) {
    const halfCarryFlag = (a & 0xfff) + (b & 0xfff) >= 0x1000 ? 1 : 0;
    this.setHalfCarryFlagDirect(halfCarryFlag);
  }

  setHalfCarryFlag8BitAdd(...numbers: number[]) {
    const sum = numbers.reduce((prev, curr) => prev + (curr & 0xf), 0);
    this.setHalfCarryFlagDirect(sum >= 0x10 ? 1 : 0);
  }

  setHalfCarryFlagSubtract(...numbers: number[]) {
    const total = numbers.map(n => n & 0xf).reduce((prev, curr) => prev - curr);
    this.setHalfCarryFlagDirect(total < 0 ? 1 : 0);
  }

  setCarryFlagSubtract(...numbers: number[]) {
    const total = numbers
      .map(n => n & 0xff)
      .reduce((prev, curr) => prev - curr);
    this.setCarryFlagDirect(total < 0 ? 1 : 0);
  }

  getHalfCarryFlag(): number {
    return (this.getReg(CPU.F) & 0b0010_0000) > 0 ? 1 : 0;
  }

  setCarryFlagDirect(carryFlag: number) {
    this.setReg(CPU.F, (this.getReg(CPU.F) & 0b1110_1111) | (carryFlag << 4));
  }

  private setCarryFlagAdd(numbers: number[], bits: number) {
    const mask = (1 << bits) - 1;
    const sum = numbers.reduce((prev, curr) => prev + (curr & mask), 0);
    this.setCarryFlagDirect(sum >= 1 << bits ? 1 : 0);
  }

  setCarryFlag8BitAdd(...numbers: number[]) {
    return this.setCarryFlagAdd(numbers, 8);
  }

  setCarryFlag16BitAdd(...numbers: number[]) {
    return this.setCarryFlagAdd(numbers, 16);
  }

  getCarryFlag(): number {
    return (this.getReg(CPU.F) & 0b0001_0000) > 0 ? 1 : 0;
  }

  clearAllFlags() {
    this.setHalfCarryFlagDirect(0);
    this.setSubtractFlag(0);
    this.setZeroFlag(0);
    this.setCarryFlagDirect(0);
  }

  rotateLeft(n: number): number {
    const msb = n >> 7;
    n = (n << 1) & 0xff;
    n |= this.getCarryFlag();

    this.setCarryFlagDirect(msb);
    this.setHalfCarryFlagDirect(0);
    this.setSubtractFlag(0);
    this.setZeroFlag(0);

    return n;
  }

  rotateRight(n: number): number {
    const lsb = n & 1;
    n >>= 1;
    n |= this.getCarryFlag() << 7;

    this.setCarryFlagDirect(lsb);
    this.setHalfCarryFlag8BitAdd(0, 0);
    this.setSubtractFlag(0);
    this.setZeroFlag(0);

    return n;
  }

  enableIME() {
    this.enableIMETick = this.tickCounter + 1;
  }

  disableIME() {
    this.enableIMETick = -1;
    this.IME = false;
  }

  private pushPC(memory: Memory) {
    memory.setByte(--this.SP, this.PC >> 8);
    memory.setByte(--this.SP, this.PC & 0xff);
  }

  private handleInterrupts(memory: Memory) {
    let vblank = false;
    let coincidence = false;
    let oam = false;
    let timer = false;

    if (memory.interruptVBlankRequested() && memory.interruptVBlankEnabled()) {
      vblank = true;
    } else if (
      memory.interruptCoincidenceRequested() &&
      memory.interruptCoincidenceEnabled()
    ) {
      coincidence = true;
    } else if (memory.interruptOAMRequested() && memory.interruptOAMEnabled()) {
      oam = true;
    } else if (
      memory.interruptTimerRequested() &&
      memory.interruptTimerEnabled()
    ) {
      timer = true;
    }
    // TODO: add joypad and serial interrupts

    // TODO: priorities in case multiple interrupts are requested
    if (this.IME) {
      if (vblank) {
        memory.interruptVBlankClear();

        this.pushPC(memory);
        this.PC = 0x40;
      } else if (coincidence) {
        console.log("Executing coincidence interrupt");
        memory.interruptCoincidenceClear();

        this.pushPC(memory);
        this.PC = 0x48;  // TODO: same interrupt address as OAM?
      } else if (oam) {
        console.log("Executing OAM interrupt");
        memory.interruptOAMClear();

        this.pushPC(memory);
        this.PC = 0x48;
      } else if (timer) {
        // console.log("Executing timer interrupt");
        memory.interruptTimerClear();

        this.pushPC(memory);
        this.PC = 0x50;
      }
    }

    if (vblank || coincidence || oam || timer) {
      this.IME = false;
      this.isHalted = false; // wake up from low power state
    }
  }

  private handleDivider(memory: Memory, cycles: number) {
    this.dividerCycleCounter += cycles;

    // DIV increments at 16_384/s, the CPU runs at 4_194_304 cycles/s.
    // (4_194_304 cycles/s) / (16_384/s) = 256 cycles
    if (this.dividerCycleCounter >= 256) {
      memory.incDivider();
      // Cannot set equal to zero because added instruction count cycles
      // won't exactly match 256, keep the remainder to avoid subtle timing
      // issues.
      this.dividerCycleCounter %= 256;
    }
  }

  private handleTimer(memory: Memory, cycles: number) {
    if (!memory.timerEnabled()) {
      return;
    }

    this.timerCycleCounter += cycles;

    const cyclesPerInc = memory.cyclesPerInc();
    if (this.timerCycleCounter >= cyclesPerInc) {
      const overflowed = memory.incTimer();
      if (overflowed) {
        memory.interruptTimer();
      }
      this.timerCycleCounter -= cyclesPerInc;
    }
  }

  tick(memory: Memory) {
    this.handleInterrupts(memory);

    let currentInstruction = memory.getInstruction(this.PC);

    if (currentInstruction === undefined) {
      // Probably RAM, attempt to JIT
      const bankOffset = memory.getByteOffsetBasedOnAddr(this.PC);
      const bank = memory.getBankBasedOnAddr(this.PC); // TODO: maybe this should return a padded bank instead
      currentInstruction = Disassembler.buildInstruction(this.PC, bankOffset, bank);
    }

    this.tickCounter++;

    let cycles;
    if (this.isHalted) {
      cycles = 4;
    } else {
      cycles = currentInstruction.execAndIncrementPC(this, memory);
    }

    this.handleDivider(memory, cycles);
    this.handleTimer(memory, cycles);

    if (this.enableIMETick === this.tickCounter) {
      this.IME = true;
    }

    return cycles;
  }
}
