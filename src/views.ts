import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import * as utils from "./utils.js";

export abstract class View {
  element: HTMLElement;
  abstract update(): void;

  constructor(elementID: string) {
    this.setupElement(elementID);
    const element = document.getElementById(elementID);
    if (!element) {
      throw new Error(`#${elementID} does not exist in DOM.`);
    }
    this.element = element;
  }

  // Can be implemented if DOM elements need to be created dynamically.
  protected setupElement(_elementID: string): void {}
}

export class RegisterView extends View {
  cpu: CPU;
  name: string;
  reg: number;

  constructor(elementID: string, name: string, cpu: CPU, reg: number) {
    super(elementID);
    this.name = name;
    this.cpu = cpu;
    this.reg = reg;
  }

  update() {
    this.element.innerHTML = `${this.name}: ${utils.hexString(
      this.cpu.getReg(this.reg)
    )}`;
  }
}

export class SPView extends View {
  cpu: CPU;

  constructor(elementID: string, cpu: CPU) {
    super(elementID);
    this.cpu = cpu;
  }

  update() {
    this.element.innerHTML = `SP: ${utils.hexString(this.cpu.SP, 16)}`;
  }
}

export class BankView extends View {
  memory: Memory;
  bank: number;

  constructor(bank: number, memory: Memory) {
    super(`bank${utils.decString(bank, 3)}`);
    this.memory = memory;
    this.bank = bank;
  }

  protected setupElement(elementID: string) {
    const span = document.createElement("span");
    span.id = elementID;
    span.classList.add("inactiveBank");
    document.getElementById("memoryBanks")!.appendChild(span);
  }

  update() {
    if (this.memory.bank === this.bank) {
      this.element.classList.remove("inactiveBank");
      this.element.classList.add("activeBank");
    } else {
      this.element.classList.remove("activeBank");
      this.element.classList.add("inactiveBank");
    }
  }
}

export class MemoryView extends View {
  parent: View;
  memory: Memory;
  cpu: CPU;
  address: number;
  bank: number;

  constructor(
    bank: number,
    address: number,
    memory: Memory,
    cpu: CPU,
    parent: View
  ) {
    super(
      `memBank${utils.decString(bank, 3)}Addr${utils.hexString(address, 16)}`
    );
    this.memory = memory;
    this.cpu = cpu;
    this.address = address;
    this.bank = bank;
    this.parent = parent;
  }

  protected setupElement(elementID: string) {
    const div = document.createElement("div");
    div.id = elementID;
    this.parent.element.appendChild(div);
  }

  update() {
    if (this.memory.bank === this.bank && this.cpu.PC === this.address) {
      this.element.classList.add("activeInstruction");
      this.element.scrollIntoView();
    } else {
      this.element.classList.remove("activeInstruction");
    }

    // TODO show amount of time this was executed
  }
}
