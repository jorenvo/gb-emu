import * as utils from "./utils.js";
import { Instruction } from "./instruction.js";
import { Memory } from "./memory.js";

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

  SP: number;
  private PCInternal: number;

  regs: Uint8Array;
  instructions: Map<number, Instruction>;

  prevPCs: number[];
  tickCounter: number;

  constructor(instructions: Map<number, Instruction>) {
    this.SP = 0xfffe;
    this.PCInternal = 0;
    // from 0x0 to 0x7
    // B (0x0)          C (0x1)
    // D (0x2)          E (0x3)
    // H (0x4)          L (0x5)
    // F (flags, 0x6)   A (accumulator, 0x7)
    this.regs = new Uint8Array(new Array(8));
    this.instructions = instructions;

    this.prevPCs = [];
    this.tickCounter = 0;
  }

  getCombinedRegister(r1: number, r2: number): number {
    return (this.regs[r1] << 8) | this.regs[r2];
  }

  setCombinedRegister(r1: number, r2: number, val: number) {
    this.regs[r1] = val >> 8;
    this.regs[r2] = val & 0xff;
  }

  set PC(newPC: number) {
    while (this.prevPCs.length > 8) {
      this.prevPCs.shift();
    }

    this.prevPCs.push(this.PCInternal);
    this.PCInternal = newPC;
  }

  get PC() {
    return this.PCInternal;
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
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b0111_1111) | (zeroFlag << 7);
  }

  getZeroFlag(): number {
    return this.regs[CPU.F] >> 7;
  }

  setSubtractFlag(subFlag: number) {
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1011_1111) | (subFlag << 6);
  }

  getSubtractFlag(): number {
    return (this.regs[CPU.F] >> 6) & 1;
  }

  setHalfCarryFlagDirect(halfCarryFlag: number) {
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1101_1111) | (halfCarryFlag << 5);
  }

  setHalfCarryFlagAdd(a: number, b: number) {
    const halfCarryFlag = (a & 0xf) + (b & 0xf) >= 0x10 ? 1 : 0;
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1101_1111) | (halfCarryFlag << 5);
  }

  setHalfCarryFlagSubtract(a: number, b: number) {
    const halfCarryFlag = (b & 0xf) > (a & 0xf) ? 1 : 0;
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1101_1111) | (halfCarryFlag << 5);
  }

  getHalfCarryFlag(): number {
    return (this.regs[CPU.F] & 0b0010_0000) > 0 ? 1 : 0;
  }

  setCarryFlagDirect(carryFlag: number) {
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1110_1111) | (carryFlag << 4);
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
    return (this.regs[CPU.F] & 0b0001_0000) > 0 ? 1 : 0;
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

  tick(memory: Memory) {
    const currentInstruction = this.instructions.get(this.PC);
    if (currentInstruction === undefined) {
      const hexPC = utils.hexString(this.PC, 16);
      throw new Error(
        `Trying to read outside of memory (PC: ${hexPC}), stopping CPU.`
      );
    }

    this.tickCounter++;
    return currentInstruction.execAndIncrementPC(this, memory);
  }
}
