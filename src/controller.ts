import { CPU } from "./cpu.js";
import { View, RegisterView, SPView } from "./views.js";

export class Controller {
  private registerViews: Map<number, RegisterView>;
  // memoryViews: Map<number, MemoryView>;

  private toUpdate: Set<View>;
  private nextUpdate: number | undefined;

  constructor(cpu: CPU) {
    this.registerViews = this.createRegisterViews(cpu);
    // this.memoryViews = new Map();
    this.toUpdate = new Set();
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

  updatedReg(reg: number) {
    const view = this.registerViews.get(reg);
    if (!view) {
      throw new Error("Unknown reg ${reg}");
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
