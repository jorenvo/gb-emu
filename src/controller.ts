import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { View, RegisterView, SPView, BankView, MemoryView } from "./views.js";

export class Controller {
  private registerViews: Map<number, RegisterView>;
  private bankViews: Map<number, BankView>;
  private memoryViews: Map<number, MemoryView>;

  private toUpdate: Set<View>;
  private nextUpdate: number | undefined;

  constructor(cpu: CPU, memory: Memory) {
    this.registerViews = this.createRegisterViews(cpu);
    this.bankViews = this.createBankViews(memory);
    this.memoryViews = this.createMemoryViews(cpu, memory);
    this.toUpdate = new Set();
    this.markAllUpdated();
    this.updateLoop();
  }

  private markAllUpdated() {
    for (const view of this.registerViews.values()) {
      this.toUpdate.add(view);
    }
    for (const view of this.bankViews.values()) {
      this.toUpdate.add(view);
    }
    for (const view of this.memoryViews.values()) {
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

  private createMemoryViews(cpu: CPU, memory: Memory) {
    const views = new Map();
    for (let bank = -1; bank < memory.nrBanks; ++bank) {
      const bankView = this.bankViews.get(bank);
      if (!bankView) {
        throw new Error(`Bank ${bank} doesn't exist.`);
      }
      for (let addr = 0; addr < Memory.BANKSIZE; ++addr) {
        views.set(
          this.createMemoryViewKey(bank, addr),
          new MemoryView(bank, addr, memory, cpu, bankView.element)
        );
      }
    }

    return views;
  }

  updatedReg(reg: number) {
    const view = this.registerViews.get(reg);
    if (!view) {
      throw new Error(`Unknown reg ${reg}`);
    }

    this.toUpdate.add(view);
  }

  updatedMemory(bank: number, address: number) {
    const view = this.memoryViews.get(this.createMemoryViewKey(bank, address));
    if (!view) {
      throw new Error(
        `Memory at bank ${bank} address ${address} doesn't exist`
      );
    }

    this.toUpdate.add(view);
  }

  private updatePending() {
    this.toUpdate.forEach(view => {
      view.update();
    });
    this.toUpdate.clear();
  }

  private updateLoop() {
    this.updatePending();
    this.nextUpdate = window.setTimeout(this.updateLoop.bind(this), 1_000);
  }
}