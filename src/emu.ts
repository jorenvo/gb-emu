import * as utils from "./utils.js";
import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Instruction } from "./instruction.js";
import { Disassembler } from "./disassembler.js";

export class Emulator {
  private instructionMap: Map<number, Instruction>;
  private cpu: CPU;
  private memory: Memory;

  // debugger related
  private paused: boolean;
  private breakpoint: number | undefined;

  constructor(bytes: Uint8Array) {
    const instructions = this.disassemble(bytes);
    this.instructionMap = this.addressToInstruction(instructions);
    this.cpu = new CPU(this.instructionMap);
    this.memory = new Memory(bytes);
    this.paused = false;
  }

  setBreakpoint(addr: number) {
    this.breakpoint = addr;
  }

  private disassemble(bytes: Uint8Array): Instruction[] {
    const instructions = [];
    let i = 0;

    while (i < bytes.length) {
      const newInstruction = Disassembler.buildInstruction(i, bytes);
      const size = newInstruction.size();
      if (size === 0) {
        throw new Error(
          `Encountered unimplemented instruction: ${newInstruction.disassemble(
            new Memory(new Uint8Array())
          )}`
        );
      }

      i += size;
      instructions.push(newInstruction);
    }

    return instructions;
  }

  private addressToInstruction(
    instructions: Instruction[]
  ): Map<number, Instruction> {
    let res = new Map();

    for (let instruction of instructions) {
      res.set(instruction.getAddress(), instruction);
    }

    return res;
  }

  private updateRegs() {
    let s = `PC: ${utils.hexString(this.cpu.PC, 16)}  `;
    s += `SP: ${utils.hexString(this.cpu.SP, 16)}  `;

    s += `B: ${utils.hexString(this.cpu.regs[CPU.B])}  `;
    s += `C: ${utils.hexString(this.cpu.regs[CPU.C])}  `;
    s += `D: ${utils.hexString(this.cpu.regs[CPU.D])}  `;
    s += `E: ${utils.hexString(this.cpu.regs[CPU.E])}  `;
    s += `H: ${utils.hexString(this.cpu.regs[CPU.H])}  `;
    s += `L: ${utils.hexString(this.cpu.regs[CPU.L])}  `;
    s += `F: ${utils.hexString(this.cpu.regs[CPU.F])}  `;
    s += `A: ${utils.hexString(this.cpu.regs[CPU.A])}  `;

    document.getElementById("regs")!.innerText = s;
  }

  private createMemoryDiv(addr: number) {
    const byte = this.memory.getByte(addr);
    const newDiv = document.createElement("div");

    if (addr === undefined || byte === undefined) debugger;

    newDiv.innerText = `${utils.hexString(addr)}: ${utils.hexString(
      byte
    )} ${utils.binString(byte)}`;

    const instruction = this.instructionMap.get(addr);
    if (instruction) {
      newDiv.innerText += ` ${instruction.disassemble(this.memory)}`;
    }

    return newDiv;
  }

  private updateMemory() {
    const PC = this.cpu.PC;
    const contextInstructions = 8;
    const memoryDiv = document.getElementById("memory")!;
    memoryDiv.innerHTML = "";

    const bytesBefore = Math.min(contextInstructions, PC);
    for (let addr = PC - bytesBefore; addr <= PC - 1; addr++) {
      memoryDiv.appendChild(this.createMemoryDiv(addr));
    }

    const currentMemory = this.createMemoryDiv(PC);

    if (this.paused) {
      currentMemory.style.color = "#ffb22e";
    } else {
      currentMemory.style.color = "#2e7bff";
    }

    memoryDiv.appendChild(currentMemory);

    const bytesAfter = Math.min(
      contextInstructions,
      this.memory.bytes.length - 1 - PC
    );
    for (let addr = PC + 1; addr <= PC + bytesAfter; addr++) {
      memoryDiv.appendChild(this.createMemoryDiv(addr));
    }
  }

  private updateStack() {
    const stackDiv = document.getElementById("stack")!;
    const sp = this.cpu.SP;
    const context = 2;
    stackDiv.innerHTML = "";

    for (
      let addr = Math.max(0, sp - context);
      addr <= Math.min(sp + context, this.memory.getSize() - 1);
      addr++
    ) {
      stackDiv.appendChild(this.createMemoryDiv(addr));
    }
  }

  private updateUI() {
    this.updateRegs();
    this.updateMemory();
    this.updateStack();
  }

  run() {
    console.log("main loop");
    if (this.breakpoint !== undefined && this.breakpoint === this.cpu.PC) {
      this.paused = true;
    }

    this.updateUI();

    if (!this.cpu.tick(this.memory)) return;
    if (this.cpu.PC === 0x100) console.log("Should load cartridge rom now");

    if (!this.paused) {
      window.setTimeout(() => this.run(), 100);
    }
  }
}
