import * as utils from "./utils.js";
import { Loader } from "./loader.js";
import { Emulator } from "./emu.js";
import { Controller } from "./controller.js";

new Controller();

function setBreakpoint(emu: Emulator) {
  const breakpoint = document.getElementById("breakpoint")!;
  const val = (breakpoint as HTMLInputElement).value;
  emu.setBreakpoint(parseInt(val, 16));
}

function _runEmulator(bytes: Uint8Array) {
  // const emu = new Emulator(bytes);
  // window.emu = emu;
  // setBreakpoint(emu);
  // const breakpoint = document.getElementById("breakpoint")!;
  // breakpoint.addEventListener("change", () => setBreakpoint(emu));
  // const next = document.getElementById("next")!;
  // next.addEventListener("click", () => emu.run());
  // const copy = document.getElementById("copy")!;
  // copy.addEventListener("click", () => {
  //   selectElementText(document.getElementById("memory")!);
  //   document.execCommand("copy");
  // });
  // emu.run();
}
