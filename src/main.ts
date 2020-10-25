import { Loader } from "./loader.js";
import { Emulator } from "./emu.js";
import { BOOTROM } from "./roms.js";

declare global {
  interface Window {
    emu: Emulator;
  }
}

function setBreakpoint(emu: Emulator) {
  const breakpoint = document.getElementById("breakpoint")!;
  const val = (breakpoint as HTMLInputElement).value;
  emu.setBreakpoint(parseInt(val, 16));
}

function selectElementText(el: HTMLElement) {
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

function runEmulator(bytes: Uint8Array) {
  const emu = new Emulator(bytes);
  window.emu = emu;

  setBreakpoint(emu);
  const breakpoint = document.getElementById("breakpoint")!;
  breakpoint.addEventListener("change", () => setBreakpoint(emu));

  const next = document.getElementById("next")!;
  next.addEventListener("click", () => emu.run());

  const pause = document.getElementById("pause")!;
  pause.addEventListener("click", () => {
    emu.paused = !emu.paused;
    if (!emu.paused) {
      emu.run();
    }
  });

  const copy = document.getElementById("copy")!;
  copy.addEventListener("click", () => {
    selectElementText(document.getElementById("memory")!);
    document.execCommand("copy");
  });

  emu.run();
}

const loader = new Loader();
loader.readFile.then((rom) => {
  const fullRom = new Uint8Array(BOOTROM.length + rom.length);
  fullRom.set(BOOTROM, 0);
  fullRom.set(rom, BOOTROM.length);
  runEmulator(fullRom);
});

const bootromButton = document.getElementById("loadBootrom")!;
bootromButton.addEventListener("click", () => runEmulator(BOOTROM));
