import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Controller } from "./controller.js";
import { Instruction } from "./instruction.js";
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
  centeredMemory: MemoryView | undefined;

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

  center(memory: MemoryView) {
    if (this.centeredMemory) {
      this.centeredMemory.element.classList.remove("highlightedInstruction");
    }
    this.centeredMemory = memory;

    memory.element.scrollIntoView();
    this.element.scrollTop -= this.element.clientHeight / 2;
    memory.element.classList.add("highlightedInstruction");
  }
}

export class MemoryView extends View {
  bankView: BankView;
  memory: Memory;
  controller: Controller;
  cpu: CPU;
  address: number;
  instruction: Instruction;

  constructor(
    bankView: BankView,
    address: number,
    memory: Memory,
    cpu: CPU,
    controller: Controller
  ) {
    let elementID = "memBank";
    if (bankView.bank === -1) {
      elementID += "Boot";
    } else {
      elementID += utils.decString(bankView.bank, 3);
    }
    elementID += `-${utils.hexString(address, 16)}`;

    super(elementID, bankView.element, "memoryview");
    this.bankView = bankView;
    this.memory = memory;
    this.cpu = cpu;
    this.address = address;
    this.controller = controller;

    this.instruction = this.memory.getInstruction(this.address, bankView.bank)!;
    if (this.instruction.getRelatedAddress(this.memory) !== -1) {
      this.element.addEventListener(
        "click",
        this.clickJumpToRelated.bind(this)
      );
    }
  }

  centerInBankView() {
    this.bankView.center(this);
  }

  update() {
    if (this.instruction) {
      const dis = this.instruction.disassemble(this.memory);
      this.element.innerHTML = `${utils.hexString(this.address, 16)}  ${dis}`;

      if (this.instruction.recentlyExecuted) {
        this.element.classList.add("recentlyExecuted");
      } else {
        this.element.classList.remove("recentlyExecuted");
      }

      if (this.instruction.getRelatedAddress(this.memory) !== -1) {
        this.element.classList.add("jumpToAddr");
      }
    }

    if (this.memory.bank === this.bankView.bank && this.cpu.PC === this.address) {
      this.centerInBankView();
    } else {
      this.element.classList.remove("highlightedInstruction");
    }

    // TODO show amount of time this was executed
  }

  private clickJumpToRelated(_e: MouseEvent) {
    this.controller.viewAddress(
      this.instruction.getRelatedAddress(this.memory),
      this.bankView.bank
    );
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
