import { Loader } from "./loader.js";
import { Emulator } from "./emu.js";
import { BOOTROM } from "./roms.js";

function setBreakpoint(emu: Emulator) {
  const breakpoint = document.getElementById("breakpoint")!;
  const val = (breakpoint as HTMLInputElement).value;
  emu.setBreakpoint(parseInt(val, 16));
}

function runEmulator(bytes: Uint8Array) {
  const emu = new Emulator(bytes);

  setBreakpoint(emu);
  const breakpoint = document.getElementById("breakpoint")!;
  breakpoint.addEventListener("change", () => setBreakpoint(emu));

  const next = document.getElementById("next")!;
  next.addEventListener("click", () => emu.run());

  const pause = document.getElementById("pause")!;
  pause.addEventListener("click", () => (emu.paused = true));

  emu.run();
}

const loader = new Loader();
loader.readFile.then(runEmulator);

const bootromButton = document.getElementById("loadBootrom")!;
bootromButton.addEventListener("click", () => runEmulator(BOOTROM));
