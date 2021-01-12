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
  IME: boolean;

  private _SP: number;
  private _PC: number;

  private _regs: Uint8Array;

  tickCounter: number;

  private _controller: Controller | undefined;

  constructor() {
    this._SP = 0xfffe;
    this.IME = false;
    this._PC = 0;
    // from 0x0 to 0x7
    // B (0x0)          C (0x1)
    // D (0x2)          E (0x3)
    // H (0x4)          L (0x5)
    // F (flags, 0x6)   A (accumulator, 0x7)
    this._regs = new Uint8Array(new Array(8));
    this.tickCounter = 0;
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
    this.controller.updatedSP();
    this._SP = addr;
  }

  getReg(r: number) {
    return this._regs[r];
  }

  setReg(r: number, val: number) {
    utils.assert(val >= 0 && val <= 255, `Setting invalid value ${val} in 8 bit register ${r}`);
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

  setHalfCarryFlagAdd(a: number, b: number) {
    const halfCarryFlag = (a & 0xf) + (b & 0xf) >= 0x10 ? 1 : 0;
    this.setReg(
      CPU.F,
      (this.getReg(CPU.F) & 0b1101_1111) | (halfCarryFlag << 5)
    );
  }

  setHalfCarryFlagSubtract(a: number, b: number) {
    const halfCarryFlag = (b & 0xf) > (a & 0xf) ? 1 : 0;
    this.setReg(
      CPU.F,
      (this.getReg(CPU.F) & 0b1101_1111) | (halfCarryFlag << 5)
    );
  }

  getHalfCarryFlag(): number {
    return (this.getReg(CPU.F) & 0b0010_0000) > 0 ? 1 : 0;
  }

  setCarryFlagDirect(carryFlag: number) {
    this.setReg(CPU.F, (this.getReg(CPU.F) & 0b1110_1111) | (carryFlag << 4));
  }

  setCarryFlagAdd(a: number, b: number) {
    const carryFlag = a + b > 0xff ? 1 : 0;
    this.setCarryFlagDirect(carryFlag);
  }

  setCarryFlagSubtract(a: number, b: number) {
    const carryFlag = b > a ? 1 : 0;
    this.setCarryFlagDirect(carryFlag);
  }

  getCarryFlag(): number {
    return (this.getReg(CPU.F) & 0b0001_0000) > 0 ? 1 : 0;
  }

  rotateLeft(n: number): number {
    const msb = n >> 7;
    n <<= 1;
    n |= this.getCarryFlag();

    this.setCarryFlagDirect(msb);
    this.setHalfCarryFlagAdd(0, 0);
    this.setSubtractFlag(0);
    this.setZeroFlag(0);

    return n;
  }

  rotateRight(n: number): number {
    const lsb = n & 1;
    n >>= 1;
    n |= this.getCarryFlag() << 7;

    this.setCarryFlagDirect(lsb);
    this.setHalfCarryFlagAdd(0, 0);
    this.setSubtractFlag(0);
    this.setZeroFlag(0);

    return n;
  }

  tick(memory: Memory) {
    let currentInstruction = memory.getInstruction(this.PC);
    if (currentInstruction === undefined) {
      // Probably RAM, attempt to JIT
      currentInstruction = Disassembler.buildInstruction(this.PC, memory.ram);
    }

    this.tickCounter++;
    return currentInstruction.execAndIncrementPC(this, memory);
  }
}
