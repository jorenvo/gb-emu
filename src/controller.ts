import * as utils from "./utils.js";
import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Loader } from "./loader.js";
import { Emulator } from "./emu.js";
import { Instruction } from "./instruction.js";
import {
  View,
  RegisterView,
  SPView,
  PCView,
  BankView,
  MemoryView,
  StackView,
  ExecutionThreadView,
  PauseButton,
  RunBootRomButton,
  StepNextButton,
  CopyButton,
  BreakpointSetter,
} from "./views.js";

declare global {
  interface Window {
    controller: Controller;
  }
}

export abstract class Controller {
  public abstract runBootRom(): void;
  public abstract togglePause(): void;
  public abstract stepNext(): void;
  public abstract setBreakpoint(address: number): void;
  public abstract setBreakpointBank(bank: number): void;
  public abstract updatedReg(reg: number): void;
  public abstract updatedSP(): void;
  public abstract updatedStack(): void;
  public abstract viewAddress(address: number, bank: number): void;
  public abstract viewAddressInCurrentBank(address: number): void;
  public abstract getActiveBankView(): BankView | undefined;
  public abstract movedPC(newAddr: number): void;
  public abstract changedBank(): void;
  public abstract getRecentInstructions(): Instruction[];
}

export class ControllerMock {
  public runBootRom(): void {}
  public togglePause(): void {}
  public stepNext(): void {}
  public setBreakpoint(_address: number): void {}
  public setBreakpointBank(_bank: number): void {}
  public updatedReg(_reg: number): void {}
  public updatedSP(): void {}
  public updatedStack(): void {}
  public viewAddress(_address: number, _bank: number): void {}
  public viewAddressInCurrentBank(_address: number): void {}
  public getActiveBankView(): BankView | undefined {
    return undefined;
  }
  public movedPC(_newAddr: number): void {}
  public changedBank(): void {}
  public getRecentInstructions(): Instruction[] {
    return [];
  }
}

export class ControllerReal implements Controller {
  static MAX_RECENT_INSTRUCTIONS = 128;

  // loader
  private loader: Loader;

  // model
  private emu: Emulator | undefined;
  private recentInstructions: Instruction[];

  // This remembers how many of each Instruction are in
  // recentInstruction. When pushing/shifting this list is updated and
  // we mark an instruction as not recently executed when it no longer
  // appears in the list.
  private recentInstructionsCounter: Map<Instruction, number>;

  // views
  private registerViews: Map<number, RegisterView> | undefined;
  private bankViews: Map<number, BankView> | undefined;
  private memoryViews: Map<number, MemoryView> | undefined;
  private instructionToMemoryView: Map<Instruction, MemoryView> | undefined;
  private SPView: SPView | undefined;
  private PCView: PCView | undefined;
  private stackView: StackView | undefined;
  private executionThreadView: ExecutionThreadView | undefined;
  private prevPCMemoryView: MemoryView | undefined;

  // buttons
  private pauseButton: PauseButton;
  private bootRomButton: RunBootRomButton;
  private stepNextButton: StepNextButton;
  private copyButton: CopyButton;

  // input
  private breakpointSetter: BreakpointSetter;

  // necessary in case emu is not yet running
  private breakpoint: number | undefined;
  private breakpointBank: number | undefined;

  private toUpdate: Set<View>;
  private nextUpdate: number | undefined;

  constructor() {
    this.loader = new Loader();
    this.loader.readFile.then((rom) => this.boot(new Uint8Array(rom)));
    this.toUpdate = new Set();
    this.recentInstructions = [];
    this.recentInstructionsCounter = new Map();

    this.pauseButton = new PauseButton("pause", this);
    this.stepNextButton = new StepNextButton("next", this);
    this.bootRomButton = new RunBootRomButton("loadBootrom", this);
    this.copyButton = new CopyButton("copy", this);
    this.breakpointSetter = new BreakpointSetter("breakpoint", this);
  }

  private boot(bytes: Uint8Array) {
    console.log("Booting...");
    this.emu = new Emulator(this, bytes);
    window.controller = this;

    this.registerViews = this.createRegisterViews(this.emu.cpu);
    this.bankViews = this.createBankViews(this.emu.memory);

    this.memoryViews = new Map();
    this.instructionToMemoryView = new Map();
    this.createMemoryViews(this.emu.cpu, this.emu.memory);

    this.stackView = new StackView("stack", this.emu.cpu, this.emu.memory);
    this.SPView = new SPView("SP", this.emu.cpu);
    this.PCView = new PCView("PC", this.emu.cpu);
    this.executionThreadView = new ExecutionThreadView("thread", this);

    this.toUpdate = new Set();
    this.markAllUpdated();
    this.updateLoop();

    this.emu.setBreakpoint(this.breakpoint);
    this.breakpoint = undefined;
    this.emu.setBreakpointBank(this.breakpointBank);
    this.breakpointBank = undefined;

    this.emu.run();
  }

  private markAllUpdated() {
    for (const view of this.registerViews!.values()) {
      this.toUpdate.add(view);
    }

    this.toUpdate.add(this.SPView!);

    for (const view of this.bankViews!.values()) {
      this.toUpdate.add(view);
    }

    this.toUpdate.add(this.stackView!);

    // Updates happen in insertion order, keep this last in case of
    // disassemble errors.
    for (const view of this.memoryViews!.values()) {
      this.toUpdate.add(view);
    }
  }

  private createRegisterViews(cpu: CPU) {
    const views = new Map();
    views.set(CPU.B, new RegisterView("regB", "B", cpu, CPU.B));
    views.set(CPU.C, new RegisterView("regC", "C", cpu, CPU.C));
    views.set(CPU.D, new RegisterView("regD", "D", cpu, CPU.D));
    views.set(CPU.E, new RegisterView("regE", "E", cpu, CPU.E));
    views.set(CPU.H, new RegisterView("regH", "H", cpu, CPU.H));
    views.set(CPU.L, new RegisterView("regL", "L", cpu, CPU.L));
    views.set(CPU.F, new RegisterView("regF", "F", cpu, CPU.F));
    views.set(CPU.A, new RegisterView("regA", "A", cpu, CPU.A));

    return views;
  }

  private createBankViews(memory: Memory) {
    const views = new Map();
    for (let bank = -1; bank < memory.nrBanks; ++bank) {
      views.set(
        bank,
        new BankView(bank, memory, document.getElementById("memoryBanks")!)
      );
    }

    return views;
  }

  private createMemoryViewKey(bank: number, address: number): number {
    return (bank << 16) | address;
  }

  private getBankAddressRange(
    memory: Memory,
    bankNr: number
  ): [number, number] {
    if (bankNr === -1) {
      return [0, memory.bootROM.length];
    } else if (bankNr === 0) {
      return [0, Memory.BANKSIZE];
    } else {
      return [Memory.BANKSIZE, Memory.BANKSIZE + Memory.BANKSIZE];
    }
  }

  private createMemoryViews(cpu: CPU, memory: Memory) {
    for (let bank = -1; bank < memory.nrBanks; ++bank) {
      let [bankStart, bankEnd] = this.getBankAddressRange(memory, bank);
      const bankView = this.bankViews!.get(bank);
      if (!bankView) {
        throw new Error(`Bank ${bank} doesn't exist.`);
      }

      for (let addr = bankStart; addr < bankEnd; ++addr) {
        const instruction = memory.getInstruction(addr, bank);
        if (instruction) {
          const view = new MemoryView(bankView, addr, memory, cpu, this);
          this.memoryViews!.set(this.createMemoryViewKey(bank, addr), view);
          this.instructionToMemoryView!.set(instruction, view);
        }
      }
    }
  }

  public runBootRom() {
    this.boot(new Uint8Array());
  }

  public togglePause() {
    this.emu!.togglePause();
  }

  public stepNext() {
    this.emu!.run();
  }

  public setBreakpoint(address: number) {
    if (this.emu) {
      this.emu.setBreakpoint(address);
    } else {
      this.breakpoint = address;
    }
  }

  public setBreakpointBank(bank: number) {
    if (this.emu) {
      this.emu.setBreakpointBank(bank);
    } else {
      this.breakpointBank = bank;
    }
  }

  private updatePending() {
    this.toUpdate.forEach((view) => {
      view.update();
    });
    this.toUpdate.clear();
  }

  private updateLoop() {
    this.updatePending();
    this.nextUpdate = window.setTimeout(this.updateLoop.bind(this), 1_000 / 60);
  }

  // Updated functions
  public updatedReg(reg: number) {
    const view = this.registerViews!.get(reg);
    if (!view) {
      throw new Error(`Unknown reg ${reg}`);
    }

    this.toUpdate.add(view);
  }

  public updatedSP() {
    this.toUpdate.add(this.SPView!);
  }

  private getMemoryView(address: number, bank?: number): MemoryView {
    if (bank === undefined) {
      bank = this.emu!.memory.getBankBasedOnAddress(address);
    }

    const view = this.memoryViews!.get(this.createMemoryViewKey(bank, address));
    if (!view) {
      throw new Error(
        `Memory view at bank ${bank} address ${utils.hexString(
          address,
          16
        )} doesn't exist`
      );
    }

    return view;
  }

  public updatedStack() {
    this.toUpdate.add(this.stackView!);
  }

  public viewAddress(address: number, bank: number) {
    this.getMemoryView(address, bank).centerInBankView(true);
  }

  public viewAddressInCurrentBank(address: number) {
    // TODO: callers should use viewAddress instead, there's no way to
    // determine the bank reliably.
    let bank = 0;
    if (address >= Memory.BANKSIZE) {
      bank = 1;
    }
    this.viewAddress(address, bank);
  }

  public getActiveBankView() {
    return this.bankViews!.get(this.emu!.memory.bank);
  }

  private incrementRecentInstructionCounter(instruction: Instruction) {
    if (!this.recentInstructionsCounter.has(instruction)) {
      this.recentInstructionsCounter.set(instruction, 0);
    }

    const prev = this.recentInstructionsCounter.get(instruction)!;
    this.recentInstructionsCounter.set(instruction, prev + 1);
  }

  public changedBank(): void {
    console.log(
      `Changed bank from bank ${this.emu!.memory.bank} @${utils.hexString(
        this.emu!.cpu.PC,
        16
      )}`
    );
  }

  public movedPC(newAddr: number) {
    this.toUpdate.add(this.PCView!);

    // TODO: Emulator should do this
    if (this.emu!.memory.bank === -1 && newAddr === 0x100) {
      this.emu!.memory.setBank(0);
      console.log("Switched out boot ROM and switched to bank 0");
    }

    const instruction = this.emu!.memory.getInstruction(newAddr);
    if (!instruction) {
      console.log(`${utils.hexString(newAddr, 16)}, ${this.emu!.memory.bank}`);
      throw new Error(`No instruction at ${utils.hexString(newAddr, 16)}`);
    }

    while (
      this.recentInstructions.length > ControllerReal.MAX_RECENT_INSTRUCTIONS
    ) {
      const oldInstruction = this.recentInstructions.shift()!;

      const currentCounter = this.recentInstructionsCounter.get(oldInstruction);
      if (currentCounter === undefined) {
        throw new Error("Old instruction not in list!");
      }

      const timesInList = currentCounter - 1;
      if (timesInList < 0) {
        throw new Error("Counter < 0");
      } else if (timesInList === 0) {
        oldInstruction.recentlyExecuted = false;
        const view = this.instructionToMemoryView!.get(oldInstruction);
        if (!view) {
          throw new Error("No view");
        }
        this.toUpdate.add(view);
      }

      this.recentInstructionsCounter.set(oldInstruction, timesInList);
    }

    this.recentInstructions.push(instruction);
    this.incrementRecentInstructionCounter(instruction);
    instruction.recentlyExecuted = true;

    if (this.prevPCMemoryView) {
      this.toUpdate.add(this.prevPCMemoryView);
    }

    const newView = this.getMemoryView(newAddr);
    this.toUpdate.add(newView);
    this.prevPCMemoryView = newView;

    this.toUpdate.add(this.executionThreadView!);
  }

  public getRecentInstructions() {
    return this.recentInstructions;
  }
}
