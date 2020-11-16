import { CPU } from "./cpu.js";
import * as utils from "./utils.js";

export abstract class View {
  element: HTMLElement;
  abstract update(): void;

  constructor(elementID: string) {
    const element = document.getElementById(elementID);
    if (!element) {
      throw new Error(`#${elementID} does not exist in DOM.`);
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
