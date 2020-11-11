import * as utils from "./utils.js";
import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Video } from "./video.js";
import { Instruction } from "./instruction.js";
import { Disassembler } from "./disassembler.js";

export class Emulator {
  private instructionMap: Map<number, Instruction>;
  private cpu: CPU;
  private memory: Memory;
  private video: Video;

  // ui related
  private addrToMemoryDiv: Map<number, HTMLDivElement>;
  private memoryPC: HTMLDivElement | undefined;

  // run loop related
  private runBudgetMs: number;

  // debugger related
  paused: boolean;
  breakpoint: number | undefined;

  constructor(bytes: Uint8Array) {
    const instructions = this.disassemble(bytes);
    this.instructionMap = this.addressToInstruction(instructions);
    this.cpu = new CPU(this.instructionMap);
    this.memory = new Memory(bytes);
    this.video = new Video(
      this.memory,
      document.getElementById("video")! as HTMLCanvasElement
    );
    this.paused = false;
    this.addrToMemoryDiv = this.renderMemory();

    this.runBudgetMs = (1 / 60) * 1_000;
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

  private updateMemRegs() {
    let s = `LCDC: ${utils.binString(this.memory.getLCDC())}  `;
    s += `SCY: ${utils.hexString(this.memory.getSCY())}  `;
    s += `SCX: ${utils.hexString(this.memory.getSCX())}  `;
    s += `LY: ${utils.hexString(this.memory.getLY())}  `;
    s += `LYC: ${utils.hexString(this.memory.getLYC())}  `;
    s += `WY: ${utils.hexString(this.memory.getWY())}  `;
    s += `WX: ${utils.hexString(this.memory.getWX())}  `;

    document.getElementById("memRegs")!.innerText = s;
  }

  private updatePrevPCs() {
    let s = this.cpu.prevPCs.map(PC => utils.hexString(PC, 16)).join(" ");
    document.getElementById("prevPCs")!.innerText = "Prev PCs: " + s;
  }

  private createMemoryDiv(addr: number) {
    const byte = this.memory.getByte(addr);
    const newDiv = document.createElement("div");

    if (addr === undefined || byte === undefined) debugger;

    newDiv.innerText = `${utils.hexString(addr, 16)}: ${utils.hexString(byte)}`;

    const instruction = this.instructionMap.get(addr);
    if (instruction) {
      newDiv.innerText += ` ${instruction.disassemble(this.memory)}`;
    }

    return newDiv;
  }

  private renderMemory(): Map<number, HTMLDivElement> {
    const addrToMemoryDiv = new Map();
    const memoryDiv = document.getElementById("memory")!;
    memoryDiv.innerHTML = "";

    for (let addr = 0; addr <= this.memory.loadedBytes; addr++) {
      const addrDiv = this.createMemoryDiv(addr);
      memoryDiv.appendChild(addrDiv);
      addrToMemoryDiv.set(addr, addrDiv);
    }

    return addrToMemoryDiv;
  }

  private updateMemory() {
    let color = "#2e7bff";
    if (this.paused) {
      color = "#ffb22e";
    }

    if (this.memoryPC) {
      this.memoryPC.style.color = "black";
    }

    const memoryDiv = this.addrToMemoryDiv.get(this.cpu.PC);
    if (memoryDiv === undefined) {
      throw new Error(
        `PC (${utils.hexString(this.cpu.PC, 16)}) not aligned with instruction.`
      );
    }

    const instruction = this.instructionMap.get(this.cpu.PC);
    if (instruction === undefined) {
      throw new Error(`PC ${this.cpu.PC} is not in instruction map.`);
    }

    this.memoryPC = memoryDiv;
    this.memoryPC.style.color = color;

    const execColor = Math.max(100, 255 - instruction.executions * 8);
    this.memoryPC.style.backgroundColor = `rgb(${execColor}, 255, ${execColor})`;

    this.memoryPC.scrollIntoView();

    const memoryContainer = document.getElementById("memory")!;
    memoryContainer.scrollTop -= memoryContainer.clientHeight / 2;
  }

  private updateStack() {
    const stackDiv = document.getElementById("stack")!;
    const sp = this.cpu.SP;
    const context = 3;
    stackDiv.innerHTML = "";

    for (
      let addr = Math.max(0, sp - context);
      addr <= Math.min(sp + context, this.memory.getSize() - 1);
      addr++
    ) {
      const memoryDiv = this.createMemoryDiv(addr);
      if (addr === sp) {
        memoryDiv.style.color = "#2e7bff";
      }

      stackDiv.appendChild(memoryDiv);
    }
  }

  private updateUI() {
    this.updateRegs();
    this.updateMemRegs();
    this.updatePrevPCs();
    this.updateMemory();
    this.updateStack();
  }

  private renderVideo() {
    // LCD enable
    if (utils.getBit(this.memory.getLCDC(), 7)) {
      this.video.render();
    }
  }

  run() {
    if (this.breakpoint !== undefined && this.breakpoint === this.cpu.PC) {
      this.paused = true;
    }

    const endMs = performance.now() + this.runBudgetMs;
    let elapsedMs = 0;

    this.updateUI();
    const startMs = performance.now();

    let i = 0;
    while (startMs + elapsedMs < endMs) {
      elapsedMs += utils.tCyclesToMs(this.cpu.tick(this.memory));
      this.video.handleLY(startMs + elapsedMs);
      if (this.cpu.PC === 0x100) {
        console.log("Should load cartridge rom now...");
        this.updateUI();
        return;
      }

      ++i;
    }

    this.renderVideo();

    if (!this.paused) {
      // console.log(`${i} instructions in run, scheduling next one in ${endMs - performance.now()} ms`);
      setTimeout(() => this.run(), endMs - performance.now());
    }
  }
}
