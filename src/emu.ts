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
  private nrBanks: number;

  // ui related
  private controller: Controller;
  private bankToAddrToMemoryDiv: Map<number, Map<number, HTMLDivElement>>; // TODO: this could be an array
  private memoryPC: HTMLDivElement | undefined;
  private bankNrToDiv: Map<number, HTMLDivElement>; // TODO: this can be an array

  // run loop related
  private runBudgetMs: number;

  // debugger related
  paused: boolean;
  breakpoint: number | undefined;

  constructor(bytes: Uint8Array) {
    this.memory = new Memory(bytes);
    const instructions = this.disassemble(this.memory);
    this.instructionMap = this.addressToInstruction(instructions);
    this.cpu = new CPU(this.instructionMap);
    this.video = new Video(
      this.memory,
      document.getElementById("video")! as HTMLCanvasElement
    );

    this.controller = new Controller();

    this.nrBanks = 2 << this.memory.getByte(0x148);
    console.log(`${this.nrBanks} banks`);
    this.bankNrToDiv = new Map();

    this.paused = false;
    this.bankToAddrToMemoryDiv = this.renderMemory();

    this.runBudgetMs = (1 / 60) * 1_000;
  }

  setBreakpoint(addr: number) {
    this.breakpoint = addr;
  }

  private disassemble(memory: Memory): Instruction[] {
    const instructions = [];

    for (let bank = -1; bank < this.memory.nrBanks; ++bank) {
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

  private createMemoryDiv(bank: number, addr: number) {
    this.memory.setBank(bank);

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

  private renderMemory(): Map<number, Map<number, HTMLDivElement>> {
    const bankToAddrToMemoryDiv = new Map();
    const memoryBanks = document.getElementById("memoryBanks")!;
    for (let bank = -1; bank < this.nrBanks; ++bank) {
      // -1 for bootrom
      const bankDiv = document.createElement("div");
      if (bank === -1) {
        bankDiv.id = "bankBOOT";
      } else {
        bankDiv.id = `bank${utils.decString(bank, 4)}`;
      }
      memoryBanks.appendChild(bankDiv);
      this.bankNrToDiv.set(bank, bankDiv);
      bankToAddrToMemoryDiv.set(bank, new Map());

      for (let addr = 0; addr < this.memory.getBankSizeBytes(); ++addr) {
        const addrDiv = this.createMemoryDiv(bank, addr);
        bankDiv.appendChild(addrDiv);
        bankToAddrToMemoryDiv.get(bank).set(addr, bankDiv);
      }
    }

    return bankToAddrToMemoryDiv;
  }

  private updateMemory() {
    // bankNr: number, div: HTMLDivElement) {
    let color = "#2e7bff";
    if (this.paused) {
      color = "#ffb22e";
    }

    if (this.memoryPC) {
      this.memoryPC.style.color = "black";
    }

    const addrToMemoryDiv = this.bankToAddrToMemoryDiv.get(
      this.memory.getActiveBank()
    );
    if (!addrToMemoryDiv) {
      throw new Error(`Unknown memory bank: ${this.memory.getActiveBank()}`);
    }

    const memoryDiv = addrToMemoryDiv.get(this.cpu.PC);
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
      addr <= Math.min(sp + context, 0xffff);
      addr++
    ) {
      const memoryDiv = this.createMemoryDiv(0, addr);
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
