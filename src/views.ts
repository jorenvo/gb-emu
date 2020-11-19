import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Controller } from "./controller.js";
import * as utils from "./utils.js";

export abstract class View {
  element: HTMLElement;
  parent: HTMLElement | undefined;
  abstract update(): void;

  constructor(elementID: string, parent?: HTMLElement, elementName?: string) {
    let element = document.getElementById(elementID);
    if (!element) {
      if (!parent) {
        throw new Error(`Cannot create #${elementID} without parent.`);
      }
      if (!elementName) {
        throw new Error(`Cannot create #${elementID} without element name.`);
      }

      element = document.createElement(elementName);
      element.id = elementID;
      parent.appendChild(element);
    }

    this.element = element;
  }
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

  constructor(bank: number, memory: Memory, parent: HTMLElement) {
    let elementID = "bank";
    if (bank === -1) {
      elementID += "Boot";
    } else {
      elementID += utils.decString(bank, 3);
    }
    super(elementID, parent, "bankview");
    this.memory = memory;
    this.bank = bank;

    this.element.classList.add("inactiveBank");
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
  memory: Memory;
  cpu: CPU;
  address: number;
  bank: number;
  parent: HTMLElement;

  constructor(
    bank: number,
    address: number,
    memory: Memory,
    cpu: CPU,
    parent: HTMLElement
  ) {
    let elementID = "memBank";
    if (bank === -1) {
      elementID += "Boot";
    } else {
      elementID += utils.decString(bank, 3);
    }
    elementID += `-${utils.hexString(address, 16)}`;

    super(elementID, parent, "memoryview");
    this.memory = memory;
    this.cpu = cpu;
    this.address = address;
    this.bank = bank;
    this.parent = parent;
  }

  centerInBankView() {
    this.element.scrollIntoView();
    this.parent.scrollTop -= this.parent.clientHeight / 2;
  }

  update() {
    const instruction = this.memory.getInstruction(this.address, this.bank);
    if (instruction) {
      const dis = instruction.disassemble(this.memory);
      this.element.innerHTML = `${utils.hexString(this.address, 16)}  ${dis}`;

      if (instruction.recentlyExecuted) {
        this.element.classList.add("recentlyExecuted");
      } else {
        this.element.classList.remove("recentlyExecuted");
      }

      if (instruction.getRelatedAddress(this.memory) !== -1) {
        this.element.classList.add("jumpToAddr");
      }
    }

    if (this.memory.bank === this.bank && this.cpu.PC === this.address) {
      this.element.classList.add("activeInstruction");
      this.centerInBankView();
    } else {
      this.element.classList.remove("activeInstruction");
    }

    // TODO show amount of time this was executed
  }
}

export abstract class Button {
  element: HTMLElement;
  controller: Controller;
  abstract click(e: MouseEvent): void;

  constructor(elementID: string, controller: Controller) {
    const el = document.getElementById(elementID);
    if (!el) {
      throw new Error(`Button #${elementID} does not exist.`);
    }

    el.addEventListener("click", this.click.bind(this));
    this.element = el;
    this.controller = controller;
  }
}

export class PauseButton extends Button {
  click(_e: MouseEvent): void {
    this.controller.togglePause();
  }
}

export class RunBootRomButton extends Button {
  click(_e: MouseEvent): void {
    this.controller.runBootRom();
  }
}

export class StepNextButton extends Button {
  click(_e: MouseEvent): void {
    this.controller.stepNext();
  }
}
