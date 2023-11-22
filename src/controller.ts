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
  BankNrView,
  BankView,
  MemRegView,
  MemoryView,
  StackView,
  ExecutionThreadView,
  TileMapView,
  IndividualTileDataView,
  PauseButton,
  RunBootRomButton,
  StepNextButton,
  CopyButton,
  BreakpointSetter,
  PCFileButton,
  KeyboardInputView,
  DebugToggleButton,
  BankSelector,
  TileDataView,
} from "./views.js";
import { FileLogger } from "./logger.js";
import * as utils from "./utils.js";
import { Disassembler } from "./disassembler.js";

declare global {
  interface Window {
    controller: Controller;
    cpu: CPU;
    memory: Memory;
    diss: Disassembler;
  }
}

export abstract class Controller {
  public abstract runBootRom(): void;
  public abstract togglePause(): void;
  public abstract toggleDebugging(): void;
  public abstract stepNext(): void;
  public abstract setBreakpoint(address: number): void;
  public abstract setBreakpointBank(bank: number): void;
  public abstract updatedReg(reg: number): void;
  public abstract updatedSP(): void;
  public abstract updatedStack(): void;
  public abstract updatedMemReg(address: number): void;
  public abstract updatedTileMapPointers(): void;
  public abstract updatedAllTileData(): void;
  public abstract updatedTileData(address: number): void;
  public abstract highlightTile(pointer: number): void;
  public abstract clearHighlightTile(): void;
  public abstract updatedWorkRam(): void;
  public abstract viewAddress(address: number, bank: number): void;
  public abstract getActiveBankView(): BankView | undefined;
  public abstract showBank(bank: number): void;
  public abstract getShownBank(): number;
  public abstract movedPC(newAddr: number): void;
  public abstract changedBank(bankNr: number): void;
  public abstract getRecentInstructions(): Instruction[];
  public abstract downloadPCLog(): void;
  public abstract keyPressB(down: boolean): void;
  public abstract keyPressA(down: boolean): void;
  public abstract keyPressStart(down: boolean): void;
  public abstract keyPressSelect(down: boolean): void;
  public abstract keyPressRight(down: boolean): void;
  public abstract keyPressLeft(down: boolean): void;
  public abstract keyPressUp(down: boolean): void;
  public abstract keyPressDown(down: boolean): void;
}

export class ControllerMock {
  public runBootRom(): void {}
  public togglePause(): void {}
  public toggleDebugging(): void {}
  public stepNext(): void {}
  public setBreakpoint(_address: number): void {}
  public setBreakpointBank(_bank: number): void {}
  public updatedReg(_reg: number): void {}
  public updatedSP(): void {}
  public updatedStack(): void {}
  public updatedMemReg(_address: number): void {}
  public updatedTileMapPointers(): void {}
  public updatedAllTileData(): void {}
  public updatedTileData(address: number): void {}
  public highlightTile(_pointer: number): void {}
  public clearHighlightTile(): void {}
  public updatedWorkRam(): void {}
  public viewAddress(_address: number, _bank: number): void {}
  public getActiveBankView(): BankView | undefined {
    return undefined;
  }
  public showBank(bank: number): void {}
  public getShownBank(): number {
    return -1;
  }
  public movedPC(_newAddr: number): void {}
  public changedBank(bankNr: number): void {}
  public getRecentInstructions(): Instruction[] {
    return [];
  }
  public downloadPCLog(): void {}
  public keyPressB(_down: boolean): void {}
  public keyPressA(_down: boolean): void {}
  public keyPressStart(_down: boolean): void {}
  public keyPressSelect(_down: boolean): void {}
  public keyPressRight(_down: boolean): void {}
  public keyPressLeft(_down: boolean): void {}
  public keyPressUp(_down: boolean): void {}
  public keyPressDown(_down: boolean): void {}
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
  private bankNrView: BankNrView | undefined;
  private addrToMemRegView: Map<number, MemRegView> | undefined;
  private stackView: StackView | undefined;
  private executionThreadView: ExecutionThreadView | undefined;
  private prevPCMemoryView: MemoryView | undefined;
  private tileMapView: TileMapView | undefined;
  private tileDataView: TileDataView | undefined;
  private addrToTileDataView: Map<number, IndividualTileDataView> | undefined;
  private keyboardInputView: KeyboardInputView | undefined;

  // buttons
  private debugToggleButton: DebugToggleButton;
  private bankSelection: BankSelector | undefined;
  private pauseButton: PauseButton;
  private bootRomButton: RunBootRomButton;
  private stepNextButton: StepNextButton;
  private copyButton: CopyButton;
  private pcDownloadButton: PCFileButton;

  // input
  private debuggingEnabled: boolean;
  private breakpointSetter: BreakpointSetter;

  // necessary in case emu is not yet running
  private breakpoint: number | undefined;
  private breakpointBank: number | undefined;

  private toUpdateFast: Set<View>;
  private toUpdateSlow: Set<View>;
  private nextUpdateFast: number | undefined;
  private nextUpdateSlow: number | undefined;

  private shownBank: number;

  private pcLogger: FileLogger;

  constructor() {
    this.loader = new Loader();
    this.loader.readFile.then((rom) => this.boot(new Uint8Array(rom)));
    this.toUpdateFast = new Set();
    this.toUpdateSlow = new Set();
    this.recentInstructions = [];
    this.recentInstructionsCounter = new Map();
    this.debuggingEnabled = true;

    this.debugToggleButton = new DebugToggleButton("debugToggle", this);
    this.pauseButton = new PauseButton("pause", this);
    this.stepNextButton = new StepNextButton("next", this);
    this.bootRomButton = new RunBootRomButton("loadBootrom", this);
    this.copyButton = new CopyButton("copy", this);
    this.pcDownloadButton = new PCFileButton("downloadPCFile", this);
    this.breakpointSetter = new BreakpointSetter("breakpoint", this);

    this.pcLogger = new FileLogger();
    this.shownBank = -1;
  }

  private boot(bytes: Uint8Array) {
    console.log("Booting...");
    this.emu = new Emulator(this, bytes);
    window.controller = this;
    window.cpu = this.emu.cpu;
    window.memory = this.emu.memory;
    window.diss = Disassembler;

    this.bankSelection = new BankSelector("bankSelection", this.emu.memory, this);
    this.registerViews = this.createRegisterViews(this.emu.cpu);
    this.bankNrView = new BankNrView("bankNr", this.emu.memory);
    this.addrToMemRegView = this.createMemRegisterViews(this.emu.memory);

    this.bankViews = this.createBankViews(this.emu.memory);

    this.memoryViews = new Map();
    this.instructionToMemoryView = new Map();
    this.createMemoryViews(this.emu.cpu, this.emu.memory);

    this.stackView = new StackView("stack", this.emu.cpu, this.emu.memory);
    this.SPView = new SPView("SP", this.emu.cpu);
    this.PCView = new PCView("PC", this.emu.cpu);
    this.executionThreadView = new ExecutionThreadView("thread", this);
    this.tileMapView = new TileMapView("bgTileMap", this, this.emu.video);

    this.tileDataView = new TileDataView("tileData", this.emu.video);
    this.addrToTileDataView = this.tileDataView.getTileViews();

    this.keyboardInputView = new KeyboardInputView("video", this);

    this.toUpdateFast = new Set();
    this.markAllUpdated();
    this.updateLoopFast();
    this.updateLoopSlow();

    this.emu.setBreakpoint(this.breakpoint);
    this.breakpoint = undefined;
    this.emu.setBreakpointBank(this.breakpointBank);
    this.breakpointBank = undefined;

    this.emu.run();
  }

  private markAllUpdated() {
    for (const view of this.registerViews!.values()) {
      this.toUpdateFast.add(view);
    }

    this.toUpdateFast.add(this.bankNrView!);

    for (const view of this.addrToMemRegView!.values()) {
      this.toUpdateFast.add(view);
    }

    this.toUpdateFast.add(this.SPView!);

    for (const view of this.bankViews!.values()) {
      this.toUpdateFast.add(view);
    }

    this.toUpdateFast.add(this.bankSelection!);
    this.toUpdateFast.add(this.stackView!);
    this.toUpdateFast.add(this.tileMapView!);
    this.toUpdateFast.add(this.tileDataView!);

    // Updates happen in insertion order, keep this last in case of
    // disassemble errors.
    for (const view of this.memoryViews!.values()) {
      this.toUpdateFast.add(view);
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

  private createMemRegisterViews(memory: Memory) {
    const displayBits = true;
    const displayHex = false;
    const views = new Map();
    views.set(Memory.LCDC, new MemRegView("memRegLCDC", "LCDC", Memory.LCDC, displayBits, memory));
    views.set(Memory.STAT, new MemRegView("memRegSTAT", "STAT", Memory.STAT, displayBits, memory));
    views.set(Memory.LY, new MemRegView("memRegLY", "LY", Memory.LY, displayHex, memory));
    views.set(Memory.SCY, new MemRegView("memRegSCY", "SCY", Memory.SCY, displayHex, memory));
    views.set(Memory.SCX, new MemRegView("memRegSCX", "SCX", Memory.SCX, displayHex, memory));
    views.set(Memory.LYC, new MemRegView("memRegLYC", "LYC", Memory.LYC, displayHex, memory));
    views.set(Memory.WY, new MemRegView("memRegWY", "WY", Memory.WY, displayHex, memory));
    views.set(Memory.WX, new MemRegView("memRegWX", "WX", Memory.WX, displayHex, memory));
    views.set(Memory.DIV, new MemRegView("memRegDIV", "DIV", Memory.DIV, displayHex, memory));

    return views;
  }

  private createBankViews(memory: Memory) {
    const parent = document.getElementById("memoryBanks")!;
    const views = new Map();

    for (let bank = -1; bank < memory.nrBanks; ++bank) {
      views.set(bank, new BankView(bank, memory, parent, this));
    }

    views.set(-2, new BankView(-2, memory, parent, this)); // TODO: -2 is RAM, do something less hacky

    return views;
  }

  private createMemoryViewKey(bank: number, address: number): number {
    return (bank << 16) | address;
  }

  private getBankAddressRange(memory: Memory, bankNr: number): [number, number] {
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

  public toggleDebugging() {
    this.debuggingEnabled = !this.debuggingEnabled;
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

  private updatePending(views: Set<View>) {
    if (!this.debuggingEnabled) {
      return;
    }
    views.forEach((view) => view.update());
    views.clear();
  }

  private updateLoopFast() {
    this.updatePending(this.toUpdateFast);
    this.nextUpdateFast = window.setTimeout(this.updateLoopFast.bind(this), 1_000 / 60);
  }

  private updateLoopSlow() {
    this.updatePending(this.toUpdateSlow);
    this.nextUpdateSlow = window.setTimeout(this.updateLoopSlow.bind(this), 1_000 / 5);
  }

  // Updated functions
  public updatedReg(reg: number) {
    const view = this.registerViews!.get(reg);
    if (!view) {
      throw new Error(`Unknown reg ${reg}`);
    }

    this.toUpdateFast.add(view);
  }

  public updatedSP() {
    this.toUpdateFast.add(this.SPView!);
  }

  private getMemoryView(address: number, bank?: number): MemoryView | undefined {
    if (bank === undefined) {
      bank = this.emu!.memory.getBankNrBasedOnAddress(address);
    }

    return this.memoryViews!.get(this.createMemoryViewKey(bank, address));
  }

  public updatedStack() {
    this.toUpdateFast.add(this.stackView!);
  }

  public updatedMemReg(address: number) {
    const view = this.addrToMemRegView!.get(address);
    if (view) {
      this.toUpdateFast.add(view);
    }
  }

  public updatedTileMapPointers() {
    this.toUpdateFast.add(this.tileMapView!);
  }

  public updatedAllTileData() {
    this.toUpdateFast.add(this.tileDataView!);
  }

  public updatedTileData(address: number) {
    const tileData = this.addrToTileDataView!.get(address)!;
    if (!tileData) debugger;
    this.toUpdateFast.add(tileData);
  }

  public highlightTile(pointer: number) {
    let [col, row] = this.emu!.video.getTileColRow(pointer);
    this.tileDataView!.highlight(col, row);
    this.toUpdateFast.add(this.tileDataView!);
  }

  public clearHighlightTile() {
    this.tileDataView!.clearHighlight();
    this.toUpdateFast.add(this.tileDataView!);
  }

  public updatedWorkRam() {
    console.log("Clearing work ram");
    // remove everything, only disassemble again when the user clicks
    const ramBank = -2;
    const bankView = this.bankViews!.get(ramBank)!;

    // clear views
    for (let addr = Memory.WORKRAMSTART; addr < Memory.WORKRAMSTART + Memory.WORKRAMSIZE; addr++) {
      this.memoryViews!.delete(this.createMemoryViewKey(ramBank, addr));
    }

    bankView.clear();
  }

  private createWorkRamMemoryViews(startAddress: number) {
    const ramBank = -2;
    const memory = this.emu!.memory;
    const bankView = this.bankViews!.get(ramBank)!;

    this.updatedWorkRam();

    for (
      let addr = startAddress;
      addr < startAddress + Memory.WORKRAMSIZE && addr <= 0xffff;
      addr++
    ) {
      const instruction = memory.getInstruction(addr, ramBank);
      if (instruction !== undefined) {
        const view = new MemoryView(bankView, addr, memory, this.emu!.cpu, this);
        this.memoryViews!.set(this.createMemoryViewKey(ramBank, addr), view);
        this.instructionToMemoryView!.set(instruction, view);
        this.toUpdateFast.add(view);
      }
    }
  }

  public viewAddress(address: number, bank: number) {
    const view = this.getMemoryView(address, bank);
    this.showBank(bank);
    if (view) {
      // ROM
      view.centerInBankView(true);
    } else {
      // RAM
      this.emu!.memory.disassembleRam(address);
      this.createWorkRamMemoryViews(address);
    }
  }

  public getActiveBankView() {
    return this.bankViews!.get(this.emu!.memory.bank);
  }

  public showBank(bank: number) {
    this.shownBank = bank;
    this.bankViews!.forEach((bankView) => this.toUpdateFast.add(bankView));
    this.toUpdateFast.add(this.bankSelection!);
  }

  public getShownBank(): number {
    return this.shownBank;
  }

  private incrementRecentInstructionCounter(instruction: Instruction) {
    if (!this.recentInstructionsCounter.has(instruction)) {
      this.recentInstructionsCounter.set(instruction, 0);
    }

    const prev = this.recentInstructionsCounter.get(instruction)!;
    this.recentInstructionsCounter.set(instruction, prev + 1);
  }

  public changedBank(bankNr: number): void {
    // TODO: this is called a lot when initially disassembling by the
    // MemoryView views.
    this.toUpdateFast.add(this.bankNrView!);
  }

  private switchOutOfBootROM(newAddr: number) {
    // TODO: Emulator should do this
    if (this.emu!.memory.bank === -1 && newAddr === 0x100) {
      this.emu!.memory.setBank(1);
      console.log("Switched out boot ROM and switched to bank 1");
    }
  }

  public movedPC(newAddr: number) {
    if (!this.debuggingEnabled) {
      this.switchOutOfBootROM(newAddr);
      return;
    }

    const activeBank = this.emu!.memory.getBankNrBasedOnAddress(newAddr);
    if (this.shownBank !== activeBank) {
      this.showBank(activeBank);
    }

    if (this.emu!.memory.bank !== -1) {
      this.pcLogger.log(newAddr); // TODO only if not in interrupt
    }
    this.toUpdateFast.add(this.PCView!);

    this.switchOutOfBootROM(newAddr);

    const instruction = this.emu!.memory.getInstruction(newAddr);
    if (!instruction) {
      // Could be RAM which will be JIT-ed. Don't visualize.
      return;
    }

    // This test avoids short loops from taking over the entire recentInstructions list.
    if (!this.recentInstructions.includes(instruction)) {
      while (this.recentInstructions.length > ControllerReal.MAX_RECENT_INSTRUCTIONS) {
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
            throw new Error(
              `No view for instruction ${oldInstruction.disassemble(
                this.emu!.memory,
              )} at ${utils.hexString(oldInstruction.getAddress())}`,
            );
          }
          this.toUpdateSlow.add(view);
        }

        this.recentInstructionsCounter.set(oldInstruction, timesInList);
      }

      this.recentInstructions.push(instruction);
    }

    this.incrementRecentInstructionCounter(instruction);
    instruction.recentlyExecuted = true;

    if (this.prevPCMemoryView) {
      this.toUpdateSlow.add(this.prevPCMemoryView);
    }

    const newView = this.getMemoryView(newAddr)!;
    this.toUpdateSlow.add(newView);
    this.prevPCMemoryView = newView;

    this.toUpdateFast.add(this.executionThreadView!);
  }

  public getRecentInstructions() {
    return this.recentInstructions;
  }

  public downloadPCLog() {
    this.pcLogger.download();
  }

  public keyPressB(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} B`);
    this.emu!.memory.setIOKeyB(down);
  }

  public keyPressA(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} A`);
    this.emu!.memory.setIOKeyA(down);
  }

  public keyPressStart(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} start`);
    this.emu!.memory.setIOKeyStart(down);
  }

  public keyPressSelect(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} select`);
    this.emu!.memory.setIOKeySelect(down);
  }

  public keyPressRight(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} right`);
    this.emu!.memory.setIOKeyRight(down);
  }

  public keyPressLeft(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} left`);
    this.emu!.memory.setIOKeyLeft(down);
  }

  public keyPressUp(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} up`);
    this.emu!.memory.setIOKeyUp(down);
  }

  public keyPressDown(down: boolean) {
    console.log(`${down ? "Pressing" : "Releasing"} down`);
    this.emu!.memory.setIOKeyDown(down);
  }
}
