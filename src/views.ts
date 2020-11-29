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

  center(memory: MemoryView, smooth: boolean) {
    if (this.centeredMemory) {
      this.centeredMemory.element.classList.remove("highlightedInstruction");
    }
    this.centeredMemory = memory;

    const halfClientHeight = this.element.clientHeight / 2;
    if (smooth) {
      const top =
        memory.element.offsetTop - this.element.offsetTop - halfClientHeight;
      this.element.scrollTo({ top: top, behavior: "smooth" });
    } else {
      memory.element.scrollIntoView();
      this.element.scrollTop -= halfClientHeight;
    }
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

  private originalBank: number | undefined;

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

    this.switchToInstructionBank();
    if (this.instruction.getRelatedAddress(this.memory) !== -1) {
      this.element.addEventListener(
        "click",
        this.clickJumpToRelated.bind(this)
      );
    }
    this.restoreBank();
  }

  private switchToInstructionBank() {
    this.originalBank = this.memory.bank;
    this.memory.setBank(this.bankView.bank);
  }

  private restoreBank() {
    if (this.originalBank === undefined) {
      throw new Error("restoreBank called without corresponding switchToBank");
    }

    this.memory.setBank(this.originalBank);
    this.originalBank = undefined;
  }

  centerInBankView(center: boolean) {
    this.bankView.center(this, center);
  }

  update() {
    this.switchToInstructionBank();

    let dis = "";
    try {
      dis = this.instruction.disassemble(this.memory);
    } catch (error) {
      console.error(
        `Failed disassembling ${this.instruction.getBytesHex(this.memory)}`
      );
      console.error(error); // to show the original backtrace
      throw error; // to stop execution
    }

    this.element.innerHTML = `${utils.hexString(this.address, 16)}  ${dis}`;

    if (this.instruction.recentlyExecuted) {
      this.element.classList.add("recentlyExecuted");
    } else {
      this.element.classList.remove("recentlyExecuted");
    }

    if (this.instruction.getRelatedAddress(this.memory) !== -1) {
      this.element.classList.add("jumpToAddr");
    }
    this.restoreBank();

    if (
      this.memory.bank === this.bankView.bank &&
      this.cpu.PC === this.address
    ) {
      this.centerInBankView(false);
    } else {
      this.element.classList.remove("highlightedInstruction");
    }
  }

  private clickJumpToRelated(_e: MouseEvent) {
    this.switchToInstructionBank();
    this.controller.viewAddress(
      this.instruction.getRelatedAddress(this.memory),
      this.bankView.bank
    );
    this.restoreBank();
  }
}

// TODO: support for RAM banking
export class StackView extends View {
  cpu: CPU;
  memory: Memory;

  constructor(elementID: string, cpu: CPU, memory: Memory) {
    super(elementID);
    this.cpu = cpu;
    this.memory = memory;
  }

  private createStackByteView(addr: number) {
    const el = document.createElement("stackbyte");
    const addrString = utils.hexString(addr, 16);
    const byteString = utils.hexString(this.memory.getByte(addr));
    el.innerHTML = `${addrString}  ${byteString}`;
    return el;
  }

  update() {
    const context = 4;
    this.element.innerHTML = "";

    for (
      let addr = Math.max(0, this.cpu.SP - context);
      addr <= Math.min(this.cpu.SP + context, 0xffff);
      addr++
    ) {
      const view = this.createStackByteView(addr);
      if (addr === this.cpu.SP) {
        view.classList.add("stackBottom");
      }
      this.element.appendChild(view);
    }
  }
}

export class ExecutionThreadView extends View {
  controller: Controller;

  constructor(elementID: string, controller: Controller) {
    super(elementID);
    this.controller = controller;
  }

  update() {
    const recentInstructions = this.controller.getRecentInstructions();
    const instructions = recentInstructions.slice(
      recentInstructions.length - 16
    );
    instructions.reverse();
    this.element.innerHTML = instructions
      .map(i => utils.hexString(i.getAddress(), 16))
      .join(" ");
  }
}

export class BreakpointSetter extends View {
  controller: Controller;

  constructor(elementID: string, controller: Controller) {
    super(elementID);
    this.controller = controller;
    this.element.addEventListener("change", this.setBreakpoint.bind(this));
  }

  update() {
    // TODO: necessary? Don't think controller would ever updated this.
  }

  private setBreakpoint(_e: Event) {
    const val = (this.element as HTMLInputElement).value;
    if (val.includes(",")) {
      const [bank, addr] = val.split(",");
      this.controller.setBreakpointBank(parseInt(bank, 16));
      this.controller.setBreakpoint(parseInt(addr, 16));
    } else {
      this.controller.setBreakpoint(parseInt(val, 16));
    }
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

export class CopyButton extends Button {
  private selectElementText(el: HTMLElement) {
    const win = window;
    var doc = win.document,
      sel,
      range;

    sel = win.getSelection()!;
    range = doc.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  click(_e: MouseEvent): void {
    this.selectElementText(this.controller.getActiveBankView()!.element);
    document.execCommand("copy");
  }
}
