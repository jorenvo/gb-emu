import { Memory } from "./memory.js";
import * as utils from "./utils.js";

export class Video {
  private memory: Memory;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private colorMap: number[][];

  constructor(memory: Memory, canvas: HTMLCanvasElement) {
    this.memory = memory;

    this.canvas = canvas;
    this.canvas.width = 160;
    this.canvas.height = 144;

    this.ctx = this.canvas.getContext("2d")!;

    this.colorMap = [
      [255, 255, 255, 255], // 0b00
      [170, 170, 170, 255], // 0b01
      [85, 85, 85, 255], // 0b10
      [0, 0, 0, 255], // 0b11
    ];
  }

  getColorMap() {
    return this.colorMap;
  }

  private getTile(address: number) {
    const lcdc = this.memory.getLCDC();
    if (utils.getBits(lcdc, 4, 4) === 0) {
      throw new Error("No support for 0x8800-0x97ff tile addressing mode yet.");
    }

    return 0x8000 + address * 16;
  }

  renderTile(image: ImageData, tileStart: number, x: number, y: number) {
    // for (let row = 0; row < 8; row++) {
    //   for (let col = 0; col < 8; col++) {
    //     const currentX = x + col;
    //     const currentY = y + row;
    //     const offset = (currentY * image.width + currentX) * 4;

    //     image.data[offset + 0] = 128;
    //     image.data[offset + 1] = 128;
    //     image.data[offset + 2] = 128;
    //     image.data[offset + 3] = 128;
    //   }
    // }
    // return;

    for (let byte = 0; byte < 16; byte += 2) {
      // lsb is first
      const lsb = this.memory.getByte(tileStart + byte);
      const msb = this.memory.getByte(tileStart + byte + 1);

      // console.log(
      //   `${utils.hexString(lsb)} @${tileStart + byte}, ${utils.hexString(
      //     msb
      //   )} @${tileStart + byte + 1}`
      // );
      let colors = "";
      for (let bit = 7; bit >= 0; bit--) {
        let colorGB =
          (utils.getBits(msb, bit, bit) << 1) | utils.getBits(lsb, bit, bit);

        let color = this.colorMap[colorGB];
        colors += ` ${colorGB} @(`;

        const colorCoordX = x + Math.abs(bit - 7);
        const colorCoordY = y + byte / 2;
        colors += `${colorCoordX}, ${colorCoordY})`;
        const dataOffset = (colorCoordY * image.width + colorCoordX) * 4;

        for (let i = 0; i < 4; i++) {
          image.data[dataOffset + i] = color[i];
        }
      }
      // console.log(colors);
    }
  }

  private renderNormalBackground(image: ImageData) {
    const lcdc = this.memory.getLCDC();
    let tileMapStart = 0x9800;
    if (utils.getBits(lcdc, 3, 3)) {
      tileMapStart = 0x9c00;
    }

    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) {
        let tilePointer = this.memory.getByte(tileMapStart + row * 32 + col);
        if (tilePointer !== 0) {
          this.renderTile(image, this.getTile(tilePointer), col * 8, row * 8);
        }
      }
    }
  }

  render() {
    const image = this.ctx.createImageData(160, 144);
    this.renderNormalBackground(image);

    if (utils.getBits(this.memory.getLCDC(), 5, 5)) {
      utils.log(this.memory.getLCDC(), "render window");
    }

    this.ctx.putImageData(image, 0, 0);
  }
}
