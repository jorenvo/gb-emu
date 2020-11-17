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
    for (const view of this.registerViews.values()) {
      this.toUpdate.add(view);
    }

    this.updateLoop();
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
    for (let bank = 0; bank < memory.nrBanks + 1; ++bank) {
      views.set(bank, new BankView(bank, memory));
    }

    return views;
  }

  private createMemoryViews(cpu: CPU, memory: Memory) {
    const views = new Map();
    for (let bank = 0; bank < memory.nrBanks + 1; ++bank) {
      const bankView = this.bankViews.get(bank)!;
      for (let addr = 0; addr < Memory.BANKSIZE; ++addr) {
        views.set(
          (bank << 16) | addr,
          new MemoryView(bank, addr, memory, cpu, bankView)
        );
      }
    }

    return views;
  }

  updatedReg(reg: number) {
    const view = this.registerViews.get(reg);
    if (!view) {
      throw new Error("Unknown reg ${reg}");
    }

    this.toUpdate.add(view);
  }

  updatedMemory(bank: number, address: number) {}

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
