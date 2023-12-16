import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Controller } from "./controller.js";
import { Instruction } from "./instruction.js";
import { Video } from "./video.js";
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

export class MapperTypeView extends View {
  memory: Memory;

  constructor(elementID: string, memory: Memory) {
    super(elementID);
    this.memory = memory;
  }

  update() {
    this.element.innerText = `MBC: ${this.memory.getMapperType()}`;
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
    this.element.innerHTML = `${this.name}: ${utils.hexString(this.cpu.getReg(this.reg))}`;
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

export class PCView extends View {
  cpu: CPU;

  constructor(elementID: string, cpu: CPU) {
    super(elementID);
    this.cpu = cpu;
  }

  update() {
    this.element.innerHTML = `PC: ${utils.hexString(this.cpu.PC, 16)}`;
  }
}

export class BankNrView extends View {
  memory: Memory;

  constructor(elementID: string, memory: Memory) {
    super(elementID);
    this.memory = memory;
  }

  update() {
    this.element.innerHTML = `BNK: ${utils.decString(this.memory.bank, 2)}`;
  }
}

export class MemRegView extends View {
  memory: Memory;
  name: string;
  address: number;
  asBits: boolean;

  constructor(elementID: string, name: string, address: number, asBits: boolean, memory: Memory) {
    super(elementID);
    this.name = name;
    this.address = address;
    this.asBits = asBits;
    this.memory = memory;
  }

  update() {
    const value = this.memory.getByte(this.address);
    let formatted;
    if (this.asBits) {
      formatted = utils.binString(value);
    } else {
      formatted = utils.hexString(value);
    }
    this.element.innerHTML = `${this.name}: ${formatted}`;
  }
}

export class TileMapView extends View {
  controller: Controller;
  video: Video;

  constructor(elementID: string, controller: Controller, video: Video) {
    super(elementID);
    this.controller = controller;
    this.video = video;
  }

  hover(pointer: number) {
    this.controller.highlightTile(pointer);
  }

  hoverStop() {
    this.controller.clearHighlightTile();
  }

  update() {
    this.element.innerHTML = "";

    // 32x32 tile pointers
    for (let row = 0; row < 32; row++) {
      const rowEl = document.createElement("tilemaprow");
      for (let col = 0; col < 32; col++) {
        const ptrEl = document.createElement("tilemappointer");
        const ptr = this.video.getTilePointer(row, col, !!"background");
        ptrEl.innerHTML = utils.hexString(ptr).replace("0x", "");
        if (ptr !== 0) {
          ptrEl.classList.add("setTilePointer");
        }
        ptrEl.addEventListener("mouseenter", () => this.hover(ptr));
        ptrEl.addEventListener("mouseleave", () => this.hoverStop());

        rowEl.appendChild(ptrEl);
      }
      this.element.appendChild(rowEl);
    }
  }
}

export class IndividualTileDataView extends View {
  private width: number;
  private height: number;
  video: Video;
  address: number;
  highlighted: boolean;

  constructor(video: Video, parent: HTMLElement, address: number) {
    super(`tiledata-${utils.hexString(address, 16)}`, parent, "canvas");
    this.width = 8;
    this.height = 8;
    this.element.setAttribute("width", `${this.width}`);
    this.element.setAttribute("height", `${this.height}`);
    this.video = video;
    this.address = address;
    this.highlighted = false;
  }

  highlight() {
    this.highlighted = true;
  }

  clearHighlight() {
    this.highlighted = false;
  }

  update() {
    // Always render all tiles, regardless of the addressing mode (LCDC bit 4)
    let colorMap = this.video.getColorMapBgOrWindow();
    if (this.highlighted) {
      colorMap = [
        [255, 255, 255, 255],
        [320, 170, 170, 255],
        [235, 85, 85, 255],
        [200, 0, 0, 255],
      ];
    }

    const ctx = (this.element as HTMLCanvasElement).getContext("2d")!;
    const imgData = ctx.createImageData(this.width, this.height);
    this.video.renderTile(imgData, colorMap, this.address, 0, 0, 0, 0, false, false, false, false);
    ctx.putImageData(imgData, 0, 0);
  }
}

export class TileDataView extends View {
  private video: Video;
  private addrToTile: Map<number, IndividualTileDataView>;
  private highlightedCol: number | undefined;
  private highlightedRow: number | undefined;
  private colRowToTile: Map<string, IndividualTileDataView>;

  constructor(elementID: string, video: Video) {
    super(elementID);
    this.video = video;
    this.addrToTile = new Map();
    this.colRowToTile = new Map();
    this.createIndividualTiles();
  }

  private getTile(col: number, row: number) {
    const tile = this.colRowToTile.get(`${col},${row}`);
    if (!tile) {
      throw new Error(`Tile at ${col},${row} not found`);
    }
    return tile;
  }

  highlight(col: number, row: number) {
    this.clearHighlight();
    this.getTile(col, row).highlight();
    this.highlightedCol = col;
    this.highlightedRow = row;
  }

  clearHighlight() {
    if (this.highlightedCol !== undefined && this.highlightedRow !== undefined) {
      this.getTile(this.highlightedCol, this.highlightedRow).clearHighlight();
      this.highlightedCol = undefined;
      this.highlightedRow = undefined;
    }
  }

  getTileViews() {
    return this.addrToTile;
  }

  private createIndividualTiles() {
    // Always render all tiles, regardless of the addressing mode (LCDC bit 4)
    const tileDataStart = 0x8000;

    // Tile data is in 0x8000-0x97ff = 0x1800 bytes. 16 bytes per tile, so
    // 384 tiles. Fits in 24x16.
    for (let row = 0; row < 24; row++) {
      const rowEl = document.createElement("tiledatarow");
      for (let col = 0; col < 16; col++) {
        const addr = tileDataStart + (row * 16 + col) * 16;
        const tile = new IndividualTileDataView(this.video, this.element, addr);
        this.addrToTile.set(addr, tile);
        this.colRowToTile.set(`${col},${row}`, tile);
        rowEl.appendChild(tile.element);
      }
      this.element.appendChild(rowEl);
    }
  }

  update() {
    console.log(`Updating all tiles`);
    this.addrToTile.forEach((tile) => tile.update());
  }
}

export class BankSelector extends View {
  memory: Memory;
  controller: Controller;

  constructor(elementID: string, memory: Memory, controller: Controller) {
    super(elementID, undefined, "bankSelectionView");
    this.memory = memory;
    this.controller = controller;
    this.element.addEventListener("change", this.onChange.bind(this));
  }

  private addOption(bankNr: number, name: string) {
    const option = document.createElement("option");
    option.setAttribute("value", `${bankNr}`);
    option.innerText = name;
    if (this.controller.getShownBank() === bankNr) {
      option.setAttribute("selected", "1");
    }

    this.element.appendChild(option);
  }

  update() {
    this.element.innerHTML = "";

    this.addOption(-1, "Boot");
    this.addOption(-2, "RAM");

    for (let bank = 0; bank < this.memory.nrBanks; bank++) {
      this.addOption(bank, `Bank ${bank}`);
    }
  }

  private onChange(event: Event) {
    const newBank = (event.target as HTMLOptionElement).value;
    this.controller.showBank(Number(newBank));
  }
}

export class VideoScaleSelector extends View {
  controller: Controller;

  constructor(elementID: string, controller: Controller) {
    super(elementID, undefined, "videoScaleSelectorView");
    this.controller = controller;
    this.element.addEventListener("change", this.onChange.bind(this));
  }

  update() {}

  private onChange(event: Event) {
    this.controller.changeVideoScale((event.target as HTMLOptionElement).value);
  }
}

export class BankView extends View {
  memory: Memory;
  controller: Controller;
  bank: number;
  centeredMemory: MemoryView | undefined;

  constructor(bank: number, memory: Memory, parent: HTMLElement, controller: Controller) {
    let elementID = "bank";
    if (bank === -1) {
      elementID += "Boot";
    } else {
      elementID += utils.decString(bank, 3);
    }
    super(elementID, parent, "bankview");
    this.memory = memory;
    this.bank = bank;
    this.controller = controller;

    this.element.classList.add("inactiveBank");
  }

  clear() {
    this.element.innerHTML = "";
  }

  update() {
    if (this.bank === -2) {
      this.element.classList.add("ramBank");
    }

    if (this.memory.bank === this.bank) {
      this.element.classList.remove("inactiveBank");
      this.element.classList.add("activeBank");
    } else {
      this.element.classList.remove("activeBank");
      this.element.classList.add("inactiveBank");
    }

    if (this.controller.getShownBank() === this.bank) {
      this.element.classList.remove("hiddenBank");
    } else {
      this.element.classList.add("hiddenBank");
    }
  }

  center(memory: MemoryView, smooth: boolean) {
    if (this.centeredMemory) {
      this.centeredMemory.element.classList.remove("highlightedInstruction");
    }
    this.centeredMemory = memory;

    const halfClientHeight = this.element.clientHeight / 2;
    if (smooth) {
      const top = memory.element.offsetTop - this.element.offsetTop - halfClientHeight;
      this.element.scrollTo({
        top: top,
        behavior: "smooth",
      });
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
    controller: Controller,
  ) {
    let elementID = "memBank";

    switch (bankView.bank) {
      case -2:
        elementID += "RAM";
        break;
      case -1:
        elementID += "Boot";
        break;
      default:
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
      this.element.addEventListener("click", this.clickJumpToRelated.bind(this));
    }
    this.restoreBank();
  }

  private switchToInstructionBank() {
    if (this.memory.bank === this.bankView.bank) {
      return;
    }
    this.originalBank = this.memory.bank;
    this.memory.setROMBankLower(this.bankView.bank);
  }

  private restoreBank() {
    if (this.originalBank === undefined) {
      return;
    }
    this.memory.setROMBankLower(this.originalBank);
    this.originalBank = undefined;
  }

  centerInBankView(smooth: boolean) {
    this.bankView.center(this, smooth);
  }

  update() {
    this.switchToInstructionBank();

    let dis = "";
    try {
      dis = this.instruction.disassemble(this.memory);
    } catch (error) {
      console.error(`Failed disassembling ${this.instruction.getBytesHex(this.memory)}`);
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

    // Center if PC points to this and either:
    // - the memory bank matches this memory, or
    // - the memory bank is 0 (fixed RAM, always active) and we're not booting
    if (
      this.cpu.PC === this.address &&
      ((this.bankView.bank === 0 && this.memory.bank !== -1) ||
        this.bankView.bank === -2 || // RAMBank
        this.bankView.bank === this.memory.bank)
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
      this.bankView.bank,
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
    const instructions = recentInstructions.slice(recentInstructions.length - 16);
    instructions.reverse();
    this.element.innerHTML = "PCs: ";
    instructions.forEach((i) => {
      const instructionElement = document.createElement("span");
      const addr = i.getAddress();
      instructionElement.innerHTML = utils.hexString(addr, 16) + " ";
      instructionElement.addEventListener("click", (_e: MouseEvent) =>
        this.clickJumpToRelated(addr),
      );
      this.element.appendChild(instructionElement);
    });
  }

  private clickJumpToRelated(address: number) {
    // TODO: the bank should stored in the clickable elements
    let bank = 0;
    if (address >= Memory.BANKSIZE) {
      bank = 1;
    }
    this.controller.viewAddress(address, bank);
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

export class KeyboardInputView extends View {
  private controller: Controller;

  constructor(elementID: string, controller: Controller) {
    super(elementID);
    this.controller = controller;
    this.setupHandlers();
  }

  private setupHandlers() {
    this.element.addEventListener("keydown", this.handleKey.bind(this));
    this.element.addEventListener("keyup", this.handleKey.bind(this));
  }

  private handleKey(e: KeyboardEvent) {
    const keydown = e.type === "keydown";
    switch (e.code) {
      case "KeyZ":
        this.controller.keyPressB(keydown);
        break;
      case "KeyX":
        this.controller.keyPressA(keydown);
        break;
      case "Enter":
        this.controller.keyPressStart(keydown);
        break;
      case "Backslash":
        this.controller.keyPressSelect(keydown);
        break;
      case "ArrowRight":
        this.controller.keyPressRight(keydown);
        break;
      case "ArrowLeft":
        this.controller.keyPressLeft(keydown);
        break;
      case "ArrowUp":
        this.controller.keyPressUp(keydown);
        break;
      case "ArrowDown":
        this.controller.keyPressDown(keydown);
        break;
    }
  }

  update() {}
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

export class DebugToggleButton extends Button {
  click(_e: MouseEvent): void {
    this.controller.toggleDebugging();
  }
}

export class BootToggleButton extends Button {
  click(_e: MouseEvent): void {
    this.controller.toggleBoot();
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
    let doc = win.document,
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

export class PCFileButton extends Button {
  click(_e: MouseEvent): void {
    this.controller.downloadPCLog();
  }
}
