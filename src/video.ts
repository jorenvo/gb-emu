import { Memory } from "./memory.js";
import * as utils from "./utils.js";

type RGBA = [number, number, number, number];
type ColorMap = [RGBA, RGBA, RGBA, RGBA];

export class Video {
  private memory: Memory;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private colorWhite: RGBA;
  private colorLightGray: RGBA;
  private colorDarkGray: RGBA;
  private colorBlack: RGBA;
  private colorMap: ColorMap;

  private nextVLineStartMs: number;
  private nextVBlankStopMs: number | undefined;

  // private frameDurationMs: number;
  // private vBlankDurationMs: number;
  private vLineRenderMs: number;

  private warnedWideTiles: boolean;

  constructor(memory: Memory, canvas: HTMLCanvasElement) {
    this.memory = memory;

    this.canvas = canvas;
    this.canvas.width = 256;
    this.canvas.height = 256;

    this.ctx = this.canvas.getContext("2d")!;

    this.colorWhite = [255, 255, 255, 255]; // 0b00
    this.colorLightGray = [170, 170, 170, 255]; // 0b01
    this.colorDarkGray = [85, 85, 85, 255]; // 0b10
    this.colorBlack = [0, 0, 0, 255]; // 0b11
    this.colorMap = [this.colorWhite, this.colorLightGray, this.colorDarkGray, this.colorBlack];

    // this.frameDurationMs = 1_000 / 59.73; // 59.73 Hz
    // this.vBlankDurationMs = 1.087; // 1087 us
    this.nextVLineStartMs = 0; // immediately start rendering

    this.vLineRenderMs = utils.mCyclesToMs(114);

    this.warnedWideTiles = false;
  }

  handleLY(timeMs: number) {
    if (timeMs >= this.nextVLineStartMs) {
      let ly = this.memory.getLY();
      let newLY;
      if (ly > 153) {
        newLY = 0;
      } else {
        newLY = ly + 1;
      }

      if (newLY === this.memory.getLYC()) {
        this.memory.interruptCoincidence();
      } else {
        this.memory.interruptCoincidenceClear();
      }

      if (newLY === 144) {
        this.memory.interruptVBlank();
      }

      this.memory.setLY(newLY);
      this.nextVLineStartMs = timeMs + this.vLineRenderMs;
    }
  }

  getColorMapBgOrWindow() {
    return this.getColorMap(this.memory.getBGP());
  }

  getColorMapObject(obp0: boolean) {
    return this.getColorMap(obp0 ? this.memory.getOBP0() : this.memory.getOBP1());
  }

  private getColorMap(paletteByte: number): ColorMap {
    return [
      this.colorMap[(paletteByte >> 0) & 0b11],
      this.colorMap[(paletteByte >> 2) & 0b11],
      this.colorMap[(paletteByte >> 4) & 0b11],
      this.colorMap[(paletteByte >> 6) & 0b11],
    ];
  }

  getTileDataStart(): number {
    const lcdc = this.memory.getLCDC();
    if (utils.getBit(lcdc, 4)) {
      return 0x8000;
    } else {
      // 0x8800 addressing uses 0x9000 as its base
      return 0x9000;
    }
  }

  getTileColRow(address: number): [number, number] {
    const lcdc = this.memory.getLCDC();
    if (!utils.getBit(lcdc, 4)) {
      // In 0x8800 addressing mode, the tile pointer is 2s complement. It's
      // also centered around 0x9000 instead of the default 0x8000. So
      // offset the tile pointer by the tiles that need to be skipped:
      // the first 0x1000 bytes with 16 bytes per tile.
      address = utils.twosComplementToNumber(address);
      address += 0x1000 / 16;
    }

    let row = Math.floor(address / 16);
    let col = address % 16;
    return [col, row];
  }

  private getTile(address: number) {
    const lcdc = this.memory.getLCDC();
    const tileDataStart = this.getTileDataStart();

    if (!this.warnedWideTiles && utils.getBit(lcdc, 2)) {
      console.warn("This uses wide tiles which are not implemented.");
      this.warnedWideTiles = true;
    }

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
    scy: number,
    attrFlipX: boolean,
    attrFlipY: boolean,
    isObject: boolean,
    objectOverlapped: boolean,
  ) {
    for (let byte = 0; byte < 16; byte += 2) {
      // lsb is first
      const lsb = this.memory.getByte(tileStart + byte);
      const msb = this.memory.getByte(tileStart + byte + 1);

      for (let bit = 7; bit >= 0; bit--) {
        const colorGB = (utils.getBit(msb, bit) << 1) | utils.getBit(lsb, bit);
        const color = colorMap[colorGB];

        // Skip color 0 for objects, it's transparent.
        if (isObject && colorGB === 0) {
          continue;
        }

        let tileX = Math.abs(bit - 7);
        if (attrFlipX) {
          tileX = 7 - tileX;
        }
        let tileY = byte / 2;
        if (attrFlipY) {
          tileY = 7 - tileY;
        }

        let colorCoordX = this.wrapToScreenCoords(x - scx + tileX);
        let colorCoordY = this.wrapToScreenCoords(y - scy + tileY);
        const dataOffset = (colorCoordY * image.width + colorCoordX) * 4;

        // The object is overlapped by background colors 1-3.
        if (objectOverlapped) {
          const bgColorMap = this.getColorMapBgOrWindow();
          const bgColor = image.data.slice(dataOffset, dataOffset + 4);
          let bgColorShouldOverlap = false;

          for (let i = 1; i <= 3; ++i) {
            const colorMapColor = bgColorMap[i];
            if (
              bgColor[0] === colorMapColor[0] &&
              bgColor[1] === colorMapColor[1] &&
              bgColor[2] === colorMapColor[2]
            )
              bgColorShouldOverlap = true;
          }

          if (bgColorShouldOverlap) {
            break;
          }
        }

        for (let i = 0; i < 4; i++) {
          image.data[dataOffset + i] = color[i];
        }
      }
    }
  }

  private getTileMapStart(background: boolean): number {
    const lcdc = this.memory.getLCDC();
    if ((background && utils.getBit(lcdc, 3)) || (!background && utils.getBit(lcdc, 6))) {
      return 0x9c00;
    } else {
      return 0x9800;
    }
  }

  getTilePointer(row: number, col: number, background: boolean): number {
    const tileMapStart = this.getTileMapStart(background);
    return this.memory.getByte(tileMapStart + row * 32 + col);
  }

  private renderBackgroundOrWindow(image: ImageData, background: boolean) {
    if (!background && !utils.getBit(this.memory.getLCDC(), 5)) {
      return;
    }

    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) {
        let scrollX, scrollY;
        if (background) {
          scrollX = this.memory.getSCX();
          scrollY = this.memory.getSCY();
        } else {
          scrollX = this.memory.getWX() - 7;
          scrollY = this.memory.getWY();
        }

        let tilePointer = this.getTilePointer(row, col, background);
        this.renderTile(
          image,
          this.getColorMapBgOrWindow(),
          this.getTile(tilePointer),
          col * 8,
          row * 8,
          scrollX,
          scrollY,
          false,
          false,
          !"not object",
          false,
        );
      }
    }
  }

  private renderObjects(image: ImageData) {
    for (let spriteAddress = 0xfe00; spriteAddress < 0xfe9f; spriteAddress += 4) {
      const y = this.wrapToScreenCoords(this.memory.getByte(spriteAddress) - 16);
      const x = this.wrapToScreenCoords(this.memory.getByte(spriteAddress + 1) - 8);
      const tileIndex = this.memory.getByte(spriteAddress + 2);

      const attrs = this.memory.getByte(spriteAddress + 3);
      const paletteOBP0 = !Boolean(utils.getBit(attrs, 4));
      const flipX = Boolean(utils.getBit(attrs, 5));
      const flipY = Boolean(utils.getBit(attrs, 6));
      const objectOverlapped = Boolean(utils.getBit(attrs, 7));

      // TODO support 8x16 tiles
      this.renderTile(
        image,
        this.getColorMapObject(paletteOBP0),
        0x8000 + tileIndex * 16,
        x,
        y,
        0,
        0,
        flipX,
        flipY,
        !!"object",
        objectOverlapped,
      );
    }
  }

  private getBorderColor(): RGBA {
    const rgbString = window.getComputedStyle(document.body).getPropertyValue("--color-red");
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
    if (utils.getBit(this.memory.getLCDC(), 0)) {
      this.renderBackgroundOrWindow(image, !!"background");
      this.renderBackgroundOrWindow(image, !"window");
    }

    if (utils.getBit(this.memory.getLCDC(), 1)) {
      this.renderObjects(image);
    }

    this.renderPhysicalScreenBorder(image);

    if (utils.getBit(this.memory.getLCDC(), 2)) {
      console.error("8x16 sprites are currently unsupported!");
    }

    this.ctx.putImageData(image, 0, 0);
  }
}
