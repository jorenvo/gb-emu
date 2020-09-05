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
  PC: number;

  regs: Uint8Array;
  instructions: Map<number, Instruction>;
  prefix: boolean;

  constructor(instructions: Map<number, Instruction>) {
    this.SP = 0xfffe;
    this.PC = 0;
    // from 0x0 to 0x7
    // B (0x0)          C (0x1)
    // D (0x2)          E (0x3)
    // H (0x4)          L (0x5)
    // F (flags, 0x6)   A (accumulator, 0x7)
    this.regs = new Uint8Array(new Array(8));
    this.instructions = instructions;
  }

  getCombinedRegister(r1: number, r2: number): number {
    return (this.regs[r1] << 8) | this.regs[r2];
  }

  setCombinedRegister(r1: number, r2: number, val: number) {
    this.regs[r1] = val >> 8;
    this.regs[r2] = val & 0xff;
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
    return (this.regs[CPU.F] & 0b0111_1111) >> 8;
  }

  setSubtractFlag(subFlag: number) {
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1011_1111) | (subFlag << 6);
  }

  setHalfCarryFlag(a: number, b: number) {
    const halfCarryFlag = (a & 0xf) + (b & 0xf) === 0x10 ? 1 : 0;
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1101_1111) | (halfCarryFlag << 5);
  }

  setCarryFlagDirect(carryFlag: number) {
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1110_1111) | (carryFlag << 4);
  }

  setCarryFlag(a: number, b: number) {
    const carryFlag = a + b > 0xff ? 1 : 0;
    this.setCarryFlagDirect(carryFlag);
  }

  getCarryFlag(): number {
    return (this.regs[CPU.F] & 0b0001_0000) > 0 ? 1 : 0;
  }

  rotateLeft(regValue: number): number {
    const msb = regValue >> 7;
    return (regValue << 1) | msb;
  }

  rotateLeftCarry(carry: number, regValue: number): [number, number] {
    const eightBit = (regValue >> 7) & 1;
    regValue <<= 1;
    regValue &= 0b1111_1110;
    regValue |= carry;

    return [eightBit, regValue];
  }

  tick(memory: Memory) {
    const currentInstruction = this.instructions.get(this.PC);
    if (currentInstruction === undefined) {
      const hexSP = utils.hexString(this.SP, 16);
      console.log(
        `Trying to read outside of memory (SP: ${hexSP}), stopping CPU.`
      );
      return false;
    }

    currentInstruction.exec(this, memory);
    return true;
  }
}
