import * as utils from "./utils.js";
import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Video } from "./video.js";
import { Controller } from "./controller.js";

export class Emulator {
  cpu: CPU;
  memory: Memory;
  private video: Video;

  // run loop related
  private runBudgetMs: number;

  // debugger related
  paused: boolean;
  breakpoint: number | undefined;
  breakpointBank: number | undefined;

  constructor(controller: Controller, bytes: Uint8Array) {
    this.memory = new Memory(bytes, controller);
    this.cpu = new CPU();
    this.cpu.setController(controller);

    this.video = new Video(
      this.memory,
      document.getElementById("video")! as HTMLCanvasElement
    );

    this.paused = false;

    this.runBudgetMs = (1 / 60) * 1_000;
  }

  setBreakpoint(addr: number | undefined) {
    this.breakpoint = addr;
  }

  setBreakpointBank(bank: number | undefined) {
    this.breakpointBank = bank;
  }

  private renderVideo() {
    // LCD enable
    if (utils.getBit(this.memory.getLCDC(), 7)) {
      this.video.render();
    }
  }

  togglePause() {
    this.paused = !this.paused;
    if (!this.paused) {
      this.run();
    }
  }

  run() {
    const endMs = performance.now() + this.runBudgetMs;
    let elapsedMs = 0;

    const startMs = performance.now();

    let i = 0;
    while (startMs + elapsedMs < endMs) {
      elapsedMs += utils.tCyclesToMs(this.cpu.tick(this.memory));
      this.video.handleLY(startMs + elapsedMs);

      // if paused it means we're stepping over single instructions
      if (this.paused) {
        return;
      }

      if (
        this.breakpoint !== undefined &&
        this.breakpoint === this.cpu.PC &&
        (this.breakpointBank === undefined ||
          this.breakpointBank === this.memory.bank)
      ) {
        this.paused = true;
        return;
      }

      ++i;
    }

    this.renderVideo();

    if (!this.paused) {
      // console.log(`${i} instructions in run, scheduling next one in ${endMs - performance.now()} ms`);
      setTimeout(() => this.run(), endMs - performance.now());
    }
  }
}
