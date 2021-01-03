import { Memory } from "./memory.js";
import * as utils from "./utils.js";

type RGBA = [number, number, number, number];
type ColorMap = [RGBA, RGBA, RGBA, RGBA];

export class Video {
  private memory: Memory;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private colorMap: ColorMap;

  private nextVLineStartMs: number;
  private nextVBlankStopMs: number | undefined;

  // private frameDurationMs: number;
  // private vBlankDurationMs: number;
  private vLineRenderMs: number;

  constructor(memory: Memory, canvas: HTMLCanvasElement) {
    this.memory = memory;

    this.canvas = canvas;
    this.canvas.width = 256;
    this.canvas.height = 256;

    this.ctx = this.canvas.getContext("2d")!;

    this.colorMap = [
      [255, 255, 255, 255], // 0b00
      [170, 170, 170, 255], // 0b01
      [85, 85, 85, 255], // 0b10
      [0, 0, 0, 255], // 0b11
    ];

    // this.frameDurationMs = 1_000 / 59.73; // 59.73 Hz
    // this.vBlankDurationMs = 1.087; // 1087 us
    this.nextVLineStartMs = 0; // immediately start rendering

    this.vLineRenderMs = utils.mCyclesToMs(114);
  }

  handleLY(timeMs: number) {
    if (timeMs >= this.nextVLineStartMs) {
      let ly = this.memory.getLY();
      if (ly > 153) {
        this.memory.setLY(0);
      } else {
        this.memory.setLY(ly + 1);
      }

      this.nextVLineStartMs = timeMs + this.vLineRenderMs;
    }
  }

  getColorMap() {
    return this.colorMap;
  }

  getTileDataStart(): number {
    const lcdc = this.memory.getLCDC();
    if (utils.getBit(lcdc, 4)) {
      return 0x8000;
    } else {
      return 0x8800;
    }
  }

  getTileColRow(address: number) {
    const lcdc = this.memory.getLCDC();
    if (utils.getBit(lcdc, 4)) {
      let row = Math.floor(address / 16);
      let col = address % 16;
      return [col, row];
    } else {
      throw new Error("Not implemented");
    }
  }

  private getTile(address: number) {
    const lcdc = this.memory.getLCDC();
    const tileDataStart = this.getTileDataStart();
    if (utils.getBit(lcdc, 4)) {
      return tileDataStart + address * 16;
    } else {
      // 0x8800 addressing
      return tileDataStart + utils.twosComplementToNumber(address) * 16;
    }
  }

  private wrapToScreenCoords(n: number) {
    while (n < 0) {
      n += 256;
    }
    return n % 256;
  }

  renderTile(
    image: ImageData,
    colorMap: ColorMap,
    tileStart: number,
    x: number,
    y: number,
    scx: number,
    scy: number
  ) {
    for (let byte = 0; byte < 16; byte += 2) {
      // lsb is first
      const lsb = this.memory.getByte(tileStart + byte);
      const msb = this.memory.getByte(tileStart + byte + 1);

      for (let bit = 7; bit >= 0; bit--) {
        const colorGB = (utils.getBit(msb, bit) << 1) | utils.getBit(lsb, bit);
        const color = colorMap[colorGB];
        let colorCoordX = this.wrapToScreenCoords(x - scx + Math.abs(bit - 7));
        let colorCoordY = this.wrapToScreenCoords(y - scy + byte / 2);
        const dataOffset = (colorCoordY * image.width + colorCoordX) * 4;

        for (let i = 0; i < 4; i++) {
          image.data[dataOffset + i] = color[i];
        }
      }
    }
  }

  private getTileMapStart(): number {
    const lcdc = this.memory.getLCDC();
    if (utils.getBit(lcdc, 3)) {
      return 0x9c00;
    } else {
      return 0x9800;
    }
  }

  getTilePointer(row: number, col: number): number {
    const tileMapStart = this.getTileMapStart();
    return this.memory.getByte(tileMapStart + row * 32 + col);
  }

  private renderNormalBackground(image: ImageData) {
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) {
        let tilePointer = this.getTilePointer(row, col);
        this.renderTile(
          image,
          this.colorMap,
          this.getTile(tilePointer),
          col * 8,
          row * 8,
          this.memory.getSCX(),
          this.memory.getSCY()
        );
      }
    }
  }

  private getBorderColor(): RGBA {
    const rgbString = window
      .getComputedStyle(document.body)
      .getPropertyValue("--color-red");
    const rgb = rgbString
      .replace(/[^\d,]/g, "")
      .split(",")
      .map((x) => parseInt(x, 10));
    return [rgb[0], rgb[1], rgb[2], 255]; // can't push to rgb because needs to be RGBA for tsc
  }

  private renderPhysicalScreenBorder(image: ImageData) {
    const color = this.getBorderColor();
    let toDataOffset = (col: number, row: number) => {
      const numbersPerPixel = 4;
      return (row * 256 + col) * numbersPerPixel;
    };

    // Physical Gameboy screen shows 160x144 pixels
    // left and right border
    for (let row = 0; row <= 143; ++row) {
      const offsetStartLeft = toDataOffset(0, row);
      image.data[offsetStartLeft + 0] = color[0];
      image.data[offsetStartLeft + 1] = color[1];
      image.data[offsetStartLeft + 2] = color[2];
      image.data[offsetStartLeft + 3] = color[3];

      const offsetStartRight = toDataOffset(159, row);
      image.data[offsetStartRight + 0] = color[0];
      image.data[offsetStartRight + 1] = color[1];
      image.data[offsetStartRight + 2] = color[2];
      image.data[offsetStartRight + 3] = color[3];
    }

    // top and bottom border
    for (let col = 0; col <= 159; ++col) {
      const offsetStartTop = toDataOffset(col, 0);
      image.data[offsetStartTop + 0] = color[0];
      image.data[offsetStartTop + 1] = color[1];
      image.data[offsetStartTop + 2] = color[2];
      image.data[offsetStartTop + 3] = color[3];

      const offsetStartBottom = toDataOffset(col, 143);
      image.data[offsetStartBottom + 0] = color[0];
      image.data[offsetStartBottom + 1] = color[1];
      image.data[offsetStartBottom + 2] = color[2];
      image.data[offsetStartBottom + 3] = color[3];
    }
  }

  render() {
    const image = this.ctx.createImageData(256, 256);
    this.renderNormalBackground(image);
    this.renderPhysicalScreenBorder(image);

    if (utils.getBit(this.memory.getLCDC(), 5)) {
      utils.log(this.memory.getLCDC(), "render window");
    }

    this.ctx.putImageData(image, 0, 0);
  }
}
